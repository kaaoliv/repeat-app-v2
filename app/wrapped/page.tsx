import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function formatHours(totalSeconds: number) {
  return Math.floor(totalSeconds / 3600);
}

export default async function WrappedPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="px-4 pt-9">
        <p className="text-ink-muted">
          Faça{" "}
          <Link href="/login" className="text-primary-soft underline">
            login
          </Link>{" "}
          pra ver seu Wrapped.
        </p>
      </main>
    );
  }

  const yearStart = `${year}-01-01T00:00:00Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00Z`;

  const { data: listens } = await supabase
    .from("track_listens")
    .select(
      "play_count, listened_at, tracks(duration_seconds, title, albums(title, cover_url, genres, artists(name)))"
    )
    .eq("user_id", user.id)
    .gte("listened_at", yearStart)
    .lt("listened_at", yearEnd);

  const byArtist = new Map<string, number>();
  const byAlbum = new Map<string, { title: string; artist: string; cover: string | null; seconds: number }>();
  const byGenre = new Map<string, number>();
  let totalSeconds = 0;
  let totalPlays = 0;

  for (const l of listens ?? []) {
    const track = l.tracks as any;
    const album = track?.albums;
    if (!album) continue;
    const seconds = (track.duration_seconds ?? 0) * l.play_count;
    totalSeconds += seconds;
    totalPlays += l.play_count;

    const artistName = album.artists?.name;
    if (artistName) byArtist.set(artistName, (byArtist.get(artistName) ?? 0) + seconds);

    const albumKey = `${artistName}::${album.title}`;
    const existing = byAlbum.get(albumKey);
    if (existing) existing.seconds += seconds;
    else byAlbum.set(albumKey, { title: album.title, artist: artistName, cover: album.cover_url, seconds });

    for (const g of album.genres ?? []) {
      byGenre.set(g, (byGenre.get(g) ?? 0) + seconds);
    }
  }

  const topArtist = Array.from(byArtist.entries()).sort((a, b) => b[1] - a[1])[0];
  const topAlbum = Array.from(byAlbum.values()).sort((a, b) => b.seconds - a.seconds)[0];
  const topGenre = Array.from(byGenre.entries()).sort((a, b) => b[1] - a[1])[0];

  const longestDaySpan = new Set((listens ?? []).map((d) => d.listened_at.slice(0, 10))).size;

  const hasData = totalSeconds > 0;

  return (
    <main className="px-4 pt-9 pb-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-extrabold text-2xl text-ink">Seu {year} em música</h1>
        <div className="flex gap-1">
          {[currentYear - 1, currentYear].map((y) => (
            <Link
              key={y}
              href={`/wrapped?year=${y}`}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                y === year
                  ? "bg-primary/15 border-primary/50 text-primary-soft"
                  : "border-line text-ink-muted hover:text-ink"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-ink-muted text-sm">
          Nenhuma escuta registrada em {year} ainda. Vai lá curtir uns álbuns!
        </p>
      ) : (
        <div className="space-y-4">
          {/* Hero: total de horas */}
          <div className="rounded-3xl bg-gradient-to-br from-primary/25 to-blue/10 border border-primary/30 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-2">Você ouviu</p>
            <p className="font-display font-extrabold text-6xl text-ink leading-none">
              {formatHours(totalSeconds)}h
            </p>
            <p className="text-sm text-ink-muted mt-3">
              em {totalPlays} escuta{totalPlays === 1 ? "" : "s"}, em {longestDaySpan} dia
              {longestDaySpan === 1 ? "" : "s"} diferentes
            </p>
          </div>

          {/* Top artista */}
          {topArtist && (
            <div className="rounded-2xl bg-surface border border-line p-6">
              <p className="text-xs uppercase tracking-[0.15em] text-ink-faint mb-2">Artista do ano</p>
              <p className="font-display font-bold text-2xl text-ink">{topArtist[0]}</p>
              <p className="text-sm text-ink-muted mt-1">{formatHours(topArtist[1])}h ouvidas</p>
            </div>
          )}

          {/* Top álbum */}
          {topAlbum && (
            <div className="rounded-2xl bg-surface border border-line p-6 flex items-center gap-4">
              {topAlbum.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={topAlbum.cover}
                  alt={topAlbum.title}
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.15em] text-ink-faint mb-1">Álbum do ano</p>
                <p className="font-display font-bold text-lg text-ink truncate">{topAlbum.title}</p>
                <p className="text-sm text-ink-muted truncate">{topAlbum.artist}</p>
              </div>
            </div>
          )}

          {/* Top gênero */}
          {topGenre && (
            <div className="rounded-2xl bg-surface border border-line p-6">
              <p className="text-xs uppercase tracking-[0.15em] text-ink-faint mb-2">Seu som</p>
              <p className="font-display font-bold text-2xl text-ink capitalize">{topGenre[0]}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
