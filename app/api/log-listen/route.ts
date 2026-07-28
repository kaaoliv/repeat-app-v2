import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getReleaseGroupDuration } from "@/lib/musicbrainz";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json();
  const {
    musicbrainzReleaseGroupId,
    title,
    artistName,
    artistMusicbrainzId,
    coverUrl,
    year,
  } = body;

  if (!musicbrainzReleaseGroupId || !title || !artistName) {
    return NextResponse.json(
      { error: "Dados do álbum incompletos." },
      { status: 400 }
    );
  }

  // 1. Garante que o artista existe
  let { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("musicbrainz_id", artistMusicbrainzId)
    .maybeSingle();

  if (!artist) {
    const { data: newArtist, error: artistErr } = await supabase
      .from("artists")
      .insert({ name: artistName, musicbrainz_id: artistMusicbrainzId })
      .select("id")
      .single();

    if (artistErr) {
      return NextResponse.json({ error: artistErr.message }, { status: 500 });
    }
    artist = newArtist;
  }

  // 2. Garante que o álbum existe (busca duração na MusicBrainz na primeira vez)
  let { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("musicbrainz_id", musicbrainzReleaseGroupId)
    .maybeSingle();

  if (!album) {
    const durationSeconds = await getReleaseGroupDuration(
      musicbrainzReleaseGroupId
    );

    const { data: newAlbum, error: albumErr } = await supabase
      .from("albums")
      .insert({
        artist_id: artist!.id,
        title,
        cover_url: coverUrl,
        release_year: year ? Number(year) : null,
        duration_seconds: durationSeconds,
        musicbrainz_id: musicbrainzReleaseGroupId,
      })
      .select("id")
      .single();

    if (albumErr) {
      return NextResponse.json({ error: albumErr.message }, { status: 500 });
    }
    album = newAlbum;
  }

  // 3. Registra o listen_log (cada chamada = +1 play_count nesse log do dia)
  const { error: logErr } = await supabase.from("listen_logs").insert({
    user_id: user.id,
    album_id: album!.id,
    play_count: 1,
  });

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
