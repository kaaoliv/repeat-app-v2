"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MBRelease, MBArtist } from "@/lib/musicbrainz";

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, "0")}`;
  return `${minutes} min`;
}

function formatTrackDuration(totalSeconds: number | null) {
  if (!totalSeconds) return null;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MBRelease[]>([]);
  const [artists, setArtists] = useState<MBArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fetchingDurations = useRef(new Set<string>());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/search-albums?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const items: MBRelease[] = data.results ?? [];
      setResults(items);
      setArtists(data.artists ?? []);

      // Álbuns que já vieram sem duração (não estavam no nosso cache)
      // buscam a duração em segundo plano, um de cada vez, sem travar a
      // lista — a MusicBrainz pede no máx. ~1 requisição/segundo.
      const missing = items.filter((r) => !r.durationSeconds);
      fetchDurationsSequentially(missing.map((r) => r.id));
    } catch {
      setFeedback("Erro ao buscar. Tenta de novo.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDurationsSequentially(ids: string[]) {
    for (const id of ids) {
      if (fetchingDurations.current.has(id)) continue;
      fetchingDurations.current.add(id);

      try {
        const res = await fetch(`/api/album-duration?id=${id}`);
        const data = await res.json();
        if (data.durationSeconds) {
          setResults((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, durationSeconds: data.durationSeconds } : r
            )
          );
        }
      } catch {
        // silencioso — a duração simplesmente não aparece pra esse item
      }

      // pequeno intervalo entre chamadas pra respeitar o rate limit da MusicBrainz
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  async function handleMarkAsHeard(album: MBRelease) {
    setLoggingId(album.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/log-listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          musicbrainzReleaseGroupId: album.id,
          title: album.title,
          artistName: album.artistName,
          artistMusicbrainzId: album.artistId,
          coverUrl: album.coverUrl,
          year: album.year,
        }),
      });

      if (res.status === 401) {
        setFeedback("Você precisa estar logado pra marcar como ouvido.");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error ?? "Erro ao marcar como ouvido.");
        return;
      }

      setFeedback(`"${album.title}" marcado como ouvido!`);
      router.refresh();
    } finally {
      setLoggingId(null);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="font-display italic text-4xl text-paper tracking-tight">Repeat</h1>
        <p className="text-paper-muted mt-2">
          Quanto tempo da sua vida você já gastou ouvindo música?
        </p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca um álbum, artista ou música..."
          className="flex-1 bg-panel border border-white/5 rounded-lg px-4 py-2.5 outline-none focus:border-amber-dim/60 transition-colors text-paper placeholder:text-paper-muted/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-amber text-chassis rounded-lg px-5 py-2.5 font-medium disabled:opacity-50 hover:brightness-110 transition-[filter]"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {feedback && (
        <p className="text-sm mb-6 text-paper-muted bg-panel border border-white/5 rounded-lg px-4 py-2">
          {feedback}
        </p>
      )}

      {artists.length > 0 && (
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          {artists.map((artist) => (
            <Link
              key={artist.id}
              href={`/artist/${artist.id}`}
              className="shrink-0 flex items-center gap-2 bg-panel border border-amber-dim/30 rounded-full pl-1.5 pr-4 py-1.5 hover:border-amber-dim transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-panel-raised flex items-center justify-center text-amber text-xs font-display italic">
                {artist.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm text-paper">{artist.name}</span>
            </Link>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {results.map((album) => (
          <li
            key={album.id}
            className="flex items-center gap-4 bg-panel border border-white/5 rounded-lg p-3"
          >
            <div
              onClick={() => router.push(`/album/${album.id}`)}
              className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
            >
              <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden bg-chassis">
                <Image
                  src={album.coverUrl ?? "/placeholder-cover.png"}
                  alt={album.title}
                  fill
                  sizes="56px"
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-paper truncate">{album.title}</p>
                <p className="text-sm text-paper-muted truncate">
                  {album.artistId ? (
                    <Link
                      href={`/artist/${album.artistId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-amber hover:underline"
                    >
                      {album.artistName}
                    </Link>
                  ) : (
                    album.artistName
                  )}{" "}
                  {album.year ? `· ${album.year}` : ""}
                </p>
                {album.matchedTrack && (
                  <p className="text-xs text-paper-muted/70 truncate mt-0.5">
                    🎵 {album.matchedTrack.title}
                    {album.matchedTrack.durationSeconds
                      ? ` · ${formatTrackDuration(album.matchedTrack.durationSeconds)}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {formatDuration(album.durationSeconds) && (
                <span className="text-xs text-paper-muted font-counter">
                  {formatDuration(album.durationSeconds)}
                </span>
              )}
              <button
                onClick={() => handleMarkAsHeard(album)}
                disabled={loggingId === album.id}
                className="text-sm bg-panel-raised border border-amber-dim/30 hover:border-amber-dim hover:text-amber transition-colors rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {loggingId === album.id ? "..." : "Já ouvi"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
