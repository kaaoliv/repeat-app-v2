import { createSupabaseServerClient } from "@/lib/supabase-server";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export const dynamic = "force-dynamic";

const genreBarColors = ["bg-primary", "bg-blue", "bg-coral", "bg-pink", "bg-gold", "bg-teal"];

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
      <main className="px-4 pt-9">
        <p className="text-ink-muted">Faça login pra ver suas estatísticas.</p>
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
    <main className="pb-8">
      <PageHeader title="Estatísticas" />
      <div className="px-4">
        {decades.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint mb-4">
              Por década
            </h2>
            <div className="flex items-end gap-2 h-40">
              {decades.map(([decade, seconds]) => (
                <div key={decade} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-blue rounded-t-md"
                    style={{ height: `${(seconds / maxDecadeSeconds) * 100}%`, minHeight: 4 }}
                    title={formatDuration(seconds)}
                  />
                  <span className="text-xs text-ink-muted tabular-nums">{decade}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {topGenres.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint mb-4">
              Gêneros mais ouvidos
            </h2>
            <div className="space-y-2.5">
              {topGenres.map(([genre, seconds], i) => (
                <div key={genre} className="flex items-center gap-3">
                  <span className="text-sm text-ink w-28 shrink-0 truncate">{genre}</span>
                  <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${genreBarColors[i % genreBarColors.length]}`}
                      style={{ width: `${(seconds / maxGenreSeconds) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-muted tabular-nums w-14 text-right shrink-0">
                    {formatDuration(seconds)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {topArtists.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint mb-4">
              Top artistas
            </h2>
            <ol className="space-y-2">
              {topArtists.map(([artist, seconds], i) => (
                <li
                  key={artist}
                  className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-3"
                >
                  <span className="font-display font-bold text-primary-soft w-5 shrink-0">{i + 1}</span>
                  <span className="flex-1 text-ink truncate">{artist}</span>
                  <span className="text-xs text-ink-muted tabular-nums shrink-0">
                    {formatDuration(seconds)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {decades.length === 0 && topGenres.length === 0 && (
          <EmptyState
            title="Ainda sem dados"
            description="Marca alguns álbuns como ouvidos pra ver suas estatísticas aparecerem aqui."
            cta={{ label: "Buscar álbuns", href: "/" }}
            tone="teal"
          />
        )}
      </div>
    </main>
  );
}
