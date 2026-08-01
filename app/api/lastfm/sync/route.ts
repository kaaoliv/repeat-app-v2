import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists } from "@/lib/album-helpers";
import {
  getAlbumTracklist,
  findAlbumByArtistAndTitle,
  findAlbumByArtistAndTrack,
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
  let match = tracks.find((t) => normalizeTitle(t.title) === normalizedScrobble);
  if (match) return match;
  match = tracks.find((t) => {
    const nt = normalizeTitle(t.title);
    return nt.startsWith(normalizedScrobble) || normalizedScrobble.startsWith(nt);
  });
  return match ?? null;
}

type SyncStats = { matched: number; albumsSkipped: number; tracksUnmatched: number };

// Processa um grupo de scrobbles que já sabemos pertencer ao mesmo álbum
// (id da MusicBrainz já resolvido): garante que álbum+faixas existem no
// banco, casa cada escuta com a faixa certa e registra.
async function processAlbumGroup(
  supabase: any,
  albumMbid: string,
  artistNameHint: string,
  scrobbles: LastfmScrobble[],
  stats: SyncStats
) {
  const album = await ensureAlbumExists(supabase, {
    musicbrainzReleaseGroupId: albumMbid,
    artistName: artistNameHint,
  });
  if (!album) {
    stats.albumsSkipped++;
    return;
  }

  const mbTracks: MBTrack[] = await getAlbumTracklist(albumMbid);
  if (mbTracks.length === 0) {
    stats.albumsSkipped++;
    return;
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
    stats.albumsSkipped++;
    return;
  }

  const countByTrackId = new Map<string, { count: number; latest: number }>();
  for (const s of scrobbles) {
    const track = findBestTrackMatch(s.trackName, dbTracks);
    if (!track) {
      stats.tracksUnmatched++;
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
    stats.matched += count;
  }
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
  const scrobbles = allScrobbles.filter((s) => !s.nowPlaying && s.scrobbledAt && s.artistName);

  if (scrobbles.length === 0) {
    return NextResponse.json({ synced: 0, matched: 0, albumsSkipped: 0, tracksUnmatched: 0 });
  }

  const withAlbum = scrobbles.filter((s) => s.albumName);
  const withoutAlbum = scrobbles.filter((s) => !s.albumName);

  const stats: SyncStats = { matched: 0, albumsSkipped: 0, tracksUnmatched: 0 };
  let maxScrobbledAt = since ?? 0;
  for (const s of scrobbles) {
    if (s.scrobbledAt && s.scrobbledAt > maxScrobbledAt) maxScrobbledAt = s.scrobbledAt;
  }

  // --- Caminho 1: scrobbles que já vêm com álbum informado ---
  const byAlbumKey = new Map<string, { artistName: string; albumName: string; scrobbles: LastfmScrobble[] }>();
  for (const s of withAlbum) {
    const key = `${s.artistName.toLowerCase()}::${s.albumName.toLowerCase()}`;
    if (!byAlbumKey.has(key)) {
      byAlbumKey.set(key, { artistName: s.artistName, albumName: s.albumName, scrobbles: [] });
    }
    byAlbumKey.get(key)!.scrobbles.push(s);
  }

  for (const group of byAlbumKey.values()) {
    const albumMbid =
      group.scrobbles.find((s) => s.albumMbid)?.albumMbid ??
      (await findAlbumByArtistAndTitle(group.artistName, group.albumName));

    if (!albumMbid) {
      stats.albumsSkipped++;
      continue;
    }
    await processAlbumGroup(supabase, albumMbid, group.artistName, group.scrobbles, stats);
    await new Promise((r) => setTimeout(r, 250)); // não estourar rate limit da MusicBrainz
  }

  // --- Caminho 2: scrobbles sem álbum — busca pelo nome da música ---
  const byTrackKey = new Map<string, { artistName: string; trackName: string; scrobbles: LastfmScrobble[] }>();
  for (const s of withoutAlbum) {
    const key = `${s.artistName.toLowerCase()}::${s.trackName.toLowerCase()}`;
    if (!byTrackKey.has(key)) {
      byTrackKey.set(key, { artistName: s.artistName, trackName: s.trackName, scrobbles: [] });
    }
    byTrackKey.get(key)!.scrobbles.push(s);
  }

  for (const group of byTrackKey.values()) {
    const albumMbid = await findAlbumByArtistAndTrack(group.artistName, group.trackName);
    if (!albumMbid) {
      stats.albumsSkipped++;
      continue;
    }
    await processAlbumGroup(supabase, albumMbid, group.artistName, group.scrobbles, stats);
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
    matched: stats.matched,
    albumsSkipped: stats.albumsSkipped,
    tracksUnmatched: stats.tracksUnmatched,
  });
}
