"use client";

import { useState } from "react";
import Link from "next/link";
import UserAvatar from "../components/UserAvatar";
import PageHeader from "../components/PageHeader";

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
    <main className="pb-8">
      <PageHeader title="Buscar pessoas" />
      <div className="px-4">
        <form onSubmit={handleSearch} className="relative mb-6">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca por username..."
            className="w-full rounded-full border border-line bg-surface py-3 pl-11 pr-24 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-primary/60"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "..." : "Buscar"}
          </button>
        </form>

        <ul className="space-y-2">
          {results.map((person) => (
            <li key={person.username}>
              <Link
                href={`/u/${person.username}`}
                className="flex items-center gap-3 bg-surface border border-line rounded-xl p-3 hover:border-white/20 transition-colors"
              >
                <UserAvatar
                  src={person.avatar_url}
                  alt={person.username}
                  className="w-10 h-10 shrink-0 rounded-full"
                />
                <div className="min-w-0">
                  <p className="text-ink truncate">{person.display_name || person.username}</p>
                  <p className="text-sm text-ink-muted truncate">@{person.username}</p>
                </div>
              </Link>
            </li>
          ))}
          {results.length === 0 && query.length >= 2 && !loading && (
            <p className="text-ink-muted text-sm">Ninguém encontrado.</p>
          )}
        </ul>
      </div>
    </main>
  );
}
