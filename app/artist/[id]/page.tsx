"use client";

import { useEffect, useState, use as usePromise } from "react";
import Image from "next/image";
import Link from "next/link";

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

export default function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Carregando artista...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">{error ?? "Artista não encontrado."}</p>
        <Link href="/" className="text-paper-muted text-sm underline mt-4 inline-block">
          Voltar pra busca
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Voltar
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-2">
        {data.description?.imageUrl && (
          <div className="relative w-20 h-20 shrink-0 rounded-full overflow-hidden bg-panel border border-white/5">
            <Image
              src={data.description.imageUrl}
              alt={data.artist.name}
              fill
              sizes="80px"
              className="object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
        <h1 className="font-display italic text-3xl text-paper">
          {data.artist.name}
        </h1>
      </div>

      {data.description?.text && (
        <p className="text-sm text-paper-muted leading-relaxed mb-8 bg-panel border border-white/5 rounded-lg p-4">
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

      <h2 className="text-sm uppercase tracking-[0.15em] text-paper-muted mb-4">
        Álbuns
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {data.albums.map((album) => (
          <Link
            key={album.id}
            href={`/album/${album.id}`}
            className="group"
          >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-chassis border border-white/5 mb-2">
              <Image
                src={album.coverUrl}
                alt={album.title}
                fill
                sizes="200px"
                className="object-cover group-hover:brightness-110 transition-[filter]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <p className="text-sm font-medium text-paper truncate">{album.title}</p>
            <p className="text-xs text-paper-muted font-counter">
              {album.year ?? "—"}
              {album.primaryType && album.primaryType !== "Album"
                ? ` · ${album.primaryType}`
                : ""}
            </p>
          </Link>
        ))}
        {data.albums.length === 0 && (
          <p className="text-paper-muted text-sm col-span-full">
            Não encontramos álbuns catalogados pra esse artista.
          </p>
        )}
      </div>
    </main>
  );
}
