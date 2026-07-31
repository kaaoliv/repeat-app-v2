import Link from "next/link";

// Cabeçalho de página padrão: título grande estilo Refract, com opcional
// botão de voltar e um slot de ação à direita.
export default function PageHeader({
  title,
  subtitle,
  count,
  backHref,
  action,
}: {
  title: string;
  subtitle?: string;
  count?: number | string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pb-4 pt-8">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-1.5 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar
          </Link>
        )}
        <h1 className="flex items-baseline gap-2 font-display text-3xl font-extrabold tracking-tight text-ink">
          <span className="text-balance">{title}</span>
          {count !== undefined && (
            <span className="text-lg font-semibold text-ink-faint">{count}</span>
          )}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}
