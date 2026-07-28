import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Usa @supabase/ssr no browser (não @supabase/supabase-js puro) porque
// o fluxo de login OAuth é PKCE: o "code_verifier" precisa ficar num cookie
// pra que app/auth/callback/route.ts (que roda no servidor) consiga lê-lo
// e completar o login. Com o cliente puro, isso ia pro localStorage e o
// servidor nunca via — causava o bug de "volta pro login sem erro visível".
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
