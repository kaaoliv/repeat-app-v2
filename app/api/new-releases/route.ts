import { NextResponse } from "next/server";
import { getNewReleases } from "@/lib/musicbrainz";

export async function GET() {
  const releases = await getNewReleases();
  return NextResponse.json({ releases });
}
