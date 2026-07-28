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
  // Preenchido quando esse álbum apareceu na busca por causa de uma
  // música específica bater com o texto pesquisado (não o nome do álbum).
  matchedTrack: { title: string; durationSeconds: number | null } | null;
  score: number;
};

// Busca "release groups" (álbuns) por nome, já trazendo artista + score
// de relevância que o próprio MusicBrainz calcula (usamos como aproximação
// de "mais conhecido" — releases oficiais e correspondências exatas
// pontuam mais alto que bootlegs, demos, etc).
async function searchAlbumsRaw(query: string): Promise<MBRelease[]> {
  const url = `${MB_BASE}/release-group/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=12`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`MusicBrainz respondeu ${res.status}`);

  const data = await res.json();

  return (data["release-groups"] ?? []).map((rg: any) => ({
    id: rg.id,
    title: rg.title,
    artistName: rg["artist-credit"]?.[0]?.name ?? "Artista desconhecido",
    artistId: rg["artist-credit"]?.[0]?.artist?.id ?? "",
    year: rg["first-release-date"]?.slice(0, 4) || null,
    durationSeconds: null,
    coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
    matchedTrack: null,
    score: Number(rg.score ?? 0),
  }));
}

// Busca músicas (recordings) por nome. Cada resultado já vem com duração
// exata (não precisa de chamada extra) e, quando disponível, com o álbum
// (release-group) ao qual a faixa pertence — é isso que usamos pra
// mostrar o álbum na lista de resultados mesmo quando a pessoa digitou
// o nome de uma música, não do disco.
async function searchSongsRaw(query: string): Promise<MBRelease[]> {
  const url = `${MB_BASE}/recording/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=15`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`MusicBrainz respondeu ${res.status}`);

  const data = await res.json();

  const results: MBRelease[] = [];

  for (const rec of data.recordings ?? []) {
    const release = rec.releases?.[0];
    const releaseGroup = release?.["release-group"];
    if (!releaseGroup?.id) continue; // sem álbum associado, não dá pra "marcar como ouvido"

    results.push({
      id: releaseGroup.id,
      title: releaseGroup.title ?? release.title,
      artistName: rec["artist-credit"]?.[0]?.name ?? "Artista desconhecido",
      artistId: rec["artist-credit"]?.[0]?.artist?.id ?? "",
      year: releaseGroup["first-release-date"]?.slice(0, 4) || null,
      durationSeconds: null,
      coverUrl: `https://coverartarchive.org/release-group/${releaseGroup.id}/front-250`,
      matchedTrack: {
        title: rec.title,
        durationSeconds: rec.length ? Math.round(rec.length / 1000) : null,
      },
      score: Number(rec.score ?? 0),
    });
  }

  return results;
}

// Busca combinada: álbuns + músicas, deduplicados por álbum (release-group)
// e ordenados por relevância (score do MusicBrainz), que funciona como uma
// aproximação razoável de "mais conhecido primeiro" — correspondências
// exatas em releases oficiais pontuam mais alto que raridades/bootlegs.
export async function searchAlbumsAndSongs(query: string): Promise<MBRelease[]> {
  const [albums, songs] = await Promise.all([
    searchAlbumsRaw(query).catch(() => []),
    searchSongsRaw(query).catch(() => []),
  ]);

  const byId = new Map<string, MBRelease>();

  for (const item of [...albums, ...songs]) {
    const existing = byId.get(item.id);
    if (!existing || item.score > existing.score) {
      byId.set(item.id, {
        ...item,
        matchedTrack: item.matchedTrack ?? existing?.matchedTrack ?? null,
      });
    } else if (!existing.matchedTrack && item.matchedTrack) {
      existing.matchedTrack = item.matchedTrack;
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
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
