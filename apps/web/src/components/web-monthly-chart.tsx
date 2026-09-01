"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import { ChartTooltip } from "@/components/chart-tooltip";

interface MonthlyDatum {
  mes: string;
  usuarios_curr: number | null;
  usuarios_prev: number | null;
  sesiones_curr?: number | null;
  sesiones_prev?: number | null;
  usuarios_meta?: number | null;
  sesiones_meta?: number | null;
}

interface WebMonthlyChartProps {
  data: MonthlyDatum[];
  labels?: { curr: string; prev: string };
}

export function WebMonthlyChart({
  data,
  labels = { curr: "2026", prev: "2025" },
}: WebMonthlyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sin datos.
      </div>
    );
  }

  // Barras = usuarios, línea = sesiones. Las series del año anterior solo se
  // muestran si hay datos cargados.
  const hasUsersPrev = data.some((d) => (d.usuarios_prev ?? 0) > 0);
  const hasSessionsPrev = data.some((d) => (d.sesiones_prev ?? 0) > 0);
  const hasUsersMeta = data.some((d) => d.usuarios_meta != null);
  const hasSessionsMeta = data.some((d) => d.sesiones_meta != null);

  const formatTick = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
        ? `${(v / 1_000).toFixed(0)}k`
        : String(v);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis yAxisId="left" stroke="#1e40af" fontSize={11} tickFormatter={formatTick} />
        <YAxis yAxisId="right" orientation="right" stroke="#0f172a" fontSize={11} tickFormatter={formatTick} />
        <Tooltip content={<ChartTooltip format={(v) => formatNumber(v)} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
        {/* Barras = usuarios: meta (gris pizarra) + real (azul, con etiqueta) */}
        {hasUsersPrev && (
          <Bar yAxisId="left" dataKey="usuarios_prev" fill="#e2e8f0" name={`Usuarios ${labels.prev}`} />
        )}
        {hasUsersMeta && (
          <Bar yAxisId="left" dataKey="usuarios_meta" fill="#cbd5e1" stroke="#64748b" strokeWidth={1.25} name="Meta usuarios" radius={[3, 3, 0, 0]} />
        )}
        <Bar yAxisId="left" dataKey="usuarios_curr" fill="#1e40af" name={`Usuarios ${labels.curr}`} radius={[3, 3, 0, 0]}>
          <LabelList dataKey="usuarios_curr" position="top" fontSize={9} fill="#1e293b" formatter={(v: number) => (v ? formatTick(v) : "")} />
        </Bar>
        {/* Línea = sesiones: meta (gris punteada) + real (tinta, con etiqueta) */}
        {hasSessionsPrev && (
          <Line yAxisId="right" type="monotone" dataKey="sesiones_prev" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name={`Sesiones ${labels.prev}`} />
        )}
        {hasSessionsMeta && (
          <Line yAxisId="right" type="monotone" dataKey="sesiones_meta" stroke="#64748b" strokeWidth={1.75} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#64748b" }} connectNulls name="Meta sesiones" />
        )}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="sesiones_curr"
          stroke="#0f172a"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#0f172a", stroke: "#fff", strokeWidth: 1 }}
          activeDot={{ r: 6 }}
          name={`Sesiones ${labels.curr}`}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
