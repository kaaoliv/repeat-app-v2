import { createSupabaseServerClient } from "@/lib/supabase-server";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import AlbumCard from "../components/AlbumCard";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="px-4 pt-9">
        <p className="text-ink-muted">Faça login pra ver sua lista.</p>
      </main>
    );
  }

  const { data } = await supabase
    .from("watchlist")
    .select("added_at, albums(id, title, cover_url, musicbrainz_id, artists(name))")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  const items = (data ?? []).filter((item: any) => item.albums);

  return (
    <main className="pb-8">
      <PageHeader title="Quero ouvir" count={items.length || undefined} />
      <div className="px-4">
        {items.length === 0 ? (
          <EmptyState
            title="Nada salvo ainda"
            description="Marca álbuns com a estrela ☆ na tela do álbum pra guardar aqui."
            cta={{ label: "Buscar álbuns", href: "/" }}
            tone="gold"
          />
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
            {items.map((item: any, i: number) => {
              const album = item.albums;
              return (
                <li key={i}>
                  <AlbumCard
                    href={`/album/${album.musicbrainz_id}`}
                    title={album.title}
                    subtitle={album.artists?.name}
                    coverUrl={album.cover_url}
                    accent="gold"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
