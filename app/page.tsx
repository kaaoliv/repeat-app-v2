"use client";

import { useState } from "react";
import Image from "next/image";
import type { MBRelease } from "@/lib/musicbrainz";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MBRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/search-albums?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setFeedback("Erro ao buscar. Tenta de novo.");
    } finally {
      setLoading(false);
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
    } finally {
      setLoggingId(null);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Repeat</h1>
        <p className="text-accent/60 mt-1">
          Quanto tempo da sua vida você já gastou ouvindo música?
        </p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca um álbum ou artista..."
          className="flex-1 bg-surface border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-accent text-background rounded-lg px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {feedback && (
        <p className="text-sm mb-6 text-accent/80 bg-surface border border-white/10 rounded-lg px-4 py-2">
          {feedback}
        </p>
      )}

      <ul className="space-y-3">
        {results.map((album) => (
          <li
            key={album.id}
            className="flex items-center gap-4 bg-surface border border-white/10 rounded-lg p-3"
          >
            <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden bg-white/5">
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
              <p className="font-medium truncate">{album.title}</p>
              <p className="text-sm text-accent/60 truncate">
                {album.artistName} {album.year ? `· ${album.year}` : ""}
              </p>
            </div>
            <button
              onClick={() => handleMarkAsHeard(album)}
              disabled={loggingId === album.id}
              className="text-sm bg-white/10 hover:bg-white/20 transition-colors rounded-md px-3 py-1.5 shrink-0 disabled:opacity-50"
            >
              {loggingId === album.id ? "..." : "Já ouvi"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
