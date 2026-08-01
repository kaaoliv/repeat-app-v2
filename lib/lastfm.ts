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
