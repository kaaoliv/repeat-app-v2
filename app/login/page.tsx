"use client";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold mb-2">Entrar no Repeat</h1>
      <p className="text-accent/60 text-sm mb-8">
        Pra marcar álbuns como ouvidos e ver seu total de horas.
      </p>

      <button
        onClick={handleGoogleLogin}
        className="w-full bg-accent text-background rounded-lg px-5 py-3 font-medium flex items-center justify-center gap-2"
      >
        Continuar com Google
      </button>
    </main>
  );
}
