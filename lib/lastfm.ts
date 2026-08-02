const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

export type LastfmScrobble = {
  artistName: string;
  artistMbid: string | null;
  albumName: string;
  albumMbid: string | null;
  trackName: string;
  trackMbid: string | null;
  scrobbledAt: number | null; // timestamp unix, null = "tocando agora"
  nowPlaying: boolean;
};

export type LastfmAlbumInfo = {
  title: string;
  artistName: string;
  mbid: string | null;
  coverUrl: string | null;
  tracks: { title: string; trackNumber: number; durationSeconds: number | null }[];
};

// Última linha de defesa quando a MusicBrainz não acha o álbum de jeito
// nenhum (comum em funk/DJ brasileiro, covers de fã, etc.) — pega os
// dados direto do próprio Last.fm, que costuma ter catálogo mais amplo
// pra esse tipo de conteúdo de nicho.
export async function getAlbumInfo(
  artistName: string,
  albumName: string
): Promise<LastfmAlbumInfo | null> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    method: "album.getinfo",
    artist: artistName,
    album: albumName,
    api_key: apiKey,
    format: "json",
  });

  const res = await fetch(`${LASTFM_BASE}?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  const album = data?.album;
  if (!album) return null;

  const images = album.image ?? [];
  const bestImage = [...images].reverse().find((i: any) => i["#text"]);

  const rawTracks = album.tracks?.track;
  const trackList = rawTracks ? (Array.isArray(rawTracks) ? rawTracks : [rawTracks]) : [];

  return {
    title: album.name,
    artistName: album.artist,
    mbid: album.mbid || null,
    coverUrl: bestImage?.["#text"] || null,
    tracks: trackList.map((t: any, i: number) => ({
      title: t.name,
      trackNumber: Number(t["@attr"]?.rank ?? i + 1),
      durationSeconds: t.duration ? Number(t.duration) : null,
    })),
  };
}

export type LastfmTrackInfo = {
  title: string;
  artistName: string;
  albumName: string | null;
  albumMbid: string | null;
  durationSeconds: number | null;
};

// Mesma ideia, mas quando nem o nome do álbum a gente tem (scrobble sem
// álbum) — pergunta pro Last.fm o que ele sabe sobre essa música.
export async function getTrackInfo(
  artistName: string,
  trackName: string
): Promise<LastfmTrackInfo | null> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    method: "track.getinfo",
    artist: artistName,
    track: trackName,
    api_key: apiKey,
    format: "json",
  });

  const res = await fetch(`${LASTFM_BASE}?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  const track = data?.track;
  if (!track) return null;

  return {
    title: track.name,
    artistName: track.artist?.name ?? artistName,
    albumName: track.album?.title ?? null,
    albumMbid: track.album?.mbid || null,
    durationSeconds: track.duration ? Math.round(Number(track.duration) / 1000) : null,
  };
}

// Confirma que um username existe no Last.fm (usado ao conectar a conta).
export async function verifyLastfmUser(username: string): Promise<boolean> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return false;

  const url = `${LASTFM_BASE}?method=user.getinfo&user=${encodeURIComponent(
    username
  )}&api_key=${apiKey}&format=json`;

  const res = await fetch(url);
  if (!res.ok) return false;
  const data = await res.json();
  return !data.error;
}

// Busca as escutas recentes de alguém no Last.fm. Por padrão só traz
// scrobbles depois de `since` (timestamp unix), pra sincronização
// incremental não reprocessar tudo toda vez.
export async function getRecentScrobbles(
  username: string,
  since?: number,
  limit = 200
): Promise<LastfmScrobble[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: username,
    api_key: apiKey,
    format: "json",
    limit: String(limit),
  });
  if (since) params.set("from", String(since));

  const res = await fetch(`${LASTFM_BASE}?${params.toString()}`);
  if (!res.ok) return [];

  const data = await res.json();
  const tracks = data?.recenttracks?.track;
  if (!tracks) return [];

  const list = Array.isArray(tracks) ? tracks : [tracks];

  return list.map((t: any) => ({
    artistName: t.artist?.["#text"] ?? t.artist?.name ?? "",
    artistMbid: t.artist?.mbid || null,
    albumName: t.album?.["#text"] ?? "",
    albumMbid: t.album?.mbid || null,
    trackName: t.name ?? "",
    trackMbid: t.mbid || null,
    scrobbledAt: t.date?.uts ? Number(t.date.uts) : null,
    nowPlaying: t["@attr"]?.nowplaying === "true",
  }));
}
