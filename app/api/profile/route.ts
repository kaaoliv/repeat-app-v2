import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { username } = await req.json();
  const clean = (username ?? "").trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return NextResponse.json(
      { error: "Username precisa ter 3-20 caracteres: letras, números ou _" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, username: clean }, { onConflict: "id" });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Esse username já está em uso." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, username: clean });
}
