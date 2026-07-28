import type { SupabaseClient } from "@supabase/supabase-js";
import { getAlbumBasicInfo } from "./musicbrainz";

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
    const { data: newAlbum, error: albumErr } = await supabase
      .from("albums")
      .insert({
        artist_id: artist!.id,
        title,
        cover_url: coverUrl,
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
