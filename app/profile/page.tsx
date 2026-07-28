import { createSupabaseServerClient } from "@/lib/supabase-server";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const days = Math.floor(hours / 24);
  return { hours, days };
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-accent/70">Faça login pra ver seu perfil.</p>
      </main>
    );
  }

  // Consulta a view user_total_listen_time (ver schema.sql)
  const { data: totals } = await supabase
    .from("user_total_listen_time")
    .select("total_seconds")
    .eq("user_id", user.id)
    .maybeSingle();

  const totalSeconds = totals?.total_seconds ?? 0;
  const { hours, days } = formatDuration(totalSeconds);

  // Últimas faixas ouvidas, com o álbum de cada uma (modelo novo, faixa a
  // faixa). Agrupamos por álbum na hora de exibir, mostrando a faixa mais
  // recente marcada em cada um.
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
    });
    if (recentAlbums.length >= 10) break;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <section className="mb-10 bg-surface border border-white/10 rounded-xl p-8 text-center">
        <p className="text-accent/60 text-sm mb-2">Você já gastou</p>
        <p className="text-5xl font-semibold tracking-tight">{hours}h</p>
        <p className="text-accent/60 text-sm mt-2">
          {days > 0 ? `≈ ${days} dia(s) inteiro(s) de música` : "ouvindo música"}
        </p>
      </section>

      <h2 className="text-lg font-medium mb-4">Últimos ouvidos</h2>
      <ul className="space-y-3">
        {recentAlbums.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-4 bg-surface border border-white/10 rounded-lg p-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.title}</p>
              <p className="text-sm text-accent/60 truncate">{item.artistName}</p>
            </div>
            <span className="text-xs text-accent/40 shrink-0">
              {new Date(item.listened_at).toLocaleDateString("pt-BR")}
            </span>
          </li>
        ))}
        {recentAlbums.length === 0 && (
          <p className="text-accent/50 text-sm">
            Nenhum álbum marcado ainda. Vai na busca e marca o primeiro!
          </p>
        )}
      </ul>
    </main>
  );
}
