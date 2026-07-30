import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import FollowButton from "@/app/components/FollowButton";

export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  return hours;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-paper-muted">Usuário @{username} não encontrado.</p>
      </main>
    );
  }

  const [{ data: totals }, { count: followerCount }, { count: followingCount }, { data: isFollowing }] =
    await Promise.all([
      supabase
        .from("user_total_listen_time")
        .select("total_seconds")
        .eq("user_id", profile.id)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      viewer
        ? supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", viewer.id)
            .eq("following_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const { data: recentListens } = await supabase
    .from("track_listens")
    .select("listened_at, tracks(title, albums(title, cover_url, artists(name)))")
    .eq("user_id", profile.id)
    .order("listened_at", { ascending: false })
    .limit(20);

  const seenAlbums = new Set<string>();
  const recentAlbums: any[] = [];
  for (const listen of recentListens ?? []) {
    const track = listen.tracks as any;
    const albumTitle = track?.albums?.title;
    if (!albumTitle || seenAlbums.has(albumTitle)) continue;
    seenAlbums.add(albumTitle);
    recentAlbums.push({
      title: albumTitle,
      artistName: track?.albums?.artists?.name,
      coverUrl: track?.albums?.cover_url,
    });
    if (recentAlbums.length >= 8) break;
  }

  const hours = formatDuration(totals?.total_seconds ?? 0);
  const isOwnProfile = viewer?.id === profile.id;

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden bg-panel border border-white/5">
            {profile.avatar_url && (
              <Image src={profile.avatar_url} alt={profile.username} fill className="object-cover" />
            )}
          </div>
          <div>
            <h1 className="font-display italic text-2xl text-paper">
              {profile.display_name || `@${profile.username}`}
            </h1>
            <p className="text-paper-muted text-sm">@{profile.username}</p>
          </div>
        </div>
        {!isOwnProfile && viewer && (
          <FollowButton targetUserId={profile.id} initiallyFollowing={!!isFollowing} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-8 text-center">
        <div className="bg-panel border border-white/5 rounded-lg py-4">
          <p className="font-counter text-xl text-amber">{hours}h</p>
          <p className="text-xs text-paper-muted mt-1">ouvidas</p>
        </div>
        <div className="bg-panel border border-white/5 rounded-lg py-4">
          <p className="font-counter text-xl text-paper">{followerCount ?? 0}</p>
          <p className="text-xs text-paper-muted mt-1">seguidores</p>
        </div>
        <div className="bg-panel border border-white/5 rounded-lg py-4">
          <p className="font-counter text-xl text-paper">{followingCount ?? 0}</p>
          <p className="text-xs text-paper-muted mt-1">seguindo</p>
        </div>
      </div>

      <h2 className="font-display italic text-xl text-paper mb-4">Atividade recente</h2>
      <div className="grid grid-cols-4 gap-3">
        {recentAlbums.map((album, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-chassis">
            {album.coverUrl && (
              <Image src={album.coverUrl} alt={album.title} fill className="object-cover" />
            )}
          </div>
        ))}
        {recentAlbums.length === 0 && (
          <p className="text-paper-muted text-sm col-span-full">Nada ouvido ainda.</p>
        )}
      </div>
    </main>
  );
}
