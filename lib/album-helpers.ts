import type { SupabaseClient } from "@supabase/supabase-js";
import { getAlbumBasicInfo } from "./musicbrainz";
import { getAlbumInfo } from "./lastfm";
import { searchAlbumCover } from "./spotify";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A MusicBrainz sempre devolve uma URL de capa "otimista" (monta o link
// assumindo que a Cover Art Archive tem a imagem), mas nem sempre tem de
// verdade — aí a imagem simplesmente não carrega. Confirma se existe de
// verdade antes de salvar; se não existir, tenta Last.fm e depois
// Spotify em vez de deixar sem capa nenhuma. (O Last.fm às vezes mostra
// capa no site mas devolve o campo de imagem vazio pela API — por isso
// o Spotify entra como segunda linha de defesa, não como substituto.)
async function resolveCoverUrl(
  candidateUrl: string | undefined,
  artistName: string,
  albumTitle: string
): Promise<string | null> {
  if (candidateUrl) {
    try {
      const res = await fetch(candidateUrl, { method: "HEAD" });
      if (res.ok) return candidateUrl;
    } catch {
      // segue pro fallback
    }
  }

  try {
    const lastfmAlbum = await getAlbumInfo(artistName, albumTitle);
    if (lastfmAlbum?.coverUrl) return lastfmAlbum.coverUrl;
  } catch {
    // segue pro próximo fallback
  }

  try {
    const spotifyCover = await searchAlbumCover(artistName, albumTitle);
    if (spotifyCover?.coverUrl) return spotifyCover.coverUrl;
  } catch {
    // sem capa mesmo, ok
  }

  return null;
}

// Garante que o artista e o álbum existem nas nossas tabelas, criando se
// for a primeira vez que alguém mexe nesse álbum. Usado tanto por
// /api/log-listen quanto por /api/album/[id] e /api/track-listen.
export async function ensureAlbumExists(
  supabase: SupabaseClient,
  params: {
    musicbrainzReleaseGroupId: string;
    title?: string;
    artistName?: string;
    artistMusicbrainzId?: string;
    coverUrl?: string;
    year?: string | null;
  }
): Promise<{ id: string } | null> {
  let { musicbrainzReleaseGroupId, title, artistName, artistMusicbrainzId, coverUrl, year } =
    params;

  // Se não veio informação suficiente (ex: chamada direto pela URL da
  // tela de álbum), busca na MusicBrainz.
  if (!title || !artistName) {
    const info = await getAlbumBasicInfo(musicbrainzReleaseGroupId);
    if (!info) return null;
    title = info.title;
    artistName = info.artistName;
    artistMusicbrainzId = info.artistId;
    coverUrl = info.coverUrl;
    year = info.year;
  }

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
    if (artistErr) return null;
    artist = newArtist;
  }

  let { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("musicbrainz_id", musicbrainzReleaseGroupId)
    .maybeSingle();

  if (!album) {
    const verifiedCoverUrl = await resolveCoverUrl(coverUrl, artistName!, title!);

    const { data: newAlbum, error: albumErr } = await supabase
      .from("albums")
      .insert({
        artist_id: artist!.id,
        title,
        cover_url: verifiedCoverUrl,
        release_year: year ? Number(year) : null,
        musicbrainz_id: musicbrainzReleaseGroupId,
      })
      .select("id")
      .single();
    if (albumErr) return null;
    album = newAlbum;
  }

  return album;
}

// Versão pra álbuns que a MusicBrainz não conhece (comum em conteúdo de
// nicho: funk/DJ regional, covers de fã, etc.) — usa dados do Last.fm e
// chaves sintéticas no lugar de ids reais da MusicBrainz. Reaproveita as
// mesmas colunas (musicbrainz_id) só que prefixadas com "lastfm:", pra
// nunca colidir com um MBID de verdade e continuar usando a mesma
// constraint de unicidade que já existia.
export async function ensureLastfmAlbumExists(
  supabase: SupabaseClient,
  params: {
    artistName: string;
    albumTitle: string;
    coverUrl: string | null;
    tracks: { title: string; trackNumber: number; durationSeconds: number | null }[];
  }
): Promise<{ id: string } | null> {
  const { artistName, albumTitle, coverUrl, tracks } = params;

  const artistKey = `lastfm:artist:${slugify(artistName)}`;
  const albumKey = `lastfm:album:${slugify(artistName)}:${slugify(albumTitle)}`;

  let { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("musicbrainz_id", artistKey)
    .maybeSingle();

  if (!artist) {
    const { data: newArtist, error: artistErr } = await supabase
      .from("artists")
      .insert({ name: artistName, musicbrainz_id: artistKey, source: "lastfm" })
      .select("id")
      .single();
    if (artistErr) return null;
    artist = newArtist;
  }

  let { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("musicbrainz_id", albumKey)
    .maybeSingle();

  const totalSeconds = tracks.reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0);

  if (!album) {
    const { data: newAlbum, error: albumErr } = await supabase
      .from("albums")
      .insert({
        artist_id: artist!.id,
        title: albumTitle,
        cover_url: coverUrl,
        musicbrainz_id: albumKey,
        source: "lastfm",
        duration_seconds: totalSeconds || null,
      })
      .select("id")
      .single();
    if (albumErr) return null;
    album = newAlbum;
  }

  if (tracks.length > 0) {
    await supabase.from("tracks").upsert(
      tracks.map((t) => ({
        album_id: album!.id,
        musicbrainz_recording_id: `lastfm:track:${albumKey}:${t.trackNumber}`,
        title: t.title,
        duration_seconds: t.durationSeconds,
        track_number: t.trackNumber,
        disc_number: 1,
        source: "lastfm",
      })),
      { onConflict: "album_id,disc_number,track_number" }
    );
  }

  return album;
}
