"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fmtMoney = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${Math.round(v)}`;

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
};

export interface InvRevPoint {
  mes: string;          // label corto, p.ej. "Ene"
  inversion: number;
  ingresos: number;
  roas: number | null;
}

// Inversión vs Ingresos por mes (barras) + ROAS (línea, eje derecho).
export function InvestmentRevenueChart({ data }: { data: InvRevPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis yAxisId="left" tickFormatter={fmtMoney} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(v: number) => `${v.toFixed(0)}x`}
          fontSize={11}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          formatter={(v: number, n: string) => (n === "ROAS" ? [`${v.toFixed(2)}x`, n] : [fmtMoney(v), n])}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="inversion" name="Inversión" fill="#2b4dff" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" dataKey="roas" name="ROAS" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Donut compacto (solo torta) para acompañar una tabla de detalle al lado.
export function CompactDonut({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="56%" outerRadius="92%" paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [`${fmtMoney(v)} · ${total ? ((v / total) * 100).toFixed(1) : 0}%`, ""]}
          contentStyle={tooltipStyle}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Donut con leyenda de valores + % al lado (formato configurable).
export function LegendDonut({
  data,
  fmt,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  fmt: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <div>
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie data={sorted} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="56%" outerRadius="90%" paddingAngle={2}>
            {sorted.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => [`${fmt(v)} · ${total ? ((v / total) * 100).toFixed(1) : 0}%`, ""]}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1">
        {sorted.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {fmt(d.value)} · <span className="font-semibold text-foreground">{total ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Embudo de conversión compacto: etiqueta + valor arriba, barra proporcional debajo.
export interface FunnelStage {
  label: string;
  value: number;
  pct?: string | null;   // % respecto de la etapa anterior
  color: string;
}

export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const w = Math.max((s.value / max) * 100, 4);
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">{s.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{s.value.toLocaleString("es-AR")}</span>
                {i > 0 && s.pct ? <span className="ml-1 text-muted-foreground">({s.pct})</span> : null}
              </span>
            </div>
            <div className="h-6 rounded bg-muted/40">
              <div className="h-6 rounded" style={{ width: `${w}%`, backgroundColor: s.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
