import { cumplimientoPct, semaforoDe, SEMAFORO_COLOR } from "@/lib/metas";

// Card de KPI con objetivo — sistema visual sobrio (= MetaKpiCard): headline
// coloreado por SEMÁFORO (verde si cumple el objetivo, amarillo cerca, rojo lejos),
// chip de desvío en pp y barra de avance. Reemplaza los cards navy/rojos de CB y
// Floor Share para alinearlos con el resto de los dashboards.

const SEM_BG: Record<string, string> = {
  verde: "rgba(22,163,74,.12)",
  amarillo: "rgba(217,119,6,.14)",
  rojo: "rgba(220,38,38,.12)",
  "sin-meta": "rgba(100,116,139,.10)",
};

export function KpiObjCard({
  title, medida, value, obj, unit = "%", decimals = 1, contexto,
}: {
  title: string;
  medida?: string;
  value: number | null;
  obj: number;
  unit?: string;
  decimals?: number;
  contexto?: string;
}) {
  const cumpl = cumplimientoPct(value, obj, "up");
  const sem = semaforoDe(cumpl, { umbralVerde: 100, umbralAmarillo: 90 });
  const color = SEMAFORO_COLOR[sem];
  const delta = value != null ? value - obj : null;
  const barPct = cumpl == null ? 0 : Math.max(0, Math.min(cumpl, 100));
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {medida && <div className="mt-0.5 text-[10px] text-muted-foreground/70">{medida}</div>}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums" style={{ color }}>
          {value != null ? `${value.toFixed(decimals)}${unit}` : "—"}
        </span>
        <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ color, background: SEM_BG[sem] }}>
          {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(decimals)} pp`}
        </span>
      </div>
      {contexto && <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{contexto}</div>}

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Objetivo {obj}{unit}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
      </div>
    </div>
  );
}
