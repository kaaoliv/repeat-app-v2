import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists } from "@/lib/album-helpers";
import {
  getAlbumTracklist,
  findAlbumByArtistAndTitle,
  type MBTrack,
} from "@/lib/musicbrainz";
import { getRecentScrobbles, type LastfmScrobble } from "@/lib/lastfm";

// Remove sufixos comuns que fazem o mesmo título "parecer" diferente entre
// Last.fm e MusicBrainz: "(feat. Fulano)", "- Remastered 2011", "(Live)" etc.
function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s*[\(\[][^)\]]*(feat\.?|with|remaster|live|version|edit|mono|stereo)[^)\]]*[\)\]]\s*/gi, " ")
    .replace(/\s*-\s*(remaster(ed)?|live|mono|stereo).*/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestTrackMatch(
  scrobbleTitle: string,
  tracks: { id: string; title: string }[]
) {
  const normalizedScrobble = normalizeTitle(scrobbleTitle);
  // 1. match exato (normalizado)
  let match = tracks.find((t) => normalizeTitle(t.title) === normalizedScrobble);
  if (match) return match;
  // 2. um começa com o outro (cobre "Song" vs "Song (Bonus Track)")
  match = tracks.find((t) => {
    const nt = normalizeTitle(t.title);
    return nt.startsWith(normalizedScrobble) || normalizedScrobble.startsWith(nt);
  });
  return match ?? null;
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("lastfm_username, lastfm_last_synced_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.lastfm_username) {
    return NextResponse.json({ error: "Last.fm não conectado." }, { status: 400 });
  }

  const since = profile.lastfm_last_synced_at
    ? Math.floor(new Date(profile.lastfm_last_synced_at).getTime() / 1000)
    : undefined;

  const allScrobbles = await getRecentScrobbles(profile.lastfm_username, since);
  const scrobbles = allScrobbles.filter((s) => !s.nowPlaying && s.scrobbledAt);
  const withoutAlbum = scrobbles.filter((s) => !s.albumName || !s.artistName).length;

  if (scrobbles.length === 0) {
    return NextResponse.json({ synced: 0, matched: 0, albumsSkipped: 0, tracksUnmatched: 0, withoutAlbum: 0 });
  }

  // Agrupa por álbum (artista + nome do álbum) pra resolver cada um só
  // uma vez, mesmo que tenha várias faixas/escutas daquele álbum no lote.
  const byAlbumKey = new Map<string, { artistName: string; albumName: string; scrobbles: LastfmScrobble[] }>();
  for (const s of scrobbles) {
    if (!s.albumName || !s.artistName) continue; // sem álbum não dá pra registrar (ver withoutAlbum)
    const key = `${s.artistName.toLowerCase()}::${s.albumName.toLowerCase()}`;
    if (!byAlbumKey.has(key)) {
      byAlbumKey.set(key, { artistName: s.artistName, albumName: s.albumName, scrobbles: [] });
    }
    byAlbumKey.get(key)!.scrobbles.push(s);
  }

  let matchedCount = 0;
  let albumsSkipped = 0;
  let tracksUnmatched = 0;
  let maxScrobbledAt = since ?? 0;

  for (const group of byAlbumKey.values()) {
    for (const s of group.scrobbles) {
      if (s.scrobbledAt && s.scrobbledAt > maxScrobbledAt) maxScrobbledAt = s.scrobbledAt;
    }

    // Resolve o id do álbum na MusicBrainz: usa o mbid que o Last.fm já
    // trouxer (mais confiável) ou busca por texto como fallback.
    const albumMbid =
      group.scrobbles.find((s) => s.albumMbid)?.albumMbid ??
      (await findAlbumByArtistAndTitle(group.artistName, group.albumName));

    if (!albumMbid) {
      albumsSkipped++;
      continue;
    }

    const album = await ensureAlbumExists(supabase, {
      musicbrainzReleaseGroupId: albumMbid,
      artistName: group.artistName,
    });
    if (!album) {
      albumsSkipped++;
      continue;
    }

    const mbTracks: MBTrack[] = await getAlbumTracklist(albumMbid);
    if (mbTracks.length === 0) {
      albumsSkipped++;
      continue;
    }

    const { data: dbTracks } = await supabase
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
      .select("id, title");

    if (!dbTracks) {
      albumsSkipped++;
      continue;
    }

    // Casa cada escuta com a faixa certa pelo título (com tolerância a
    // diferenças de "(feat. ...)", remaster, maiúsculas, pontuação etc).
    const countByTrackId = new Map<string, { count: number; latest: number }>();
    for (const s of group.scrobbles) {
      const track = findBestTrackMatch(s.trackName, dbTracks);
      if (!track) {
        tracksUnmatched++;
        continue;
      }
      const existing = countByTrackId.get(track.id) ?? { count: 0, latest: 0 };
      existing.count += 1;
      if (s.scrobbledAt && s.scrobbledAt > existing.latest) existing.latest = s.scrobbledAt;
      countByTrackId.set(track.id, existing);
    }

    for (const [trackId, { count, latest }] of countByTrackId.entries()) {
      await supabase.rpc("sync_track_listen", {
        p_track_id: trackId,
        p_play_count_delta: count,
        p_listened_at: new Date(latest * 1000).toISOString(),
        p_source: "lastfm",
      });
      matchedCount += count;
    }

    // pequena pausa entre álbuns pra não estourar o rate limit da MusicBrainz
    await new Promise((r) => setTimeout(r, 250));
  }

  if (maxScrobbledAt > 0) {
    await supabase
      .from("profiles")
      .update({ lastfm_last_synced_at: new Date(maxScrobbledAt * 1000).toISOString() })
      .eq("id", user.id);
  }

  return NextResponse.json({
    synced: scrobbles.length,
    matched: matchedCount,
    albumsSkipped,
    tracksUnmatched,
    withoutAlbum,
  });
}
