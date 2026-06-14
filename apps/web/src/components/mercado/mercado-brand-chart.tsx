"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = ["#ec4899", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#94a3b8", "#64748b"];
const HIGHLIGHT = "#2b4dff"; // Drean

export interface BrandChartPoint {
  mes: string;
  [brand: string]: number | string | null;
}

export function MercadoBrandChart({
  data,
  brands,
  highlight = "DREAN",
  suffix = "",
  colors,
}: {
  data: BrandChartPoint[];
  brands: string[];
  highlight?: string;
  suffix?: string;
  colors?: Record<string, string>;
}) {
  if (data.length === 0) {
    return <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  const others = brands.filter((b) => b !== highlight);
  const long = data.length > 24; // serie histórica larga: eje más espaciado y sin puntos
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="mes"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          interval="preserveStartEnd"
          minTickGap={long ? 36 : 12}
          tickMargin={6}
        />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}${suffix}`} width={42} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [`${v}${suffix}`, n]} />
        {others.map((b, i) => (
          <Line
            key={b}
            type="linear"
            dataKey={b}
            stroke={colors?.[b] ?? PALETTE[i % PALETTE.length]}
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        ))}
        {brands.includes(highlight) && (
          <Line type="linear" dataKey={highlight} stroke={colors?.[highlight] ?? HIGHLIGHT} strokeWidth={3} dot={long ? false : { r: 2.5 }} connectNulls />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
