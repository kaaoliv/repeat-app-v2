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
  heard: boolean;
};

type AlbumData = {
  album: {
    title: string;
    artistName: string;
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
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  async function toggleTrack(track: Track) {
    if (!track.id || !data) return;

    if (!data.isLoggedIn) {
      setError("Você precisa estar logado pra marcar faixas.");
      return;
    }

    const newHeard = !track.heard;
    setTogglingId(track.id);

    // Atualização otimista — muda a tela na hora, sem esperar a resposta.
    setData({
      ...data,
      tracks: data.tracks.map((t) =>
        t.id === track.id ? { ...t, heard: newHeard } : t
      ),
    });

    try {
      const res = await fetch("/api/track-listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, heard: newHeard }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // reverte se der erro
      setData((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.id === track.id ? { ...t, heard: !newHeard } : t
              ),
            }
          : prev
      );
      setError("Erro ao salvar. Tenta de novo.");
    } finally {
      setTogglingId(null);
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

  const heardCount = data.tracks.filter((t) => t.heard).length;
  const heardSeconds = data.tracks
    .filter((t) => t.heard)
    .reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0);

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
            {data.album.artistName} {data.album.year ? `· ${data.album.year}` : ""}
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
          <li key={`${track.discNumber}-${track.trackNumber}`}>
            <button
              onClick={() => toggleTrack(track)}
              disabled={togglingId === track.id || !track.id}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-panel transition-colors text-left disabled:opacity-50"
            >
              <span
                className={`w-5 h-5 rounded-sm shrink-0 border flex items-center justify-center transition-colors ${
                  track.heard
                    ? "bg-amber border-amber"
                    : "border-white/15"
                }`}
              >
                {track.heard && (
                  <span className="text-chassis text-xs font-bold">✓</span>
                )}
              </span>
              <span className="text-paper-muted text-sm w-5 shrink-0 tabular-nums font-counter">
                {track.trackNumber}
              </span>
              <span className={`flex-1 min-w-0 truncate ${track.heard ? "text-paper" : "text-paper/80"}`}>
                {track.title}
              </span>
              <span className="text-paper-muted text-sm shrink-0 tabular-nums font-counter">
                {formatTrackDuration(track.durationSeconds)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
