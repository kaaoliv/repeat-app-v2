import { NextRequest, NextResponse } from "next/server";
import { getArtistAlbums, getArtistDescription, mbFetch } from "@/lib/musicbrainz";

const MB_BASE = "https://musicbrainz.org/ws/2";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: artistId } = await params;

  const artistRes = await mbFetch(`${MB_BASE}/artist/${artistId}?fmt=json`, 3600);

  if (!artistRes || !artistRes.ok) {
    return NextResponse.json(
      {
        error:
          "Artista não encontrado (ou a MusicBrainz está sobrecarregada — tenta de novo em alguns segundos).",
      },
      { status: 404 }
    );
  }

  const artist = await artistRes.json();

  const [albums, description] = await Promise.all([
    getArtistAlbums(artistId),
    getArtistDescription(artistId).catch(() => null),
  ]);

  return NextResponse.json({
    artist: { id: artist.id, name: artist.name },
    description,
    albums,
  });
}
