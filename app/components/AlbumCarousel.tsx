import Link from "next/link";
import AlbumCard, { type Badge } from "./AlbumCard";

export type CarouselItem = {
  href: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  badge?: Badge;
};

// Fileira horizontal com scroll (o "Hottest" / "New Releases" do Refract).
// Some sozinho se não tiver itens — nunca mostra uma seção vazia.
export default function AlbumCarousel({
  title,
  emoji,
  items,
  accent = "primary",
  seeAllHref,
}: {
  title: string;
  emoji?: string;
  items: CarouselItem[];
  accent?: Badge["color"];
  seeAllHref?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="flex items-center gap-2 font-display font-bold text-lg text-ink">
          {emoji && <span>{emoji}</span>}
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-0.5 text-xs font-semibold text-ink-muted transition-colors hover:text-primary-soft"
          >
            Ver tudo
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>
      <div className="flex gap-3.5 overflow-x-auto px-4 pb-1 snap-x snap-mandatory no-scrollbar">
        {items.map((item, i) => (
          <div key={i} className="w-32 sm:w-36 shrink-0 snap-start">
            <AlbumCard
              href={item.href}
              title={item.title}
              subtitle={item.subtitle}
              coverUrl={item.coverUrl}
              accent={accent}
              badges={item.badge ? [item.badge] : []}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
