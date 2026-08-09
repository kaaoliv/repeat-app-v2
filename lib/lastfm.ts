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
  genres: string[];
  tracks: { title: string; trackNumber: number; durationSeconds: number | null }[];
};

// As "tags" do Last.fm são folksonomia livre (qualquer usuário pode
// aplicar), então misturam gênero de verdade com humor/vibe ("2020s",
// "favorite", "sexy"). Filtramos as óbvias não-gênero e pegamos as top 3
// que sobrarem — não é perfeito, mas cobre a maioria dos casos.
const NON_GENRE_TAGS = new Set([
  "favorite", "favorites", "favourite", "favourites", "seen live", "beautiful",
  "sexy", "awesome", "amazing", "love", "loved", "chill", "cool", "good",
  "great", "best", "epic", "catchy", "male vocalists", "female vocalists",
  "under 2000 listeners", "spotify",
]);

function filterGenreTags(tags: string[]): string[] {
  return tags
    .filter((t) => !NON_GENRE_TAGS.has(t.toLowerCase()) && !/^\d{4}s?$/.test(t))
    .slice(0, 3);
}

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

  const rawTags = album.tags?.tag;
  const tagList = rawTags ? (Array.isArray(rawTags) ? rawTags : [rawTags]) : [];
  const genres = filterGenreTags(tagList.map((t: any) => t.name).filter(Boolean));

  return {
    title: album.name,
    artistName: album.artist,
    mbid: album.mbid || null,
    coverUrl: bestImage?.["#text"] || null,
    genres,
    tracks: trackList.map((t: any, i: number) => ({
      title: t.name,
      trackNumber: Number(t["@attr"]?.rank ?? i + 1),
      durationSeconds: t.duration ? Number(t.duration) : null,
    })),
  };
}

// Busca só as tags/gêneros de um artista — usado como último fallback
// quando o álbum em si não tem tags (comum em singles/faixas avulsas),
// já que geralmente o artista tem tags mais consistentes.
export async function getArtistGenres(artistName: string): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    method: "artist.gettoptags",
    artist: artistName,
    api_key: apiKey,
    format: "json",
  });

  const res = await fetch(`${LASTFM_BASE}?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  const rawTags = data?.toptags?.tag;
  const tagList = rawTags ? (Array.isArray(rawTags) ? rawTags : [rawTags]) : [];
  return filterGenreTags(tagList.map((t: any) => t.name).filter(Boolean));
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
// Busca as escutas recentes de alguém no Last.fm. A API devolve do mais
// recente pro mais antigo — se só pegássemos uma página, qualquer coisa
// além do limite ficaria pra trás pra sempre (é exatamente o bug que
// resolvemos aqui: pagina até cobrir tudo desde `since`, ou até um teto
// de segurança, em vez de confiar numa página só).
export async function getRecentScrobbles(
  username: string,
  since?: number,
  maxItems = 500
): Promise<LastfmScrobble[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  const perPage = 200; // máximo permitido pela API do Last.fm
  const maxPages = Math.ceil(maxItems / perPage);
  const all: LastfmScrobble[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      method: "user.getrecenttracks",
      user: username,
      api_key: apiKey,
      format: "json",
      limit: String(perPage),
      page: String(page),
    });
    if (since) params.set("from", String(since));

    const res = await fetch(`${LASTFM_BASE}?${params.toString()}`);
    if (!res.ok) break;

    const data = await res.json();
    const tracks = data?.recenttracks?.track;
    if (!tracks) break;

    const list = Array.isArray(tracks) ? tracks : [tracks];
    if (list.length === 0) break;

    all.push(
      ...list.map((t: any) => ({
        artistName: t.artist?.["#text"] ?? t.artist?.name ?? "",
        artistMbid: t.artist?.mbid || null,
        albumName: t.album?.["#text"] ?? "",
        albumMbid: t.album?.mbid || null,
        trackName: t.name ?? "",
        trackMbid: t.mbid || null,
        scrobbledAt: t.date?.uts ? Number(t.date.uts) : null,
        nowPlaying: t["@attr"]?.nowplaying === "true",
      }))
    );

    const totalPages = Number(data?.recenttracks?.["@attr"]?.totalPages ?? 1);
    if (page >= totalPages || all.length >= maxItems) break;
  }

  return all.slice(0, maxItems);
}
