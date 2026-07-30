import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, "0")}`;
  return `${minutes} min`;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort = "recent" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Faça login pra ver sua biblioteca.</p>
      </main>
    );
  }

  const { data: listens } = await supabase
    .from("track_listens")
    .select(
      "play_count, listened_at, tracks(duration_seconds, album_id, albums(id, title, cover_url, musicbrainz_id, artists(name)))"
    )
    .eq("user_id", user.id);

  const byAlbum = new Map<
    string,
    {
      albumId: string;
      title: string;
      artistName: string;
      coverUrl: string | null;
      musicbrainzId: string;
      totalSeconds: number;
      totalPlays: number;
      lastListenedAt: string;
    }
  >();

  for (const listen of listens ?? []) {
    const track = listen.tracks as any;
    const album = track?.albums;
    if (!album) continue;

    const existing = byAlbum.get(album.id);
    const seconds = (track.duration_seconds ?? 0) * listen.play_count;

    if (existing) {
      existing.totalSeconds += seconds;
      existing.totalPlays += listen.play_count;
      if (listen.listened_at > existing.lastListenedAt) {
        existing.lastListenedAt = listen.listened_at;
      }
    } else {
      byAlbum.set(album.id, {
        albumId: album.id,
        title: album.title,
        artistName: album.artists?.name ?? "",
        coverUrl: album.cover_url,
        musicbrainzId: album.musicbrainz_id,
        totalSeconds: seconds,
        totalPlays: listen.play_count,
        lastListenedAt: listen.listened_at,
      });
    }
  }

  let albums = Array.from(byAlbum.values());

  if (sort === "plays") {
    albums.sort((a, b) => b.totalPlays - a.totalPlays);
  } else if (sort === "alpha") {
    albums.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    albums.sort((a, b) => (a.lastListenedAt < b.lastListenedAt ? 1 : -1));
  }

  const sortOptions = [
    { key: "recent", label: "Recentes" },
    { key: "plays", label: "Mais ouvidos" },
    { key: "alpha", label: "A-Z" },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/profile" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Perfil
      </Link>
      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="font-display italic text-3xl text-paper">Biblioteca</h1>
        <p className="text-paper-muted text-sm font-counter">{albums.length} álbuns</p>
      </div>

      <div className="flex gap-2 mb-6">
        {sortOptions.map((opt) => (
          <Link
            key={opt.key}
            href={`/library?sort=${opt.key}`}
            className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${
              sort === opt.key
                ? "bg-amber/10 border-amber-dim text-amber"
                : "border-white/10 text-paper-muted hover:text-paper"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <ul className="space-y-2">
        {albums.map((album) => (
          <li key={album.albumId}>
            <Link
              href={`/album/${album.musicbrainzId}`}
              className="flex items-center gap-4 bg-panel border border-white/5 rounded-lg p-3 hover:border-amber-dim/30 transition-colors"
            >
              <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden bg-chassis">
                {album.coverUrl && (
                  <Image
                    src={album.coverUrl}
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
                <p className="text-sm text-paper-muted truncate">{album.artistName}</p>
              </div>
              <div className="text-right shrink-0 font-counter text-xs text-paper-muted">
                <p className="text-amber">{album.totalPlays}×</p>
                <p>{formatDuration(album.totalSeconds)}</p>
              </div>
            </Link>
          </li>
        ))}
        {albums.length === 0 && (
          <p className="text-paper-muted text-sm">
            Nenhum álbum ouvido ainda.
          </p>
        )}
      </ul>
    </main>
  );
}
