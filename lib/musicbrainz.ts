// A MusicBrainz API é gratuita e não exige chave, mas exige um User-Agent
// identificando a aplicação (é a única regra deles). Ver:
// https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "RepeatApp/0.1 (contato@garfado.com.br)";

export type MBRelease = {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  year: string | null;
  durationSeconds: number | null;
  coverUrl: string | null;
};

// Busca "release groups" (álbuns) por nome, já trazendo artista.
export async function searchAlbums(query: string): Promise<MBRelease[]> {
  const url = `${MB_BASE}/release-group/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=10`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // MusicBrainz pede no máx. 1 req/s por IP — cache curto evita repetição
    // acidental em navegação rápida.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`MusicBrainz respondeu ${res.status}`);
  }

  const data = await res.json();

  return (data["release-groups"] ?? []).map((rg: any) => ({
    id: rg.id,
    title: rg.title,
    artistName: rg["artist-credit"]?.[0]?.name ?? "Artista desconhecido",
    artistId: rg["artist-credit"]?.[0]?.artist?.id ?? "",
    year: rg["first-release-date"]?.slice(0, 4) || null,
    durationSeconds: null, // duração vem só da "release" específica; ver getReleaseDuration
    coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
  }));
}

// Busca a duração total (soma das faixas) de uma release específica.
// Como o release-group não tem duração direta, pegamos a primeira release
// associada e somamos as faixas.
export async function getReleaseGroupDuration(
  releaseGroupId: string
): Promise<number | null> {
  const searchUrl = `${MB_BASE}/release?release-group=${releaseGroupId}&fmt=json&limit=1&inc=recordings`;

  const res = await fetch(searchUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const release = data.releases?.[0];
  if (!release) return null;

  let totalMs = 0;
  for (const medium of release.media ?? []) {
    for (const track of medium.tracks ?? []) {
      totalMs += track.length ?? 0;
    }
  }

  return totalMs > 0 ? Math.round(totalMs / 1000) : null;
}
