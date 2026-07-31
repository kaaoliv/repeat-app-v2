"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import AlbumCover from "@/app/components/AlbumCover";
import PageHeader from "@/app/components/PageHeader";
import EmptyState from "@/app/components/EmptyState";

type ListData = {
  list: {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    list_items: {
      album_id: string;
      albums: {
        id: string;
        title: string;
        cover_url: string | null;
        musicbrainz_id: string;
        artists: { name: string } | null;
      };
    }[];
  };
  isOwner: boolean;
};

export default function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/lists/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Erro ao carregar lista."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function removeAlbum(albumId: string) {
    if (!data) return;
    setData({
      ...data,
      list: {
        ...data.list,
        list_items: data.list.list_items.filter((i) => i.album_id !== albumId),
      },
    });
    await fetch(`/api/lists/${id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId }),
    });
  }

  if (loading) {
    return (
      <main className="px-4 pt-9">
        <p className="text-ink-muted">Carregando...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="px-4 pt-9">
        <p className="text-ink-muted">{error ?? "Lista não encontrada."}</p>
      </main>
    );
  }

  return (
    <main className="pb-8">
      <PageHeader
        title={data.list.name}
        subtitle={data.list.description ?? undefined}
        backHref="/lists"
      />

      <div className="px-4">
        {data.list.list_items.length === 0 ? (
          <EmptyState
            title="Lista vazia"
            description="Adiciona álbuns pela tela de álbum, usando o botão '+ Lista'."
            cta={{ label: "Buscar álbuns", href: "/" }}
            tone="pink"
          />
        ) : (
          <ul className="space-y-2">
            {data.list.list_items.map((item) => (
              <li
                key={item.album_id}
                className="flex items-center gap-4 bg-surface border border-line rounded-xl p-3"
              >
                <Link
                  href={`/album/${item.albums.musicbrainz_id}`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <AlbumCover
                    src={item.albums.cover_url}
                    alt={item.albums.title}
                    className="w-14 h-14 shrink-0 rounded-lg"
                    sizes="56px"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{item.albums.title}</p>
                    <p className="text-sm text-ink-muted truncate">
                      {item.albums.artists?.name}
                    </p>
                  </div>
                </Link>
                {data.isOwner && (
                  <button
                    onClick={() => removeAlbum(item.album_id)}
                    className="text-ink-faint hover:text-coral text-sm shrink-0 px-2 transition-colors"
                    title="Remover da lista"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
