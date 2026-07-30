"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FollowButton({
  targetUserId,
  initiallyFollowing,
}: {
  targetUserId: string;
  initiallyFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setBusy(true);
    setFollowing(next);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          action: next ? "follow" : "unfollow",
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`text-sm rounded-lg px-4 py-2 font-medium transition-colors disabled:opacity-50 ${
        following
          ? "border border-white/15 text-paper hover:border-white/30"
          : "bg-amber text-chassis hover:brightness-110"
      }`}
    >
      {following ? "Seguindo" : "Seguir"}
    </button>
  );
}
