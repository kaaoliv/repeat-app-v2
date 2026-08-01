"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LastfmConnector({
  initialUsername,
  lastSyncedAt,
}: {
  initialUsername: string | null;
  lastSyncedAt: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialUsername ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lastfm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao conectar.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await fetch("/api/lastfm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "" }),
      });
      setValue("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await fetch("/api/lastfm/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao sincronizar.");
        return;
      }
      setSyncResult(
        json.synced === 0
          ? "Tudo já sincronizado."
          : `${json.matched} escuta(s) registrada(s) de ${json.synced} scrobble(s).`
      );
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  if (!initialUsername && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm bg-surface border border-line rounded-full px-4 py-2 text-ink-muted hover:text-ink hover:border-white/20 transition-colors"
      >
        🎧 Conectar Last.fm
      </button>
    );
  }

  if (editing) {
    return (
      <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
        <p className="text-sm text-ink-muted">
          Seu username do Last.fm (não a senha, só o nome de usuário público):
        </p>
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="seu_username_lastfm"
            className="flex-1 bg-bg border border-line rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary/60"
          />
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="text-sm bg-primary text-white rounded-full px-4 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "..." : "Conectar"}
          </button>
        </div>
        {error && <p className="text-xs text-coral">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink">
            🎧 Conectado como <span className="font-semibold">{initialUsername}</span>
          </p>
          <p className="text-xs text-ink-faint mt-0.5">
            {lastSyncedAt
              ? `Última sincronização: ${new Date(lastSyncedAt).toLocaleString("pt-BR")}`
              : "Ainda não sincronizado"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs bg-primary text-white rounded-full px-3 py-1.5 font-semibold disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={saving}
            className="text-xs text-ink-faint hover:text-coral transition-colors px-2"
          >
            Desconectar
          </button>
        </div>
      </div>
      {syncResult && <p className="text-xs text-teal mt-2">{syncResult}</p>}
      {error && <p className="text-xs text-coral mt-2">{error}</p>}
    </div>
  );
}
