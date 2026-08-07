import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import UsernameEditor from "../components/UsernameEditor";
import LastfmConnector from "../components/LastfmConnector";
import EditProfileForm from "../components/EditProfileForm";
import UserAvatar from "../components/UserAvatar";
import AlbumCover from "../components/AlbumCover";
import { formatListenDate } from "@/lib/format";

// Sem isso, o Next.js pode reaproveitar uma versão em cache dessa página
// entre navegações rápidas (ex: marcar uma faixa e ir direto pro perfil),
// mostrando o total de horas desatualizado por alguns segundos.
export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
  const totalDays = Math.floor(totalHours / 24);

  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = totalHours % 24;

  return { hours: totalHours, minutes: totalMinutes, days: totalDays, months, daysInMonth: days, hoursInDay: hours };
}

// "9m 15d 4h" — só mostra as unidades que fazem sentido (não aparece "0m"
// se ainda não fez nem um mês, etc).
function formatCompactDuration(totalSeconds: number) {
  const { months, daysInMonth, hoursInDay, hours, minutes } = formatDuration(totalSeconds);

  if (months > 0) return `${months}m ${daysInMonth}d ${hoursInDay}h`;
  if (daysInMonth > 0) return `${daysInMonth}d ${hoursInDay}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
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

const shortcuts = [
  { href: "/library", label: "Biblioteca", accent: "text-blue" },
  { href: "/stats", label: "Estatísticas", accent: "text-teal" },
  { href: "/watchlist", label: "Quero ouvir", accent: "text-gold" },
  { href: "/lists", label: "Minhas listas", accent: "text-pink" },
  { href: "/wrapped", label: "Meu Wrapped", accent: "text-coral" },
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
    .select("username, display_name, avatar_url, lastfm_username, lastfm_last_synced_at")
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

  const { data: recentListens } = await supabase
    .from("track_listens")
    .select(
      "listened_at, play_count, tracks(title, duration_seconds, albums(title, cover_url, musicbrainz_id, artists(name)))"
    )
    .eq("user_id", user.id)
    .order("listened_at", { ascending: false });

  // Normaliza pra conseguir juntar a mesma música quando ela existe em
  // mais de um álbum no nosso banco (ex: veio uma vez via MusicBrainz e
  // outra vez via Last.fm, ou está no álbum original e numa coletânea) —
  // sem isso, o total de escutas dessa música ficaria dividido entre as
  // duas entradas em vez de somado.
  function normalizeSongKey(artist: string, title: string) {
    return `${artist}::${title}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s*[\(\[][^)\]]*(feat\.?|with|remaster|live|version|edit|mono|stereo)[^)\]]*[\)\]]\s*/gi, " ")
      .replace(/[^\w\s:]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const songMap = new Map<
    string,
    {
      title: string;
      artistName: string;
      coverUrl: string | null;
      musicbrainzId: string;
      totalPlayCount: number;
      lastListenedAt: string;
    }
  >();

  for (const listen of recentListens ?? []) {
    const track = listen.tracks as any;
    const album = track?.albums;
    if (!track?.title || !album) continue;
    const artistName = album.artists?.name ?? "";
    const key = normalizeSongKey(artistName, track.title);

    const existing = songMap.get(key);
    if (existing) {
      existing.totalPlayCount += listen.play_count;
      // mantém a capa/álbum mais recente como "representante" da música
      if (listen.listened_at > existing.lastListenedAt) {
        existing.lastListenedAt = listen.listened_at;
        existing.coverUrl = album.cover_url;
        existing.musicbrainzId = album.musicbrainz_id;
      }
    } else {
      songMap.set(key, {
        title: track.title,
        artistName,
        coverUrl: album.cover_url,
        musicbrainzId: album.musicbrainz_id,
        totalPlayCount: listen.play_count,
        lastListenedAt: listen.listened_at,
      });
    }
  }

  const recentSongs = Array.from(songMap.values())
    .sort((a, b) => (a.lastListenedAt < b.lastListenedAt ? 1 : -1))
    .slice(0, 10);

  const { data: allListenDates } = await supabase
    .from("track_listens")
    .select("listened_at")
    .eq("user_id", user.id);

  const streak = calculateStreak((allListenDates ?? []).map((d) => d.listened_at));

  return (
    <main className="max-w-2xl mx-auto px-4 pt-10 pb-8 animate-fade-in">
      {/* Cabeçalho de identidade */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <UserAvatar
              src={profile.avatar_url}
              alt={profile.display_name ?? "avatar"}
              className="w-12 h-12 rounded-full shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
              <span className="font-display font-bold text-lg text-primary-soft">
                {(profile?.username ?? "?").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            {profile?.display_name && (
              <p className="font-display font-bold text-ink leading-tight">{profile.display_name}</p>
            )}
            <UsernameEditor currentUsername={profile?.username ?? null} />
          </div>
        </div>
        <Link
          href="/people"
          className="text-sm text-ink-muted hover:text-ink transition-colors shrink-0 mt-1"
        >
          Buscar pessoas
        </Link>
      </div>

      <div className="mb-6">
        <EditProfileForm
          currentDisplayName={profile?.display_name ?? null}
          currentAvatarUrl={profile?.avatar_url ?? null}
        />
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

      <div className="mb-8">
        <LastfmConnector
          initialUsername={profile?.lastfm_username ?? null}
          lastSyncedAt={profile?.lastfm_last_synced_at ?? null}
        />
      </div>

      {/* Hero de horas */}
      <section className="relative mb-8 overflow-hidden bg-surface border border-line rounded-2xl p-6 shadow-card">
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex items-center justify-between mb-3">
          <p className="text-ink-muted text-sm font-medium">Horas ouvidas</p>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <p className="relative font-display font-extrabold text-4xl sm:text-5xl text-ink tracking-tight">
          {formatCompactDuration(totalSeconds)}
        </p>
        {streak > 0 && (
          <p className="relative inline-flex items-center gap-1.5 text-gold text-sm mt-4 font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            {streak} dia{streak === 1 ? "" : "s"} seguido{streak === 1 ? "" : "s"} ouvindo
          </p>
        )}
      </section>

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-10">
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

      {/* Últimas músicas */}
      <h2 className="font-display font-semibold text-xl text-ink mb-4">Últimas músicas</h2>
      {recentSongs.length === 0 ? (
        <p className="text-ink-muted text-sm">
          Nenhuma música marcada ainda. Vai na busca e marca a primeira!
        </p>
      ) : (
        <ul className="space-y-2">
          {recentSongs.map((item, i) => (
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
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-xs font-bold tabular-nums text-primary-soft">
                    {item.totalPlayCount}×
                  </span>
                  <span className="text-xs text-ink-faint">
                    {formatListenDate(item.lastListenedAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
