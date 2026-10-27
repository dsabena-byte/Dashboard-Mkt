"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export { colorForBrand, BRAND_COLORS_FS } from "@/lib/floor-share-colors";

interface BrandRankingProps {
  data: { marca: string; share: number; unidades: number }[];
  highlight?: string;
}

// Mismos colores que la app vieja: Drean rojo, el resto azul (ranking) / paleta fija por posición (evolución).
const DREAN_RED = "#e63946";
const OTRAS = ["#60a5fa", "#f59e0b", "#10b981", "#a78bfa", "#06b6d4", "#f97316", "#84cc16", "#f472b6", "#c084fc"];

export function FloorShareBrandRanking({ data, highlight = "Drean" }: BrandRankingProps) {
  if (data.length === 0) return <div className="py-12 text-center text-xs text-muted-foreground">Sin datos.</div>;
  const chartData = data.map((d) => ({ marca: d.marca, share: Number(d.share.toFixed(1)) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 38)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="marca" fontSize={11} stroke="hsl(var(--muted-foreground))" width={76} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
          formatter={(v: number) => [`${v}%`, "Floor Share"]}
        />
        <Bar dataKey="share">
          {chartData.map((d, i) => <Cell key={i} fill={d.marca === highlight ? DREAN_RED : "#3b82f6"} />)}
          <LabelList dataKey="share" position="right" fontSize={10} fontWeight={700} formatter={(v: number) => `${Math.round(v)}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface WeeklyProps {
  data: { semana: number; shares: Record<string, number> }[];
  marcas: string[];
}

export function FloorShareWeeklyChart({ data, marcas }: WeeklyProps) {
  if (data.length === 0) return <div className="py-12 text-center text-xs text-muted-foreground">Sin datos.</div>;
  const chartData = data.map((d) => {
    const row: Record<string, string | number> = { label: `Sem ${d.semana}` };
    for (const m of marcas) row[m] = Number((d.shares[m] ?? 0).toFixed(1));
    return row;
  });
  const otras = marcas.filter((m) => m !== "Drean");
  const color = (m: string) => (m === "Drean" ? DREAN_RED : OTRAS[otras.indexOf(m) % OTRAS.length]!);
  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" angle={-35} textAnchor="end" height={44} interval={0} />
        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
          formatter={(v: number) => `${v}%`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Drean al final → se dibuja arriba de las demás. */}
        {[...otras, "Drean"].filter((m) => marcas.includes(m)).map((m) => (
          <Line key={m} type="monotone" dataKey={m} stroke={color(m)} strokeWidth={m === "Drean" ? 3 : 1.5} dot={{ r: m === "Drean" ? 4 : 2 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
