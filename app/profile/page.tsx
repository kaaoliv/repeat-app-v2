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

  // Top álbuns marcados (mais recentes primeiro, v0 simples)
  const { data: recentLogs } = await supabase
    .from("listen_logs")
    .select("logged_at, albums(title, cover_url, artists(name))")
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(10);

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
        {(recentLogs ?? []).map((log: any, i: number) => (
          <li
            key={i}
            className="flex items-center gap-4 bg-surface border border-white/10 rounded-lg p-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{log.albums?.title}</p>
              <p className="text-sm text-accent/60 truncate">
                {log.albums?.artists?.name}
              </p>
            </div>
            <span className="text-xs text-accent/40 shrink-0">
              {new Date(log.logged_at).toLocaleDateString("pt-BR")}
            </span>
          </li>
        ))}
        {(!recentLogs || recentLogs.length === 0) && (
          <p className="text-accent/50 text-sm">
            Nenhum álbum marcado ainda. Vai na busca e marca o primeiro!
          </p>
        )}
      </ul>
    </main>
  );
}
