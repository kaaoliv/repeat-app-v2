"use client";

export type DiscoverFilters = {
  genre: string; // "" = Any
  yearMin: string;
  yearMax: string;
  listened: string; // "" | "yes" | "no"
  rated: string;
  watchlist: string;
};

export const EMPTY_FILTERS: DiscoverFilters = {
  genre: "",
  yearMin: "",
  yearMax: "",
  listened: "",
  rated: "",
  watchlist: "",
};

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-ink">{label}</span>
        <span className="text-[15px] text-ink-faint">{value}</span>
      </div>
      {children}
    </div>
  );
}

function TriStateChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options: { v: string; label: string }[] = [
    { v: "", label: "Qualquer" },
    { v: "yes", label: "Sim" },
    { v: "no", label: "Não" },
  ];
  return (
    <div className="mt-2 flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.v}
          onClick={() => onChange(opt.v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.v
              ? "bg-primary text-white"
              : "bg-bg border border-line text-ink-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function DiscoverFiltersModal({
  open,
  onClose,
  filters,
  onChange,
  availableGenres,
  fadeListened,
  onToggleFadeListened,
}: {
  open: boolean;
  onClose: () => void;
  filters: DiscoverFilters;
  onChange: (f: DiscoverFilters) => void;
  availableGenres: string[];
  fadeListened: boolean;
  onToggleFadeListened: (v: boolean) => void;
}) {
  if (!open) return null;

  function set<K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg">
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <button onClick={onClose} className="text-[15px] text-ink-muted">
          Cancelar
        </button>
        <h2 className="text-[15px] font-semibold text-ink">Filtros</h2>
        <button onClick={onClose} className="text-[15px] font-semibold text-teal">
          Pronto
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <p className="pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Aparência
        </p>
        <Row label="Esmaecer já ouvidos" value="">
          <div className="mt-2">
            <button
              onClick={() => onToggleFadeListened(!fadeListened)}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                fadeListened ? "bg-teal" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  fadeListened ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </Row>

        <p className="pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Conteúdo
        </p>

        <Row label="Gênero" value={filters.genre || "Qualquer"}>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => set("genre", "")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filters.genre === ""
                  ? "bg-primary text-white"
                  : "bg-bg border border-line text-ink-muted"
              }`}
            >
              Qualquer
            </button>
            {availableGenres.map((g) => (
              <button
                key={g}
                onClick={() => set("genre", g)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filters.genre === g
                    ? "bg-primary text-white"
                    : "bg-bg border border-line text-ink-muted"
                }`}
              >
                {g}
              </button>
            ))}
            {availableGenres.length === 0 && (
              <span className="text-xs text-ink-faint">
                Nenhum gênero cadastrado nos álbuns em alta ainda.
              </span>
            )}
          </div>
        </Row>

        <Row label="Ano" value="">
          <div className="mt-2 flex items-center gap-2">
            <input
              inputMode="numeric"
              placeholder="De"
              value={filters.yearMin}
              onChange={(e) => set("yearMin", e.target.value.replace(/\D/g, ""))}
              className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-primary/60"
            />
            <span className="text-ink-faint">—</span>
            <input
              inputMode="numeric"
              placeholder="Até"
              value={filters.yearMax}
              onChange={(e) => set("yearMax", e.target.value.replace(/\D/g, ""))}
              className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-primary/60"
            />
          </div>
        </Row>

        <p className="pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Conta
        </p>

        <Row label="Ouvido" value="">
          <TriStateChips value={filters.listened} onChange={(v) => set("listened", v)} />
        </Row>
        <Row label="Avaliado" value="">
          <TriStateChips value={filters.rated} onChange={(v) => set("rated", v)} />
        </Row>
        <Row label="Na 'Quero ouvir'" value="">
          <TriStateChips value={filters.watchlist} onChange={(v) => set("watchlist", v)} />
        </Row>

        {hasActiveFilters && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="mt-6 text-sm font-semibold text-gold"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
