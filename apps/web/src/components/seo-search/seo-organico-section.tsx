"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeoOverviewRow, KeywordGapRow } from "@/lib/competitive-queries";

const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n)));
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 };
const CATS = ["Todas", "lavarropas", "heladeras", "cocinas"];

export function SeoOrganicoSection({ overview, gap }: { overview: SeoOverviewRow[]; gap: KeywordGapRow[] }) {
  const [cat, setCat] = useState("Todas");

  const barData = useMemo(
    () => overview.filter((o) => (o.etv ?? 0) > 0).map((o) => ({ marca: o.marca ?? o.dominio, etv: o.etv ?? 0, kw: o.keywords_count ?? 0, top: o.pos_1_3 ?? 0 })),
    [overview],
  );
  const gapFiltrado = useMemo(
    () => gap.filter((g) => cat === "Todas" || g.categoria === cat).slice(0, 40),
    [gap, cat],
  );

  if (overview.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-xs text-muted-foreground">
        Sin data de SEO todavía. Corré el sync <code>seo-sync</code> (necesita saldo en DataForSEO).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">SEO orgánico</h2>
        <p className="text-sm text-muted-foreground">Visibilidad en búsqueda orgánica (Google Argentina) y oportunidades de keywords.</p>
      </div>

      {/* Visibilidad orgánica (ETV) */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Visibilidad orgánica — tráfico estimado (ETV)</h3>
        <p className="mb-3 mt-0.5 text-[11px] text-muted-foreground">Tráfico orgánico mensual estimado por dominio. El tamaño de la barra = qué tan visible es cada marca en Google.</p>
        <ResponsiveContainer width="100%" height={Math.max(240, barData.length * 32)}>
          <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <XAxis type="number" tickFormatter={fmtNum} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="marca" width={80} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number, n: string) => [n === "etv" ? fmtNum(v) : v, n === "etv" ? "ETV" : n]} contentStyle={tooltipStyle} />
            <Bar dataKey="etv" radius={[0, 4, 4, 0]}>
              {barData.map((d) => (
                <Cell key={d.marca} fill={d.marca === "Drean" ? "#2b4dff" : "#94a3b8"} fillOpacity={d.marca === "Drean" ? 1 : 0.7} />
              ))}
              <LabelList dataKey="etv" position="right" fontSize={10} formatter={fmtNum} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Keyword gap */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Keyword gap — oportunidades</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Keywords donde un competidor rankea y <strong>Drean no</strong>. Ordenadas por volumen: contenido a crear.</p>
          </div>
          <div className="flex gap-1">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-2.5 py-1 text-[11px] ${cat === c ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Keyword</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Competidor</th>
                <th className="px-3 py-2 text-right">Volumen/mes</th>
              </tr>
            </thead>
            <tbody>
              {gapFiltrado.map((g, i) => (
                <tr key={`${g.keyword}-${g.competidor}-${i}`} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{g.keyword}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.categoria ?? "—"}</td>
                  <td className="px-3 py-2">{g.competidor}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.search_volume != null ? fmtNum(g.search_volume) : "—"}</td>
                </tr>
              ))}
              {gapFiltrado.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Sin gaps para esta categoría.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
