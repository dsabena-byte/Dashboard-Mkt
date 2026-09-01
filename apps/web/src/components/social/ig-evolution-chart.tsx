"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface IgEvolutionDatum {
  mes: string;
  alcance: number | null;
  metaAlcance: number | null;
  alcColor: string; // color semáforo de la barra de alcance (vs su meta)
  engPct: number | null; // engagement como % (interacciones / alcance)
  metaEngPct: number | null;
}

const fmtK = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v));
const fmtKfull = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v));

// Punto de la línea de engagement % coloreado por semáforo del mes.
function EngDot(props: { cx?: number; cy?: number; payload?: IgEvolutionDatum }) {
  const { cx, cy } = props;
  if (cx == null || cy == null || props.payload?.engPct == null) return <g />;
  return <circle cx={cx} cy={cy} r={3.5} fill="#4f46e5" stroke="#fff" strokeWidth={1} />;
}

export function IgEvolutionChart({ data }: { data: IgEvolutionDatum[] }) {
  if (data.length === 0) {
    return <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">Sin datos mensuales.</div>;
  }
  const hasMetaAlc = data.some((d) => d.metaAlcance != null);
  const hasMetaEng = data.some((d) => d.metaEngPct != null);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 8 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
        <YAxis
          yAxisId="left"
          stroke="#4f46e5"
          fontSize={11}
          tickLine={false}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          label={{ value: "Engagement %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#4f46e5" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#64748b"
          fontSize={11}
          tickLine={false}
          tickFormatter={fmtK}
          label={{ value: "Alcance", angle: 90, position: "insideRight", fontSize: 10, fill: "#64748b" }}
        />
        <Tooltip
          formatter={(v: number, name: string) => [name.includes("%") ? `${v.toFixed(2)}%` : fmtKfull(v), name]}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "rgba(100,116,139,.06)" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Meta alcance = barra neutra hueca (referencia del plan) */}
        {hasMetaAlc && (
          <Bar yAxisId="right" dataKey="metaAlcance" name="Meta alcance" fill="#cbd5e1" stroke="#64748b" strokeWidth={1.25} radius={[3, 3, 0, 0]} />
        )}
        {/* Alcance real = barra coloreada por semáforo vs su meta */}
        <Bar yAxisId="right" dataKey="alcance" name="Alcance (real)" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.alcColor} />
          ))}
        </Bar>
        {/* Meta engagement % = línea punteada neutra */}
        {hasMetaEng && (
          <Line yAxisId="left" type="linear" dataKey="metaEngPct" name="Meta eng. %" stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="5 4" dot={false} connectNulls />
        )}
        {/* Engagement % real = línea índigo con puntos */}
        <Line yAxisId="left" type="monotone" dataKey="engPct" name="Engagement %" stroke="#4f46e5" strokeWidth={2.5} dot={<EngDot />} activeDot={{ r: 5 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
