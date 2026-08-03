"use client";

import { useState } from "react";

// Diferente de AlbumCover (que usa next/image, restrito a domínios
// conhecidos), o avatar pode vir de qualquer URL que a pessoa colar —
// por isso usa <img> simples em vez de next/image.
export default function UserAvatar({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`bg-surface-2 flex items-center justify-center text-ink-faint ${className}`}>
        <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
