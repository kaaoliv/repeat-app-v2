import Link from "next/link";

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint shrink-0">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const items: { href: string; label: string; emoji: string }[] = [
  { href: "/discover", label: "Gênero", emoji: "🎧" },
  { href: "/discover", label: "Populares da semana", emoji: "🔥" },
  { href: "/top-rated", label: "Mais bem avaliados", emoji: "⭐" },
  { href: "/new-releases", label: "Últimos lançamentos", emoji: "✨" },
];

export default function ExploreByPanel() {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Explorar por
      </h2>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {items.map((item, i) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/5 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <span className="flex items-center gap-3 text-[15px] text-ink">
              <span className="text-base">{item.emoji}</span>
              {item.label}
            </span>
            <ChevronRight />
          </Link>
        ))}
      </div>
    </div>
  );
}
