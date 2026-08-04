import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runLastfmSync } from "@/lib/lastfm-sync";

// Sem isso, a Vercel corta em 10s no plano Hobby — pedimos o máximo
// permitido lá (60s). A função em si trabalha com um orçamento de 45s,
// deixando folga de sobra pra sempre responder antes desse limite.
export const maxDuration = 60;

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("lastfm_username, lastfm_last_synced_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.lastfm_username) {
    return NextResponse.json({ error: "Last.fm não conectado." }, { status: 400 });
  }

  const result = await runLastfmSync(
    supabase,
    user.id,
    profile.lastfm_username,
    profile.lastfm_last_synced_at,
    45_000
  );

  if (result.newWatermark) {
    await supabase
      .from("profiles")
      .update({ lastfm_last_synced_at: new Date(result.newWatermark * 1000).toISOString() })
      .eq("id", user.id);
  }

  return NextResponse.json(result);
}
