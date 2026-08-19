"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeoOverviewRow, KeywordGapRow, RankingRow } from "@/lib/competitive-queries";
import { brandLabel, categoryLabel } from "@/lib/demo/anonymize";

const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n)));
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 };
const CATS = ["Todas", "lavarropas", "heladeras", "cocinas"];

// Badge de posición de Drean: verde ≤3, ámbar ≤10, gris resto, rojo si no rankea.
function PosBadge({ pos }: { pos: number | null }) {
  if (pos == null) return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">no rankea</span>;
  const c = pos <= 3 ? "bg-emerald-100 text-emerald-700" : pos <= 10 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c}`}>#{pos}</span>;
}

export function SeoOrganicoSection({ overview, gap, rankings }: { overview: SeoOverviewRow[]; gap: KeywordGapRow[]; rankings: RankingRow[] }) {
  const [cat, setCat] = useState("Todas");

  const barData = useMemo(
    () => overview.filter((o) => (o.etv ?? 0) > 0).map((o) => ({ marca: o.marca ?? o.dominio, etv: o.etv ?? 0, kw: o.keywords_count ?? 0, top: o.pos_1_3 ?? 0 })),
    [overview],
  );

  // Universo de keywords relevantes: las que Drean rankea (con su posición) + las
  // del gap (donde Drean no rankea, con el competidor líder). Ordenado por volumen
  // → "en las búsquedas más grandes, ¿dónde está parada Drean?".
  const topKeywords = useMemo(() => {
    const by = new Map<string, { keyword: string; categoria: string | null; volumen: number; dreanPos: number | null; lider: string | null }>();
    for (const r of rankings) by.set(r.keyword, { keyword: r.keyword, categoria: r.categoria, volumen: r.search_volume ?? 0, dreanPos: r.posicion, lider: null });
    for (const g of gap) {
      const ex = by.get(g.keyword);
      if (ex) { if (!ex.lider) ex.lider = g.competidor; }
      else by.set(g.keyword, { keyword: g.keyword, categoria: g.categoria, volumen: g.search_volume ?? 0, dreanPos: null, lider: g.competidor });
    }
    return [...by.values()]
      .filter((k) => cat === "Todas" || k.categoria === cat)
      .sort((a, b) => b.volumen - a.volumen)
      .slice(0, 50);
  }, [rankings, gap, cat]);

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
            <YAxis type="category" dataKey="marca" width={80} fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: string) => brandLabel(v)} />
            <Tooltip formatter={(v: number, n: string) => [n === "etv" ? fmtNum(v) : v, n === "etv" ? "ETV" : n]} labelFormatter={(l: string) => brandLabel(l)} contentStyle={tooltipStyle} />
            <Bar dataKey="etv" radius={[0, 4, 4, 0]}>
              {barData.map((d) => (
                <Cell key={d.marca} fill={d.marca === "Drean" ? "#2b4dff" : "#94a3b8"} fillOpacity={d.marca === "Drean" ? 1 : 0.7} />
              ))}
              <LabelList dataKey="etv" position="right" fontSize={10} formatter={fmtNum} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Posición de Drean en las keywords top */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Posición de {brandLabel("Drean")} en las keywords top</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Para las búsquedas de mayor volumen: <strong>en qué posición rankea {brandLabel("Drean")}</strong> (o si no rankea, qué competidor la lleva). Verde = top 3, ámbar = top 10.
            </p>
          </div>
          <div className="flex gap-1">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-2.5 py-1 text-[11px] ${cat === c ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                {categoryLabel(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[460px] overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Keyword</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Volumen/mes</th>
                <th className="px-3 py-2 text-center">{brandLabel("Drean")}</th>
                <th className="px-3 py-2">Si no rankea, líder</th>
              </tr>
            </thead>
            <tbody>
              {topKeywords.map((k, i) => (
                <tr key={`${k.keyword}-${i}`} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{k.keyword}</td>
                  <td className="px-3 py-2 text-muted-foreground">{k.categoria ? categoryLabel(k.categoria) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.volumen ? fmtNum(k.volumen) : "—"}</td>
                  <td className="px-3 py-2 text-center"><PosBadge pos={k.dreanPos} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{k.dreanPos == null ? (k.lider ? brandLabel(k.lider) : "—") : ""}</td>
                </tr>
              ))}
              {topKeywords.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sin data para esta categoría.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
