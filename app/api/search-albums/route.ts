import { NextRequest, NextResponse } from "next/server";
import { searchAlbums } from "@/lib/musicbrainz";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query precisa ter pelo menos 2 caracteres." },
      { status: 400 }
    );
  }

  try {
    const results = await searchAlbums(q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Erro ao buscar na MusicBrainz." },
      { status: 502 }
    );
  }
}
