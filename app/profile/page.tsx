import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import UsernameEditor from "../components/UsernameEditor";
import AlbumCover from "../components/AlbumCover";

// Sem isso, o Next.js pode reaproveitar uma versão em cache dessa página
// entre navegações rápidas (ex: marcar uma faixa e ir direto pro perfil),
// mostrando o total de horas desatualizado por alguns segundos.
export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const days = Math.floor(hours / 24);
  return { hours, days };
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

// O contador de horas, no estilo dos odômetros mecânicos de toca-fitas:
// cada dígito na sua própria janelinha, número fixo de casas.
function OdometerDigits({ value, digits = 4 }: { value: number; digits?: number }) {
  const padded = Math.min(value, 10 ** digits - 1)
    .toString()
    .padStart(digits, "0")
    .split("");

  return (
    <div className="flex gap-1 justify-center">
      {padded.map((digit, i) => (
        <span
          key={i}
          className="w-11 h-16 sm:w-14 sm:h-20 bg-chassis border border-amber-dim/50 rounded-sm flex items-center justify-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]"
        >
          <span className="font-counter font-bold text-3xl sm:text-4xl text-amber tabular-nums">
            {digit}
          </span>
        </span>
      ))}
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Faça login pra ver seu perfil.</p>
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
  const { hours, days } = formatDuration(totalSeconds);

  const { data: recentListens } = await supabase
    .from("track_listens")
    .select("listened_at, tracks(title, albums(title, cover_url, artists(name)))")
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
    });
    if (recentAlbums.length >= 10) break;
  }

  const { data: allListenDates } = await supabase
    .from("track_listens")
    .select("listened_at")
    .eq("user_id", user.id);

  const streak = calculateStreak((allListenDates ?? []).map((d) => d.listened_at));

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <UsernameEditor currentUsername={profile?.username ?? null} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-paper-muted font-counter">
            <span className="text-paper">{followerCount ?? 0}</span> seguidores ·{" "}
            <span className="text-paper">{followingCount ?? 0}</span> seguindo
          </span>
          <Link href="/people" className="text-sm text-paper-muted hover:text-paper transition-colors">
            Buscar pessoas
          </Link>
        </div>
      </div>

      <section className="mb-6 bg-panel border border-white/5 rounded-2xl p-8 sm:p-10">
        <p className="text-paper-muted text-xs uppercase tracking-[0.2em] text-center mb-5">
          Horas ouvidas
        </p>
        <OdometerDigits value={hours} />
        <p className="text-paper-muted text-sm text-center mt-5">
          {days > 0
            ? `≈ ${days} dia${days === 1 ? "" : "s"} inteiro${days === 1 ? "" : "s"} da sua vida`
            : "vai ouvindo que o contador gira"}
        </p>
        {streak > 0 && (
          <p className="text-amber text-sm text-center mt-3 font-counter">
            🔥 {streak} dia{streak === 1 ? "" : "s"} seguido{streak === 1 ? "" : "s"} ouvindo
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-10">
        <Link
          href="/library"
          className="bg-panel border border-white/5 rounded-lg px-3 py-4 text-center hover:border-amber-dim/40 transition-colors"
        >
          <p className="text-sm text-paper">Biblioteca</p>
        </Link>
        <Link
          href="/stats"
          className="bg-panel border border-white/5 rounded-lg px-3 py-4 text-center hover:border-amber-dim/40 transition-colors"
        >
          <p className="text-sm text-paper">Estatísticas</p>
        </Link>
        <Link
          href="/watchlist"
          className="bg-panel border border-white/5 rounded-lg px-3 py-4 text-center hover:border-amber-dim/40 transition-colors"
        >
          <p className="text-sm text-paper">Quero ouvir</p>
        </Link>
        <Link
          href="/lists"
          className="bg-panel border border-white/5 rounded-lg px-3 py-4 text-center hover:border-amber-dim/40 transition-colors"
        >
          <p className="text-sm text-paper">Minhas listas</p>
        </Link>
      </div>

      <h2 className="font-display italic text-xl text-paper mb-4">Últimos ouvidos</h2>
      <ul className="space-y-2">
        {recentAlbums.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-4 bg-panel border border-white/5 rounded-lg px-4 py-3"
          >
            <AlbumCover
              src={item.coverUrl}
              alt={item.title}
              className="w-11 h-11 shrink-0 rounded"
              sizes="44px"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-paper truncate">{item.title}</p>
              <p className="text-sm text-paper-muted truncate">{item.artistName}</p>
            </div>
            <span className="text-xs text-paper-muted/60 shrink-0 font-counter">
              {new Date(item.listened_at).toLocaleDateString("pt-BR")}
            </span>
          </li>
        ))}
        {recentAlbums.length === 0 && (
          <p className="text-paper-muted text-sm">
            Nenhum álbum marcado ainda. Vai na busca e marca o primeiro!
          </p>
        )}
      </ul>
    </main>
  );
}
