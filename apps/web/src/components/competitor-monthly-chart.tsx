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

interface MonthlyDatum {
  fecha: string;
  [competidor: string]: string | number | null;
}

interface CompetitorMonthlyChartProps {
  data: Array<{ competidor: string; meses: Array<{ fecha: string; visitas: number }> }>;
}

const PALETA = [
  "#3b82f6", "#f43f5e", "#22c55e", "#a78bfa",
  "#f97316", "#facc15", "#0ea5e9", "#ec4899",
];

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function fmtMonth(fecha: string): string {
  const [y, m] = fecha.split("-");
  const idx = parseInt(m ?? "1", 10) - 1;
  return `${MONTH_LABELS[idx] ?? m} ${y?.slice(2) ?? ""}`;
}

export function CompetitorMonthlyChart({ data }: CompetitorMonthlyChartProps) {
  const competidores = data.filter((d) => d.meses.length > 0);
  if (competidores.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        El actor de Apify no devolvió historia mensual en este snapshot.
      </div>
    );
  }

  const fechasSet = new Set<string>();
  for (const c of competidores) for (const m of c.meses) fechasSet.add(m.fecha);
  const fechas = [...fechasSet].sort();

  const rows: MonthlyDatum[] = fechas.map((fecha) => {
    const row: MonthlyDatum = { fecha: fmtMonth(fecha) };
    for (const c of competidores) {
      const m = c.meses.find((x) => x.fecha === fecha);
      row[c.competidor] = m?.visitas ?? null;
    }
    return row;
  });

  const tickFmt = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
      : String(v);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={tickFmt} />
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
        {competidores.map((c, i) => (
          <Line
            key={c.competidor}
            type="monotone"
            dataKey={c.competidor}
            stroke={PALETA[i % PALETA.length]}
            strokeWidth={2.5}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
