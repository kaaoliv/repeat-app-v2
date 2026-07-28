import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Cliente único para uso no browser (client components).
// Para rotas de servidor com necessidade de RLS por usuário logado,
// crie um cliente por request usando o cookie de sessão (ver docs do Supabase Auth Helpers).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
