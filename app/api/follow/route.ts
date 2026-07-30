import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { targetUserId, action } = await req.json();

  if (!targetUserId || (action !== "follow" && action !== "unfollow")) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Você não pode seguir a si mesmo." }, { status: 400 });
  }

  if (action === "follow") {
    const { error } = await supabase
      .from("follows")
      .upsert(
        { follower_id: user.id, following_id: targetUserId },
        { onConflict: "follower_id,following_id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
