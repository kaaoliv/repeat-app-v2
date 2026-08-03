"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EditProfileForm({
  currentDisplayName,
  currentAvatarUrl,
}: {
  currentDisplayName: string | null;
  currentAvatarUrl: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentDisplayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, avatarUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao salvar.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-ink-faint hover:text-ink-muted transition-colors"
      >
        Editar perfil
      </button>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs text-ink-muted block mb-1">Nome de exibição</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Como quer aparecer"
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary/60"
        />
      </div>
      <div>
        <label className="text-xs text-ink-muted block mb-1">URL da foto (opcional)</label>
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary/60"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-primary text-white rounded-full px-4 py-2 font-semibold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-sm text-ink-faint hover:text-ink-muted transition-colors px-2"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-coral">{error}</p>}
    </div>
  );
}
