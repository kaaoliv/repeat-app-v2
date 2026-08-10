"use client";

import { useState } from "react";
import Link from "next/link";
import type { MBRelease, MBArtist } from "@/lib/musicbrainz";
import PageHeader from "../components/PageHeader";
import AlbumCard from "../components/AlbumCard";
import UserAvatar from "../components/UserAvatar";
import ExploreByPanel from "../components/ExploreByPanel";

type PersonResult = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Tab = "music" | "people";

export default function SearchPage() {
  const [tab, setTab] = useState<Tab>("music");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const [albums, setAlbums] = useState<MBRelease[]>([]);
  const [artists, setArtists] = useState<MBArtist[]>([]);
  const [people, setPeople] = useState<PersonResult[]>([]);

  async function runSearch(q: string, activeTab: Tab) {
    if (q.trim().length < 2) {
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      if (activeTab === "music") {
        const res = await fetch(`/api/search-albums?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setAlbums(data.results ?? []);
        setArtists(data.artists ?? []);
      } else {
        const res = await fetch(`/api/people?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setPeople(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    if (v.trim().length < 2) setSearched(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query, tab);
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    if (query.trim().length >= 2) runSearch(query, next);
  }

  return (
    <main className="pb-24">
      <PageHeader title="Buscar" />

      <div className="px-4">
        <form onSubmit={handleSubmit} className="relative mb-4">
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
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={tab === "music" ? "Busca álbum, artista ou música..." : "Busca por username..."}
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

        <div className="mb-6 flex gap-2">
          {(["music", "people"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === t
                  ? "bg-primary text-white"
                  : "border border-line bg-surface text-ink-muted"
              }`}
            >
              {t === "music" ? "Músicas" : "Pessoas"}
            </button>
          ))}
        </div>

        {!searched && <ExploreByPanel />}

        {searched && tab === "music" && (
          <div className="space-y-6">
            {artists.length > 0 && (
              <section>
                <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  Artistas
                </h2>
                <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                  {artists.map((artist) => (
                    <Link
                      key={artist.id}
                      href={`/artist/${artist.id}`}
                      className="flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 transition-colors hover:border-primary/50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue font-display text-sm font-bold text-white">
                        {artist.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-ink">{artist.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {albums.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  Álbuns
                </h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {albums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      href={`/album/${album.id}`}
                      title={album.title}
                      subtitle={album.artistName}
                      coverUrl={album.coverUrl}
                    />
                  ))}
                </div>
              </section>
            )}

            {!loading && albums.length === 0 && artists.length === 0 && (
              <p className="text-sm text-ink-muted">Nada encontrado pra "{query}".</p>
            )}
          </div>
        )}

        {searched && tab === "people" && (
          <ul className="space-y-2">
            {people.map((person) => (
              <li key={person.username}>
                <Link
                  href={`/u/${person.username}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-white/20"
                >
                  <UserAvatar
                    src={person.avatar_url}
                    alt={person.username}
                    className="h-10 w-10 shrink-0 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-ink">{person.display_name || person.username}</p>
                    <p className="truncate text-sm text-ink-muted">@{person.username}</p>
                  </div>
                </Link>
              </li>
            ))}
            {!loading && people.length === 0 && (
              <p className="text-sm text-ink-muted">Ninguém encontrado.</p>
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
