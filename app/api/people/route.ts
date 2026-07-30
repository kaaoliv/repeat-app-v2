import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ users: [] });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .ilike("username", `%${q.trim()}%`)
    .not("username", "is", null)
    .limit(10);

  return NextResponse.json({ users: data ?? [] });
}
