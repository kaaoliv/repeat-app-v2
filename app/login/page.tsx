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
    <main className="max-w-sm mx-auto px-4 pt-24 pb-24 text-center">
      <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-glow">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" />
        </svg>
      </span>
      <h1 className="font-display font-extrabold text-3xl text-ink mb-2">Entrar no Repeat</h1>
      <p className="text-ink-muted text-sm mb-8">
        Pra marcar álbuns como ouvidos e ver seu total de horas.
      </p>

      <button
        onClick={handleGoogleLogin}
        className="w-full bg-primary text-white rounded-full px-5 py-3 font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-[filter] shadow-glow"
      >
        Continuar com Google
      </button>
    </main>
  );
}
