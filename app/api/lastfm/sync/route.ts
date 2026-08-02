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
// plano Hobby — pedimos o máximo permitido lá (60s).
export const maxDuration = 60;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SyncStats = {
  matched: number;
  albumsSkipped: number;
  tracksUnmatched: number;
  viaLastfm: number;
  skippedExamples: string[];
};

// Garante que o álbum existe no banco e devolve suas faixas — tenta
// MusicBrainz primeiro (id já resolvido) e cai pro Last.fm só se preciso.
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

  await sleep(400);
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

// Registra as escutas de um grupo já resolvido (álbum + faixas conhecidas),
// não importa se veio da MusicBrainz ou do Last.fm.
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

  const allScrobbles = await getRecentScrobbles(profile.lastfm_username, since, 40);
  const scrobbles = allScrobbles.filter((s) => !s.nowPlaying && s.scrobbledAt && s.artistName);

  if (scrobbles.length === 0) {
    return NextResponse.json({ synced: 0, matched: 0, albumsSkipped: 0, tracksUnmatched: 0, viaLastfm: 0 });
  }

  const withAlbum = scrobbles.filter((s) => s.albumName);
  const withoutAlbum = scrobbles.filter((s) => !s.albumName);

  const stats: SyncStats = { matched: 0, albumsSkipped: 0, tracksUnmatched: 0, viaLastfm: 0, skippedExamples: [] };
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
    const directMbid = group.scrobbles.find((s) => s.albumMbid)?.albumMbid;
    let resolved: ({ id: string } & Partial<ResolvedAlbum>) | null = directMbid
      ? { id: directMbid, artistName: group.artistName }
      : await findAlbumByArtistAndTitle(group.artistName, group.albumName);

    let albumResult: { albumId: string; dbTracks: { id: string; title: string }[] } | null = null;

    if (resolved) {
      await sleep(500);
      albumResult = await resolveAlbumTracks(supabase, resolved);
    }

    // Nível 3: MusicBrainz não achou (ou não tinha faixas) — pergunta pro Last.fm.
    if (!albumResult) {
      await sleep(300);
      const lastfmAlbum = await getAlbumInfo(group.artistName, group.albumName);
      if (lastfmAlbum) {
        const album = await ensureLastfmAlbumExists(supabase, {
          artistName: lastfmAlbum.artistName,
          albumTitle: lastfmAlbum.title,
          coverUrl: lastfmAlbum.coverUrl,
          tracks:
            lastfmAlbum.tracks.length > 0
              ? lastfmAlbum.tracks
              : group.scrobbles.map((s, i) => ({
                  title: s.trackName,
                  trackNumber: i + 1,
                  durationSeconds: null,
                })),
        });
        if (album) {
          const { data: dbTracks } = await supabase
            .from("tracks")
            .select("id, title")
            .eq("album_id", album.id);
          if (dbTracks) {
            albumResult = { albumId: album.id, dbTracks };
            stats.viaLastfm++;
          }
        }
      }
    }

    if (!albumResult) {
      stats.albumsSkipped++;
      if (stats.skippedExamples.length < 8) {
        stats.skippedExamples.push(`[álbum] ${group.artistName} — ${group.albumName}`);
      }
      await sleep(300);
      continue;
    }

    await registerListens(supabase, albumResult.dbTracks, group.scrobbles, stats);
    await sleep(500);
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
    let resolved = await findAlbumByArtistAndTrack(group.artistName, group.trackName);
    let albumResult: { albumId: string; dbTracks: { id: string; title: string }[] } | null = null;

    if (resolved) {
      await sleep(500);
      albumResult = await resolveAlbumTracks(supabase, resolved);
    }

    if (!albumResult) {
      await sleep(300);
      const lastfmTrack = await getTrackInfo(group.artistName, group.trackName);
      if (lastfmTrack) {
        if (lastfmTrack.albumName) {
          // O Last.fm sabe o álbum mesmo sem o scrobble ter informado —
          // tenta esse caminho antes de criar algo sintético.
          await sleep(300);
          const lastfmAlbum = await getAlbumInfo(group.artistName, lastfmTrack.albumName);
          if (lastfmAlbum) {
            const album = await ensureLastfmAlbumExists(supabase, {
              artistName: lastfmAlbum.artistName,
              albumTitle: lastfmAlbum.title,
              coverUrl: lastfmAlbum.coverUrl,
              tracks:
                lastfmAlbum.tracks.length > 0
                  ? lastfmAlbum.tracks
                  : [{ title: group.trackName, trackNumber: 1, durationSeconds: lastfmTrack.durationSeconds }],
            });
            if (album) {
              const { data: dbTracks } = await supabase
                .from("tracks")
                .select("id, title")
                .eq("album_id", album.id);
              if (dbTracks) {
                albumResult = { albumId: album.id, dbTracks };
                stats.viaLastfm++;
              }
            }
          }
        }

        // Sem álbum nem na fonte nenhuma — cria um "álbum" de uma faixa só,
        // melhor do que perder a escuta.
        if (!albumResult) {
          const album = await ensureLastfmAlbumExists(supabase, {
            artistName: lastfmTrack.artistName,
            albumTitle: lastfmTrack.title,
            coverUrl: null,
            tracks: [{ title: lastfmTrack.title, trackNumber: 1, durationSeconds: lastfmTrack.durationSeconds }],
          });
          if (album) {
            const { data: dbTracks } = await supabase
              .from("tracks")
              .select("id, title")
              .eq("album_id", album.id);
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
        stats.skippedExamples.push(`[música] ${group.artistName} — ${group.trackName}`);
      }
      await sleep(300);
      continue;
    }

    await registerListens(supabase, albumResult.dbTracks, group.scrobbles, stats);
    await sleep(500);
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
    viaLastfm: stats.viaLastfm,
    skippedExamples: stats.skippedExamples,
  });
}
