"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MBRelease, MBArtist } from "@/lib/musicbrainz";
import AlbumCover from "./components/AlbumCover";
import AlbumCarousel, { type CarouselItem } from "./components/AlbumCarousel";
import { formatAlbumDuration, formatTrackDuration } from "@/lib/format";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MBRelease[]>([]);
  const [artists, setArtists] = useState<MBArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const fetchingDurations = useRef(new Set<string>());

  const [friendsListened, setFriendsListened] = useState<CarouselItem[]>([]);
  const [trending, setTrending] = useState<CarouselItem[]>([]);
  const [newReleases, setNewReleases] = useState<CarouselItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    fetch("/api/home-feed")
      .then((res) => res.json())
      .then((data) => {
        setFriendsListened(
          (data.friendsListened ?? []).map((a: any) => ({
            href: `/album/${a.musicbrainzId}`,
            title: a.title,
            subtitle: a.artistName,
            coverUrl: a.coverUrl,
            badge: { color: "pink" as const, label: a.friendName, corner: "tl" as const },
          }))
        );
        setTrending(
          (data.trending ?? []).map((a: any) => ({
            href: `/album/${a.musicbrainzId}`,
            title: a.title,
            subtitle: a.artistName,
            coverUrl: a.coverUrl,
            badge: {
              color: "coral" as const,
              label: `🔥 ${a.listeners}`,
              corner: "tl" as const,
            },
          }))
        );
        setNewReleases(
          (data.newReleases ?? []).map((a: any) => ({
            href: `/album/${a.musicbrainzId}`,
            title: a.title,
            subtitle: a.artistName,
            coverUrl: a.coverUrl,
            badge: a.year ? { color: "teal" as const, label: a.year, corner: "tl" as const } : undefined,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;

    setLoading(true);
    setSearched(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/search-albums?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const items: MBRelease[] = data.results ?? [];
      setResults(items);
      setArtists(data.artists ?? []);

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
        // silencioso
      }
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
      setLoggedIds((prev) => new Set(prev).add(album.id));
      router.refresh();
    } finally {
      setLoggingId(null);
    }
  }

  return (
    <main className="px-4">
      <header className="pb-5 pt-9">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" />
            </svg>
          </span>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Repeat
          </h1>
        </div>
        <p className="mt-2 text-pretty text-sm text-ink-muted">
          Seu diário de escuta. Faixa por faixa, com as repetições contando de
          verdade.
        </p>
      </header>

      <form onSubmit={handleSearch} className="relative mb-6">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca álbum, artista ou música..."
          className="w-full rounded-full border border-line bg-surface py-3 pl-11 pr-24 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "..." : "Buscar"}
        </button>
      </form>

      {feedback && (
        <p className="mb-5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink-muted">
          {feedback}
        </p>
      )}

      {!searched && !feedLoading && (
        <div className="-mx-4">
          <AlbumCarousel title="Amigos ouviram" emoji="👥" items={friendsListened} accent="pink" />
          <AlbumCarousel title="Em alta" emoji="🔥" items={trending} accent="coral" />
          <AlbumCarousel title="Últimos lançamentos" emoji="✨" items={newReleases} accent="teal" />
        </div>
      )}

      {/* Card de artista no topo dos resultados */}
      {artists.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Artistas
          </h2>
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${artist.id}`}
                className="flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 transition-colors hover:border-primary/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue font-display text-sm font-bold text-white">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-ink">{artist.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Grid de resultados como capas de LP */}
      {results.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Álbuns
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {results.map((album) => {
              const heard = loggedIds.has(album.id);
              const dur = formatAlbumDuration(album.durationSeconds);
              return (
                <li key={album.id} className="animate-fade-in">
                  <Link href={`/album/${album.id}`} className="group block">
                    <div className="relative">
                      <AlbumCover
                        src={album.coverUrl}
                        alt={album.title}
                        title={album.title}
                        sizes="(max-width: 640px) 45vw, 200px"
                        className="aspect-square w-full rounded-xl shadow-card ring-1 ring-line transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-[0.97]"
                      />
                      <div className="absolute -bottom-0.5 left-3 right-3 h-1 rounded-full bg-primary opacity-90" />
                      {dur && (
                        <span className="absolute right-2 top-2 rounded-full bg-bg/70 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-badge backdrop-blur-sm">
                          {dur}
                        </span>
                      )}
                      {heard && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-semibold text-bg shadow-badge">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 12 4.5 4.5L19 7" />
                          </svg>
                          Ouvido
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {album.title}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {album.artistName}
                        {album.year ? ` · ${album.year}` : ""}
                      </p>
                      {album.matchedTrack && (
                        <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                          {album.matchedTrack.title}
                          {album.matchedTrack.durationSeconds
                            ? ` · ${formatTrackDuration(album.matchedTrack.durationSeconds)}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleMarkAsHeard(album)}
                      disabled={loggingId === album.id || heard}
                      aria-label={`Marcar ${album.title} como ouvido`}
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
                        heard
                          ? "border-teal bg-teal/15 text-teal"
                          : "border-line bg-surface text-ink-muted hover:border-primary/50 hover:text-primary-soft"
                      }`}
                    >
                      {loggingId === album.id ? (
                        <span className="text-xs">...</span>
                      ) : heard ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12 4.5 4.5L19 7" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Estado vazio inicial e sem resultados */}
      {!loading && results.length === 0 && artists.length === 0 && (
        <div className="animate-fade-in flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-5 text-primary">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="12" cy="12" r="9.2" />
              <circle cx="12" cy="12" r="5.5" className="opacity-40" />
              <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-bold text-ink">
            {searched ? "Nada encontrado" : "Comece a contar seu tempo"}
          </h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">
            {searched
              ? "Tenta outro nome de álbum, artista ou música."
              : "Busque um álbum e marque as faixas que você já ouviu. Cada repetição soma no seu extrato de vida em música."}
          </p>
        </div>
      )}
    </main>
  );
}
