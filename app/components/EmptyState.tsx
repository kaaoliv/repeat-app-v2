import Link from "next/link";

// Estado vazio com "ilustração" (disco de vinil desenhado em SVG simples,
// não decorativo — representa o conceito do app), texto e call-to-action.
export default function EmptyState({
  title,
  description,
  cta,
  tone = "primary",
}: {
  title: string;
  description: string;
  cta?: { label: string; href: string };
  tone?: "primary" | "blue" | "coral" | "pink" | "gold" | "teal";
}) {
  const ring: Record<string, string> = {
    primary: "text-primary",
    blue: "text-blue",
    coral: "text-coral",
    pink: "text-pink",
    gold: "text-gold",
    teal: "text-teal",
  };
  const btn: Record<string, string> = {
    primary: "bg-primary",
    blue: "bg-blue",
    coral: "bg-coral",
    pink: "bg-pink",
    gold: "bg-gold text-bg",
    teal: "bg-teal text-bg",
  };

  return (
    <div className="animate-fade-in flex flex-col items-center px-6 py-14 text-center">
      <div className={`mb-5 ${ring[tone]}`}>
        <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="12" cy="12" r="9.2" className="opacity-90" />
          <circle cx="12" cy="12" r="5.5" className="opacity-40" />
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          <path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4" className="opacity-30" />
        </svg>
      </div>
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">
        {description}
      </p>
      {cta && (
        <Link
          href={cta.href}
          className={`mt-5 inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-transform active:scale-95 ${btn[tone]}`}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
