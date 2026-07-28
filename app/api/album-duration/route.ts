import { NextRequest, NextResponse } from "next/server";
import { getReleaseGroupDuration } from "@/lib/musicbrainz";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const releaseGroupId = req.nextUrl.searchParams.get("id");

  if (!releaseGroupId) {
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
  }

  const durationSeconds = await getReleaseGroupDuration(releaseGroupId);

  // Se tiver alguém logado e o álbum já existir na nossa tabela (foi
  // marcado como ouvido por alguém antes, só que sem duração ainda),
  // aproveita e cacheia — assim a próxima busca já vem instantânea.
  try {
    if (durationSeconds) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("albums")
          .update({ duration_seconds: durationSeconds })
          .eq("musicbrainz_id", releaseGroupId);
      }
    }
  } catch {
    // cache é só uma otimização, ignora falha silenciosamente
  }

  return NextResponse.json({ durationSeconds });
}
