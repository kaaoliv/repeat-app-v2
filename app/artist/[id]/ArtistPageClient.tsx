"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AlbumCard from "@/app/components/AlbumCard";

type ArtistData = {
  artist: { id: string; name: string };
  description: { text: string; wikipediaUrl: string; imageUrl: string | null } | null;
  albums: {
    id: string;
    title: string;
    year: string | null;
    coverUrl: string;
    primaryType: string | null;
  }[];
};

const accents = ["primary", "blue", "coral", "teal", "pink", "gold"] as const;

export default function ArtistPageClient({ id }: { id: string }) {
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/artist/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Erro ao carregar artista."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="px-4 pt-9">
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-surface-2" />
          <div className="h-8 w-40 animate-pulse rounded bg-surface-2" />
        </div>
        <p className="mt-8 text-sm text-ink-muted">Carregando artista...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="px-4 pt-9">
        <p className="text-ink-muted">{error ?? "Artista não encontrado."}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary-soft underline">
          Voltar pra busca
        </Link>
      </main>
    );
  }

  const showPhoto = data.description?.imageUrl && !imgFailed;

  return (
    <main className="px-4 pt-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Voltar
      </Link>

      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/40">
          {showPhoto ? (
            <Image
              src={data.description!.imageUrl as string}
              alt={data.artist.name}
              fill
              sizes="96px"
              className="object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-blue font-display text-3xl font-extrabold text-white">
              {data.artist.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-balance font-display text-2xl font-extrabold leading-tight text-ink">
            {data.artist.name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {data.albums.length} {data.albums.length === 1 ? "álbum" : "álbuns"}
          </p>
        </div>
      </div>

      {data.description?.text && (
        <p className="mt-5 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-muted">
          {data.description.text}{" "}
          {data.description.wikipediaUrl && (
            <a
              href={data.description.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-soft underline hover:text-primary"
            >
              Ver na Wikipédia
            </a>
          )}
        </p>
      )}

      <h2 className="mb-3 mt-7 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Discografia
      </h2>

      {data.albums.length === 0 ? (
        <p className="px-1 text-sm text-ink-muted">
          Não encontramos álbuns catalogados pra esse artista.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
          {data.albums.map((album, i) => (
            <AlbumCard
              key={album.id}
              href={`/album/${album.id}`}
              title={album.title}
              subtitle={
                album.year
                  ? album.primaryType && album.primaryType !== "Album"
                    ? `${album.year} · ${album.primaryType}`
                    : album.year
                  : album.primaryType ?? undefined
              }
              coverUrl={album.coverUrl}
              accent={accents[i % accents.length]}
            />
          ))}
        </div>
      )}
    </main>
  );
}
