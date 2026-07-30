import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: list, error } = await supabase
    .from("lists")
    .select(
      "id, name, description, is_public, user_id, list_items(album_id, added_at, albums(id, title, cover_url, musicbrainz_id, artists(name)))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !list) {
    return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    list,
    isOwner: user?.id === list.user_id,
  });
}
