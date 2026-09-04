"use client";

// Comparador libre de presupuestos (Inversión de Marketing): elegí dos versiones
// (A vs B), período, moneda y cuentas → KPIs, evolución mensual, acumulado,
// distribución por clasificación/cuenta y detalle por concepto (árbol colapsable).
// Sistema visual de la app: cards sobrios + Recharts (A azul #1e40af, B gris pizarra).

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";
import type { BgtRow } from "@/lib/bgt-queries";
import type { FacturacionRow } from "@/lib/facturacion-queries";
import {
  CUENTA_NUM, CLASIF_ORDER, clasifDe, MESES_CAP, MESES_UP, mesesDePeriodo,
  type Clasif, type Moneda, type Periodo,
} from "@/lib/bgt-dashboard";

const COLOR_A = "#1e40af"; // REAL / A — azul (protagonista)
const COLOR_B = "#94a3b8"; // comparación / B — gris pizarra
const POS = "#16a34a";
const NEG = "#dc2626";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "anual", label: "Año completo" },
  { key: "c1", label: "Cuatrimestre 1 (Ene–Abr)" },
  { key: "c2", label: "Cuatrimestre 2 (May–Ago)" },
  { key: "c3", label: "Cuatrimestre 3 (Sep–Dic)" },
];

function fmtShort(v: number): string {
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(0)}k`;
  return `${sign}${a.toFixed(0)}`;
}

export function InversionComparador({ rows, facturacion, year }: { rows: BgtRow[]; facturacion: FacturacionRow[]; year: number }) {
  const versiones = useMemo(() => [...new Set(rows.map((r) => r.presupuesto))].sort(), [rows]);
  const cuentasAll = useMemo(() => [...new Set(rows.map((r) => r.cuenta))].sort(), [rows]);

  const pick = (pref: string, fallbackIdx: number) => (versiones.includes(pref) ? pref : versiones[fallbackIdx] ?? versiones[0] ?? "");
  const [pptoA, setPptoA] = useState(() => pick(`REAL ${year}`, 0));
  const [pptoB, setPptoB] = useState(() => pick(`4+8 ${year}`, Math.min(1, versiones.length - 1)));
  const [periodo, setPeriodo] = useState<Periodo>("anual");
  const [moneda, setMoneda] = useState<Moneda>("ars");
  const [cuentasSel, setCuentasSel] = useState<Set<string>>(new Set());
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());
  const [cuentasAbiertas, setCuentasAbiertas] = useState<Set<string>>(new Set());

  const pre = moneda === "ars" ? "$ " : "US$ ";
  const fmt = (v: number) => `${v < 0 ? "-" : ""}${pre}${new Intl.NumberFormat("es-AR").format(Math.abs(Math.round(v)))}`;
  const fmtMon = (v: number) => `${pre}${fmtShort(v)}`;

  const mesesUp = mesesDePeriodo(periodo);
  const valField: keyof BgtRow = moneda;

  const filtered = useMemo(() => {
    const todas = cuentasSel.size === 0;
    const set = new Set(mesesUp);
    const byPpto = (p: string) => rows.filter((r) => r.presupuesto === p && set.has(r.mes) && (todas || cuentasSel.has(r.cuenta)));
    return { A: byPpto(pptoA), B: byPpto(pptoB) };
  }, [rows, pptoA, pptoB, mesesUp, cuentasSel]);

  const sum = (arr: BgtRow[]) => arr.reduce((s, r) => s + (r[valField] as number), 0);
  const totA = sum(filtered.A), totB = sum(filtered.B);
  const diff = totA - totB;
  const varPct = totB !== 0 ? ((totA - totB) / Math.abs(totB)) * 100 : 0;

  // Facturación del período (USD) — null si falta algún mes (misma regla que el server).
  const factPeriodo = useMemo(() => {
    if (moneda !== "usd") return null;
    const map = new Map(facturacion.map((f) => [f.mes, f.facturacion]));
    const ym = mesesUp.map((m) => `${year}-${String(MESES_UP.indexOf(m) + 1).padStart(2, "0")}-01`);
    let s = 0;
    for (const k of ym) { const v = map.get(k); if (v == null) return null; s += v; }
    return s;
  }, [facturacion, mesesUp, moneda, year]);

  // Serie mensual (para barras y acumulado).
  const serie = useMemo(() => {
    return mesesUp.map((m, i) => {
      const a = Math.round(sum(filtered.A.filter((r) => r.mes === m)));
      const b = Math.round(sum(filtered.B.filter((r) => r.mes === m)));
      const dPct = b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
      return { mes: MESES_CAP[MESES_UP.indexOf(m)] ?? m, a, b, dPct, i };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, mesesUp, valField]);

  const serieAcum = useMemo(() => {
    let ca = 0, cb = 0;
    return serie.map((p) => { ca += p.a; cb += p.b; return { mes: p.mes, a: ca, b: cb }; });
  }, [serie]);

  // Distribución (del ppto A): por clasificación y por cuenta.
  const distClasif = useMemo(() => {
    const acc = new Map<Clasif, number>();
    for (const r of filtered.A) acc.set(clasifDe(r.cuenta), (acc.get(clasifDe(r.cuenta)) ?? 0) + (r[valField] as number));
    return CLASIF_ORDER.map((cl) => ({ label: cl, v: Math.abs(Math.round(acc.get(cl) ?? 0)) })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, valField]);

  const distCuenta = useMemo(() => {
    const acc = new Map<string, number>();
    for (const r of filtered.A) acc.set(r.cuenta, (acc.get(r.cuenta) ?? 0) + (r[valField] as number));
    return [...acc.entries()].map(([label, v]) => ({ label, v: Math.abs(Math.round(v)) })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, valField]);

  // Árbol: clasificación → cuenta → concepto.
  const arbol = useMemo(() => {
    const keys = [...new Set([...filtered.A, ...filtered.B].map((r) => `${r.cuenta}||${r.concepto}`))];
    type Item = { num: string; ct: string; conc: string; vA: number; vB: number };
    const items: Item[] = keys.map((k) => {
      const [ct, conc] = k.split("||") as [string, string];
      const vA = Math.round(sum(filtered.A.filter((r) => r.cuenta === ct && r.concepto === conc)));
      const vB = Math.round(sum(filtered.B.filter((r) => r.cuenta === ct && r.concepto === conc)));
      return { num: CUENTA_NUM[ct] ?? "", ct, conc, vA, vB };
    });
    const grupos = new Map<Clasif, Item[]>();
    for (const it of items) { const cl = clasifDe(it.ct); (grupos.get(cl) ?? grupos.set(cl, []).get(cl)!).push(it); }
    return grupos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, valField]);

  const toggleCuenta = (c: string) => setCuentasSel((prev) => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleColapsada = (cl: string) => setColapsadas((prev) => { const n = new Set(prev); n.has(cl) ? n.delete(cl) : n.add(cl); return n; });
  const toggleCuentaAbierta = (k: string) => setCuentasAbiertas((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const clearFilters = () => { setPeriodo("anual"); setCuentasSel(new Set()); setPptoA(pick(`REAL ${year}`, 0)); setPptoB(pick(`4+8 ${year}`, Math.min(1, versiones.length - 1))); };

  const selectCls = "rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
  const cuentaBtnTxt = cuentasSel.size === 0 ? "Todas" : cuentasSel.size === 1 ? [...cuentasSel][0]! : `${cuentasSel.size} cuentas`;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold tracking-tight">Comparador de presupuestos</h3>
        <p className="text-[11px] text-muted-foreground">Elegí dos versiones y compará por período, cuenta y moneda.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Presupuesto A</span>
          <select className={selectCls} value={pptoA} onChange={(e) => setPptoA(e.target.value)}>
            {versiones.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Presupuesto B</span>
          <select className={selectCls} value={pptoB} onChange={(e) => setPptoB(e.target.value)}>
            {versiones.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
          <select className={selectCls} value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            {PERIODOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <div className="relative flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cuenta</span>
          <button type="button" onClick={() => setCuentaOpen((o) => !o)} className={`${selectCls} min-w-[150px] text-left`}>
            {cuentaBtnTxt}
          </button>
          {cuentaOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setCuentaOpen(false)} />
              <div className="absolute top-full z-20 mt-1 max-h-72 w-64 overflow-auto rounded-lg border bg-card p-1.5 shadow-md">
                <button type="button" onClick={() => setCuentasSel(new Set())} className={`mb-1 w-full rounded-md px-2 py-1 text-left text-xs font-semibold ${cuentasSel.size === 0 ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>Todas</button>
                {cuentasAll.map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted">
                    <input type="checkbox" checked={cuentasSel.has(c)} onChange={() => toggleCuenta(c)} className="h-3.5 w-3.5" />
                    <span className="truncate">{c}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Moneda</span>
          <div className="flex rounded-lg border p-0.5">
            {(["ars", "usd"] as Moneda[]).map((m) => (
              <button key={m} type="button" onClick={() => setMoneda(m)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${moneda === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m === "ars" ? "$ ARS" : "USD"}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={clearFilters} className="ml-auto rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">Limpiar</button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={pptoA} value={fmt(totA)} valueColor={COLOR_A} sub={`${filtered.A.length} registros`} />
        <KpiCard label={pptoB} value={fmt(totB)} valueColor={COLOR_B} sub={`${filtered.B.length} registros`} />
        <KpiCard label={`Diferencia (${pptoA} − ${pptoB})`} value={fmt(diff)} valueColor={diff >= 0 ? POS : NEG} sub={`${pptoA} ${diff >= 0 ? "supera a" : "queda debajo de"} ${pptoB}`} />
        <KpiCard label="Variación %" value={`${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`} valueColor={varPct >= 0 ? POS : NEG} sub={`${pptoA} vs ${pptoB}`} />
      </div>

      {/* Gráficos: evolución + acumulado */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Evolución mensual</h4>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={serie} margin={{ top: 22, right: 12, left: 8, bottom: 8 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis width={56} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={fmtShort} />
              <Tooltip content={<ChartTooltip format={(v) => fmt(v)} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
              <Bar dataKey="a" name={pptoA} fill={COLOR_A} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="dPct"
                  content={(props) => {
                    const { x, y, width, value } = props as { x: number; y: number; width: number; value: number | null };
                    if (value == null || Math.abs(value) < 0.5) return null;
                    return <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={value >= 0 ? POS : NEG}>{(value >= 0 ? "+" : "") + value.toFixed(0) + "%"}</text>;
                  }} />
              </Bar>
              <Bar dataKey="b" name={pptoB} fill={COLOR_B} radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Acumulado del período</h4>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={serieAcum} margin={{ top: 22, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis width={56} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={fmtShort} />
              <Tooltip content={<ChartTooltip format={(v) => fmt(v)} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
              <Line type="monotone" dataKey="a" name={pptoA} stroke={COLOR_A} strokeWidth={2.5} dot={{ r: 3, fill: COLOR_A }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="b" name={pptoB} stroke={COLOR_B} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: COLOR_B }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribución por clasificación + por cuenta */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DistCard title={`Distribución por clasificación — ${pptoA}`} items={distClasif} fmtMon={fmtMon} />
        <DistCard title={`Distribución por cuenta — ${pptoA}`} items={distCuenta} fmtMon={fmtMon} />
      </div>

      {/* Detalle por concepto (árbol) */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <h4 className="px-4 pt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Detalle por concepto</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-y text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">N° / Clasificación / Concepto</th>
                <th className="px-3 py-2 text-right font-semibold">{pptoA}</th>
                <th className="px-3 py-2 text-right font-semibold">{pptoB}</th>
                <th className="px-3 py-2 text-right font-semibold">Diferencia</th>
                <th className="px-3 py-2 text-right font-semibold">% Var</th>
                <th className="px-3 py-2 text-right font-semibold">% Inv</th>
                {factPeriodo != null && <th className="px-3 py-2 text-right font-semibold">Inv / Fact</th>}
              </tr>
            </thead>
            <tbody>
              {CLASIF_ORDER.map((clasif) => {
                const items = arbol.get(clasif) ?? [];
                if (items.length === 0) return null;
                // Agrupar por cuenta.
                const accMap = new Map<string, { num: string; ct: string; conceptos: typeof items; vA: number; vB: number }>();
                for (const it of items) {
                  const key = it.num || it.ct;
                  const e = accMap.get(key) ?? { num: it.num, ct: it.ct, conceptos: [] as typeof items, vA: 0, vB: 0 };
                  e.conceptos.push(it); e.vA += it.vA; e.vB += it.vB; accMap.set(key, e);
                }
                const cuentas = [...accMap.values()].sort((a, b) => b.vA - a.vA);
                const gA = items.reduce((s, it) => s + it.vA, 0), gB = items.reduce((s, it) => s + it.vB, 0);
                const abierta = !colapsadas.has(clasif);
                return (
                  <FragmentRows key={clasif}
                    clasif={clasif} gA={gA} gB={gB} abierta={abierta} nCuentas={cuentas.length}
                    onToggle={() => toggleColapsada(clasif)}
                    totA={totA} factPeriodo={factPeriodo} fmt={fmt} cuentas={cuentas}
                    cuentasAbiertas={cuentasAbiertas} onToggleCuenta={toggleCuentaAbierta} />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-foreground text-background">
                <td className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide">Total</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt(totA)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt(totB)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: diff >= 0 ? "#34d399" : "#f87171" }}>{fmt(diff)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: varPct >= 0 ? "#34d399" : "#f87171" }}>{totB === 0 ? "—" : `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">100%</td>
                {factPeriodo != null && <td className="px-3 py-2.5 text-right font-bold tabular-nums">{factPeriodo ? `${((totA / factPeriodo) * 100).toFixed(2)}%` : "—"}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

function KpiCard({ label, value, valueColor, sub }: { label: string; value: string; valueColor: string; sub: string }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" title={label}>{label}</span>
      <span className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight" style={{ color: valueColor }}>{value}</span>
      <span className="mt-1 text-[11px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function DistCard({ title, items, fmtMon }: { title: string; items: { label: string; v: number }[]; fmtMon: (v: number) => string }) {
  const total = items.reduce((s, d) => s + d.v, 0);
  const max = items.reduce((m, d) => Math.max(m, d.v), 0) || 1;
  return (
    <div className="rounded-xl border bg-card p-4">
      <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {items.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((d) => {
            const pct = total > 0 ? (d.v / total) * 100 : 0;
            return (
              <div key={d.label}>
                <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground" title={d.label}>{d.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fmtMon(d.v)} <span className="font-semibold text-foreground">{pct.toFixed(1)}%</span></span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(d.v / max) * 100}%`, background: COLOR_A }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Filas de una clasificación (grupo → cuentas → conceptos).
type Item = { num: string; ct: string; conc: string; vA: number; vB: number };
function FragmentRows({
  clasif, gA, gB, abierta, nCuentas, onToggle, totA, factPeriodo, fmt, cuentas, cuentasAbiertas, onToggleCuenta,
}: {
  clasif: Clasif; gA: number; gB: number; abierta: boolean; nCuentas: number; onToggle: () => void;
  totA: number; factPeriodo: number | null; fmt: (v: number) => string;
  cuentas: { num: string; ct: string; conceptos: Item[]; vA: number; vB: number }[];
  cuentasAbiertas: Set<string>; onToggleCuenta: (k: string) => void;
}) {
  const cells = (vA: number, vB: number) => {
    const d = vA - vB, p = vB !== 0 ? ((vA - vB) / Math.abs(vB)) * 100 : 0;
    return (
      <>
        <td className="px-3 py-1.5 text-right tabular-nums">{fmt(vA)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{fmt(vB)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: d >= 0 ? POS : NEG }}>{fmt(d)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: p >= 0 ? POS : NEG }}>{vB === 0 ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`}</td>
        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{totA > 0 ? ((vA / totA) * 100).toFixed(1) : "0"}%</td>
        {factPeriodo != null && <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{factPeriodo ? ((vA / factPeriodo) * 100).toFixed(2) + "%" : "—"}</td>}
      </>
    );
  };
  return (
    <>
      <tr className="cursor-pointer bg-foreground/[0.04] font-semibold hover:bg-foreground/[0.07]" onClick={onToggle}>
        <td className="px-3 py-2">
          <span className="inline-block w-3.5 text-muted-foreground transition-transform" style={{ transform: abierta ? "rotate(90deg)" : "none" }}>▸</span>{" "}
          {clasif} <span className="font-normal text-muted-foreground">({nCuentas})</span>
        </td>
        {cells(gA, gB)}
      </tr>
      {abierta && cuentas.map((acc) => {
        const accKey = `${clasif}||${acc.num || acc.ct}`;
        const single = acc.conceptos.length <= 1;
        const accOpen = cuentasAbiertas.has(accKey);
        return (
          <FragmentAcc key={accKey} acc={acc} accKey={accKey} single={single} accOpen={accOpen} onToggle={() => onToggleCuenta(accKey)} cells={cells} />
        );
      })}
    </>
  );
}

function FragmentAcc({ acc, single, accOpen, onToggle, cells }: {
  acc: { num: string; ct: string; conceptos: Item[]; vA: number; vB: number }; accKey: string; single: boolean; accOpen: boolean; onToggle: () => void;
  cells: (vA: number, vB: number) => React.ReactNode;
}) {
  return (
    <>
      <tr className={`border-t bg-muted/30 ${single ? "" : "cursor-pointer hover:bg-muted/50"}`} onClick={single ? undefined : onToggle}>
        <td className="px-3 py-1.5 pl-6">
          {single ? <span className="inline-block w-3.5" /> : <span className="inline-block w-3.5 text-muted-foreground transition-transform" style={{ transform: accOpen ? "rotate(90deg)" : "none" }}>▸</span>}{" "}
          <span className="text-muted-foreground">{acc.num}</span> <span className="font-medium text-foreground">{acc.ct}</span>
          {single && <span className="text-muted-foreground"> · {acc.conceptos[0]!.conc}</span>}
        </td>
        {cells(acc.vA, acc.vB)}
      </tr>
      {!single && accOpen && acc.conceptos.slice().sort((a, b) => b.vA - a.vA).map((it, i) => (
        <tr key={i} className="border-t">
          <td className="px-3 py-1.5 pl-12 text-muted-foreground">{it.conc}</td>
          {cells(it.vA, it.vB)}
        </tr>
      ))}
    </>
  );
}
