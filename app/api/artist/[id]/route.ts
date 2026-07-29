import { NextRequest, NextResponse } from "next/server";
import { getArtistAlbums, getArtistDescription } from "@/lib/musicbrainz";

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "RepeatApp/0.1 (contato@garfado.com.br)";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: artistId } = await params;

  const artistRes = await fetch(`${MB_BASE}/artist/${artistId}?fmt=json`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!artistRes.ok) {
    return NextResponse.json({ error: "Artista não encontrado." }, { status: 404 });
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
