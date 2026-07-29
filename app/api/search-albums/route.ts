import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  searchAlbumsAndSongs,
  searchArtists,
  getArtistAlbums,
  type MBRelease,
} from "@/lib/musicbrainz";

// Cliente simples (sem sessão de usuário) só pra ler dados públicos —
// a tabela albums é de leitura pública (ver schema.sql), então a anon key
// já basta aqui.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query precisa ter pelo menos 2 caracteres." },
      { status: 400 }
    );
  }

  try {
    const [freeTextResults, artists] = await Promise.all([
      searchAlbumsAndSongs(q),
      searchArtists(q).catch(() => []),
    ]);

    // Quando a busca claramente bate com um artista, os álbuns oficiais
    // dele (discografia real, sem remix/cover/bootleg de terceiros) vão
    // pro topo — é uma fonte bem mais limpa que a busca livre por texto,
    // que mistura qualquer coisa que mencione o nome do artista.
    let officialResults: MBRelease[] = [];
    const topArtist = artists[0];
    if (topArtist && topArtist.score >= 90) {
      const albums = await getArtistAlbums(topArtist.id);
      officialResults = albums.slice(0, 8).map((a) => ({
        id: a.id,
        title: a.title,
        artistName: topArtist.name,
        artistId: topArtist.id,
        year: a.year,
        durationSeconds: null,
        coverUrl: a.coverUrl,
        matchedTrack: null,
        score: 1000, // sempre acima dos resultados de texto livre
      }));
    }

    // Deduplica (prioriza a versão "oficial" quando o mesmo álbum aparece
    // nos dois lugares) e ordena por score.
    const byId = new Map<string, MBRelease>();
    for (const item of [...freeTextResults, ...officialResults]) {
      const existing = byId.get(item.id);
      if (!existing || item.score > existing.score) byId.set(item.id, item);
    }
    const results = Array.from(byId.values()).sort((a, b) => b.score - a.score);

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

    return NextResponse.json({ results: enriched, artists });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Erro ao buscar na MusicBrainz." },
      { status: 502 }
    );
  }
}
