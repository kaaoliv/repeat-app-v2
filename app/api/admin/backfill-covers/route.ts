import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAlbumInfo } from "@/lib/lastfm";

// Rota de manutenção — não roda sozinha, é pra você chamar uma vez (ou de
// vez em quando) colando a URL no navegador com o secret. Corrige álbuns
// que ficaram sem capa (ou com uma capa da MusicBrainz que não existe de
// verdade) puxando do Last.fm em vez disso.
export const maxDuration = 60;
const TIME_BUDGET_MS = 50_000;

async function coverExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createSupabaseAdminClient();

  const { data: albums } = await supabase
    .from("albums")
    .select("id, title, cover_url, source, artists(name)")
    .order("created_at", { ascending: true });

  let checked = 0;
  let fixed = 0;
  let stillMissing = 0;
  let timedOut = false;

  for (const album of albums ?? []) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }

    checked++;
    const artistName = (album.artists as any)?.name;
    if (!artistName) continue;

    const hasValidCover = album.cover_url ? await coverExists(album.cover_url) : false;
    if (hasValidCover) continue;

    const lastfmAlbum = await getAlbumInfo(artistName, album.title).catch(() => null);
    if (lastfmAlbum?.coverUrl) {
      await supabase.from("albums").update({ cover_url: lastfmAlbum.coverUrl }).eq("id", album.id);
      fixed++;
    } else {
      stillMissing++;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({
    totalAlbums: (albums ?? []).length,
    checked,
    fixed,
    stillMissing,
    timedOut,
  });
}
