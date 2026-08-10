import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeGenres } from "@/lib/genre-taxonomy";

// Rota de manutenção — não roda sozinha. Diferente do backfill-genres
// (que busca gênero na API pra quem não tem nenhum), essa aqui só
// REPROCESSA o que já está salvo em `genres` com a normalização nova
// (lib/genre-taxonomy.ts). Não chama API externa nenhuma — é local e
// rápido, então roda tudo de uma vez, sem paginação.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: albums } = await supabase
    .from("albums")
    .select("id, genres")
    .not("genres", "is", null);

  let checked = 0;
  let changed = 0;
  let clearedToEmpty = 0;

  for (const album of albums ?? []) {
    checked++;
    const before = (album.genres ?? []) as string[];
    const after = normalizeGenres(before);

    const isSame =
      before.length === after.length && before.every((g, i) => g === after[i]);
    if (isSame) continue;

    changed++;
    if (after.length === 0) clearedToEmpty++;

    await supabase
      .from("albums")
      .update({ genres: after.length > 0 ? after : null })
      .eq("id", album.id);
  }

  return NextResponse.json({
    totalWithGenres: (albums ?? []).length,
    checked,
    changed,
    clearedToEmpty,
    note: "Concluído — não precisa rodar de novo, é local e sem paginação.",
  });
}
