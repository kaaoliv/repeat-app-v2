import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists } from "@/lib/album-helpers";
import {
  getAlbumBasicInfo,
  getAlbumTracklist,
  getAlbumGenres,
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

  // Álbuns que vieram só do Last.fm (a MusicBrainz não tem esse conteúdo
  // catalogado) usam uma chave sintética "lastfm:album:..." em vez de um
  // id de verdade — não faz sentido tentar buscar isso na MusicBrainz.
  if (releaseGroupId.startsWith("lastfm:")) {
    return handleLastfmSourcedAlbum(supabase, releaseGroupId, user);
  }

  // Busca tudo em paralelo: info básica, tracklist e gêneros na MusicBrainz.
  const [basicInfo, mbTracks, genres] = await Promise.all([
    getAlbumBasicInfo(releaseGroupId),
    getAlbumTracklist(releaseGroupId),
    getAlbumGenres(releaseGroupId),
  ]);

  if (!basicInfo) {
    return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  }

  // Descrição do artista foi movida pra uma rota separada
  // (/api/album/[id]/description) — é a parte mais lenta (3 serviços
  // externos em sequência), então a tela de álbum busca em segundo plano
  // em vez de segurar a resposta principal.

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

  // Sincroniza duração e gêneros do álbum se ainda não tiver.
  const totalSeconds = mbTracks.reduce(
    (sum, t) => sum + (t.durationSeconds ?? 0),
    0
  );
  const updates: Record<string, unknown> = {};
  if (totalSeconds > 0) updates.duration_seconds = totalSeconds;
  if (genres.length > 0) updates.genres = genres;
  if (Object.keys(updates).length > 0) {
    await supabase.from("albums").update(updates).eq("id", album.id);
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

  let inWatchlist = false;
  if (user) {
    const { data: wl } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("album_id", album.id)
      .maybeSingle();
    inWatchlist = !!wl;
  }

  return NextResponse.json({
    albumId: album.id,
    album: {
      title: basicInfo.title,
      artistName: basicInfo.artistName,
      artistId: basicInfo.artistId,
      coverUrl: basicInfo.coverUrl,
      year: basicInfo.year,
      genres,
      totalSeconds,
    },
    tracks,
    isLoggedIn: !!user,
    inWatchlist,
  });
}

// Serve um álbum que só existe por causa do Last.fm (a MusicBrainz não
// cataloga esse conteúdo) — não tenta mais nenhuma chamada externa, usa
// só o que já está salvo no nosso banco desde a sincronização.
async function handleLastfmSourcedAlbum(
  supabase: any,
  albumKey: string,
  user: { id: string } | null
) {
  const { data: album } = await supabase
    .from("albums")
    .select("id, title, cover_url, release_year, duration_seconds, artists(name)")
    .eq("musicbrainz_id", albumKey)
    .maybeSingle();

  if (!album) {
    return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  }

  const { data: dbTracks } = await supabase
    .from("tracks")
    .select("id, title, duration_seconds, track_number, disc_number")
    .eq("album_id", album.id)
    .order("track_number", { ascending: true });

  let playCountByTrackId = new Map<string, number>();
  if (user && dbTracks && dbTracks.length > 0) {
    const { data: listens } = await supabase
      .from("track_listens")
      .select("track_id, play_count")
      .eq("user_id", user.id)
      .in(
        "track_id",
        dbTracks.map((t: any) => t.id)
      );
    playCountByTrackId = new Map((listens ?? []).map((l: any) => [l.track_id, l.play_count]));
  }

  const tracks = (dbTracks ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    durationSeconds: t.duration_seconds,
    trackNumber: t.track_number,
    discNumber: t.disc_number,
    playCount: playCountByTrackId.get(t.id) ?? 0,
  }));

  let inWatchlist = false;
  if (user) {
    const { data: wl } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("album_id", album.id)
      .maybeSingle();
    inWatchlist = !!wl;
  }

  return NextResponse.json({
    albumId: album.id,
    album: {
      title: album.title,
      artistName: album.artists?.name ?? "Artista desconhecido",
      artistId: "", // sem id de artista de verdade nesse caso — sem link pra tela de artista
      coverUrl: album.cover_url,
      year: album.release_year ? String(album.release_year) : null,
      genres: [], // gênero só existe via MusicBrainz
      totalSeconds: album.duration_seconds ?? 0,
    },
    tracks,
    isLoggedIn: !!user,
    inWatchlist,
    source: "lastfm",
  });
}
