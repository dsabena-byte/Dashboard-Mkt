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
import { formatNumber } from "@/lib/utils";

interface MonthlyDatum {
  mes: string;
  sesiones: number;
  usuarios: number;
  conversiones: number;
  sesiones_anterior?: number;
  usuarios_anterior?: number;
}

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fmtMonth(fecha: string): string {
  const [y, m] = fecha.split("-");
  const idx = parseInt(m ?? "1", 10) - 1;
  return `${MONTH_LABELS[idx] ?? m} ${y?.slice(2) ?? ""}`;
}

export function WebMonthlyChart({ data }: { data: MonthlyDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sin datos.
      </div>
    );
  }

  // ¿Hay algún mes con data del año anterior? Sino, ocultamos esa barra.
  const hasPriorYear = data.some((d) => (d.sesiones_anterior ?? 0) > 0);

  const formatted = data.map((d) => ({ ...d, mesLabel: fmtMonth(d.mes) }));
  const formatTick = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
      : String(v);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={formatted} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mesLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
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
        <Bar dataKey="sesiones" fill="#3b82f6" name="Sesiones" />
        {hasPriorYear && (
          <Bar dataKey="sesiones_anterior" fill="#cbd5e1" name="Sesiones (año anterior)" />
        )}
        <Line
          type="monotone"
          dataKey="usuarios"
          stroke="#f43f5e"
          strokeWidth={2.5}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          name="Usuarios"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
