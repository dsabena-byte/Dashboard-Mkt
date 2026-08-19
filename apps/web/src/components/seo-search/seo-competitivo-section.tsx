"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SerpRow, SeoIndexHistRow } from "@/lib/competitive-queries";
import { brandLabel, categoryLabel, scrubText } from "@/lib/demo/anonymize";

// Retailers vs marcas (para colorear y agrupar el set competitivo).
const RETAILERS = new Set(["ML", "Frávega", "Naldo", "Rodo", "Cetrogar", "Megatone", "Casa del Audio", "Coto", "Oncity"]);
const ABSENT = 100; // keyword donde el dominio no rankea (como en el Excel)

const CATS: Array<{ key: string; label: string }> = [
  { key: "lavarropas", label: "Lavarropas" },
  { key: "heladeras", label: "Heladeras" },
  { key: "cocinas", label: "Cocinas" },
];
const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n)));
// Color de celda de la matriz por posición (verde top → rojo → gris ausente).
function cellClass(pos: number | undefined): string {
  if (pos == null) return "bg-slate-50 text-slate-300";
  if (pos <= 3) return "bg-emerald-500 text-white font-semibold";
  if (pos <= 10) return "bg-emerald-200 text-emerald-900";
  if (pos <= 20) return "bg-amber-200 text-amber-900";
  if (pos <= 50) return "bg-orange-200 text-orange-900";
  return "bg-rose-100 text-rose-700";
}
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 };

export function SeoCompetitivoSection({ rows, historia = [] }: { rows: SerpRow[]; historia?: SeoIndexHistRow[] }) {
  const [cat, setCat] = useState("lavarropas");
  const [set, setSet] = useState<"todos" | "marca" | "retailer">("todos");
  // Filtra basura (ej. "Total:" filas-resumen del Excel) y filas sin keyword real.
  const esValida = (kw: string) => !!kw && !/^total\b/i.test(kw.trim()) && kw.trim().length > 2;
  const catRows = useMemo(() => rows.filter((r) => r.categoria === cat && esValida(r.keyword)), [rows, cat]);

  // Universo de keywords de la categoría (con volumen).
  const universo = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of catRows) if (!m.has(r.keyword)) m.set(r.keyword, r.search_volume ?? 0);
    return m;
  }, [catRows]);

  // Índice conglomerado por dominio: posición promedio ponderada por volumen
  // sobre TODO el universo (no rankea = 100). Menor = mejor posicionado.
  const indice = useMemo(() => {
    const posByMarcaKw = new Map<string, number>();
    const marcas = new Set<string>();
    for (const r of catRows) {
      marcas.add(r.marca);
      if (r.posicion != null) posByMarcaKw.set(`${r.marca}|${r.keyword}`, r.posicion);
    }
    const totalVol = [...universo.values()].reduce((s, v) => s + v, 0) || 1;
    return [...marcas]
      .map((marca) => {
        let num = 0;
        for (const [kw, vol] of universo) num += vol * (posByMarcaKw.get(`${marca}|${kw}`) ?? ABSENT);
        return { marca, indice: num / totalVol, retailer: RETAILERS.has(marca) };
      })
      .sort((a, b) => a.indice - b.indice);
  }, [catRows, universo]);

  // Evolución mensual del índice de Drean (snapshot de seo_index_history).
  const historiaDrean = useMemo(() => {
    const byMes = new Map<string, number>();
    for (const h of historia) if (h.categoria === cat && h.marca === "Drean") byMes.set(h.mes, h.indice);
    return [...byMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, indice]) => ({ mes: mes.slice(0, 7), indice }));
  }, [historia, cat]);

  // Buckets Drean-céntricos.
  const buckets = useMemo(() => {
    const dreanPos = new Map<string, number | null>();
    const bestOther = new Map<string, { marca: string; pos: number } | null>();
    for (const r of catRows) {
      if (r.marca === "Drean") dreanPos.set(r.keyword, r.posicion);
      else if (r.posicion != null) {
        const cur = bestOther.get(r.keyword);
        if (!cur || r.posicion < cur.pos) bestOther.set(r.keyword, { marca: r.marca, pos: r.posicion });
      }
    }
    const faltantes: Array<{ keyword: string; vol: number; lider: string | null }> = [];
    const debiles: Array<{ keyword: string; vol: number; pos: number }> = [];
    const fuertes: Array<{ keyword: string; vol: number; pos: number }> = [];
    for (const [kw, vol] of universo) {
      const p = dreanPos.has(kw) ? dreanPos.get(kw)! : null;
      if (p == null) faltantes.push({ keyword: kw, vol, lider: bestOther.get(kw)?.marca ?? null });
      else if (p <= 3) fuertes.push({ keyword: kw, vol, pos: p });
      else if (p >= 8 && p <= 20) debiles.push({ keyword: kw, vol, pos: p });
    }
    const byVol = <T extends { vol: number }>(a: T, b: T) => b.vol - a.vol;
    return { faltantes: faltantes.sort(byVol).slice(0, 20), debiles: debiles.sort(byVol).slice(0, 20), fuertes: fuertes.sort(byVol).slice(0, 20) };
  }, [catRows, universo]);

  // Matriz keyword × dominio: posición de cada dominio en las top keywords.
  const matriz = useMemo(() => {
    const posMap = new Map<string, number>();
    const marcasSet = new Set<string>();
    for (const r of catRows) {
      marcasSet.add(r.marca);
      if (r.posicion != null) posMap.set(`${r.marca}|${r.keyword}`, r.posicion);
    }
    const kws = [...universo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([keyword, vol]) => ({ keyword, vol }));
    const rank = (m: string) => (m === "Drean" ? -1 : RETAILERS.has(m) ? 1 : 0);
    const doms = [...marcasSet]
      .filter((m) => set === "todos" || m === "Drean" || (set === "retailer" ? RETAILERS.has(m) : !RETAILERS.has(m)))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return { kws, doms, posMap };
  }, [catRows, universo, set]);

  const dreanIdx = indice.find((i) => i.marca === "Drean");
  const dreanRank = indice.findIndex((i) => i.marca === "Drean") + 1;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-xs text-muted-foreground">
        Sin data competitiva todavía. El sync SERP está poblando la posición de cada dominio.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">SEO Competitivo</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)} className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === c.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
              {categoryLabel(c.label)}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-primary/5 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Índice de posición · {brandLabel("Drean")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-primary">{dreanIdx ? dreanIdx.indice.toFixed(1) : "—"}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">pos. prom. ponderada · #{dreanRank} de {indice.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Keywords faltantes</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">{buckets.faltantes.length}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{brandLabel("Drean")} no rankea (top volumen)</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Keywords débiles</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">{buckets.debiles.length}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">pos. 8-20 · empujables</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Keywords fuertes</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{buckets.fuertes.length}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{brandLabel("Drean")} top-3 · defender</div>
        </div>
      </div>

      {/* Índice conglomerado — ranking */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Índice de posición conglomerado</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground"><strong>Qué mide:</strong> qué tan bien posicionado está cada dominio en Google para TODAS las keywords de la categoría, ponderando por volumen de búsqueda. <strong>Cómo se calcula:</strong> Σ(volumen × posición) ÷ Σ(volumen) sobre todo el universo de keywords; si el dominio no aparece en una keyword, cuenta como posición 100. <strong>Menor = mejor</strong> (ej. 5.5 = en promedio ponderado rankea ~5º). Azul = Drean, gris = marcas, violeta = retailers.</p>
          </div>
          <div className="flex gap-1">
            {([["todos", "Todos"], ["marca", "Marcas"], ["retailer", "Retail"]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setSet(k)} className={`rounded-full border px-2.5 py-1 text-[11px] ${set === k ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const idx = indice.filter((d) => set === "todos" || d.marca === "Drean" || (set === "retailer" ? d.retailer : !d.retailer));
          return (
        <ResponsiveContainer width="100%" height={Math.max(200, idx.length * 26)}>
          <BarChart data={idx} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
            <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="marca" width={96} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => v.toFixed(1)} contentStyle={tooltipStyle} />
            <Bar dataKey="indice" radius={[0, 4, 4, 0]}>
              {idx.map((d) => (
                <Cell key={d.marca} fill={d.marca === "Drean" ? "#2b4dff" : d.retailer ? "#a855f7" : "#94a3b8"} />
              ))}
              <LabelList dataKey="indice" position="right" fontSize={10} formatter={(v: number) => v.toFixed(1)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
          );
        })()}
      </div>

      {/* Evolución del índice de Drean */}
      {historiaDrean.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Evolución del índice de Drean — {CATS.find((c) => c.key === cat)?.label}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground"><strong>Qué mide:</strong> cómo se mueve mes a mes el índice de posición de Drean (menor = mejor; el eje está invertido, así lo mejor queda arriba). Se guarda un snapshot mensual; el histórico se acumula con el tiempo.</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historiaDrean} margin={{ left: 0, right: 16, top: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis reversed domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" width={32} />
              <Tooltip formatter={(v: number) => [v.toFixed(1), "Índice"]} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="indice" stroke="#2b4dff" strokeWidth={2.5} dot={{ r: 4, fill: "#2b4dff" }}>
                <LabelList dataKey="indice" position="top" fontSize={10} formatter={(v: number) => v.toFixed(1)} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
          {historiaDrean.length === 1 && <p className="mt-1 text-[10px] text-muted-foreground">Primer mes registrado — la línea se dibuja a medida que entran los próximos snapshots mensuales.</p>}
        </div>
      )}

      {/* Buckets accionables */}
      <div>
        <h3 className="text-sm font-semibold">Keywords según la posición de Drean</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Las keywords de la categoría clasificadas según <strong>en qué posición de Google rankea DREAN</strong> hoy — dónde falta contenido, dónde hay quick wins y qué hay que defender. <strong>VOL</strong> = volumen mensual de búsqueda. En Faltantes, <strong>Líder</strong> = quién ocupa el top hoy.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <BucketTable title="🔴 Faltantes" subtitle="Drean no rankea — contenido a crear" rows={buckets.faltantes.map((f) => ({ keyword: f.keyword, vol: f.vol, extra: f.lider ?? "—" }))} extraLabel="Líder" />
        <BucketTable title="🟡 Débiles" subtitle="Drean pos. 8-20 — quick wins" rows={buckets.debiles.map((f) => ({ keyword: f.keyword, vol: f.vol, extra: `#${f.pos}` }))} extraLabel="Pos." />
        <BucketTable title="🟢 Fuertes" subtitle="Drean top-3 — defender" rows={buckets.fuertes.map((f) => ({ keyword: f.keyword, vol: f.vol, extra: `#${f.pos}` }))} extraLabel="Pos." />
      </div>

      {/* Matriz de posición (Content GAP) */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Matriz de posición · keyword × dominio</h3>
        <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">
          Posición de cada dominio en las top keywords por volumen. <span className="rounded bg-emerald-500 px-1 text-white">1-3</span> <span className="rounded bg-emerald-200 px-1">4-10</span> <span className="rounded bg-amber-200 px-1">11-20</span> <span className="rounded bg-orange-200 px-1">21-50</span> <span className="rounded bg-rose-100 px-1 text-rose-700">50+</span> <span className="rounded bg-slate-50 px-1 text-slate-400">no rankea</span>. Respeta el filtro Todos/Marcas/Retail de arriba.
        </p>
        <div className="overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full border-separate border-spacing-0 text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-medium">Keyword</th>
                {matriz.doms.map((d) => (
                  <th key={d} className={`px-1 py-1 text-center font-medium ${d === "Drean" ? "text-primary" : RETAILERS.has(d) ? "text-purple-600" : ""}`}>
                    <div className="w-9 truncate" title={d}>{d}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matriz.kws.map(({ keyword }) => (
                <tr key={keyword}>
                  <td className="sticky left-0 z-10 max-w-[180px] truncate bg-card px-2 py-1" title={keyword}>{keyword}</td>
                  {matriz.doms.map((d) => {
                    const pos = matriz.posMap.get(`${d}|${keyword}`);
                    return (
                      <td key={d} className={`px-1 py-1 text-center tabular-nums ${cellClass(pos)}`}>{pos ?? ""}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BucketTable({ title, subtitle, rows, extraLabel }: { title: string; subtitle: string; rows: Array<{ keyword: string; vol: number; extra: string }>; extraLabel: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mb-2 text-[10px] text-muted-foreground">{subtitle}</p>
      <div className="max-h-[360px] overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-card text-[9px] uppercase text-muted-foreground">
            <tr><th className="py-1 text-left">Keyword</th><th className="py-1 text-right">Vol</th><th className="py-1 text-right">{extraLabel}</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t"><td className="py-1 pr-2">{r.keyword}</td><td className="py-1 text-right tabular-nums">{fmtNum(r.vol)}</td><td className="py-1 text-right">{r.extra}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">—</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
