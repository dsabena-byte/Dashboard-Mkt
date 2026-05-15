"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface SerieDatum {
  fecha: string;
  [competidor: string]: string | number | null;
}

interface CompetitorTrafficChartProps {
  series: Array<{ competidor: string; serie: Array<{ fecha: string; visitas: number | null }> }>;
}

const PALETA = [
  "#3b82f6", "#f43f5e", "#22c55e", "#a78bfa",
  "#f97316", "#facc15", "#0ea5e9", "#ec4899",
];

export function CompetitorTrafficChart({ series }: CompetitorTrafficChartProps) {
  if (series.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        Sin datos históricos todavía. Necesitamos al menos 2 snapshots para ver evolución.
      </div>
    );
  }

  // Unir todas las fechas presentes en cualquier serie y armar un row por fecha
  const fechasSet = new Set<string>();
  for (const s of series) for (const p of s.serie) fechasSet.add(p.fecha);
  const fechas = [...fechasSet].sort();

  const data: SerieDatum[] = fechas.map((fecha) => {
    const row: SerieDatum = { fecha };
    for (const s of series) {
      const p = s.serie.find((x) => x.fecha === fecha);
      row[s.competidor] = p?.visitas ?? null;
    }
    return row;
  });

  const formatTick = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
      : String(v);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickFormatter={formatTick}
        />
        <Tooltip
          formatter={(v: number) => formatNumber(v)}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, i) => (
          <Line
            key={s.competidor}
            type="monotone"
            dataKey={s.competidor}
            stroke={PALETA[i % PALETA.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
