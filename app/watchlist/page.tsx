import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Faça login pra ver sua lista.</p>
      </main>
    );
  }

  const { data } = await supabase
    .from("watchlist")
    .select("added_at, albums(id, title, cover_url, musicbrainz_id, artists(name))")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  const items = data ?? [];

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/profile" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Perfil
      </Link>
      <h1 className="font-display italic text-3xl text-paper mt-4 mb-6">Quero ouvir</h1>

      <ul className="space-y-2">
        {items.map((item: any, i: number) => {
          const album = item.albums;
          if (!album) return null;
          return (
            <li key={i}>
              <Link
                href={`/album/${album.musicbrainz_id}`}
                className="flex items-center gap-4 bg-panel border border-white/5 rounded-lg p-3 hover:border-amber-dim/30 transition-colors"
              >
                <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden bg-chassis">
                  {album.cover_url && (
                    <Image
                      src={album.cover_url}
                      alt={album.title}
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
                  <p className="font-medium text-paper truncate">{album.title}</p>
                  <p className="text-sm text-paper-muted truncate">
                    {album.artists?.name}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
        {items.length === 0 && (
          <p className="text-paper-muted text-sm">
            Nada por aqui ainda. Marca álbuns com a estrela ☆ na tela de álbum.
          </p>
        )}
      </ul>
    </main>
  );
}
