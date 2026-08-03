import type { Metadata } from "next";
import { mbFetch } from "@/lib/musicbrainz";
import ArtistPageClient from "./ArtistPageClient";

const MB_BASE = "https://musicbrainz.org/ws/2";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const res = await mbFetch(`${MB_BASE}/artist/${id}?fmt=json`, 3600);
  if (!res || !res.ok) {
    return { title: "Artista · Repeat" };
  }

  const artist = await res.json();
  const title = `${artist.name} · Repeat`;
  const description = `Veja a discografia de ${artist.name} e marque o que você já ouviu no Repeat.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArtistPageClient id={id} />;
}
