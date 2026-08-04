import { ensureAlbumExists, ensureLastfmAlbumExists } from "./album-helpers";
import {
  getAlbumTracklist,
  findAlbumByArtistAndTitle,
  findAlbumByArtistAndTrack,
  type MBTrack,
  type ResolvedAlbum,
} from "./musicbrainz";
import { getRecentScrobbles, getAlbumInfo, getTrackInfo, type LastfmScrobble } from "./lastfm";

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

function findBestTrackMatch(scrobbleTitle: string, tracks: { id: string; title: string }[]) {
  const normalizedScrobble = normalizeTitle(scrobbleTitle);
  let match = tracks.find((t) => normalizeTitle(t.title) === normalizedScrobble);
  if (match) return match;
  match = tracks.find((t) => {
    const nt = normalizeTitle(t.title);
    return nt.startsWith(normalizedScrobble) || normalizedScrobble.startsWith(nt);
  });
  return match ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SyncStats = {
  matched: number;
  albumsSkipped: number;
  tracksUnmatched: number;
  viaLastfm: number;
  skippedExamples: string[];
  timedOut: boolean;
};

type WorkItem = {
  type: "album" | "track";
  artistName: string;
  albumName?: string;
  trackName?: string;
  scrobbles: LastfmScrobble[];
  minScrobbledAt: number;
};

async function resolveAlbumTracks(
  supabase: any,
  resolved: { id: string } & Partial<ResolvedAlbum>
): Promise<{ albumId: string; dbTracks: { id: string; title: string }[] } | null> {
  const album = await ensureAlbumExists(supabase, {
    musicbrainzReleaseGroupId: resolved.id,
    title: resolved.title,
    artistName: resolved.artistName,
    artistMusicbrainzId: resolved.artistId,
    coverUrl: resolved.coverUrl,
    year: resolved.year,
  });
  if (!album) return null;

  await sleep(350);
  const mbTracks: MBTrack[] = await getAlbumTracklist(resolved.id);
  if (mbTracks.length === 0) return null;

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

  if (!dbTracks) return null;
  return { albumId: album.id, dbTracks };
}

async function registerListens(
  supabase: any,
  userId: string,
  dbTracks: { id: string; title: string }[],
  scrobbles: LastfmScrobble[],
  stats: SyncStats
) {
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
    const { data: existingRow } = await supabase
      .from("track_listens")
      .select("play_count, listened_at")
      .eq("user_id", userId)
      .eq("track_id", trackId)
      .maybeSingle();

    const listenedAt = new Date(latest * 1000).toISOString();

    if (existingRow) {
      const newListenedAt =
        !existingRow.listened_at || listenedAt > existingRow.listened_at
          ? listenedAt
          : existingRow.listened_at;
      await supabase
        .from("track_listens")
        .update({
          play_count: existingRow.play_count + count,
          listened_at: newListenedAt,
          source: "lastfm",
        })
        .eq("user_id", userId)
        .eq("track_id", trackId);
    } else {
      await supabase.from("track_listens").insert({
        user_id: userId,
        track_id: trackId,
        play_count: count,
        listened_at: listenedAt,
        source: "lastfm",
      });
    }
    stats.matched += count;
  }
}

async function processWorkItem(supabase: any, userId: string, item: WorkItem, stats: SyncStats) {
  let resolved: ({ id: string } & Partial<ResolvedAlbum>) | null = null;

  if (item.type === "album") {
    const directMbid = item.scrobbles.find((s) => s.albumMbid)?.albumMbid;
    resolved = directMbid
      ? { id: directMbid, artistName: item.artistName }
      : await findAlbumByArtistAndTitle(item.artistName, item.albumName!);
  } else {
    resolved = await findAlbumByArtistAndTrack(item.artistName, item.trackName!);
  }

  let albumResult: { albumId: string; dbTracks: { id: string; title: string }[] } | null = null;

  if (resolved) {
    await sleep(400);
    albumResult = await resolveAlbumTracks(supabase, resolved);
  }

  if (!albumResult) {
    await sleep(250);
    if (item.type === "album") {
      const lastfmAlbum = await getAlbumInfo(item.artistName, item.albumName!);
      if (lastfmAlbum) {
        const album = await ensureLastfmAlbumExists(supabase, {
          artistName: lastfmAlbum.artistName,
          albumTitle: lastfmAlbum.title,
          coverUrl: lastfmAlbum.coverUrl,
          tracks:
            lastfmAlbum.tracks.length > 0
              ? lastfmAlbum.tracks
              : item.scrobbles.map((s, i) => ({ title: s.trackName, trackNumber: i + 1, durationSeconds: null })),
        });
        if (album) {
          const { data: dbTracks } = await supabase.from("tracks").select("id, title").eq("album_id", album.id);
          if (dbTracks) {
            albumResult = { albumId: album.id, dbTracks };
            stats.viaLastfm++;
          }
        }
      }
    } else {
      const lastfmTrack = await getTrackInfo(item.artistName, item.trackName!);
      if (lastfmTrack) {
        const album = await ensureLastfmAlbumExists(supabase, {
          artistName: lastfmTrack.artistName,
          albumTitle: lastfmTrack.albumName || lastfmTrack.title,
          coverUrl: null,
          tracks: [{ title: lastfmTrack.title, trackNumber: 1, durationSeconds: lastfmTrack.durationSeconds }],
        });
        if (album) {
          const { data: dbTracks } = await supabase.from("tracks").select("id, title").eq("album_id", album.id);
          if (dbTracks) {
            albumResult = { albumId: album.id, dbTracks };
            stats.viaLastfm++;
          }
        }
      }
    }
  }

  if (!albumResult) {
    stats.albumsSkipped++;
    if (stats.skippedExamples.length < 8) {
      const label = item.type === "album" ? item.albumName : item.trackName;
      stats.skippedExamples.push(`[${item.type === "album" ? "álbum" : "música"}] ${item.artistName} — ${label}`);
    }
    return;
  }

  await registerListens(supabase, userId, albumResult.dbTracks, item.scrobbles, stats);
}

export type SyncResult = {
  synced: number;
  matched: number;
  albumsSkipped: number;
  tracksUnmatched: number;
  viaLastfm: number;
  skippedExamples: string[];
  remaining: number;
  timedOut: boolean;
  newWatermark: number | null;
};

export async function runLastfmSync(
  supabase: any,
  userId: string,
  lastfmUsername: string,
  sinceIso: string | null,
  timeBudgetMs = 45_000
): Promise<SyncResult> {
  const startTime = Date.now();
  const since = sinceIso ? Math.floor(new Date(sinceIso).getTime() / 1000) : undefined;

  const allScrobbles = await getRecentScrobbles(lastfmUsername, since, 300);
  const scrobbles = allScrobbles.filter((s) => !s.nowPlaying && s.scrobbledAt && s.artistName);

  if (scrobbles.length === 0) {
    return {
      synced: 0,
      matched: 0,
      albumsSkipped: 0,
      tracksUnmatched: 0,
      viaLastfm: 0,
      skippedExamples: [],
      remaining: 0,
      timedOut: false,
      newWatermark: null,
    };
  }

  const groups = new Map<string, WorkItem>();
  for (const s of scrobbles) {
    const isAlbum = !!s.albumName;
    const key = isAlbum
      ? `album::${s.artistName.toLowerCase()}::${s.albumName.toLowerCase()}`
      : `track::${s.artistName.toLowerCase()}::${s.trackName.toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, {
        type: isAlbum ? "album" : "track",
        artistName: s.artistName,
        albumName: isAlbum ? s.albumName : undefined,
        trackName: !isAlbum ? s.trackName : undefined,
        scrobbles: [],
        minScrobbledAt: s.scrobbledAt!,
      });
    }
    const group = groups.get(key)!;
    group.scrobbles.push(s);
    if (s.scrobbledAt! < group.minScrobbledAt) group.minScrobbledAt = s.scrobbledAt!;
  }

  const orderedGroups = Array.from(groups.values()).sort((a, b) => a.minScrobbledAt - b.minScrobbledAt);

  const stats: SyncStats = {
    matched: 0,
    albumsSkipped: 0,
    tracksUnmatched: 0,
    viaLastfm: 0,
    skippedExamples: [],
    timedOut: false,
  };

  let watermark = since ?? 0;
  let processedGroups = 0;

  for (const group of orderedGroups) {
    if (Date.now() - startTime > timeBudgetMs) {
      stats.timedOut = true;
      break;
    }

    await processWorkItem(supabase, userId, group, stats);
    processedGroups++;

    const groupMax = Math.max(...group.scrobbles.map((s) => s.scrobbledAt ?? 0));
    if (groupMax > watermark) watermark = groupMax;

    await sleep(400);
  }

  return {
    synced: scrobbles.length,
    matched: stats.matched,
    albumsSkipped: stats.albumsSkipped,
    tracksUnmatched: stats.tracksUnmatched,
    viaLastfm: stats.viaLastfm,
    skippedExamples: stats.skippedExamples,
    remaining: orderedGroups.length - processedGroups,
    timedOut: stats.timedOut,
    newWatermark: watermark > (since ?? 0) ? watermark : null,
  };
}
