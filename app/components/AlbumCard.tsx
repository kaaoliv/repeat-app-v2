import Link from "next/link";
import AlbumCover from "./AlbumCover";

export type Badge = {
  // cor do badge — usa as cores do tema
  color: "primary" | "blue" | "coral" | "pink" | "gold" | "teal";
  label: string;
  // posição no canto da capa
  corner?: "tl" | "tr" | "bl" | "br";
  icon?: React.ReactNode;
};

const colorClasses: Record<Badge["color"], string> = {
  primary: "bg-primary text-white",
  blue: "bg-blue text-white",
  coral: "bg-coral text-white",
  pink: "bg-pink text-white",
  gold: "bg-gold text-bg",
  teal: "bg-teal text-bg",
};

const cornerClasses: Record<NonNullable<Badge["corner"]>, string> = {
  tl: "top-2 left-2",
  tr: "top-2 right-2",
  bl: "bottom-2 left-2",
  br: "bottom-2 right-2",
};

// Card de álbum estilo "capa de LP" — capa grande quadrada, badges
// coloridos flutuando sobre a capa, e título/subtítulo embaixo.
export default function AlbumCard({
  href,
  title,
  subtitle,
  coverUrl,
  badges = [],
  accent = "primary",
}: {
  href: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  badges?: Badge[];
  accent?: Badge["color"];
}) {
  const accentBar: Record<Badge["color"], string> = {
    primary: "bg-primary",
    blue: "bg-blue",
    coral: "bg-coral",
    pink: "bg-pink",
    gold: "bg-gold",
    teal: "bg-teal",
  };

  return (
    <Link href={href} className="group block">
      <div className="relative">
        <AlbumCover
          src={coverUrl}
          alt={title}
          title={title}
          sizes="(max-width: 640px) 45vw, 200px"
          className="aspect-square w-full rounded-xl shadow-card ring-1 ring-line transition-transform duration-200 group-active:scale-[0.97] group-hover:-translate-y-0.5"
        />
        {/* barrinha de acento embaixo da capa (detalhe do Refract) */}
        <div
          className={`absolute -bottom-0.5 left-3 right-3 h-1 rounded-full ${accentBar[accent]} opacity-90`}
        />
        {badges.map((badge, i) => (
          <span
            key={i}
            className={`absolute z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-badge ${
              colorClasses[badge.color]
            } ${cornerClasses[badge.corner ?? "tl"]}`}
          >
            {badge.icon}
            {badge.label}
          </span>
        ))}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-ink-muted">{subtitle}</p>
        )}
      </div>
    </Link>
  );
}
