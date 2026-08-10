"use client";

import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import AlbumCard from "../components/AlbumCard";

type TopRatedAlbum = {
  albumId: string;
  title: string;
  coverUrl: string | null;
  artistName: string;
  avgRating: number;
  reviewCount: number;
};

export default function TopRatedPage() {
  const [albums, setAlbums] = useState<TopRatedAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [minReviews, setMinReviews] = useState(2);

  useEffect(() => {
    fetch("/api/top-rated")
      .then((res) => res.json())
      .then((json) => {
        setAlbums(json.albums ?? []);
        setMinReviews(json.minReviews ?? 2);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="pb-24">
      <PageHeader title="Mais bem avaliados" />
      <div className="px-4">
        {!loading && (
          <p className="mb-4 text-xs text-ink-faint">
            Considera álbuns com pelo menos {minReviews} avaliações.
          </p>
        )}

        {loading && (
          <div className="grid grid-cols-3 gap-3 pt-1 sm:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && albums.length === 0 && (
          <EmptyState
            title="Ainda não tem dados suficientes"
            description="Assim que mais gente avaliar álbuns, o ranking aparece aqui."
            tone="gold"
          />
        )}

        {!loading && albums.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-1 sm:grid-cols-4">
            {albums.map((a) => (
              <AlbumCard
                key={a.albumId}
                href={`/album/${a.albumId}`}
                title={a.title}
                subtitle={a.artistName}
                coverUrl={a.coverUrl}
                accent="gold"
                badges={[
                  {
                    color: "gold",
                    label: `★ ${a.avgRating.toFixed(1)}`,
                    corner: "tl",
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
