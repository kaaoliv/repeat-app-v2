import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumAndTracks } from "@/lib/album-helpers";

// Marca só UMA faixa como ouvida — o botão "Marcar ouvida" que aparece
// quando a busca acha uma música específica (matchedTrack), sem precisar
// marcar o álbum inteiro. Garante que o álbum + faixas existem no banco
// (criando se for a primeira vez) e incrementa só a faixa em questão.
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
    trackTitle, // título da faixa específica (matchedTrack.title da busca)
  } = body;

  if (!musicbrainzReleaseGroupId || !trackTitle) {
    return NextResponse.json(
      { error: "musicbrainzReleaseGroupId e trackTitle são obrigatórios." },
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
      { error: "Não encontramos essa faixa ainda." },
      { status: 502 }
    );
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  const track =
    resolved.tracks.find((t) => normalize(t.title) === normalize(trackTitle)) ??
    // Às vezes o título vem levemente diferente (feat., remaster) — cai
    // pro primeiro que contém o texto como aproximação.
    resolved.tracks.find(
      (t) =>
        normalize(t.title).includes(normalize(trackTitle)) ||
        normalize(trackTitle).includes(normalize(t.title))
    );

  if (!track) {
    return NextResponse.json(
      { error: "Faixa não encontrada nesse álbum." },
      { status: 404 }
    );
  }

  const { data, error } = await supabase.rpc("increment_track_listen", {
    p_track_id: track.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    trackId: track.id,
    albumId: resolved.albumId,
    playCount: data?.play_count ?? 1,
  });
}
