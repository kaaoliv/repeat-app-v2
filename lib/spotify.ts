const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

// Client Credentials Flow — não precisa de login de usuário, só client
// id/secret do app criado no Spotify Developer Dashboard. Usado como
// fallback quando o Last.fm não tem capa (ou devolve o campo de imagem
// vazio via API, mesmo tendo capa no site).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;

  // expires_in vem em segundos (normalmente 3600). Guarda com uma margem
  // de segurança de 60s antes de considerar expirado.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.value;
}

export type SpotifyAlbumCover = {
  coverUrl: string;
  spotifyAlbumId: string;
};

// Busca a capa de um álbum no Spotify. Usa busca textual (artista +
// título) já que raramente teremos o ID do Spotify de antemão — vindo
// da MusicBrainz ou do Last.fm, os IDs não batem entre plataformas.
export async function searchAlbumCover(
  artistName: string,
  albumTitle: string
): Promise<SpotifyAlbumCover | null> {
  const token = await getSpotifyAccessToken();
  if (!token) return null;

  const query = `album:${albumTitle} artist:${artistName}`;
  const params = new URLSearchParams({
    q: query,
    type: "album",
    limit: "1",
  });

  const res = await fetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const data = await res.json();
  const album = data?.albums?.items?.[0];
  if (!album) return null;

  // Imagens vêm ordenadas da maior pra menor; pega a maior.
  const bestImage = album.images?.[0];
  if (!bestImage?.url) return null;

  return {
    coverUrl: bestImage.url,
    spotifyAlbumId: album.id,
  };
}
