import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureAlbumExists, ensureLastfmAlbumExists } from "@/lib/album-helpers";
import {
  getAlbumTracklist,
  findAlbumByArtistAndTitle,
  findAlbumByArtistAndTrack,
  type MBTrack,
  type ResolvedAlbum,
} from "@/lib/musicbrainz";
import {
  getRecentScrobbles,
  getAlbumInfo,
  getTrackInfo,
  type LastfmScrobble,
} from "@/lib/lastfm";

// A rota demora (várias chamadas à MusicBrainz/Last.fm, com pausa entre
// elas pra respeitar rate limit). Sem isso, a Vercel corta em 10s no
// plano Hobby — pedimos o máximo permitido lá (60s). Trabalhamos com um
// orçamento de 45s pra sempre ter folga de sobra pra responder antes
// desse limite, mesmo que não dê tempo de processar o lote inteiro.
export const maxDuration = 60;
const TIME_BUDGET_MS = 45_000;

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

type SyncStats = {
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
    await supabase.rpc("sync_track_listen", {
      p_track_id: trackId,
      p_play_count_delta: count,
      p_listened_at: new Date(latest * 1000).toISOString(),
      p_source: "lastfm",
    });
    stats.matched += count;
  }
}

// Resolve + registra um item de trabalho (álbum ou música), tentando
// MusicBrainz e caindo pro Last.fm direto se precisar.
async function processWorkItem(supabase: any, item: WorkItem, stats: SyncStats) {
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

  await registerListens(supabase, albumResult.dbTracks, item.scrobbles, stats);
}

export async function POST() {
  const startTime = Date.now();
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

  const allScrobbles = await getRecentScrobbles(profile.lastfm_username, since, 300);
  const scrobbles = allScrobbles.filter((s) => !s.nowPlaying && s.scrobbledAt && s.artistName);

  if (scrobbles.length === 0) {
    return NextResponse.json({
      synced: 0,
      matched: 0,
      albumsSkipped: 0,
      tracksUnmatched: 0,
      viaLastfm: 0,
      remaining: 0,
    });
  }

  // Agrupa (por álbum quando tem, por música quando não tem) e ordena do
  // scrobble mais antigo pro mais novo — processamos nessa ordem pra
  // sempre saber com segurança até onde já avançamos de verdade, mesmo
  // se o tempo acabar no meio do caminho.
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
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      stats.timedOut = true;
      break;
    }

    await processWorkItem(supabase, group, stats);
    processedGroups++;

    const groupMax = Math.max(...group.scrobbles.map((s) => s.scrobbledAt ?? 0));
    if (groupMax > watermark) watermark = groupMax;

    await sleep(400);
  }

  if (watermark > (since ?? 0)) {
    await supabase
      .from("profiles")
      .update({ lastfm_last_synced_at: new Date(watermark * 1000).toISOString() })
      .eq("id", user.id);
  }

  return NextResponse.json({
    synced: scrobbles.length,
    matched: stats.matched,
    albumsSkipped: stats.albumsSkipped,
    tracksUnmatched: stats.tracksUnmatched,
    viaLastfm: stats.viaLastfm,
    skippedExamples: stats.skippedExamples,
    remaining: orderedGroups.length - processedGroups,
    timedOut: stats.timedOut,
  });
}
