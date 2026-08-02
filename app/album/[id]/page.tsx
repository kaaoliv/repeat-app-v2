"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlbumCover from "@/app/components/AlbumCover";
import { formatTrackDuration } from "@/lib/format";

type Track = {
  id: string | null;
  title: string;
  durationSeconds: number | null;
  trackNumber: number;
  discNumber: number;
  playCount: number;
};

type AlbumData = {
  album: {
    title: string;
    artistName: string;
    artistId: string;
    coverUrl: string;
    year: string | null;
    genres: string[];
    totalSeconds: number;
  };
  tracks: Track[];
  isLoggedIn: boolean;
  inWatchlist: boolean;
};

const genreColors = ["text-blue", "text-coral", "text-teal", "text-pink", "text-gold"];

export default function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [data, setData] = useState<AlbumData | null>(null);
  const [description, setDescription] = useState<{ text: string; wikipediaUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [myLists, setMyLists] = useState<{ id: string; name: string }[]>([]);
  const [showListPicker, setShowListPicker] = useState(false);
  const [addedToListId, setAddedToListId] = useState<string | null>(null);

  async function openListPicker() {
    if (!data?.isLoggedIn) {
      setError("Você precisa estar logado pra usar listas.");
      return;
    }
    setShowListPicker((v) => !v);
    if (myLists.length === 0) {
      const res = await fetch("/api/lists");
      const json = await res.json();
      setMyLists((json.lists ?? []).map((l: any) => ({ id: l.id, name: l.name })));
    }
  }

  async function addToList(listId: string) {
    if (!data) return;
    await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        musicbrainzReleaseGroupId: id,
        title: data.album.title,
        artistName: data.album.artistName,
        artistMusicbrainzId: data.album.artistId,
        coverUrl: data.album.coverUrl,
        year: data.album.year,
      }),
    });
    setAddedToListId(listId);
    setTimeout(() => setShowListPicker(false), 600);
  }

  async function toggleWatchlist() {
    if (!data) return;
    if (!data.isLoggedIn) {
      setError("Você precisa estar logado pra usar o 'Quero ouvir'.");
      return;
    }
    const next = !data.inWatchlist;
    setWatchlistBusy(true);
    setData({ ...data, inWatchlist: next });
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          musicbrainzReleaseGroupId: id,
          title: data.album.title,
          artistName: data.album.artistName,
          artistMusicbrainzId: data.album.artistId,
          coverUrl: data.album.coverUrl,
          year: data.album.year,
          action: next ? "add" : "remove",
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setData((prev) => (prev ? { ...prev, inWatchlist: !next } : prev));
      setError("Erro ao salvar. Tenta de novo.");
    } finally {
      setWatchlistBusy(false);
    }
  }

  useEffect(() => {
    fetch(`/api/album/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Erro ao carregar álbum."))
      .finally(() => setLoading(false));

    // Busca em paralelo, sem travar a exibição da capa/faixas — é a parte
    // mais lenta (passa por 3 serviços externos em sequência do lado do
    // servidor), então chega depois e só complementa a tela quando pronta.
    fetch(`/api/album/${id}/description`)
      .then((res) => res.json())
      .then((json) => setDescription(json.description ?? null))
      .catch(() => {});
  }, [id]);

  async function changePlayCount(track: Track, action: "increment" | "decrement") {
    if (!track.id || !data) return;
    if (!data.isLoggedIn) {
      setError("Você precisa estar logado pra marcar faixas.");
      return;
    }
    const delta = action === "increment" ? 1 : -1;
    setBusyTrackId(track.id);
    setData({
      ...data,
      tracks: data.tracks.map((t) =>
        t.id === track.id ? { ...t, playCount: Math.max(0, t.playCount + delta) } : t
      ),
    });
    try {
      const res = await fetch("/api/track-listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, action }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.id === track.id ? { ...t, playCount: json.playCount } : t
              ),
            }
          : prev
      );
      router.refresh();
    } catch {
      setData((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.id === track.id
                  ? { ...t, playCount: Math.max(0, t.playCount - delta) }
                  : t
              ),
            }
          : prev
      );
      setError("Erro ao salvar. Tenta de novo.");
    } finally {
      setBusyTrackId(null);
    }
  }

  if (loading) {
    return (
      <main className="px-4 pt-9">
        <div className="flex gap-5">
          <div className="h-36 w-36 shrink-0 animate-pulse rounded-xl bg-surface-2" />
          <div className="flex-1 space-y-3 py-2">
            <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
        <p className="mt-8 text-sm text-ink-muted">Carregando álbum...</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="px-4 pt-9">
        <p className="text-ink-muted">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary-soft underline">
          Voltar pra busca
        </Link>
      </main>
    );
  }

  if (!data) return null;

  const heardCount = data.tracks.filter((t) => t.playCount > 0).length;
  const totalPlays = data.tracks.reduce((s, t) => s + t.playCount, 0);
  const heardSeconds = data.tracks.reduce(
    (sum, t) => sum + (t.durationSeconds ?? 0) * t.playCount,
    0
  );
  const progress = data.tracks.length
    ? Math.round((heardCount / data.tracks.length) * 100)
    : 0;

  return (
    <main className="px-4 pt-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Voltar
      </Link>

      <div className="flex gap-5">
        <div className="relative shrink-0">
          <AlbumCover
            src={data.album.coverUrl}
            alt={data.album.title}
            title={data.album.title}
            sizes="144px"
            className="h-36 w-36 rounded-xl shadow-card ring-1 ring-line"
          />
          {totalPlays > 0 && (
            <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-bg shadow-badge">
              {totalPlays}× ouvido
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-balance font-display text-2xl font-extrabold leading-tight text-ink">
            {data.album.title}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data.album.artistId ? (
              <Link
                href={`/artist/${data.album.artistId}`}
                className="font-medium text-primary-soft hover:underline"
              >
                {data.album.artistName}
              </Link>
            ) : (
              data.album.artistName
            )}
            {data.album.year ? ` · ${data.album.year}` : ""}
          </p>

          {data.album.genres.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {data.album.genres.map((g, i) => (
                <span
                  key={g}
                  className={`rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium ${
                    genreColors[i % genreColors.length]
                  }`}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={toggleWatchlist}
              disabled={watchlistBusy}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                data.inWatchlist
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-line bg-surface text-ink-muted hover:border-gold/50 hover:text-gold"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={data.inWatchlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
              </svg>
              Quero ouvir
            </button>

            <div className="relative">
              <button
                onClick={openListPicker}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-primary/50 hover:text-primary-soft"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Lista
              </button>
              {showListPicker && (
                <div className="absolute left-0 top-10 z-20 w-52 overflow-hidden rounded-xl border border-line bg-surface-2 py-1 shadow-card">
                  {myLists.length === 0 && (
                    <p className="px-3 py-2 text-xs text-ink-muted">
                      Nenhuma lista ainda.{" "}
                      <Link href="/lists" className="text-primary-soft underline">
                        Criar uma
                      </Link>
                    </p>
                  )}
                  {myLists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => addToList(list.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-3"
                    >
                      {addedToListId === list.id && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12 4.5 4.5L19 7" />
                        </svg>
                      )}
                      <span className="truncate">{list.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {description && description.text && (
        <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-muted">
          {description.text}{" "}
          {description.wikipediaUrl && (
            <a
              href={description.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-soft underline hover:text-primary"
            >
              Ver na Wikipédia
            </a>
          )}
        </p>
      )}

      {/* Progresso de escuta */}
      <div className="mt-6 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink">
            {heardCount}/{data.tracks.length} faixas
          </span>
          <span className="text-ink-muted">
            {formatTrackDuration(heardSeconds) ?? "0:00"} ouvidos
          </span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-blue transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-2.5 text-sm text-coral">
          {error}
        </p>
      )}

      <h2 className="mb-1 mt-6 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Faixas
      </h2>
      <ul className="divide-y divide-line/60">
        {data.tracks.map((track) => (
          <li
            key={`${track.discNumber}-${track.trackNumber}`}
            className="flex items-center gap-3 py-2.5"
          >
            <span className="w-5 shrink-0 text-center text-sm tabular-nums text-ink-faint">
              {track.trackNumber}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm ${
                  track.playCount > 0 ? "font-medium text-ink" : "text-ink/80"
                }`}
              >
                {track.title}
              </p>
              {track.durationSeconds && (
                <p className="text-xs tabular-nums text-ink-faint">
                  {formatTrackDuration(track.durationSeconds)}
                </p>
              )}
            </div>

            {track.playCount === 0 ? (
              <button
                onClick={() => changePlayCount(track, "increment")}
                disabled={busyTrackId === track.id || !track.id}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-primary/50 hover:text-primary-soft disabled:opacity-50"
              >
                Já ouvi
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface p-0.5">
                <button
                  onClick={() => changePlayCount(track, "decrement")}
                  disabled={busyTrackId === track.id}
                  aria-label="Desfazer uma escuta"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <span
                  key={track.playCount}
                  className="animate-pop w-8 text-center text-sm font-bold tabular-nums text-primary-soft"
                >
                  {track.playCount}×
                </span>
                <button
                  onClick={() => changePlayCount(track, "increment")}
                  disabled={busyTrackId === track.id}
                  aria-label="Ouvi de novo"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition-transform hover:brightness-110 active:scale-90 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            )}
          </li>
        ))}
        {data.tracks.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-muted">
            Não encontramos a lista de faixas desse álbum.
          </li>
        )}
      </ul>
    </main>
  );
}
