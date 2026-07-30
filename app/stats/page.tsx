import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, "0")}`;
  return `${minutes} min`;
}

export default async function StatsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Faça login pra ver suas estatísticas.</p>
      </main>
    );
  }

  const { data: listens } = await supabase
    .from("track_listens")
    .select(
      "play_count, tracks(duration_seconds, albums(release_year, genres, artists(name)))"
    )
    .eq("user_id", user.id);

  const byDecade = new Map<string, number>();
  const byGenre = new Map<string, number>();
  const byArtist = new Map<string, number>();

  for (const listen of listens ?? []) {
    const track = listen.tracks as any;
    const album = track?.albums;
    if (!album) continue;
    const seconds = (track.duration_seconds ?? 0) * listen.play_count;

    if (album.release_year) {
      const decade = `${Math.floor(album.release_year / 10) * 10}s`;
      byDecade.set(decade, (byDecade.get(decade) ?? 0) + seconds);
    }
    for (const genre of album.genres ?? []) {
      byGenre.set(genre, (byGenre.get(genre) ?? 0) + seconds);
    }
    const artistName = album.artists?.name;
    if (artistName) {
      byArtist.set(artistName, (byArtist.get(artistName) ?? 0) + seconds);
    }
  }

  const decades = Array.from(byDecade.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const maxDecadeSeconds = Math.max(1, ...decades.map(([, s]) => s));

  const topGenres = Array.from(byGenre.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxGenreSeconds = Math.max(1, ...topGenres.map(([, s]) => s));

  const topArtists = Array.from(byArtist.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/profile" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Perfil
      </Link>
      <h1 className="font-display italic text-3xl text-paper mt-4 mb-8">Estatísticas</h1>

      {decades.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-[0.15em] text-paper-muted mb-4">
            Por década
          </h2>
          <div className="flex items-end gap-2 h-40">
            {decades.map(([decade, seconds]) => (
              <div key={decade} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-amber/70 rounded-t"
                  style={{ height: `${(seconds / maxDecadeSeconds) * 100}%`, minHeight: 4 }}
                  title={formatDuration(seconds)}
                />
                <span className="text-xs text-paper-muted font-counter">{decade}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {topGenres.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-[0.15em] text-paper-muted mb-4">
            Gêneros mais ouvidos
          </h2>
          <div className="space-y-2">
            {topGenres.map(([genre, seconds]) => (
              <div key={genre} className="flex items-center gap-3">
                <span className="text-sm text-paper w-28 shrink-0 truncate">{genre}</span>
                <div className="flex-1 h-2 bg-panel rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber rounded-full"
                    style={{ width: `${(seconds / maxGenreSeconds) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-paper-muted font-counter w-14 text-right shrink-0">
                  {formatDuration(seconds)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {topArtists.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-[0.15em] text-paper-muted mb-4">
            Top artistas
          </h2>
          <ol className="space-y-2">
            {topArtists.map(([artist, seconds], i) => (
              <li
                key={artist}
                className="flex items-center gap-3 bg-panel border border-white/5 rounded-lg px-4 py-3"
              >
                <span className="font-counter text-amber w-5 shrink-0">{i + 1}</span>
                <span className="flex-1 text-paper truncate">{artist}</span>
                <span className="text-xs text-paper-muted font-counter shrink-0">
                  {formatDuration(seconds)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {decades.length === 0 && topGenres.length === 0 && (
        <p className="text-paper-muted text-sm">
          Marca alguns álbuns como ouvidos pra ver suas estatísticas aparecerem aqui.
        </p>
      )}
    </main>
  );
}
