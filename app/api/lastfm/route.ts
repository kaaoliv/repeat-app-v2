import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { verifyLastfmUser } from "@/lib/lastfm";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { username } = await req.json();
  const clean = (username ?? "").trim();

  if (!clean) {
    // username vazio = desconectar
    await supabase
      .from("profiles")
      .update({ lastfm_username: null, lastfm_last_synced_at: null })
      .eq("id", user.id);
    return NextResponse.json({ success: true, connected: false });
  }

  const exists = await verifyLastfmUser(clean);
  if (!exists) {
    return NextResponse.json(
      { error: "Não achei esse username no Last.fm. Confere se está certo." },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, lastfm_username: clean }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, connected: true, username: clean });
}
