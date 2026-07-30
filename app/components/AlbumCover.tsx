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
  sizes = "56px",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-chassis ${className}`}>
      {src && !failed && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
