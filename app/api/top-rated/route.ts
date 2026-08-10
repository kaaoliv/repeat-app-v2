import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Mais bem avaliados = média de nota das reviews, com um mínimo de 2
// avaliações pra entrar no ranking (senão 1 review de 5 estrelas bate
// qualquer álbum com 50 reviews de 4.5 — clássico problema de "poucas
// amostras" em ranking por média simples).
const MIN_REVIEWS = 2;

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("album_id, rating, albums(id, title, cover_url, artists(name))");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byAlbum = new Map<
    string,
    { title: string; coverUrl: string | null; artistName: string; sum: number; count: number }
  >();

  for (const r of reviews ?? []) {
    if (r.rating == null) continue;
    const album = r.albums as any;
    if (!album) continue;

    const existing = byAlbum.get(r.album_id);
    if (existing) {
      existing.sum += Number(r.rating);
      existing.count += 1;
    } else {
      byAlbum.set(r.album_id, {
        title: album.title,
        coverUrl: album.cover_url,
        artistName: album.artists?.name ?? "Artista desconhecido",
        sum: Number(r.rating),
        count: 1,
      });
    }
  }

  const ranked = Array.from(byAlbum.entries())
    .map(([albumId, a]) => ({
      albumId,
      title: a.title,
      coverUrl: a.coverUrl,
      artistName: a.artistName,
      avgRating: a.sum / a.count,
      reviewCount: a.count,
    }))
    .filter((a) => a.reviewCount >= MIN_REVIEWS)
    .sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount)
    .slice(0, 60);

  return NextResponse.json({ albums: ranked, minReviews: MIN_REVIEWS });
}
