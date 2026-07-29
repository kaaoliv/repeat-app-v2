import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists } from "@/lib/album-helpers";
import {
  getAlbumBasicInfo,
  getAlbumTracklist,
  getAlbumGenres,
  getArtistDescription,
} from "@/lib/musicbrainz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: releaseGroupId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Busca tudo em paralelo: info básica, tracklist e gêneros na MusicBrainz.
  const [basicInfo, mbTracks, genres] = await Promise.all([
    getAlbumBasicInfo(releaseGroupId),
    getAlbumTracklist(releaseGroupId),
    getAlbumGenres(releaseGroupId),
  ]);

  if (!basicInfo) {
    return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  }

  // Descrição do artista pode demorar um pouco mais (cadeia MusicBrainz →
  // Wikidata → Wikipedia) — busca depois de já ter o básico, sem travar
  // se falhar.
  const description = await getArtistDescription(basicInfo.artistId).catch(
    () => null
  );

  // Garante que álbum + artista existem no nosso banco, e sincroniza as
  // faixas (cria as que ainda não existem).
  const album = await ensureAlbumExists(supabase, {
    musicbrainzReleaseGroupId: releaseGroupId,
    title: basicInfo.title,
    artistName: basicInfo.artistName,
    artistMusicbrainzId: basicInfo.artistId,
    coverUrl: basicInfo.coverUrl,
    year: basicInfo.year,
  });

  if (!album) {
    return NextResponse.json(
      { error: "Erro ao carregar álbum." },
      { status: 500 }
    );
  }

  // Sincroniza a duração total do álbum (soma das faixas) se ainda não tiver.
  const totalSeconds = mbTracks.reduce(
    (sum, t) => sum + (t.durationSeconds ?? 0),
    0
  );
  if (totalSeconds > 0) {
    await supabase
      .from("albums")
      .update({ duration_seconds: totalSeconds })
      .eq("id", album.id);
  }

  // Upsert das faixas (on conflict faz nada demais além de garantir que
  // existem — não precisa atualizar toda vez).
  let dbTracks: { id: string; musicbrainz_recording_id: string | null }[] = [];
  if (mbTracks.length > 0) {
    const { data: upserted } = await supabase
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
        { onConflict: "album_id,disc_number,track_number", ignoreDuplicates: false }
      )
      .select("id, musicbrainz_recording_id");
    dbTracks = upserted ?? [];
  }

  // Quantas vezes esse usuário já ouviu cada faixa.
  let playCountByTrackId = new Map<string, number>();
  if (user && dbTracks.length > 0) {
    const { data: listens } = await supabase
      .from("track_listens")
      .select("track_id, play_count")
      .eq("user_id", user.id)
      .in(
        "track_id",
        dbTracks.map((t) => t.id)
      );
    playCountByTrackId = new Map(
      (listens ?? []).map((l) => [l.track_id, l.play_count])
    );
  }

  const dbTrackByRecordingId = new Map(
    dbTracks.map((t) => [t.musicbrainz_recording_id, t.id])
  );

  const tracks = mbTracks.map((t) => {
    const dbId = dbTrackByRecordingId.get(t.recordingId);
    return {
      id: dbId ?? null,
      title: t.title,
      durationSeconds: t.durationSeconds,
      trackNumber: t.trackNumber,
      discNumber: t.discNumber,
      playCount: dbId ? playCountByTrackId.get(dbId) ?? 0 : 0,
    };
  });

  return NextResponse.json({
    album: {
      title: basicInfo.title,
      artistName: basicInfo.artistName,
      artistId: basicInfo.artistId,
      coverUrl: basicInfo.coverUrl,
      year: basicInfo.year,
      genres,
      totalSeconds,
    },
    description,
    tracks,
    isLoggedIn: !!user,
  });
}
