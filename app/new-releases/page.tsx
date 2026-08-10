"use client";

import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import AlbumCard from "../components/AlbumCard";

type Release = {
  id: string;
  title: string;
  year: string | null;
  coverUrl: string;
  primaryType: string | null;
  artistName: string;
};

export default function NewReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/new-releases")
      .then((res) => res.json())
      .then((json) => setReleases(json.releases ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="pb-24">
      <PageHeader title="Últimos lançamentos" />
      <div className="px-4">
        {loading && (
          <div className="grid grid-cols-3 gap-3 pt-1 sm:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && releases.length === 0 && (
          <EmptyState
            title="Nada por aqui"
            description="Não achamos lançamentos recentes agora. Tenta de novo daqui a pouco."
            tone="teal"
          />
        )}

        {!loading && releases.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-1 sm:grid-cols-4">
            {releases.map((r) => (
              <AlbumCard
                key={r.id}
                href={`/album/${r.id}`}
                title={r.title}
                subtitle={r.artistName}
                coverUrl={r.coverUrl}
                accent="teal"
                badges={r.year ? [{ color: "teal", label: r.year, corner: "tl" }] : []}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
