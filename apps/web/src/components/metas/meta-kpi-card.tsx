import { cumplimientoPct, semaforoDe, SEMAFORO_COLOR, type Direccion } from "@/lib/metas";

export interface CmpRow {
  label: string; // "Mes Ago" / "Acum. YTD"
  actual: number | null;
  meta: number | null;
}

interface Props {
  title: string;
  medida?: string; // cómo se mide
  headlineActual: number | null; // valor grande (mes de referencia)
  headlineLabel: string; // ej "Ago 26"
  unidad?: "%" | "s" | "";
  direccion?: Direccion;
  umbralVerde?: number;
  umbralAmarillo?: number;
  rows: CmpRow[]; // comparaciones (mes, acumulado)
}

function fmt(v: number | null, unidad: "%" | "s" | ""): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (unidad === "%") return `${v.toFixed(2)}%`;
  if (unidad === "s") return `${Math.round(v)}s`;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

const SEM_BG: Record<string, string> = {
  verde: "rgba(22,163,74,.12)",
  amarillo: "rgba(217,119,6,.14)",
  rojo: "rgba(220,38,38,.12)",
  "sin-meta": "rgba(100,116,139,.10)",
};

export function MetaKpiCard({ title, medida, headlineActual, headlineLabel, unidad = "", direccion = "up", umbralVerde = 100, umbralAmarillo = 90, rows }: Props) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        {medida && <div className="mt-0.5 text-[10px] text-muted-foreground/70">{medida}</div>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{fmt(headlineActual, unidad)}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{headlineLabel}</span>
      </div>

      <div className="mt-3 space-y-2.5 border-t pt-2.5">
        {rows.map((r) => {
          const cumpl = cumplimientoPct(r.actual, r.meta, direccion);
          const sem = semaforoDe(cumpl, { umbralVerde, umbralAmarillo });
          const color = SEMAFORO_COLOR[sem];
          const desvio = r.actual != null && r.meta != null && r.meta !== 0 ? ((r.actual - r.meta) / r.meta) * 100 : null;
          const barPct = cumpl == null ? 0 : Math.max(0, Math.min(cumpl, 100));
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">meta</span>
                  <span className="font-semibold tabular-nums">{fmt(r.meta, unidad)}</span>
                </div>
                <span
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{ color, background: SEM_BG[sem] }}
                >
                  {desvio == null ? "sin meta" : (
                    <>
                      <span>{desvio >= 0 ? "▲" : "▼"}</span>
                      <span>{Math.abs(desvio).toFixed(0)}%</span>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
