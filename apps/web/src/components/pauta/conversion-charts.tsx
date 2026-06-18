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

// Embudo de conversión: lista de etapas con barra proporcional + % de paso.
export interface FunnelStage {
  label: string;
  value: number;
  pct?: string | null;   // % respecto de la etapa anterior
  color: string;
}

export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        // ancho proporcional con mínimo visible (las transacciones son chicas vs sesiones)
        const w = Math.max((s.value / max) * 100, 6);
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-44 shrink-0 text-right text-xs text-muted-foreground">{s.label}</div>
            <div className="relative h-9 flex-1 rounded bg-muted/40">
              <div
                className="flex h-9 items-center rounded px-2 text-xs font-semibold text-white"
                style={{ width: `${w}%`, backgroundColor: s.color }}
              >
                {s.value.toLocaleString("es-AR")}
              </div>
            </div>
            <div className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
              {i === 0 ? "" : s.pct ? `→ ${s.pct}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
