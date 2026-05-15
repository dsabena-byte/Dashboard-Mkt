interface KpiBarPanelProps {
  title: string;
  subtitle?: string;
  data: Array<{ label: string; value: number; display: string }>;
  /** "direct" — más alto = mejor (verde). "reverse" — más bajo = mejor. */
  colorBy?: "direct" | "reverse";
  maxLabel?: string;
}

export function KpiBarPanel({ title, subtitle, data, colorBy = "direct", maxLabel }: KpiBarPanelProps) {
  if (data.length === 0) {
    return (
      <div className="rounded border border-input p-4 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">{title}</div>
        Sin datos.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  // Para colores: ranking por valor, primer puesto verde si direct, rojo si reverse.
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const rankByLabel = new Map(sorted.map((d, i) => [d.label, i]));

  const colorFor = (label: string) => {
    const rank = rankByLabel.get(label) ?? 0;
    const total = data.length;
    const isTop = rank < Math.ceil(total / 3);
    const isBottom = rank >= total - Math.ceil(total / 3);
    if (colorBy === "direct") {
      return isTop ? "bg-emerald-500/70" : isBottom ? "bg-rose-500/60" : "bg-slate-400/60";
    }
    return isTop ? "bg-rose-500/60" : isBottom ? "bg-emerald-500/70" : "bg-slate-400/60";
  };

  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-foreground">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="space-y-1.5">
        {data.map((d) => {
          const widthPct = (d.value / maxValue) * 100;
          return (
            <div key={d.label} className="flex items-center gap-2 text-xs">
              <div className="w-24 truncate">{d.label}</div>
              <div className="relative h-4 flex-1 rounded bg-muted/40">
                <div
                  className={`absolute left-0 top-0 h-full rounded ${colorFor(d.label)}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="w-14 text-right tabular-nums font-medium">
                {d.display}
                {maxLabel ? "" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
