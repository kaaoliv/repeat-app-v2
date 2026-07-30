"use client";

import { useEffect, useState, use as usePromise } from "react";
import Image from "next/image";
import Link from "next/link";

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
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Carregando...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">{error ?? "Lista não encontrada."}</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/lists" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Minhas listas
      </Link>
      <h1 className="font-display italic text-3xl text-paper mt-4">{data.list.name}</h1>
      {data.list.description && (
        <p className="text-paper-muted mt-1">{data.list.description}</p>
      )}

      <ul className="space-y-2 mt-6">
        {data.list.list_items.map((item) => (
          <li
            key={item.album_id}
            className="flex items-center gap-4 bg-panel border border-white/5 rounded-lg p-3"
          >
            <Link
              href={`/album/${item.albums.musicbrainz_id}`}
              className="flex items-center gap-4 flex-1 min-w-0"
            >
              <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden bg-chassis">
                {item.albums.cover_url && (
                  <Image
                    src={item.albums.cover_url}
                    alt={item.albums.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-paper truncate">{item.albums.title}</p>
                <p className="text-sm text-paper-muted truncate">
                  {item.albums.artists?.name}
                </p>
              </div>
            </Link>
            {data.isOwner && (
              <button
                onClick={() => removeAlbum(item.album_id)}
                className="text-paper-muted hover:text-paper text-sm shrink-0 px-2"
                title="Remover da lista"
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {data.list.list_items.length === 0 && (
          <p className="text-paper-muted text-sm">
            Lista vazia. Adiciona álbuns pela tela de álbum.
          </p>
        )}
      </ul>
    </main>
  );
}
