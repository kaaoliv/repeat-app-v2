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
      <h1 className="font-display italic text-3xl text-paper mb-2">Entrar no Repeat</h1>
      <p className="text-paper-muted text-sm mb-8">
        Pra marcar álbuns como ouvidos e ver seu total de horas.
      </p>

      <button
        onClick={handleGoogleLogin}
        className="w-full bg-amber text-chassis rounded-lg px-5 py-3 font-medium flex items-center justify-center gap-2 hover:brightness-110 transition-[filter]"
      >
        Continuar com Google
      </button>
    </main>
  );
}
