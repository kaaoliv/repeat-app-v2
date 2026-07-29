import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists } from "@/lib/album-helpers";
import { getAlbumTracklist } from "@/lib/musicbrainz";

// Marca TODAS as faixas de um álbum como ouvidas de uma vez — é o botão
// rápido "Já ouvi" na busca. Pra ajustar faixa por faixa, a pessoa vai na
// tela do álbum (/album/[id]).
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

  if (!musicbrainzReleaseGroupId) {
    return NextResponse.json(
      { error: "musicbrainzReleaseGroupId é obrigatório." },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Erro ao salvar álbum." },
      { status: 500 }
    );
  }

  const mbTracks = await getAlbumTracklist(musicbrainzReleaseGroupId);

  if (mbTracks.length === 0) {
    return NextResponse.json(
      { error: "Não encontramos as faixas desse álbum ainda." },
      { status: 502 }
    );
  }

  const totalSeconds = mbTracks.reduce(
    (sum, t) => sum + (t.durationSeconds ?? 0),
    0
  );
  await supabase
    .from("albums")
    .update({ duration_seconds: totalSeconds })
    .eq("id", album.id);

  const { data: dbTracks, error: tracksErr } = await supabase
    .from("tracks")
    .upsert(
      mbTracks.map((t) => ({
        album_id: album.id,
        musicbrainz_recording_id: t.recordingId,
        title: t.title,
        duration_seconds: t.durationSeconds,
        track_number: t.trackNumber,
        disc_number: t.discNumber,
      })),
      { onConflict: "album_id,disc_number,track_number" }
    )
    .select("id");

  if (tracksErr || !dbTracks) {
    return NextResponse.json({ error: "Erro ao salvar faixas." }, { status: 500 });
  }

  const { error: listenErr } = await supabase.rpc("bulk_increment_album", {
    p_album_id: album.id,
  });

  if (listenErr) {
    return NextResponse.json({ error: listenErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, trackCount: dbTracks.length });
}
