import type { InsightRow } from "@/lib/insights-queries";

const PRIO_STYLE: Record<string, { bg: string; border: string; text: string; chip: string; label: string }> = {
  alta:  { bg: "bg-rose-50",    border: "border-rose-300",    text: "text-rose-900",    chip: "bg-rose-500 text-white",    label: "ALTA" },
  media: { bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-900",   chip: "bg-amber-500 text-white",   label: "MEDIA" },
  baja:  { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-900",   chip: "bg-slate-400 text-white",   label: "BAJA" },
};

const TIPO_ICON: Record<string, string> = {
  alerta: "🔴",
  oportunidad: "🟢",
  info: "ℹ️",
};

export function InsightsPanel({ insights, titulo = "📊 Insights del período" }: { insights: InsightRow[]; titulo?: string }) {
  if (insights.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-bold">{titulo}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sin insights generados todavía. El cron analiza los últimos 30 días vs los 30 previos y deja recomendaciones acá. Disparalo manual desde GitHub Actions o esperá la corrida diaria.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{titulo}</h3>
        <span className="text-[10px] text-muted-foreground">
          Generado: {new Date(insights[0]!.fecha_generado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((i) => {
          const style = PRIO_STYLE[i.prioridad] ?? PRIO_STYLE.baja!;
          const icon = TIPO_ICON[i.tipo] ?? "•";
          const acciones = Array.isArray(i.acciones) ? i.acciones : [];
          const permalink = (i.datos as { permalink?: string } | null)?.permalink;
          return (
            <div key={i.id} className={`rounded-lg border-l-4 ${style.border} ${style.bg} ${style.text} p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span>{icon}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.chip}`}>
                    {style.label}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-sm font-semibold leading-snug">{i.titulo}</div>
              <p className="mt-1 text-[11px] leading-relaxed opacity-80">{i.descripcion}</p>
              {acciones.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px]">
                  {acciones.map((a, idx) => (
                    <li key={idx} className="flex gap-1.5">
                      <span className="shrink-0 opacity-50">→</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
              {permalink && (
                <a
                  href={permalink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block text-[11px] font-medium underline opacity-80 hover:opacity-100"
                >
                  Ver post ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
