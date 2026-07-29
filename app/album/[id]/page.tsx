"use client";

import { useEffect, useState, use as usePromise } from "react";
import Image from "next/image";
import Link from "next/link";

type Track = {
  id: string | null;
  title: string;
  durationSeconds: number | null;
  trackNumber: number;
  discNumber: number;
  playCount: number;
};

type AlbumData = {
  album: {
    title: string;
    artistName: string;
    artistId: string;
    coverUrl: string;
    year: string | null;
    genres: string[];
    totalSeconds: number;
  };
  description: { text: string; wikipediaUrl: string } | null;
  tracks: Track[];
  isLoggedIn: boolean;
};

function formatTrackDuration(totalSeconds: number | null) {
  if (!totalSeconds) return "--:--";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const [data, setData] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/album/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch(() => setError("Erro ao carregar álbum."))
      .finally(() => setLoading(false));
  }, [id]);

  async function changePlayCount(track: Track, action: "increment" | "decrement") {
    if (!track.id || !data) return;

    if (!data.isLoggedIn) {
      setError("Você precisa estar logado pra marcar faixas.");
      return;
    }

    const delta = action === "increment" ? 1 : -1;
    setBusyTrackId(track.id);

    // Atualização otimista.
    setData({
      ...data,
      tracks: data.tracks.map((t) =>
        t.id === track.id
          ? { ...t, playCount: Math.max(0, t.playCount + delta) }
          : t
      ),
    });

    try {
      const res = await fetch("/api/track-listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, action }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();

      // Confirma com o valor real que veio do servidor.
      setData((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.id === track.id ? { ...t, playCount: json.playCount } : t
              ),
            }
          : prev
      );
    } catch {
      // reverte
      setData((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.id === track.id
                  ? { ...t, playCount: Math.max(0, t.playCount - delta) }
                  : t
              ),
            }
          : prev
      );
      setError("Erro ao salvar. Tenta de novo.");
    } finally {
      setBusyTrackId(null);
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Carregando álbum...</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">{error}</p>
        <Link href="/" className="text-paper-muted text-sm underline mt-4 inline-block">
          Voltar pra busca
        </Link>
      </main>
    );
  }

  if (!data) return null;

  const heardCount = data.tracks.filter((t) => t.playCount > 0).length;
  const heardSeconds = data.tracks.reduce(
    (sum, t) => sum + (t.durationSeconds ?? 0) * t.playCount,
    0
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Voltar
      </Link>

      <div className="flex gap-5 mt-4 mb-6">
        <div className="relative w-32 h-32 shrink-0 rounded-lg overflow-hidden bg-chassis">
          <Image
            src={data.album.coverUrl}
            alt={data.album.title}
            fill
            sizes="128px"
            className="object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display italic text-2xl text-paper leading-tight">
            {data.album.title}
          </h1>
          <p className="text-paper-muted mt-1">
            {data.album.artistId ? (
              <Link
                href={`/artist/${data.album.artistId}`}
                className="hover:text-amber hover:underline"
              >
                {data.album.artistName}
              </Link>
            ) : (
              data.album.artistName
            )}{" "}
            {data.album.year ? `· ${data.album.year}` : ""}
          </p>
          {data.album.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.album.genres.map((g) => (
                <span
                  key={g}
                  className="text-xs bg-panel-raised border border-amber-dim/30 rounded-full px-2 py-0.5 text-amber/90"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.description && (
        <p className="text-sm text-paper-muted leading-relaxed mb-6 bg-panel border border-white/5 rounded-lg p-4">
          {data.description.text}{" "}
          {data.description.wikipediaUrl && (
            <a
              href={data.description.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-amber/80 hover:text-amber"
            >
              Ver na Wikipédia
            </a>
          )}
        </p>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-paper-muted font-counter">
          {heardCount}/{data.tracks.length} faixas ouvidas
          {heardSeconds > 0 && ` · ${formatTrackDuration(heardSeconds)}`}
        </p>
      </div>

      {error && (
        <p className="text-sm mb-4 text-paper-muted bg-panel border border-white/5 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <ul className="space-y-1">
        {data.tracks.map((track) => (
          <li
            key={`${track.discNumber}-${track.trackNumber}`}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-panel transition-colors"
          >
            <span className="text-paper-muted text-sm w-5 shrink-0 tabular-nums font-counter">
              {track.trackNumber}
            </span>
            <span
              className={`flex-1 min-w-0 truncate ${
                track.playCount > 0 ? "text-paper" : "text-paper/80"
              }`}
            >
              {track.title}
            </span>
            <span className="text-paper-muted text-sm shrink-0 tabular-nums font-counter">
              {formatTrackDuration(track.durationSeconds)}
            </span>

            {/* Controle de escuta: botão simples quando nunca ouvida,
                contador + ações quando já tem pelo menos 1 escuta. */}
            {track.playCount === 0 ? (
              <button
                onClick={() => changePlayCount(track, "increment")}
                disabled={busyTrackId === track.id || !track.id}
                className="shrink-0 text-sm bg-panel-raised border border-amber-dim/30 hover:border-amber-dim hover:text-amber transition-colors rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                Já ouvi
              </button>
            ) : (
              <div className="shrink-0 flex items-center gap-1">
                <button
                  onClick={() => changePlayCount(track, "decrement")}
                  disabled={busyTrackId === track.id}
                  title="Desfazer uma escuta"
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-white/10 text-paper-muted hover:text-paper hover:border-white/20 transition-colors disabled:opacity-50"
                >
                  −
                </button>
                <span className="font-counter text-amber text-sm w-8 text-center tabular-nums">
                  {track.playCount}×
                </span>
                <button
                  onClick={() => changePlayCount(track, "increment")}
                  disabled={busyTrackId === track.id}
                  title="Ouvi de novo"
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-amber-dim/40 text-amber hover:border-amber-dim transition-colors disabled:opacity-50"
                >
                  +
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
