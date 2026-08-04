import { createClient } from "@supabase/supabase-js";

// Cliente com a service role key — ignora RLS completamente. NUNCA usar
// isso em código que roda no navegador, nem importar esse arquivo fora de
// rotas de servidor de confiança (tipo o cron de sincronização, que
// precisa mexer nos dados de vários usuários de uma vez, sem ter uma
// sessão de login de nenhum deles).
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
