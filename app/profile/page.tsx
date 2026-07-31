import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import UsernameEditor from "../components/UsernameEditor";
import AlbumCover from "../components/AlbumCover";
import { formatListenDate } from "@/lib/format";

// Sem isso, o Next.js pode reaproveitar uma versão em cache dessa página
// entre navegações rápidas (ex: marcar uma faixa e ir direto pro perfil),
// mostrando o total de horas desatualizado por alguns segundos.
export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const days = Math.floor(hours / 24);
  return { hours, minutes, days };
}

// Calcula quantos dias seguidos (contando hoje ou ontem como início) a
// pessoa tem pelo menos uma escuta registrada.
function calculateStreak(listenDates: string[]): number {
  const uniqueDays = Array.from(
    new Set(listenDates.map((d) => new Date(d).toISOString().slice(0, 10)))
  ).sort((a, b) => (a < b ? 1 : -1)); // mais recente primeiro

  if (uniqueDays.length === 0) return 0;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Se não ouviu nem hoje nem ontem, a sequência já quebrou.
  if (uniqueDays[0] !== todayStr && uniqueDays[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 0; i < uniqueDays.length - 1; i++) {
    const current = new Date(uniqueDays[i]);
    const next = new Date(uniqueDays[i + 1]);
    const diffDays = Math.round((current.getTime() - next.getTime()) / 86400000);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

// O contador de horas: cada dígito na sua própria janelinha, estilo
// odômetro. Mantido, mas repaginado pro tema escuro/violeta.
function OdometerDigits({
  value,
  digits = 4,
  size = "large",
}: {
  value: number;
  digits?: number;
  size?: "large" | "small";
}) {
  const padded = Math.min(value, 10 ** digits - 1)
    .toString()
    .padStart(digits, "0")
    .split("");

  const boxClass =
    size === "large"
      ? "w-12 h-16 sm:w-16 sm:h-20 text-4xl sm:text-5xl"
      : "w-9 h-12 sm:w-11 sm:h-14 text-2xl sm:text-3xl";

  return (
    <div className="flex gap-1.5 justify-center">
      {padded.map((digit, i) => (
        <span
          key={i}
          className={`${boxClass} bg-bg border border-white/10 rounded-lg flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.7)]`}
        >
          <span className="font-display font-bold text-ink tabular-nums">{digit}</span>
        </span>
      ))}
    </div>
  );
}

const shortcuts = [
  { href: "/library", label: "Biblioteca", accent: "text-blue" },
  { href: "/stats", label: "Estatísticas", accent: "text-teal" },
  { href: "/watchlist", label: "Quero ouvir", accent: "text-gold" },
  { href: "/lists", label: "Minhas listas", accent: "text-pink" },
];

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16">
        <p className="text-ink-muted">
          Faça{" "}
          <Link href="/login" className="text-primary-soft underline">
            login
          </Link>{" "}
          pra ver seu perfil.
        </p>
      </main>
    );
  }

  const { data: totals } = await supabase
    .from("user_total_listen_time")
    .select("total_seconds")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", user.id);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", user.id);

  const totalSeconds = totals?.total_seconds ?? 0;
  const { hours, minutes, days } = formatDuration(totalSeconds);

  const { data: recentListens } = await supabase
    .from("track_listens")
    .select("listened_at, tracks(title, albums(title, cover_url, musicbrainz_id, artists(name)))")
    .eq("user_id", user.id)
    .order("listened_at", { ascending: false })
    .limit(30);

  const seenAlbums = new Set<string>();
  const recentAlbums: any[] = [];
  for (const listen of recentListens ?? []) {
    const track = listen.tracks as any;
    const albumTitle = track?.albums?.title;
    if (!albumTitle || seenAlbums.has(albumTitle)) continue;
    seenAlbums.add(albumTitle);
    recentAlbums.push({
      listened_at: listen.listened_at,
      title: albumTitle,
      artistName: track?.albums?.artists?.name,
      coverUrl: track?.albums?.cover_url,
      musicbrainzId: track?.albums?.musicbrainz_id,
    });
    if (recentAlbums.length >= 10) break;
  }

  const { data: allListenDates } = await supabase
    .from("track_listens")
    .select("listened_at")
    .eq("user_id", user.id);

  const streak = calculateStreak((allListenDates ?? []).map((d) => d.listened_at));

  return (
    <main className="max-w-2xl mx-auto px-4 pt-10 pb-8 animate-fade-in">
      {/* Cabeçalho de identidade */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-lg text-primary-soft">
              {(profile?.username ?? "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <UsernameEditor currentUsername={profile?.username ?? null} />
        </div>
        <Link
          href="/people"
          className="text-sm text-ink-muted hover:text-ink transition-colors shrink-0 mt-1"
        >
          Buscar pessoas
        </Link>
      </div>

      {/* Seguidores */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <span className="text-ink-muted">
          <span className="text-ink font-semibold">{followerCount ?? 0}</span> seguidores
        </span>
        <span className="text-ink-muted">
          <span className="text-ink font-semibold">{followingCount ?? 0}</span> seguindo
        </span>
      </div>

      {/* Hero de horas */}
      <section className="relative mb-8 overflow-hidden bg-surface border border-line rounded-2xl p-8 sm:p-10 shadow-card">
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <p className="relative text-ink-muted text-xs uppercase tracking-[0.25em] text-center mb-6">
          Horas ouvidas
        </p>
        <div className="relative">
          {days > 0 ? (
            <OdometerDigits value={hours} />
          ) : (
            <div className="flex items-end justify-center gap-2">
              <OdometerDigits value={hours} digits={2} size="small" />
              <span className="text-ink-muted text-xl font-display font-bold mb-2.5">h</span>
              <OdometerDigits value={minutes} digits={2} size="small" />
              <span className="text-ink-muted text-xl font-display font-bold mb-2.5">m</span>
            </div>
          )}
        </div>
        <p className="relative text-ink-muted text-sm text-center mt-6">
          {days > 0
            ? `≈ ${days} dia${days === 1 ? "" : "s"} inteiro${days === 1 ? "" : "s"} da sua vida em música`
            : totalSeconds > 0
              ? "seu extrato de vida em música"
              : "vai ouvindo que o contador gira"}
        </p>
        {streak > 0 && (
          <p className="relative inline-flex items-center gap-1.5 text-gold text-sm mt-4 mx-auto w-full justify-center font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            {streak} dia{streak === 1 ? "" : "s"} seguido{streak === 1 ? "" : "s"} ouvindo
          </p>
        )}
      </section>

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-10">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-surface border border-line rounded-xl px-3 py-4 text-center hover:border-white/20 hover:bg-surface-2 transition-colors"
          >
            <p className={`text-sm font-medium ${s.accent}`}>{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Últimos ouvidos */}
      <h2 className="font-display font-semibold text-xl text-ink mb-4">Últimos ouvidos</h2>
      {recentAlbums.length === 0 ? (
        <p className="text-ink-muted text-sm">
          Nenhum álbum marcado ainda. Vai na busca e marca o primeiro!
        </p>
      ) : (
        <ul className="space-y-2">
          {recentAlbums.map((item, i) => (
            <li key={i}>
              <Link
                href={item.musicbrainzId ? `/album/${item.musicbrainzId}` : "#"}
                className="flex items-center gap-4 bg-surface border border-line rounded-xl px-3 py-3 hover:border-white/20 transition-colors"
              >
                <AlbumCover
                  src={item.coverUrl}
                  alt={item.title}
                  className="w-12 h-12 shrink-0 rounded-lg"
                  sizes="48px"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink truncate">{item.title}</p>
                  <p className="text-sm text-ink-muted truncate">{item.artistName}</p>
                </div>
                <span className="text-xs text-ink-faint shrink-0">
                  {formatListenDate(item.listened_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
