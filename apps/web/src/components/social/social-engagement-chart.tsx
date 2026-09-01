"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface EngComponent {
  key: string;
  name: string;
  color: string;
}

// Cada fila lleva mes, engPct, metaEngPct y una key numérica por componente de interacción.
export type SocialEngDatum = { mes: string; engPct: number | null; metaEngPct: number | null } & Record<string, number | string | null>;

const fmtK = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v)));
const fmtKfull = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v)));

export function SocialEngagementChart({ data, components }: { data: SocialEngDatum[]; components: EngComponent[] }) {
  if (data.length === 0) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  const hasMeta = data.some((d) => d.metaEngPct != null);
  const lastKey = components.length ? components[components.length - 1]!.key : "";

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
        <YAxis
          yAxisId="left"
          width={56}
          stroke="#334155"
          fontSize={11}
          tickLine={false}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          label={{ value: "Engagement %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#334155" }}
        />
        <YAxis
          yAxisId="right"
          width={56}
          orientation="right"
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          tickFormatter={fmtK}
          label={{ value: "Interacciones", angle: 90, position: "insideRight", fontSize: 10, fill: "#94a3b8" }}
        />
        <Tooltip
          formatter={(v: number, name: string) => [name.includes("%") ? `${v.toFixed(2)}%` : fmtKfull(v), name]}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "rgba(100,116,139,.06)" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
        {components.map((c) => (
          <Bar key={c.key} yAxisId="right" dataKey={c.key} name={c.name} stackId="int" fill={c.color} radius={c.key === lastKey ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
        ))}
        {hasMeta && (
          <Line yAxisId="left" type="linear" dataKey="metaEngPct" name="Meta eng. %" stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#94a3b8" }} connectNulls />
        )}
        <Line yAxisId="left" type="monotone" dataKey="engPct" name="Engagement %" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: "#0f172a", stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5 }} connectNulls>
          <LabelList dataKey="engPct" position="top" offset={10} fontSize={9} fontWeight={600} fill="#0f172a" formatter={(v: number) => (v != null ? `${v.toFixed(1)}%` : "")} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Componentes de interacción compartidos (rampa azul monocromática, de oscuro a claro).
export const ENG_COLORS = ["#1e40af", "#60a5fa", "#bfdbfe"];
