"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ListSummary = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  list_items: { count: number }[];
};

export default function ListsPage() {
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/lists")
      .then((res) => res.json())
      .then((json) => setLists(json.lists ?? []))
      .catch(() => setError("Erro ao carregar listas."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPublic: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) setError("Você precisa estar logado.");
        else setError(json.error ?? "Erro ao criar lista.");
        return;
      }
      setName("");
      setDescription("");
      setShowForm(false);
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/profile" className="text-paper-muted text-sm hover:text-paper transition-colors">
        ← Perfil
      </Link>
      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="font-display italic text-3xl text-paper">Minhas listas</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm bg-amber text-chassis rounded-lg px-4 py-2 font-medium hover:brightness-110 transition-[filter]"
        >
          + Nova lista
        </button>
      </div>

      {error && (
        <p className="text-sm mb-4 text-paper-muted bg-panel border border-white/5 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 bg-panel border border-white/5 rounded-lg p-4 space-y-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da lista (ex: Pra treino)"
            className="w-full bg-chassis border border-white/5 rounded-lg px-3 py-2 outline-none focus:border-amber-dim/60 text-paper placeholder:text-paper-muted/60"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full bg-chassis border border-white/5 rounded-lg px-3 py-2 outline-none focus:border-amber-dim/60 text-paper placeholder:text-paper-muted/60"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="text-sm bg-amber text-chassis rounded-lg px-4 py-2 font-medium disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar"}
          </button>
        </form>
      )}

      {!loading && (
        <ul className="space-y-2">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/lists/${list.id}`}
                className="flex items-center justify-between gap-4 bg-panel border border-white/5 rounded-lg px-4 py-3 hover:border-amber-dim/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-paper truncate">{list.name}</p>
                  {list.description && (
                    <p className="text-sm text-paper-muted truncate">{list.description}</p>
                  )}
                </div>
                <span className="text-xs text-paper-muted font-counter shrink-0">
                  {list.list_items?.[0]?.count ?? 0} álbuns
                </span>
              </Link>
            </li>
          ))}
          {lists.length === 0 && (
            <p className="text-paper-muted text-sm">
              Você ainda não criou nenhuma lista.
            </p>
          )}
        </ul>
      )}
    </main>
  );
}
