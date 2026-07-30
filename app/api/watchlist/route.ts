import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists } from "@/lib/album-helpers";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data } = await supabase
    .from("watchlist")
    .select("added_at, albums(id, title, cover_url, musicbrainz_id, artists(name))")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const {
    musicbrainzReleaseGroupId,
    title,
    artistName,
    artistMusicbrainzId,
    coverUrl,
    year,
    action,
  } = body;

  if (!musicbrainzReleaseGroupId || (action !== "add" && action !== "remove")) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const album = await ensureAlbumExists(supabase, {
    musicbrainzReleaseGroupId,
    title,
    artistName,
    artistMusicbrainzId,
    coverUrl,
    year,
  });

  if (!album) {
    return NextResponse.json({ error: "Erro ao salvar álbum." }, { status: 500 });
  }

  if (action === "add") {
    const { error } = await supabase
      .from("watchlist")
      .upsert({ user_id: user.id, album_id: album.id }, { onConflict: "user_id,album_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("album_id", album.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
