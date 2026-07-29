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

  const { trackId, action } = await req.json();

  if (!trackId || (action !== "increment" && action !== "decrement")) {
    return NextResponse.json(
      { error: "trackId e action ('increment' | 'decrement') são obrigatórios." },
      { status: 400 }
    );
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
