import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchAlbumsAndSongs } from "@/lib/musicbrainz";

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
    const results = await searchAlbumsAndSongs(q);

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
      durationSeconds: durationById.get(r.id) ?? null,
    }));

    return NextResponse.json({ results: enriched });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Erro ao buscar na MusicBrainz." },
      { status: 502 }
    );
  }
}
