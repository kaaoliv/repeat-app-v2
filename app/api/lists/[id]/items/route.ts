import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists } from "@/lib/album-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listId } = await params;
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
  } = body;

  if (!musicbrainzReleaseGroupId) {
    return NextResponse.json({ error: "Álbum é obrigatório." }, { status: 400 });
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

  const { error } = await supabase
    .from("list_items")
    .upsert(
      { list_id: listId, album_id: album.id },
      { onConflict: "list_id,album_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { albumId } = await req.json();
  if (!albumId) return NextResponse.json({ error: "albumId é obrigatório." }, { status: 400 });

  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", listId)
    .eq("album_id", albumId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
