"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import AlbumCard from "../components/AlbumCard";
import DiscoverFiltersModal, {
  DiscoverFilters,
  EMPTY_FILTERS,
} from "../components/DiscoverFiltersModal";

type DiscoverAlbum = {
  album_id: string;
  title: string;
  cover_url: string | null;
  release_year: number | null;
  genres: string[] | null;
  artist_name: string;
  total_plays: number;
  distinct_listeners: number;
};

export default function DiscoverPage() {
  const [albums, setAlbums] = useState<DiscoverAlbum[]>([]);
  const [listenedIds, setListenedIds] = useState<string[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [fadeListened, setFadeListened] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.genre) params.set("genre", filters.genre);
    if (filters.yearMin) params.set("yearMin", filters.yearMin);
    if (filters.yearMax) params.set("yearMax", filters.yearMax);
    if (filters.listened) params.set("listened", filters.listened);
    if (filters.rated) params.set("rated", filters.rated);
    if (filters.watchlist) params.set("watchlist", filters.watchlist);

    fetch(`/api/discover?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        setAlbums(json.albums ?? []);
        setListenedIds(json.listenedIds ?? []);
        setAvailableGenres(json.availableGenres ?? []);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("Erro ao carregar os álbuns em alta.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters]);

  const listenedSet = useMemo(() => new Set(listenedIds), [listenedIds]);
  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  return (
    <main className="pb-24">
      <PageHeader
        title="Populares da semana"
        action={
          <button
            onClick={() => setShowFilters(true)}
            className="relative flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        }
      />

      <div className="px-4">
        {error && (
          <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink-muted">
            {error}
          </p>
        )}

        {!loading && albums.length === 0 && !error && (
          <EmptyState
            title="Nada por aqui ainda"
            description={
              activeFilterCount > 0
                ? "Nenhum álbum em alta bate com esses filtros. Tenta afrouxar um pouco."
                : "Ninguém tocou nada nos últimos 7 dias — assim que rolar escuta, os álbuns em alta aparecem aqui."
            }
            tone="pink"
          />
        )}

        {loading && (
          <div className="grid grid-cols-3 gap-3 pt-1 sm:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && albums.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-1 sm:grid-cols-4">
            {albums.map((a) => {
              const isListened = listenedSet.has(a.album_id);
              return (
                <div
                  key={a.album_id}
                  className={
                    fadeListened && isListened ? "opacity-40 transition-opacity" : "transition-opacity"
                  }
                >
                  <AlbumCard
                    href={`/album/${a.album_id}`}
                    title={a.title}
                    subtitle={a.artist_name}
                    coverUrl={a.cover_url}
                    accent="teal"
                    badges={
                      isListened
                        ? [{ color: "teal", label: "Ouvido", corner: "tl" }]
                        : []
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DiscoverFiltersModal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onChange={setFilters}
        availableGenres={availableGenres}
        fadeListened={fadeListened}
        onToggleFadeListened={setFadeListened}
      />
    </main>
  );
}
