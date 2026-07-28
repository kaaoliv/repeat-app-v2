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

  const { trackId, heard } = await req.json();

  if (!trackId || typeof heard !== "boolean") {
    return NextResponse.json(
      { error: "trackId e heard são obrigatórios." },
      { status: 400 }
    );
  }

  if (heard) {
    // upsert evita erro de duplicata se o usuário clicar duas vezes rápido
    const { error } = await supabase
      .from("track_listens")
      .upsert(
        { user_id: user.id, track_id: trackId },
        { onConflict: "user_id,track_id" }
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("track_listens")
      .delete()
      .eq("user_id", user.id)
      .eq("track_id", trackId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
