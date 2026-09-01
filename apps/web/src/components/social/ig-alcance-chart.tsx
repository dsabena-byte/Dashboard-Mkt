"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface IgAlcanceDatum {
  mes: string;
  alcance: number | null;
  metaAlcance: number | null;
  alcColor: string; // semáforo de la barra real vs su meta
}

const fmtK = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v)));
const fmtKfull = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v)));

export function IgAlcanceChart({ data }: { data: IgAlcanceDatum[] }) {
  if (data.length === 0) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  const hasMeta = data.some((d) => d.metaAlcance != null);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
        <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={fmtK} />
        <Tooltip
          formatter={(v: number, name: string) => [fmtKfull(v), name]}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "rgba(100,116,139,.06)" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {hasMeta && <Bar dataKey="metaAlcance" name="Meta alcance" fill="#cbd5e1" stroke="#64748b" strokeWidth={1.25} radius={[3, 3, 0, 0]} />}
        <Bar dataKey="alcance" name="Alcance (real)" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.alcColor} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
