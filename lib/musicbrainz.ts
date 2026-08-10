import { normalizeGenres } from "./genre-taxonomy";

// A MusicBrainz API é gratuita e não exige chave, mas exige um User-Agent
// identificando a aplicação (é a única regra deles). Ver:
// https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "RepeatApp/0.1 (contato@garfado.com.br)";

// A MusicBrainz limita a ~1 requisição/segundo sem chave de API. Em picos
// de uso (várias buscas em sequência), é comum levar um 429/503 — esse
// helper tenta de novo automaticamente antes de desistir.
export async function mbFetch(url: string, revalidate = 60): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate },
    });
    if (res.ok) return res;
    if (res.status !== 429 && res.status !== 503) return res; // erro real, não adianta repetir
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  return null;
}

export type MBArtist = {
  id: string;
  name: string;
  disambiguation: string | null;
  score: number;
};

// Busca artistas por nome. Se a busca exata não achar nada (comum em
// erros de digitação, tipo "madona" em vez de "Madonna"), tenta de novo
// com busca fuzzy (tolera pequenas diferenças de grafia).
export async function searchArtists(query: string): Promise<MBArtist[]> {
  const tryFetch = async (q: string) => {
    const url = `${MB_BASE}/artist/?query=${encodeURIComponent(q)}&fmt=json&limit=5`;
    const res = await mbFetch(url);
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.artists ?? []) as any[];
  };

  let raw = await tryFetch(query);

  // Nada encontrado com a grafia exata — tenta busca aproximada (fuzzy).
  if (raw.length === 0) {
    const escaped = query.replace(/["\\]/g, "\\$&");
    raw = await tryFetch(`${escaped}~`);
  }

  return raw
    .filter((a) => Number(a.score ?? 0) >= 70) // corta resultados muito fracos
    .map((a) => ({
      id: a.id,
      name: a.name,
      disambiguation: a.disambiguation || null,
      score: Number(a.score ?? 0),
    }));
}

export type ResolvedAlbum = {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  year: string | null;
  coverUrl: string;
};

// Busca um álbum específico por nome de artista + nome do álbum — usado
// quando uma fonte externa (Last.fm) não traz o id da MusicBrainz direto.
// Já retorna os dados completos (não só o id), pra evitar uma segunda
// chamada de "buscar informações do álbum" logo depois — importante pra
// não estourar o rate limit da MusicBrainz quando processando um lote
// grande de escutas (tipo na sincronização do Last.fm).
export async function findAlbumByArtistAndTitle(
  artistName: string,
  albumName: string
): Promise<ResolvedAlbum | null> {
  // A MusicBrainz guarda o release-group sem sufixo de edição na maioria
  // dos casos ("Believe", não "Believe (Deluxe Edition)") — removendo
  // isso antes de buscar evita perder matches óbvios.
  const cleanAlbumName = albumName
    .replace(/\s*[\(\[](deluxe|expanded|anniversary|remaster(ed)?|special|bonus|collector'?s|super)[^)\]]*[\)\]]\s*/gi, "")
    .trim();

  const escapedArtist = artistName.replace(/["\\]/g, "\\$&");
  const escapedAlbum = cleanAlbumName.replace(/["\\]/g, "\\$&");
  const query = `artist:"${escapedArtist}" AND releasegroup:"${escapedAlbum}"`;
  const url = `${MB_BASE}/release-group/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=3`;

  const res = await mbFetch(url);
  if (!res || !res.ok) return null;

  const data = await res.json();
  const best = (data["release-groups"] ?? [])[0];
  if (!best || Number(best.score ?? 0) < 70) return null;

  return {
    id: best.id,
    title: best.title,
    artistName: best["artist-credit"]?.[0]?.name ?? artistName,
    artistId: best["artist-credit"]?.[0]?.artist?.id ?? "",
    year: best["first-release-date"]?.slice(0, 4) || null,
    coverUrl: `https://coverartarchive.org/release-group/${best.id}/front-250`,
  };
}

// Busca o álbum a partir de artista + nome da MÚSICA (não do álbum) —
// usado quando o Last.fm não informa o álbum do scrobble, o que é comum
// (varia por fonte: rádio, alguns players, faixas sem match perfeito).
// Acha a gravação (recording) e retorna dados do release-group da
// primeira release associada a ela.
export async function findAlbumByArtistAndTrack(
  artistName: string,
  trackName: string
): Promise<ResolvedAlbum | null> {
  const escapedArtist = artistName.replace(/["\\]/g, "\\$&");
  const escapedTrack = trackName.replace(/["\\]/g, "\\$&");
  const query = `artist:"${escapedArtist}" AND recording:"${escapedTrack}"`;
  const url = `${MB_BASE}/recording/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=5`;

  const res = await mbFetch(url);
  if (!res || !res.ok) return null;

  const data = await res.json();
  const recordings = data.recordings ?? [];

  for (const rec of recordings) {
    if (Number(rec.score ?? 0) < 70) break; // já ordenado por score, pode parar
    const release = rec.releases?.[0];
    const rg = release?.["release-group"];
    if (!rg?.id) continue;
    return {
      id: rg.id,
      title: rg.title ?? release.title,
      artistName: rec["artist-credit"]?.[0]?.name ?? artistName,
      artistId: rec["artist-credit"]?.[0]?.artist?.id ?? "",
      year: rg["first-release-date"]?.slice(0, 4) || null,
      coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
    };
  }
  return null;
}

export type MBNewRelease = MBArtistAlbum & { artistName: string };

// Busca lançamentos recentes. A MusicBrainz não tem um endpoint dedicado
// de "novidades" (diferente do Spotify, que descontinuou o dele em 2026),
// então buscamos releases do tipo "Album" com data de lançamento dentro
// do ano corrente/anterior e ordenamos pela data mais recente nós mesmos.
export async function getNewReleases(): Promise<MBNewRelease[]> {
  const currentYear = new Date().getFullYear();
  const query = `primarytype:Album AND (firstreleasedate:[${currentYear - 1}-01-01 TO ${currentYear}-12-31])`;
  const url = `${MB_BASE}/release-group/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=25`;

  const res = await mbFetch(url, 3600);
  if (!res || !res.ok) return [];

  const data = await res.json();
  const albums: (MBNewRelease & { releaseDate: string })[] = (
    data["release-groups"] ?? []
  ).map((rg: any) => ({
    id: rg.id,
    title: rg.title,
    year: rg["first-release-date"]?.slice(0, 4) || null,
    coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
    primaryType: rg["primary-type"] ?? null,
    artistName: rg["artist-credit"]?.[0]?.name ?? "Artista desconhecido",
    releaseDate: rg["first-release-date"] ?? "",
  }));

  return albums
    .filter((a) => a.releaseDate)
    .sort((a, b) => (b.releaseDate < a.releaseDate ? -1 : 1))
    .slice(0, 12);
}

export type MBArtistAlbum = {
  id: string;
  title: string;
  year: string | null;
  coverUrl: string;
  primaryType: string | null;
};

// Lista os álbuns de um artista (usado na tela de perfil do artista),
// com os "Album" oficiais primeiro e depois o resto (EPs, ao vivo, etc),
// ordenados por ano mais recente primeiro dentro de cada grupo.
export async function getArtistAlbums(artistId: string): Promise<MBArtistAlbum[]> {
  const url = `${MB_BASE}/release-group/?artist=${artistId}&fmt=json&limit=50`;

  const res = await mbFetch(url, 3600);
  if (!res || !res.ok) return [];

  const data = await res.json();
  const albums: MBArtistAlbum[] = (data["release-groups"] ?? []).map((rg: any) => ({
    id: rg.id,
    title: rg.title,
    year: rg["first-release-date"]?.slice(0, 4) || null,
    coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
    primaryType: rg["primary-type"] ?? null,
  }));

  // Ordena só por ano (mais recente primeiro) — sem separar tipo, senão
  // vira dois blocos cronológicos emendados (todos os "Album" por ano,
  // depois todos os EP/single por ano), o que lido de cima a baixo não
  // parece ordenado de verdade. Sem ano vai pro fim.
  return albums.sort((a, b) => {
    if (!a.year && !b.year) return 0;
    if (!a.year) return 1;
    if (!b.year) return -1;
    return b.year.localeCompare(a.year);
  });
}

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
  // Ausente/"musicbrainz" = veio da busca normal. "lastfm" = resultado
  // de fallback (item que a MusicBrainz não cataloga), o id nesse caso
  // é uma chave sintética "lastfm:album:..." em vez de um MBID real.
  source?: "musicbrainz" | "lastfm";
};

// Busca "release groups" (álbuns) por nome, já trazendo artista + score
// de relevância que o próprio MusicBrainz calcula (usamos como aproximação
// de "mais conhecido" — releases oficiais e correspondências exatas
// pontuam mais alto que bootlegs, demos, etc).
async function searchAlbumsRaw(query: string): Promise<MBRelease[]> {
  // A MusicBrainz, sem prefixo de campo, só procura no título do álbum —
  // por isso buscar só "Bad Bunny" (nome de artista) não achava nada.
  // Aqui forçamos a busca em artista OU título do álbum.
  const escaped = query.replace(/["\\]/g, "\\$&");
  const luceneQuery = `artist:"${escaped}" OR releasegroup:"${escaped}"`;
  const url = `${MB_BASE}/release-group/?query=${encodeURIComponent(
    luceneQuery
  )}&fmt=json&limit=12`;

  const res = await mbFetch(url);
  if (!res || !res.ok) return [];

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
  const escaped = query.replace(/["\\]/g, "\\$&");
  const luceneQuery = `artist:"${escaped}" OR recording:"${escaped}"`;
  const url = `${MB_BASE}/recording/?query=${encodeURIComponent(
    luceneQuery
  )}&fmt=json&limit=15`;

  const res = await mbFetch(url);
  if (!res || !res.ok) return [];

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

export type MBAlbumBasicInfo = {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  year: string | null;
  coverUrl: string;
};

// Busca dados básicos de um álbum específico por id (usado na tela de
// álbum, quando já sabemos o id mas não temos mais o resto dos dados
// que vieram da busca).
export async function getAlbumBasicInfo(
  releaseGroupId: string
): Promise<MBAlbumBasicInfo | null> {
  const url = `${MB_BASE}/release-group/${releaseGroupId}?inc=artist-credits&fmt=json`;

  const res = await mbFetch(url, 3600);
  if (!res || !res.ok) return null;

  const rg = await res.json();

  return {
    id: rg.id,
    title: rg.title,
    artistName: rg["artist-credit"]?.[0]?.name ?? "Artista desconhecido",
    artistId: rg["artist-credit"]?.[0]?.artist?.id ?? "",
    year: rg["first-release-date"]?.slice(0, 4) || null,
    coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
  };
}

export type MBTrack = {
  recordingId: string;
  title: string;
  durationSeconds: number | null;
  trackNumber: number;
  discNumber: number;
};

// Busca a lista completa de faixas de um álbum (usa a primeira release
// associada ao release-group, igual à lógica de duração).
export async function getAlbumTracklist(
  releaseGroupId: string
): Promise<MBTrack[]> {
  const url = `${MB_BASE}/release?release-group=${releaseGroupId}&fmt=json&limit=1&inc=recordings`;

  const res = await mbFetch(url, 3600);
  if (!res || !res.ok) return [];

  const data = await res.json();
  const release = data.releases?.[0];
  if (!release) return [];

  const tracks: MBTrack[] = [];
  let discNumber = 1;
  for (const medium of release.media ?? []) {
    for (const track of medium.tracks ?? []) {
      tracks.push({
        recordingId: track.recording?.id ?? track.id,
        title: track.title,
        durationSeconds: track.length ? Math.round(track.length / 1000) : null,
        trackNumber: Number(track.number ?? track.position ?? 0),
        discNumber,
      });
    }
    discNumber++;
  }

  return tracks;
}

// Busca os gêneros de um álbum (o MusicBrainz agrega isso por votos da
// comunidade). Retorna os 3 mais votados.
export async function getAlbumGenres(releaseGroupId: string): Promise<string[]> {
  const url = `${MB_BASE}/release-group/${releaseGroupId}?inc=genres&fmt=json`;

  const res = await mbFetch(url, 3600);
  if (!res || !res.ok) return [];

  const data = await res.json();
  const genres = (data.genres ?? []) as { name: string; count: number }[];

  return normalizeGenres(
    genres
      .sort((a, b) => b.count - a.count)
      .map((g) => g.name)
  );
}

export type ArtistDescription = {
  text: string;
  wikipediaUrl: string;
  imageUrl: string | null;
};

// Busca uma descrição curta do artista via Wikipedia, seguindo a cadeia
// MusicBrainz (relação "wikidata") → Wikidata (sitelink da Wikipédia +
// foto, se tiver) → Wikipedia (resumo). Retorna null se qualquer passo
// não encontrar nada (nem todo artista tem página).
export async function getArtistDescription(
  artistMusicbrainzId: string
): Promise<ArtistDescription | null> {
  if (!artistMusicbrainzId) return null;

  try {
    const artistRes = await mbFetch(
      `${MB_BASE}/artist/${artistMusicbrainzId}?inc=url-rels&fmt=json`,
      86400
    );
    if (!artistRes || !artistRes.ok) return null;
    const artistData = await artistRes.json();

    const wikidataRel = (artistData.relations ?? []).find(
      (r: any) => r.type === "wikidata"
    );
    const wikidataUrl = wikidataRel?.url?.resource;
    const qidMatch = wikidataUrl?.match(/Q\d+$/);
    if (!qidMatch) return null;
    const qid = qidMatch[0];

    const wikidataRes = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } }
    );
    if (!wikidataRes.ok) return null;
    const wikidataData = await wikidataRes.json();
    const entity = wikidataData.entities?.[qid];
    const sitelinks = entity?.sitelinks;

    // P18 = propriedade "imagem" na Wikidata, aponta pro nome do arquivo
    // no Wikimedia Commons.
    const imageFilename =
      entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
    const imageUrl = imageFilename
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
          imageFilename
        )}?width=400`
      : null;

    const site = sitelinks?.ptwiki ?? sitelinks?.enwiki;
    if (!site) {
      // Sem página de texto, mas pode ser que tenha foto mesmo assim.
      return imageUrl ? { text: "", wikipediaUrl: "", imageUrl } : null;
    }

    const lang = sitelinks?.ptwiki ? "pt" : "en";
    const summaryRes = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        site.title
      )}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } }
    );
    if (!summaryRes.ok) return imageUrl ? { text: "", wikipediaUrl: "", imageUrl } : null;
    const summaryData = await summaryRes.json();

    return {
      text: summaryData.extract ?? "",
      wikipediaUrl: summaryData.content_urls?.desktop?.page ?? "",
      imageUrl: imageUrl ?? summaryData.thumbnail?.source ?? null,
    };
  } catch {
    return null;
  }
}

// Busca a duração total (soma das faixas) de uma release específica.
// Como o release-group não tem duração direta, pegamos a primeira release
// associada e somamos as faixas.
export async function getReleaseGroupDuration(
  releaseGroupId: string
): Promise<number | null> {
  const searchUrl = `${MB_BASE}/release?release-group=${releaseGroupId}&fmt=json&limit=1&inc=recordings`;

  const res = await mbFetch(searchUrl, 3600);
  if (!res || !res.ok) return null;

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
