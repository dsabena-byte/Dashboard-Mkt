"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface MonthlyDatum {
  mes: string;
  usuarios_curr: number;
  usuarios_prev: number;
  sesiones_curr?: number;
  sesiones_prev?: number;
}

interface WebMonthlyChartProps {
  data: MonthlyDatum[];
  labels?: { curr: string; prev: string };
}

export function WebMonthlyChart({ data, labels = { curr: "2026", prev: "2025" } }: WebMonthlyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sin datos.
      </div>
    );
  }

  // Solo mostrar barras de sesiones si hay data en al menos un mes
  const hasSessions = data.some(
    (d) => (d.sesiones_curr ?? 0) > 0 || (d.sesiones_prev ?? 0) > 0
  );

  const formatTick = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
      : String(v);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={formatTick} />
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
        {hasSessions && (
          <>
            <Bar dataKey="sesiones_prev" fill="#cbd5e1" name={`Sesiones ${labels.prev}`} />
            <Bar dataKey="sesiones_curr" fill="#3b82f6" name={`Sesiones ${labels.curr}`} />
          </>
        )}
        <Bar dataKey="usuarios_prev" fill="#fca5a5" name={`Usuarios ${labels.prev}`} />
        <Bar dataKey="usuarios_curr" fill="#dc2626" name={`Usuarios ${labels.curr}`} />
      </BarChart>
    </ResponsiveContainer>
  );
}
