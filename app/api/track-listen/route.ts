import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { trackId, action, value } = await req.json();

  if (!trackId || !["increment", "decrement", "set"].includes(action)) {
    return NextResponse.json(
      { error: "trackId e action ('increment' | 'decrement' | 'set') são obrigatórios." },
      { status: 400 }
    );
  }

  if (action === "set") {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
      return NextResponse.json({ error: "value precisa ser um número inteiro ≥ 0." }, { status: 400 });
    }

    // Mesma música em outro álbum (ex: single + álbum) — sincroniza a
    // contagem, senão marcar manualmente numa versão não reflete na
    // outra. Só propaga quando tem musicbrainz_recording_id de verdade
    // (conteúdo puro do Last.fm não tem, aí não dá pra ter certeza que
    // é a mesma gravação).
    const { data: trackRow } = await supabase
      .from("tracks")
      .select("musicbrainz_recording_id")
      .eq("id", trackId)
      .maybeSingle();

    const siblingIds: string[] = [];
    if (trackRow?.musicbrainz_recording_id) {
      const { data: siblings } = await supabase
        .from("tracks")
        .select("id")
        .eq("musicbrainz_recording_id", trackRow.musicbrainz_recording_id)
        .neq("id", trackId);
      siblingIds.push(...(siblings ?? []).map((s) => s.id));
    }

    if (count === 0) {
      await supabase
        .from("track_listens")
        .delete()
        .eq("user_id", user.id)
        .eq("track_id", trackId);

      if (siblingIds.length > 0) {
        await supabase
          .from("track_listens")
          .delete()
          .eq("user_id", user.id)
          .in("track_id", siblingIds);
      }

      return NextResponse.json({ success: true, playCount: 0 });
    }

    const { data: upserted, error } = await supabase
      .from("track_listens")
      .upsert(
        { user_id: user.id, track_id: trackId, play_count: count, source: "manual" },
        { onConflict: "user_id,track_id" }
      )
      .select("play_count")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (siblingIds.length > 0) {
      await supabase.from("track_listens").upsert(
        siblingIds.map((id) => ({
          user_id: user.id,
          track_id: id,
          play_count: count,
          source: "manual",
        })),
        { onConflict: "user_id,track_id" }
      );
    }

    return NextResponse.json({ success: true, playCount: upserted.play_count });
  }

  // increment/decrement já propagam pras faixas irmãs dentro da própria
  // function SQL (ver supabase/sync_duplicate_tracks.sql).
  const fn = action === "increment" ? "increment_track_listen" : "decrement_track_listen";
  const { data, error } = await supabase.rpc(fn, { p_track_id: trackId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const playCount = data?.play_count ?? 0;

  return NextResponse.json({ success: true, playCount });
}
