import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import AlbumCover from "../components/AlbumCover";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { formatAlbumDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

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
      <main className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-ink-muted">
          Faça{" "}
          <Link href="/login" className="text-primary-soft underline">
            login
          </Link>{" "}
          pra ver sua biblioteca.
        </p>
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
    <main className="max-w-3xl mx-auto px-4 pt-10 pb-8 animate-fade-in">
      <PageHeader
        title="Biblioteca"
        subtitle={`${albums.length} álbum${albums.length === 1 ? "" : "ns"} no seu histórico`}
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {sortOptions.map((opt) => (
          <Link
            key={opt.key}
            href={`/library?sort=${opt.key}`}
            className={`text-sm rounded-full px-4 py-1.5 border transition-colors ${
              sort === opt.key
                ? "bg-primary/15 border-primary/50 text-primary-soft"
                : "border-line text-ink-muted hover:text-ink hover:border-white/20"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {albums.length === 0 ? (
        <EmptyState
          title="Sua estante está vazia"
          description="Marque faixas como ouvidas e os álbuns aparecem aqui, ordenados do seu jeito."
          cta={{ label: "Buscar álbuns", href: "/" }}
        />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
          {albums.map((album) => (
            <li key={album.albumId}>
              <Link href={`/album/${album.musicbrainzId}`} className="group block">
                <div className="relative">
                  <AlbumCover
                    src={album.coverUrl}
                    alt={album.title}
                    className="w-full aspect-square rounded-xl shadow-card transition-transform group-hover:-translate-y-1"
                    sizes="(max-width: 640px) 45vw, 30vw"
                  />
                  <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full shadow-badge">
                    {album.totalPlays}×
                  </span>
                  {formatAlbumDuration(album.totalSeconds) && (
                    <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-ink text-xs font-medium px-2 py-0.5 rounded-full">
                      {formatAlbumDuration(album.totalSeconds)}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-medium text-ink text-sm truncate">{album.title}</p>
                <p className="text-xs text-ink-muted truncate">{album.artistName}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
