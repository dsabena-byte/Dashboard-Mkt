"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface StackedPoint {
  period: string;
  [brand: string]: number | string | null;
}

// Composición de share por marca en dos períodos (primer y último año móvil MAT),
// barras 100% apiladas. Mismo mapa de colores que la serie de líneas.
export function MercadoStackedBars({
  data,
  brands,
  colors,
  suffix = "",
}: {
  data: StackedPoint[];
  brands: string[];
  colors: Record<string, string>;
  suffix?: string;
}) {
  if (data.length === 0) {
    return <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
        <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}${suffix}`} width={38} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, n: string) => [`${v}${suffix}`, n]}
        />
        {brands.map((b) => (
          <Bar key={b} dataKey={b} stackId="a" fill={colors[b] ?? "#94a3b8"} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
