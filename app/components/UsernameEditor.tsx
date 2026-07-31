"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UsernameEditor({
  currentUsername,
}: {
  currentUsername: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentUsername ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
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
        className="font-display font-semibold text-lg text-ink hover:text-primary-soft transition-colors"
      >
        {currentUsername ? `@${currentUsername}` : "Escolher um username"}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-ink-muted text-sm">@</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toLowerCase())}
        className="bg-bg border border-line rounded-lg px-2 py-1 text-sm text-ink outline-none focus:border-primary/60 w-32"
        placeholder="seu_username"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs bg-primary text-white rounded-full px-3 py-1.5 font-semibold disabled:opacity-50"
      >
        Salvar
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
