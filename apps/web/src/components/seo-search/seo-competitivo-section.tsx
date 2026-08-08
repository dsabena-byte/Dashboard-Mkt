"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SerpRow } from "@/lib/competitive-queries";

// Retailers vs marcas (para colorear y agrupar el set competitivo).
const RETAILERS = new Set(["ML", "Frávega", "Naldo", "Rodo", "Cetrogar", "Megatone", "Casa del Audio", "Coto", "Oncity"]);
const ABSENT = 100; // keyword donde el dominio no rankea (como en el Excel)

const CATS: Array<{ key: string; label: string }> = [
  { key: "lavarropas", label: "Lavarropas" },
  { key: "heladeras", label: "Heladeras" },
  { key: "cocinas", label: "Cocinas" },
  { key: "lavavajillas", label: "Lavavajillas" },
];
const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n)));
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 };

export function SeoCompetitivoSection({ rows }: { rows: SerpRow[] }) {
  const [cat, setCat] = useState("lavarropas");
  const catRows = useMemo(() => rows.filter((r) => r.categoria === cat), [rows, cat]);

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
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-primary/5 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Índice de posición · Drean</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-primary">{dreanIdx ? dreanIdx.indice.toFixed(1) : "—"}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">pos. prom. ponderada · #{dreanRank} de {indice.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Keywords faltantes</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">{buckets.faltantes.length}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Drean no rankea (top volumen)</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Keywords débiles</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">{buckets.debiles.length}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">pos. 8-20 · empujables</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Keywords fuertes</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{buckets.fuertes.length}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Drean top-3 · defender</div>
        </div>
      </div>

      {/* Índice conglomerado — ranking */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Índice de posición conglomerado</h3>
        <p className="mb-3 mt-0.5 text-[11px] text-muted-foreground">Posición promedio ponderada por volumen (no rankea = 100). <strong>Menor = mejor posicionado.</strong> Azul = Drean, gris = marcas, violeta = retailers.</p>
        <ResponsiveContainer width="100%" height={Math.max(260, indice.length * 26)}>
          <BarChart data={indice} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
            <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="marca" width={96} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => v.toFixed(1)} contentStyle={tooltipStyle} />
            <Bar dataKey="indice" radius={[0, 4, 4, 0]}>
              {indice.map((d) => (
                <Cell key={d.marca} fill={d.marca === "Drean" ? "#2b4dff" : d.retailer ? "#a855f7" : "#94a3b8"} />
              ))}
              <LabelList dataKey="indice" position="right" fontSize={10} formatter={(v: number) => v.toFixed(1)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Buckets accionables */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BucketTable title="🔴 Faltantes" subtitle="Drean no rankea — contenido a crear" rows={buckets.faltantes.map((f) => ({ keyword: f.keyword, vol: f.vol, extra: f.lider ?? "—" }))} extraLabel="Líder" />
        <BucketTable title="🟡 Débiles" subtitle="Pos. 8-20 — quick wins" rows={buckets.debiles.map((f) => ({ keyword: f.keyword, vol: f.vol, extra: `#${f.pos}` }))} extraLabel="Pos." />
        <BucketTable title="🟢 Fuertes" subtitle="Top-3 — defender" rows={buckets.fuertes.map((f) => ({ keyword: f.keyword, vol: f.vol, extra: `#${f.pos}` }))} extraLabel="Pos." />
      </div>
    </div>
  );
}

function BucketTable({ title, subtitle, rows, extraLabel }: { title: string; subtitle: string; rows: Array<{ keyword: string; vol: number; extra: string }>; extraLabel: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mb-2 text-[10px] text-muted-foreground">{subtitle}</p>
      <div className="max-h-[320px] overflow-auto">
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
