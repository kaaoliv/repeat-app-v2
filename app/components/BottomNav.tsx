"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  match: (path: string) => boolean;
};

const stroke = {
  fill: "none",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const items: Item[] = [
  {
    href: "/",
    label: "Início",
    match: (p) => p === "/" || p.startsWith("/album") || p.startsWith("/artist"),
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "Descobrir",
    match: (p) => p.startsWith("/discover"),
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill={active ? "currentColor" : "none"}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5z" fill={active ? "var(--color-bg, #0b0f14)" : "none"} />
      </svg>
    ),
  },
  {
    href: "/watchlist",
    label: "Quero ouvir",
    match: (p) => p.startsWith("/watchlist"),
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill={active ? "currentColor" : "none"}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
      </svg>
    ),
  },
  {
    href: "/library",
    label: "Biblioteca",
    match: (p) => p.startsWith("/library") || p.startsWith("/lists") || p.startsWith("/stats"),
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
        <rect x="4" y="4" width="4" height="16" rx="1" />
        <rect x="10" y="4" width="4" height="16" rx="1" />
        <path d="m16.5 5.2 2.8.7a1 1 0 0 1 .7 1.2L17 19.4" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Perfil",
    match: (p) => p.startsWith("/profile") || p.startsWith("/u/"),
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill={active ? "currentColor" : "none"}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </svg>
    ),
  },
  {
    href: "/people",
    label: "Buscar",
    match: (p) => p.startsWith("/people"),
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname() || "/";

  // Não mostra a barra no login
  if (pathname.startsWith("/login")) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-xl px-4 pb-5">
        <div className="pointer-events-auto flex items-center justify-between gap-1 rounded-full border border-line bg-surface/80 px-2 py-2 backdrop-blur-xl shadow-card">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-11 flex-1 items-center justify-center rounded-full transition-colors ${
                  active
                    ? "bg-primary/15 text-primary-soft"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {item.icon(active)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
