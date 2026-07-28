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
      <Link href="/" className="font-semibold tracking-tight">
        Repeat
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/profile" className="text-accent/70 hover:text-accent">
          Perfil
        </Link>
        {user ? (
          <button onClick={handleLogout} className="text-accent/70 hover:text-accent">
            Sair
          </button>
        ) : (
          <Link href="/login" className="text-accent/70 hover:text-accent">
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}
