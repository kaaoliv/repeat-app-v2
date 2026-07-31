"use client";

import Image from "next/image";
import { useState } from "react";

// Wrapper client-side do next/image — existe porque Server Components não
// podem passar props de função (tipo onError) direto pro <Image>. Isolando
// esse comportamento aqui, as páginas de perfil/biblioteca/watchlist (que
// são Server Components) continuam podendo mostrar capa com fallback.
export default function AlbumCover({
  src,
  alt,
  className = "",
  sizes = "200px",
  title,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${className}`}
    >
      {!showFallback && (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {showFallback && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-surface p-3 text-center">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            className="text-ink-faint"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
          {title && (
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink-muted">
              {title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
