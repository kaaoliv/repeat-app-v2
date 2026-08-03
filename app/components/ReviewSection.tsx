"use client";

import { useEffect, useState } from "react";
import UserAvatar from "./UserAvatar";

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

function Stars({
  value,
  onChange,
  size = "text-2xl",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: string;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className={`flex gap-0.5 ${size} ${onChange ? "cursor-pointer" : ""}`}>
      {stars.map((s) => {
        const filled = value >= s;
        const half = value >= s - 0.5 && value < s;
        return (
          <span
            key={s}
            className="relative inline-block"
            onClick={(e) => {
              if (!onChange) return;
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              const clickedHalf = e.clientX - rect.left < rect.width / 2;
              onChange(clickedHalf ? s - 0.5 : s);
            }}
          >
            <span className="text-line">★</span>
            {(filled || half) && (
              <span
                className="absolute inset-0 text-gold overflow-hidden"
                style={{ width: filled ? "100%" : "50%" }}
              >
                ★
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function ReviewSection({
  albumId,
  isLoggedIn,
}: {
  albumId: string | null;
  isLoggedIn: boolean;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    if (!albumId) return;
    fetch(`/api/reviews?albumId=${albumId}`)
      .then((res) => res.json())
      .then((json) => {
        setReviews(json.reviews ?? []);
        setMyReview(json.myReview ?? null);
        setAvgRating(json.avgRating ?? null);
        setCount(json.count ?? 0);
        if (json.myReview) {
          setMyRating(json.myReview.rating);
          setMyText(json.myReview.review_text ?? "");
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [albumId]);

  async function handleSave() {
    if (!albumId || myRating === 0) return;
    setSaving(true);
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId, rating: myRating, reviewText: myText }),
      });
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!albumId) return;
    await fetch("/api/reviews", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId }),
    });
    setMyRating(0);
    setMyText("");
    load();
  }

  if (loading || !albumId) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-ink">Avaliações</h2>
        {avgRating !== null && (
          <div className="flex items-center gap-2">
            <Stars value={avgRating} size="text-sm" />
            <span className="text-sm text-ink-muted">
              {avgRating.toFixed(1)} · {count}
            </span>
          </div>
        )}
      </div>

      {/* Minha avaliação */}
      {isLoggedIn ? (
        <div className="bg-surface border border-line rounded-xl p-4 mb-4">
          {!editing && myReview ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Stars value={myReview.rating} />
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs text-ink-muted hover:text-ink transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-xs text-ink-faint hover:text-coral transition-colors"
                  >
                    Apagar
                  </button>
                </div>
              </div>
              {myReview.review_text && (
                <p className="text-sm text-ink-muted">{myReview.review_text}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Stars value={myRating} onChange={setMyRating} />
              <textarea
                value={myText}
                onChange={(e) => setMyText(e.target.value)}
                placeholder="O que você achou? (opcional)"
                rows={3}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary/60 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || myRating === 0}
                  className="text-sm bg-primary text-white rounded-full px-4 py-2 font-semibold disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                {myReview && (
                  <button
                    onClick={() => setEditing(false)}
                    className="text-sm text-ink-faint hover:text-ink-muted transition-colors px-2"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-faint mb-4">Faça login pra avaliar esse álbum.</p>
      )}

      {/* Reviews dos outros */}
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="flex gap-3">
            <UserAvatar
              src={r.profiles?.avatar_url}
              alt={r.profiles?.username ?? "?"}
              className="w-8 h-8 rounded-full shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {r.profiles?.display_name || r.profiles?.username || "alguém"}
                </span>
                <Stars value={r.rating} size="text-xs" />
              </div>
              {r.review_text && <p className="text-sm text-ink-muted mt-0.5">{r.review_text}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
