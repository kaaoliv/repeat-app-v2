import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { trackId, action, value } = await req.json();

  if (!trackId || !["increment", "decrement", "set"].includes(action)) {
    return NextResponse.json(
      { error: "trackId e action ('increment' | 'decrement' | 'set') são obrigatórios." },
      { status: 400 }
    );
  }

  if (action === "set") {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
      return NextResponse.json({ error: "value precisa ser um número inteiro ≥ 0." }, { status: 400 });
    }

    if (count === 0) {
      const { error } = await supabase
        .from("track_listens")
        .delete()
        .eq("user_id", user.id)
        .eq("track_id", trackId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, playCount: 0 });
    }

    const { data: upserted, error } = await supabase
      .from("track_listens")
      .upsert(
        { user_id: user.id, track_id: trackId, play_count: count, source: "manual" },
        { onConflict: "user_id,track_id" }
      )
      .select("play_count")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, playCount: upserted.play_count });
  }

  const fn = action === "increment" ? "increment_track_listen" : "decrement_track_listen";
  const { data, error } = await supabase.rpc(fn, { p_track_id: trackId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Depois de zerar, a linha é apagada — a function retorna null nesse caso.
  const playCount = data?.play_count ?? 0;

  return NextResponse.json({ success: true, playCount });
}
