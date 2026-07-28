"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <nav className="max-w-2xl mx-auto px-4 pt-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 group">
        {/* dois "carretéis" — detalhe discreto, não decoração gratuita */}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-dim group-hover:bg-amber transition-colors" />
          <span className="w-2 h-2 rounded-full bg-amber-dim group-hover:bg-amber transition-colors" />
        </span>
        <span className="font-display italic text-lg tracking-tight text-paper">
          Repeat
        </span>
      </Link>
      <div className="flex items-center gap-5 text-sm">
        <Link href="/profile" className="text-paper-muted hover:text-paper transition-colors">
          Perfil
        </Link>
        {user ? (
          <button
            onClick={handleLogout}
            className="text-paper-muted hover:text-paper transition-colors"
          >
            Sair
          </button>
        ) : (
          <Link href="/login" className="text-paper-muted hover:text-paper transition-colors">
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}
