import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// GET /api/discover?genre=Rock&yearMin=1990&yearMax=2010&listened=no&rated=any&watchlist=any
//
// Base: view trending_albums_week (mais tocadas nos últimos 7 dias entre
// todo mundo). Filtros de conta (ouvido/avaliado/watchlist) só se
// aplicam se o usuário estiver logado — sem login, viram no-op.
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = req.nextUrl.searchParams;
  const genre = params.get("genre");
  const yearMin = params.get("yearMin");
  const yearMax = params.get("yearMax");
  const listened = params.get("listened"); // "yes" | "no" | null
  const rated = params.get("rated");
  const onWatchlist = params.get("watchlist");

  const { data: trending, error } = await supabase
    .from("trending_albums_week")
    .select("album_id, title, cover_url, release_year, genres, artist_name, total_plays, distinct_listeners")
    .order("total_plays", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let albums = trending ?? [];

  if (genre) {
    albums = albums.filter((a) => (a.genres ?? []).includes(genre));
  }
  if (yearMin) {
    albums = albums.filter((a) => a.release_year && a.release_year >= Number(yearMin));
  }
  if (yearMax) {
    albums = albums.filter((a) => a.release_year && a.release_year <= Number(yearMax));
  }

  // Status por usuário — sempre busca (mesmo sem filtro) quando logado,
  // porque o front usa "listenedIds" pra esmaecer as capas já ouvidas.
  let listenedIds: string[] = [];
  let ratedIds: string[] = [];
  let watchlistIds: string[] = [];

  if (user && albums.length > 0) {
    const albumIds = albums.map((a) => a.album_id);

    const [{ data: listens }, { data: reviews }, { data: watchlistRows }] = await Promise.all([
      supabase
        .from("track_listens")
        .select("tracks!inner(album_id)")
        .eq("user_id", user.id)
        .in("tracks.album_id", albumIds),
      supabase.from("reviews").select("album_id").eq("user_id", user.id).in("album_id", albumIds),
      supabase.from("watchlist").select("album_id").eq("user_id", user.id).in("album_id", albumIds),
    ]);

    listenedIds = Array.from(
      new Set((listens ?? []).map((l: any) => l.tracks?.album_id).filter(Boolean))
    );
    ratedIds = (reviews ?? []).map((r) => r.album_id);
    watchlistIds = (watchlistRows ?? []).map((w) => w.album_id);
  }

  if (listened && user) {
    const listenedSet = new Set(listenedIds);
    albums = albums.filter((a) =>
      listened === "yes" ? listenedSet.has(a.album_id) : !listenedSet.has(a.album_id)
    );
  }
  if (rated && user) {
    const ratedSet = new Set(ratedIds);
    albums = albums.filter((a) => (rated === "yes" ? ratedSet.has(a.album_id) : !ratedSet.has(a.album_id)));
  }
  if (onWatchlist && user) {
    const watchlistSet = new Set(watchlistIds);
    albums = albums.filter((a) =>
      onWatchlist === "yes" ? watchlistSet.has(a.album_id) : !watchlistSet.has(a.album_id)
    );
  }

  // Lista de gêneros disponíveis pro seletor de filtro (a partir do
  // conjunto atual em alta, não da base inteira — mantém o filtro
  // relevante ao que está sendo exibido).
  const genreSet = new Set<string>();
  for (const a of trending ?? []) {
    for (const g of a.genres ?? []) genreSet.add(g);
  }

  return NextResponse.json({
    albums,
    listenedIds,
    availableGenres: Array.from(genreSet).sort(),
  });
}
