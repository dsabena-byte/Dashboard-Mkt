"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface IgEngagementDatum {
  mes: string;
  likes: number | null;
  comentarios: number | null;
  guardados: number | null;
  engPct: number | null; // engagement % real (interacciones / alcance)
  metaEngPct: number | null;
}

const fmtK = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v)));
const fmtKfull = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v)));

export function IgEngagementChart({ data }: { data: IgEngagementDatum[] }) {
  if (data.length === 0) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  const hasMeta = data.some((d) => d.metaEngPct != null);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
          label={{ value: "Interacciones", angle: 90, position: "insideRight", fontSize: 10, fill: "#64748b" }}
        />
        <Tooltip
          formatter={(v: number, name: string) => [name.includes("%") ? `${v.toFixed(2)}%` : fmtKfull(v), name]}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "rgba(100,116,139,.06)" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Interacciones absolutas apiladas (eje derecho) */}
        <Bar yAxisId="right" dataKey="likes" name="Likes" stackId="int" fill="#ec4899" radius={[0, 0, 0, 0]} />
        <Bar yAxisId="right" dataKey="comentarios" name="Comentarios" stackId="int" fill="#3b82f6" />
        <Bar yAxisId="right" dataKey="guardados" name="Guardados" stackId="int" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        {/* Engagement % (eje izquierdo): meta + real */}
        {hasMeta && (
          <Line yAxisId="left" type="linear" dataKey="metaEngPct" name="Meta eng. %" stroke="#64748b" strokeWidth={1.75} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#64748b" }} connectNulls />
        )}
        <Line yAxisId="left" type="monotone" dataKey="engPct" name="Engagement %" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3.5, fill: "#4f46e5", stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
