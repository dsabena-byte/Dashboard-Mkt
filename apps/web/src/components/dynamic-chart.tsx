"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/chat/types";

// Renderer GENÉRICO: dibuja cualquier ChartSpec (bar/line/composed) que devuelva
// el copiloto. Reutilizable en todos los dashboards, sin cambios.
const COLORS = ["#2b4dff", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

export function DynamicChart({ spec }: { spec: ChartSpec }) {
  if (!spec?.data?.length || !spec.series?.length) {
    return <div className="rounded-lg border bg-card p-3 text-[11px] text-muted-foreground">Sin datos para graficar.</div>;
  }
  const usesRight = spec.series.some((s) => s.axis === "right");
  return (
    <div className="rounded-lg border bg-card p-3">
      {spec.title && <div className="mb-2 text-xs font-semibold">{spec.title}</div>}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={spec.data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={spec.xKey} fontSize={10} stroke="hsl(var(--muted-foreground))" />
          <YAxis yAxisId="left" fontSize={10} stroke="hsl(var(--muted-foreground))" />
          {usesRight && (
            <YAxis yAxisId="right" orientation="right" fontSize={10} stroke="hsl(var(--muted-foreground))" />
          )}
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid hsl(var(--border))" }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {spec.series.map((s, i) => {
            const color = s.color ?? COLORS[i % COLORS.length];
            const yAxisId = s.axis === "right" ? "right" : "left";
            return s.type === "line" ? (
              <Line
                key={s.key}
                yAxisId={yAxisId}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            ) : (
              <Bar key={s.key} yAxisId={yAxisId} dataKey={s.key} name={s.label} fill={color} />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
