"use client";

// Mini gráfico real vs meta de un KPI de mercado (va DENTRO de su MetaKpiCard).
// Sistema visual de IG: real en azul (#1e40af) con etiqueta numérica, meta en gris
// pizarra (#cbd5e1 / borde #64748b). Eje Y de ancho fijo (56px) → los meses quedan
// alineados entre las cards de la grilla.

import { Bar, CartesianGrid, ComposedChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";

export interface RealMetaDatum {
  mes: string;
  real: number | null;
  meta: number | null;
}

const fmt = (v: number, unidad: "%" | "pts") => (unidad === "%" ? `${v.toFixed(1)}%` : v.toFixed(1));

export function MercadoRealMetaChart({ data, unidad }: { data: RealMetaDatum[]; unidad: "%" | "pts" }) {
  const hasMeta = data.some((d) => d.meta != null);
  return (
    <ResponsiveContainer width="100%" height={150}>
      <ComposedChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
        <YAxis width={56} stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v: number) => fmt(v, unidad)} />
        <Tooltip content={<ChartTooltip format={(v) => fmt(v, unidad)} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
        {hasMeta && <Bar dataKey="meta" name="Meta" fill="#cbd5e1" stroke="#64748b" strokeWidth={1} radius={[3, 3, 0, 0]} />}
        <Bar dataKey="real" name="Real" fill="#1e40af" radius={[3, 3, 0, 0]}>
          <LabelList dataKey="real" position="top" fontSize={9} fill="#1e293b" formatter={(v: number | null) => (v == null ? "" : fmt(v, unidad))} />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
