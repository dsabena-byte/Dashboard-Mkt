"use client";

import {
  Bar,
  CartesianGrid,
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
  engPct: number | null; // engagement como % (interacciones / alcance)
  metaEngPct: number | null;
}

const fmtK = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v));
const fmtKfull = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v));

export function IgEvolutionChart({ data }: { data: IgEvolutionDatum[] }) {
  if (data.length === 0) {
    return <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">Sin datos mensuales.</div>;
  }
  const hasMetaAlc = data.some((d) => d.metaAlcance != null);
  const hasMetaEng = data.some((d) => d.metaEngPct != null);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis
          yAxisId="left"
          stroke="#dc2626"
          fontSize={11}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          label={{ value: "Engagement %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#dc2626" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#2b4dff"
          fontSize={11}
          tickFormatter={fmtK}
          label={{ value: "Alcance", angle: 90, position: "insideRight", fontSize: 10, fill: "#2b4dff" }}
        />
        <Tooltip
          formatter={(v: number, name: string) => [name.includes("%") ? `${v.toFixed(2)}%` : fmtKfull(v), name]}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Alcance: barra real + barra meta, lado a lado */}
        <Bar yAxisId="right" dataKey="alcance" fill="#2b4dff" name="Alcance (personas)" radius={[2, 2, 0, 0]} />
        {hasMetaAlc && <Bar yAxisId="right" dataKey="metaAlcance" fill="#86efac" name="Meta alcance" radius={[2, 2, 0, 0]} />}
        {/* Engagement %: línea real + línea meta */}
        <Line yAxisId="left" type="monotone" dataKey="engPct" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Engagement %" connectNulls />
        {hasMetaEng && (
          <Line yAxisId="left" type="linear" dataKey="metaEngPct" stroke="#16a34a" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#16a34a" }} name="Meta eng. %" connectNulls />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
