import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getNewReleases } from "@/lib/musicbrainz";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Amigos ouviram" — só existe pra quem está logado e segue alguém.
  let friendsListened: any[] = [];
  if (user) {
    const { data: listens } = await supabase
      .from("track_listens")
      .select(
        "listened_at, user_id, tracks(albums(id, title, cover_url, musicbrainz_id, artists(name)))"
      )
      .neq("user_id", user.id)
      .order("listened_at", { ascending: false })
      .limit(40);

    // track_listens não tem FK direta pra profiles (os dois só apontam
    // pra auth.users separadamente), então busca os nomes à parte.
    const userIds = Array.from(new Set((listens ?? []).map((l) => l.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", userIds)
      : { data: [] as any[] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const seen = new Set<string>();
    for (const listen of listens ?? []) {
      const album = (listen.tracks as any)?.albums;
      if (!album || seen.has(album.id)) continue;
      seen.add(album.id);
      const friendProfile = profileById.get(listen.user_id);
      friendsListened.push({
        albumId: album.id,
        title: album.title,
        artistName: album.artists?.name,
        coverUrl: album.cover_url,
        musicbrainzId: album.musicbrainz_id,
        friendName:
          friendProfile?.display_name || friendProfile?.username || "alguém que você segue",
      });
      if (friendsListened.length >= 12) break;
    }
  }

  // "Em alta" — vem da view agregada (sem expor quem ouviu, só quantos).
  const { data: trending } = await supabase
    .from("trending_albums")
    .select("*")
    .order("distinct_listeners", { ascending: false })
    .order("total_plays", { ascending: false })
    .limit(12);

  // "Últimos lançamentos" — MusicBrainz, já que o Spotify descontinuou
  // o endpoint equivalente em 2026.
  const newReleases = await getNewReleases().catch(() => []);

  return NextResponse.json({
    friendsListened,
    trending: (trending ?? []).map((t: any) => ({
      albumId: t.album_id,
      title: t.title,
      artistName: t.artist_name,
      coverUrl: t.cover_url,
      musicbrainzId: t.musicbrainz_id,
      listeners: t.distinct_listeners,
    })),
    newReleases: newReleases.map((r) => ({
      musicbrainzId: r.id,
      title: r.title,
      artistName: r.artistName,
      coverUrl: r.coverUrl,
      year: r.year,
    })),
  });
}
