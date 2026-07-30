"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

type PersonResult = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function PeoplePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/people?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setResults(json.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/profile" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Perfil
      </Link>
      <h1 className="font-display italic text-3xl text-paper mt-4 mb-6">Buscar pessoas</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por username..."
          className="flex-1 bg-panel border border-white/5 rounded-lg px-4 py-2.5 outline-none focus:border-amber-dim/60 text-paper placeholder:text-paper-muted/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-amber text-chassis rounded-lg px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {loading ? "..." : "Buscar"}
        </button>
      </form>

      <ul className="space-y-2">
        {results.map((person) => (
          <li key={person.username}>
            <Link
              href={`/u/${person.username}`}
              className="flex items-center gap-3 bg-panel border border-white/5 rounded-lg p-3 hover:border-amber-dim/30 transition-colors"
            >
              <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden bg-chassis">
                {person.avatar_url && (
                  <Image src={person.avatar_url} alt={person.username} fill className="object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-paper truncate">{person.display_name || person.username}</p>
                <p className="text-sm text-paper-muted truncate">@{person.username}</p>
              </div>
            </Link>
          </li>
        ))}
        {results.length === 0 && query.length >= 2 && !loading && (
          <p className="text-paper-muted text-sm">Ninguém encontrado.</p>
        )}
      </ul>
    </main>
  );
}
