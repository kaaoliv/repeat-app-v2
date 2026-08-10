"use client";

import { useEffect, useState } from "react";
import AlbumCarousel, { type CarouselItem } from "./components/AlbumCarousel";

export default function HomePage() {
  const [friendsListened, setFriendsListened] = useState<CarouselItem[]>([]);
  const [trending, setTrending] = useState<CarouselItem[]>([]);
  const [newReleases, setNewReleases] = useState<CarouselItem[]>([]);
  const [popularWeek, setPopularWeek] = useState<CarouselItem[]>([]);
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

    fetch("/api/discover")
      .then((res) => res.json())
      .then((data) => {
        setPopularWeek(
          (data.albums ?? []).slice(0, 15).map((a: any) => ({
            href: `/album/${a.album_id}`,
            title: a.title,
            subtitle: a.artist_name,
            coverUrl: a.cover_url,
            badge: {
              color: "gold" as const,
              label: `${a.total_plays}x essa semana`,
              corner: "tl" as const,
            },
          }))
        );
      })
      .catch(() => {});
  }, []);

  const hasAnyContent =
    friendsListened.length > 0 ||
    trending.length > 0 ||
    newReleases.length > 0 ||
    popularWeek.length > 0;

  return (
    <main className="pb-4">
      <header className="px-4 pb-5 pt-9">
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

      {!feedLoading && (
        <div>
          <AlbumCarousel title="Amigos ouviram" emoji="👥" items={friendsListened} accent="pink" />
          <AlbumCarousel
            title="Populares da semana"
            emoji="📈"
            items={popularWeek}
            accent="gold"
            seeAllHref="/discover"
          />
          <AlbumCarousel title="Em alta" emoji="🔥" items={trending} accent="coral" />
          <AlbumCarousel title="Últimos lançamentos" emoji="✨" items={newReleases} accent="teal" />
        </div>
      )}

      {feedLoading && (
        <div className="px-4 pt-2">
          <div className="mb-3 h-5 w-40 animate-pulse rounded bg-surface" />
          <div className="flex gap-3.5 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square w-32 shrink-0 animate-pulse rounded-xl bg-surface sm:w-36" />
            ))}
          </div>
        </div>
      )}

      {!feedLoading && !hasAnyContent && (
        <div className="animate-fade-in flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-5 text-primary">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="12" cy="12" r="9.2" />
              <circle cx="12" cy="12" r="5.5" className="opacity-40" />
              <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-bold text-ink">
            Comece a contar seu tempo
          </h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">
            Busca um álbum na aba Buscar e marca as faixas que você já ouviu.
            Cada repetição soma no seu extrato de vida em música.
          </p>
        </div>
      )}
    </main>
  );
}
