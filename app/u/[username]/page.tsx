import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import FollowButton from "@/app/components/FollowButton";
import AlbumCover from "@/app/components/AlbumCover";
import UserAvatar from "@/app/components/UserAvatar";

export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  return hours;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) return { title: "Perfil · Repeat" };

  const name = profile.display_name || `@${profile.username}`;
  const title = `${name} no Repeat`;
  const description = `Veja quanto tempo ${name} já passou ouvindo música no Repeat.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
    twitter: { card: "summary", title, description },
  };
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
      <main className="px-4 pt-9">
        <p className="text-ink-muted">Usuário @{username} não encontrado.</p>
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
    <main className="px-4 pt-9 pb-8">
      <div className="flex items-center justify-between mb-8 gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <UserAvatar
            src={profile.avatar_url}
            alt={profile.username}
            className="w-16 h-16 shrink-0 rounded-full"
          />
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-2xl text-ink truncate">
              {profile.display_name || `@${profile.username}`}
            </h1>
            <p className="text-ink-muted text-sm">@{profile.username}</p>
          </div>
        </div>
        {!isOwnProfile && viewer && (
          <FollowButton targetUserId={profile.id} initiallyFollowing={!!isFollowing} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-8 text-center">
        <div className="bg-surface border border-line rounded-xl py-4">
          <p className="font-display font-bold text-xl text-primary-soft">{hours}h</p>
          <p className="text-xs text-ink-muted mt-1">ouvidas</p>
        </div>
        <div className="bg-surface border border-line rounded-xl py-4">
          <p className="font-display font-bold text-xl text-ink">{followerCount ?? 0}</p>
          <p className="text-xs text-ink-muted mt-1">seguidores</p>
        </div>
        <div className="bg-surface border border-line rounded-xl py-4">
          <p className="font-display font-bold text-xl text-ink">{followingCount ?? 0}</p>
          <p className="text-xs text-ink-muted mt-1">seguindo</p>
        </div>
      </div>

      <h2 className="font-display font-semibold text-xl text-ink mb-4">Atividade recente</h2>
      {recentAlbums.length === 0 ? (
        <p className="text-ink-muted text-sm">Nada ouvido ainda.</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {recentAlbums.map((album, i) => (
            <AlbumCover
              key={i}
              src={album.coverUrl}
              alt={album.title}
              className="aspect-square rounded-lg"
              sizes="25vw"
            />
          ))}
        </div>
      )}
    </main>
  );
}
