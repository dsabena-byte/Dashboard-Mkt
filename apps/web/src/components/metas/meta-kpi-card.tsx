import { cumplimientoPct, semaforoDe, SEMAFORO_COLOR, type Direccion } from "@/lib/metas";

interface Props {
  title: string;
  medida?: string; // cómo se mide, ej "Interacciones ÷ Alcance"
  actual: number | null; // valor del mes de referencia
  meta: number | null;
  mesLabel: string; // mes de referencia, ej "Ago 26"
  unidad?: "%" | ""; // formato del valor
  direccion?: Direccion;
  umbralVerde?: number;
  umbralAmarillo?: number;
  periodoHint?: string; // ej "YTD 294.3K"
}

function fmt(v: number | null, unidad: "%" | ""): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (unidad === "%") return `${v.toFixed(2)}%`;
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

export function MetaKpiCard({ title, medida, actual, meta, mesLabel, unidad = "", direccion = "up", umbralVerde = 100, umbralAmarillo = 90, periodoHint }: Props) {
  const cumpl = cumplimientoPct(actual, meta, direccion);
  const sem = semaforoDe(cumpl, { umbralVerde, umbralAmarillo });
  const color = SEMAFORO_COLOR[sem];
  // Desvío % (real vs meta) para el chip: positivo = por encima de la meta.
  const desvio = actual != null && meta != null && meta !== 0 ? ((actual - meta) / meta) * 100 : null;
  const barPct = cumpl == null ? 0 : Math.max(0, Math.min(cumpl, 100));

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
          {medida && <div className="mt-0.5 text-[10px] text-muted-foreground/70">{medida}</div>}
        </div>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} title={sem} />
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{fmt(actual, unidad)}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{mesLabel}</span>
      </div>

      {/* Meta jerarquizada + desvío con semáforo */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
        <div className="text-xs">
          <span className="text-muted-foreground">Meta {mesLabel}</span>
          <div className="text-sm font-semibold tabular-nums">{fmt(meta, unidad)}</div>
        </div>
        <div
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums"
          style={{ color, background: SEM_BG[sem] }}
        >
          {desvio == null ? (
            "sin meta"
          ) : (
            <>
              <span>{desvio >= 0 ? "▲" : "▼"}</span>
              <span>{Math.abs(desvio).toFixed(0)}%</span>
              <span className="font-normal opacity-70">{cumpl != null ? `· ${Math.round(cumpl)}% meta` : ""}</span>
            </>
          )}
        </div>
      </div>

      {/* Barra de avance vs meta */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
      </div>

      {periodoHint && <div className="mt-2 text-[10px] text-muted-foreground/70">{periodoHint}</div>}
    </div>
  );
}
