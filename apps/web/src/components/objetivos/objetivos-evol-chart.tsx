"use client";

// Evolución mensual del cumplimiento: Salud de Marca (línea gruesa) + cada objetivo.
// El cumplimiento por mes de un objetivo = ponderado del cumplimiento de sus KPIs
// ese mes; Salud de Marca = ponderado de los objetivos.

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";
import type { SeguimientoObjetivos } from "@/lib/objetivos-rollup";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const SM_NAME = "Salud de Marca";

export function ObjetivosEvolChart({ data }: { data: SeguimientoObjetivos }) {
  if (!data.disponible) return null;
  const rows = MES.map((mes, i) => {
    const row: Record<string, number | string | null> = { mes };
    row[SM_NAME] = data.saludMarca.cumplSerie[i] ?? null;
    for (const o of data.objetivos) row[o.nombre] = o.cumplSerie[i] ?? null;
    return row;
  });
  const hasData = rows.some((r) => data.objetivos.some((o) => typeof r[o.nombre] === "number") || typeof r[SM_NAME] === "number");
  if (!hasData) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Evolución del cumplimiento · objetivos (% del target de KPIs)</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<ChartTooltip format={(v) => `${v.toFixed(0)}%`} />} cursor={{ stroke: "hsl(var(--border))" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
          {data.objetivos.map((o) => (
            <Line key={o.nombre} type="monotone" dataKey={o.nombre} stroke={o.color} strokeWidth={1.75} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
          ))}
          <Line type="monotone" dataKey={SM_NAME} stroke="#0f172a" strokeWidth={3} dot={{ r: 3, fill: "#0f172a", stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
