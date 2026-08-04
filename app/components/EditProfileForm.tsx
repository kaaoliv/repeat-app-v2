"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Escolhe uma imagem (jpg, png, webp...).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Imagem muito grande — máximo 5MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sessão expirou, recarrega a página.");
        return;
      }

      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) {
        setError("Erro ao enviar a imagem.");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      // Adiciona um parâmetro pra "furar" o cache do navegador quando
      // troca a foto (senão pode continuar mostrando a antiga por um tempo).
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    } finally {
      setUploading(false);
    }
  }

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
        <label className="text-xs text-ink-muted block mb-2">Foto de perfil</label>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-2 shrink-0">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs bg-surface-2 border border-line rounded-full px-3 py-2 text-ink hover:border-white/25 transition-colors disabled:opacity-50"
          >
            {uploading ? "Enviando..." : "Trocar foto"}
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs text-ink-muted block mb-1">Nome de exibição</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Como quer aparecer"
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary/60"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || uploading}
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
