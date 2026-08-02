import { NextRequest, NextResponse } from "next/server";
import { getAlbumBasicInfo, getArtistDescription } from "@/lib/musicbrainz";

// Separado do resto dos dados do álbum de propósito: a cadeia
// MusicBrainz → Wikidata → Wikipedia é a parte mais lenta de tudo (3
// serviços externos em sequência). Botando isso numa rota à parte, a
// tela de álbum consegue mostrar capa/faixas na hora e só complementa
// com a biografia quando ela chegar, sem travar a resposta principal.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: releaseGroupId } = await params;

  if (releaseGroupId.startsWith("lastfm:")) {
    return NextResponse.json({ description: null });
  }

  const basicInfo = await getAlbumBasicInfo(releaseGroupId);
  if (!basicInfo) {
    return NextResponse.json({ description: null });
  }

  const description = await getArtistDescription(basicInfo.artistId).catch(() => null);
  return NextResponse.json({ description });
}
