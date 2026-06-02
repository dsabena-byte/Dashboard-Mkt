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
import { colorForBrand } from "@/lib/floor-share-colors";
export { colorForBrand, BRAND_COLORS_FS } from "@/lib/floor-share-colors";

interface BrandRankingProps {
  data: { marca: string; share: number; unidades: number }[];
  highlight?: string;
}

export function FloorShareBrandRanking({ data, highlight = "Drean" }: BrandRankingProps) {
  if (data.length === 0) return <div className="py-12 text-center text-xs text-muted-foreground">Sin datos.</div>;
  const chartData = data.map((d) => ({
    marca: d.marca,
    share: Number(d.share.toFixed(1)),
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 50, left: 80, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="marca" fontSize={11} stroke="hsl(var(--muted-foreground))" width={80} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
          formatter={(v: number) => [`${v}%`, "Share"]}
        />
        <Bar dataKey="share" radius={[0, 4, 4, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.marca === highlight ? colorForBrand(highlight) : colorForBrand(d.marca)} opacity={d.marca === highlight ? 1 : 0.65} />
          ))}
          <LabelList dataKey="share" position="right" fontSize={11} fontWeight={700} formatter={(v: number) => `${v.toFixed(1)}%`} />
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
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
          formatter={(v: number) => `${v}%`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {marcas.map((m) => (
          <Line
            key={m}
            type="monotone"
            dataKey={m}
            stroke={colorForBrand(m)}
            strokeWidth={m === "Drean" ? 3 : 2}
            dot={{ r: m === "Drean" ? 5 : 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
