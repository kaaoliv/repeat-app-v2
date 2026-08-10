import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumAndTracks } from "@/lib/album-helpers";

// Marca TODAS as faixas de um álbum como ouvidas de uma vez — é o botão
// rápido "Já ouvi" na busca. Pra ajustar faixa por faixa, a pessoa vai na
// tela do álbum (/album/[id]). Funciona tanto pra resultado vindo da
// MusicBrainz quanto do fallback do Last.fm (ver ensureAlbumAndTracks).
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
    source,
  } = body;

  if (!musicbrainzReleaseGroupId) {
    return NextResponse.json(
      { error: "musicbrainzReleaseGroupId é obrigatório." },
      { status: 400 }
    );
  }

  const resolved = await ensureAlbumAndTracks(supabase, {
    id: musicbrainzReleaseGroupId,
    title,
    artistName,
    artistMusicbrainzId,
    coverUrl,
    year,
    source,
  });

  if (!resolved) {
    return NextResponse.json(
      { error: "Não encontramos as faixas desse álbum ainda." },
      { status: 502 }
    );
  }

  const { error: listenErr } = await supabase.rpc("bulk_increment_album", {
    p_album_id: resolved.albumId,
  });

  if (listenErr) {
    return NextResponse.json({ error: listenErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, trackCount: resolved.tracks.length });
}
