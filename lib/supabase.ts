import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Flag pra que a UI saiba se o backend está disponível e possa exibir
// estados vazios amigáveis em vez de quebrar.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Usa @supabase/ssr no browser (não @supabase/supabase-js puro) porque
// o fluxo de login OAuth é PKCE: o "code_verifier" precisa ficar num cookie
// pra que app/auth/callback/route.ts (que roda no servidor) consiga lê-lo
// e completar o login. Com o cliente puro, isso ia pro localStorage e o
// servidor nunca via — causava o bug de "volta pro login sem erro visível".
// Quando as credenciais não estão configuradas, usamos placeholders para
// não lançar erro no import; nesse caso a UI opera em modo somente-visual.
export const supabase = createBrowserClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key"
);
