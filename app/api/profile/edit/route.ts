import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { displayName, avatarUrl } = await req.json();

  if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
    return NextResponse.json({ error: "URL de foto inválida." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName?.trim() || null,
        avatar_url: avatarUrl?.trim() || null,
      },
      { onConflict: "id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
