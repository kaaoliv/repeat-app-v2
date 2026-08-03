import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const albumId = req.nextUrl.searchParams.get("albumId");
  if (!albumId) {
    return NextResponse.json({ error: "albumId é obrigatório." }, { status: 400 });
  }

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, user_id, rating, review_text, created_at, profiles(username, display_name, avatar_url)")
    .eq("album_id", albumId)
    .order("created_at", { ascending: false });

  const list = reviews ?? [];
  const avgRating =
    list.length > 0
      ? list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / list.length
      : null;

  const myReview = user ? list.find((r) => r.user_id === user.id) ?? null : null;

  return NextResponse.json({
    reviews: list.filter((r) => r.user_id !== user?.id),
    myReview,
    avgRating,
    count: list.length,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { albumId, rating, reviewText } = await req.json();

  if (!albumId || typeof rating !== "number" || rating < 0.5 || rating > 5) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      album_id: albumId,
      rating,
      review_text: reviewText?.trim() || null,
    },
    { onConflict: "user_id,album_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { albumId } = await req.json();
  if (!albumId) return NextResponse.json({ error: "albumId é obrigatório." }, { status: 400 });

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("user_id", user.id)
    .eq("album_id", albumId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
