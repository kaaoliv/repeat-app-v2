import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { runLastfmSync } from "@/lib/lastfm-sync";

// Mesmo motivo do sync manual: 60s é o teto do plano Hobby da Vercel.
export const maxDuration = 60;
const TOTAL_TIME_BUDGET_MS = 55_000;

export async function GET(req: NextRequest) {
  // A Vercel manda esse header sozinha em cron jobs configurados com
  // CRON_SECRET — protege a rota de ser chamada por qualquer um de fora.
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createSupabaseAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, lastfm_username, lastfm_last_synced_at")
    .not("lastfm_username", "is", null)
    .order("lastfm_last_synced_at", { ascending: true, nullsFirst: true });

  const results: { userId: string; username: string; synced: number; matched: number }[] = [];
  let skippedDueToTime = 0;

  for (const profile of profiles ?? []) {
    const elapsed = Date.now() - startTime;
    if (elapsed > TOTAL_TIME_BUDGET_MS - 5_000) {
      skippedDueToTime++;
      continue;
    }

    const perUserBudget = Math.min(20_000, TOTAL_TIME_BUDGET_MS - elapsed);

    try {
      const result = await runLastfmSync(
        supabase,
        profile.id,
        profile.lastfm_username!,
        profile.lastfm_last_synced_at,
        perUserBudget
      );

      if (result.newWatermark) {
        await supabase
          .from("profiles")
          .update({ lastfm_last_synced_at: new Date(result.newWatermark * 1000).toISOString() })
          .eq("id", profile.id);
      }

      results.push({
        userId: profile.id,
        username: profile.lastfm_username!,
        synced: result.synced,
        matched: result.matched,
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({
    usersProcessed: results.length,
    usersSkipped: skippedDueToTime,
    totalUsersWithLastfm: (profiles ?? []).length,
    results,
  });
}
