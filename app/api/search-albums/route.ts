import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  searchAlbumsAndSongs,
  searchArtists,
  getArtistAlbums,
  getArtistDescription,
  type MBRelease,
} from "@/lib/musicbrainz";
import { getAlbumInfo, getTrackInfo, searchTracks } from "@/lib/lastfm";
import { searchAlbumCover } from "@/lib/spotify";

// Cliente simples (sem sessão de usuário) só pra ler dados públicos —
// a tabela albums é de leitura pública (ver schema.sql), então a anon key
// já basta aqui.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Quando a MusicBrainz vem fraca (comum em funk/trap nacional, que ela
// cataloga mal), completa com busca livre no Last.fm. Cada faixa achada
// vira um resultado "single" (ou usa o álbum de verdade se o Last.fm
// souber qual é) com id sintético "lastfm:album:...", no mesmo esquema
// que já usamos pra sincronização de scrobble.
async function searchLastfmFallback(
  query: string,
  alreadyHave: Set<string>
): Promise<MBRelease[]> {
  const matches = await searchTracks(query).catch(() => []);
  const results: MBRelease[] = [];

  for (const match of matches) {
    const dedupeKey = `${match.artist.toLowerCase()}|${match.title.toLowerCase()}`;
    if (alreadyHave.has(dedupeKey)) continue;
    alreadyHave.add(dedupeKey);

    const [albumInfo, trackInfo, spotifyCover] = await Promise.all([
      getAlbumInfo(match.artist, match.title).catch(() => null),
      getTrackInfo(match.artist, match.title).catch(() => null),
      searchAlbumCover(match.artist, match.title).catch(() => null),
    ]);

    const albumTitle = albumInfo?.title || match.title;
    const coverUrl = albumInfo?.coverUrl || spotifyCover?.coverUrl || null;
    const durationSeconds = trackInfo?.durationSeconds ?? null;

    const syntheticId = `lastfm:album:${slugify(match.artist)}:${slugify(albumTitle)}`;

    results.push({
      id: syntheticId,
      title: albumTitle,
      artistName: match.artist,
      artistId: "",
      year: null,
      durationSeconds: null,
      coverUrl,
      matchedTrack: { title: match.title, durationSeconds },
      score: 60, // abaixo dos resultados reais da MusicBrainz, mas visível
      source: "lastfm",
    });

    if (results.length >= 6) break;
  }

  return results;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query precisa ter pelo menos 2 caracteres." },
      { status: 400 }
    );
  }

  try {
    // Dispara as duas buscas principais ao mesmo tempo, mas sem esperar
    // as duas terminarem antes de seguir — assim que soubermos o artista
    // (searchArtists), já disparamos a busca de álbuns oficiais dele em
    // paralelo com o que ainda falta da busca livre, em vez de empilhar
    // uma chamada inteira depois da outra.
    const freeTextPromise = searchAlbumsAndSongs(q);
    const artists = await searchArtists(q).catch(() => []);

    const topArtist = artists[0];
    const officialAlbumsPromise =
      topArtist && topArtist.score >= 90 ? getArtistAlbums(topArtist.id) : Promise.resolve([]);

    const [freeTextResults, albums] = await Promise.all([freeTextPromise, officialAlbumsPromise]);

    // Quando a busca claramente bate com um artista, os álbuns oficiais
    // dele (discografia real, sem remix/cover/bootleg de terceiros) vão
    // pro topo — é uma fonte bem mais limpa que a busca livre por texto,
    // que mistura qualquer coisa que mencione o nome do artista.
    const officialResults: MBRelease[] = topArtist
      ? albums.slice(0, 8).map((a) => ({
          id: a.id,
          title: a.title,
          artistName: topArtist.name,
          artistId: topArtist.id,
          year: a.year,
          durationSeconds: null,
          coverUrl: a.coverUrl,
          matchedTrack: null,
          score: 1000, // sempre acima dos resultados de texto livre
        }))
      : [];

    // Deduplica (prioriza a versão "oficial" quando o mesmo álbum aparece
    // nos dois lugares) e ordena por score.
    const byId = new Map<string, MBRelease>();
    for (const item of [...freeTextResults, ...officialResults]) {
      const existing = byId.get(item.id);
      if (!existing || item.score > existing.score) byId.set(item.id, item);
    }
    let results = Array.from(byId.values()).sort((a, b) => b.score - a.score);

    // A MusicBrainz veio fraca — completa com Last.fm. Cobre bem conteúdo
    // de nicho brasileiro (funk, trap nacional) que ela cataloga mal.
    if (results.length < 5) {
      const alreadyHave = new Set(
        results.map((r) => `${r.artistName.toLowerCase()}|${r.title.toLowerCase()}`)
      );
      const lastfmResults = await searchLastfmFallback(q, alreadyHave);
      results = [...results, ...lastfmResults];
    }

    // Preenche duração de álbum a partir do nosso cache (albums.duration_seconds),
    // pra quem já foi marcado como ouvido antes por alguém. Evita bater na
    // MusicBrainz de novo pra cada busca.
    const musicbrainzIds = results.map((r) => r.id);
    const { data: cached } = await supabase
      .from("albums")
      .select("musicbrainz_id, duration_seconds")
      .in("musicbrainz_id", musicbrainzIds);

    const durationById = new Map(
      (cached ?? []).map((a) => [a.musicbrainz_id, a.duration_seconds])
    );

    const enriched = results.map((r) => ({
      ...r,
      durationSeconds: r.durationSeconds ?? durationById.get(r.id) ?? null,
    }));

    // Foto de cada artista (só os retornados pela busca de artista em si,
    // no máximo 5 — controlado lá em searchArtists). Usa a mesma cadeia
    // MusicBrainz → Wikidata → Wikipedia da tela de perfil do artista.
    // Se algum falhar (artista sem página), só fica sem foto — não quebra
    // a busca.
    const artistsWithPhoto = await Promise.all(
      artists.map(async (a) => {
        const description = await getArtistDescription(a.id).catch(() => null);
        return { ...a, imageUrl: description?.imageUrl ?? null };
      })
    );

    return NextResponse.json({ results: enriched, artists: artistsWithPhoto });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Erro ao buscar na MusicBrainz." },
      { status: 502 }
    );
  }
}
