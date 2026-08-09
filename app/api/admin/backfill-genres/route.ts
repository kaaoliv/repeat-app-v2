import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAlbumGenres } from "@/lib/musicbrainz";
import { getAlbumInfo, getArtistGenres } from "@/lib/lastfm";

// Rota de manutenção — não roda sozinha, é pra chamar uma vez (ou de vez
// em quando) colando a URL com o secret. Preenche o campo `genres` dos
// álbuns que ainda estão sem (null ou array vazio):
//   - source = 'musicbrainz' -> busca via getAlbumGenres (MusicBrainz)
//   - source = 'lastfm'      -> busca via tags do álbum, com fallback
//                                pras tags do artista
export const maxDuration = 60;
const TIME_BUDGET_MS = 50_000;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createSupabaseAdminClient();

  const { data: albums } = await supabase
    .from("albums")
    .select("id, title, source, musicbrainz_id, artists(name)")
    .or("genres.is.null,genres.eq.{}")
    .order("created_at", { ascending: true });

  let checked = 0;
  let filled = 0;
  let stillMissing = 0;
  let timedOut = false;

  for (const album of albums ?? []) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }

    checked++;
    const artistName = (album.artists as any)?.name;

    let genres: string[] = [];

    if (album.source === "lastfm") {
      if (artistName) {
        const lastfmAlbum = await getAlbumInfo(artistName, album.title).catch(() => null);
        genres = lastfmAlbum?.genres ?? [];
        if (genres.length === 0) {
          genres = await getArtistGenres(artistName).catch(() => []);
        }
      }
    } else {
      // musicbrainz_id aqui é o release-group id de verdade.
      genres = await getAlbumGenres(album.musicbrainz_id!).catch(() => []);
    }

    if (genres.length > 0) {
      await supabase.from("albums").update({ genres }).eq("id", album.id);
      filled++;
    } else {
      stillMissing++;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({
    totalAlbums: (albums ?? []).length,
    checked,
    filled,
    stillMissing,
    timedOut,
    note: timedOut
      ? "Time budget estourado — chama essa rota de novo (mesma URL) pra continuar de onde parou."
      : "Concluído.",
  });
}
