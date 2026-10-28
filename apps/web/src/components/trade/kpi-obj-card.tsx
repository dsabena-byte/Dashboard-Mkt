import { MetaKpiCard } from "@/components/metas/meta-kpi-card";

// Card de KPI con objetivo de Trade (/cuadros-basicos, /floor-share, /cb-ventas). Desde el 28-oct-2026 usa el MISMO
// sistema visual que Redes (MetaKpiCard): valor en tinta + fila "real vs meta" con semáforo, chip en pp y barra.
// Sin objetivo (obj null) = card informativa: valor en tinta, sin semáforo ni barra.
export function KpiObjCard({
  title, medida, value, obj, unit = "%", decimals = 1, contexto, objLabel,
}: {
  title: string;
  medida?: string;
  value: number | null;
  obj: number | null;
  unit?: string;
  decimals?: number;
  contexto?: string;
  /** Rótulo de la fila de comparación (ej. "Oct 2026"); default "Objetivo". */
  objLabel?: string;
}) {
  if (obj == null) {
    return (
      <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        {medida && <div className="mt-0.5 text-[10px] text-muted-foreground/70">{medida}</div>}
        <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">
          {value != null ? `${value.toLocaleString("es-AR", { maximumFractionDigits: decimals })}${unit}` : "—"}
        </div>
        {contexto && <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{contexto}</div>}
      </div>
    );
  }
  return (
    <MetaKpiCard title={title} medida={medida} headlineActual={value} headlineLabel="" contexto={contexto}
      unidad="%" decimales={decimals} delta="pp" rows={[{ label: objLabel ?? "Objetivo", actual: value, meta: obj }]} />
  );
}
