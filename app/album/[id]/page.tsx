import type { Metadata } from "next";
import { getAlbumBasicInfo } from "@/lib/musicbrainz";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import AlbumPageClient from "./AlbumPageClient";

async function getPreviewData(id: string) {
  if (id.startsWith("lastfm:")) {
    const supabase = await createSupabaseServerClient();
    const { data: album } = await supabase
      .from("albums")
      .select("title, cover_url, artists(name)")
      .eq("musicbrainz_id", id)
      .maybeSingle();
    if (!album) return null;
    return {
      title: album.title,
      artistName: (album.artists as any)?.name ?? "Artista desconhecido",
      coverUrl: album.cover_url as string | null,
    };
  }

  const info = await getAlbumBasicInfo(id);
  if (!info) return null;
  return { title: info.title, artistName: info.artistName, coverUrl: info.coverUrl };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const preview = await getPreviewData(id);

  if (!preview) {
    return { title: "Álbum · Repeat" };
  }

  const title = `${preview.title} — ${preview.artistName} · Repeat`;
  const description = `Acompanhe quantas vezes você já ouviu "${preview.title}" no Repeat.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: preview.coverUrl ? [{ url: preview.coverUrl, width: 500, height: 500 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: preview.coverUrl ? [preview.coverUrl] : [],
    },
  };
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AlbumPageClient id={id} />;
}
