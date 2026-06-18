"use client";

import { useMemo, useState } from "react";
import { MultiDropdown } from "@/components/multi-dropdown";
import { KpiCard } from "@/components/kpi-card";
import {
  InvestmentRevenueChart,
  ConversionFunnel,
  CompactDonut,
  type InvRevPoint,
  type FunnelStage,
} from "@/components/pauta/conversion-charts";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  type ConversionDailyRow,
  type ConversionItemRow,
  aggregateConversion,
  aggregateByCampaign,
  aggregateByTipo,
  aggregateByCategoria,
  aggregateByMonth,
  topProducts,
  campaignTipo,
  isoToMonthKey,
  monthKeyToLabel,
  monthKeys,
} from "@/lib/pauta-conversion-data";

const fmtNum = (n: number) => formatNumber(Math.round(n));
const fmtARS = formatCurrency;
const fmtPct = (n: number | null, d = 1) => (n == null ? "—" : `${n.toFixed(d)}%`);
const fmtRoas = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}x`);

const TIPO_COLORS: Record<string, string> = {
  Search: "#2b4dff",
  "Performance Max": "#22c55e",
  Shopping: "#f59e0b",
  "Demand Gen": "#a855f7",
  Video: "#ec4899",
  Display: "#06b6d4",
  Otras: "#94a3b8",
};
const tipoColor = (t: string) => TIPO_COLORS[t] ?? "#94a3b8";

// "Enero 2026" → "Ene"
const mesCorto = (label: string) => (label.split(" ")[0] ?? label).slice(0, 3);

// Color best-in-class: verde al mejor, rojo al peor, gris si no hay spread.
function bicColor(value: number, best: number, worst: number, dir: "higher" | "lower"): string {
  if (!isFinite(value) || best === worst) return "";
  const good = dir === "higher" ? value >= best : value <= best;
  const bad = dir === "higher" ? value <= worst : value >= worst;
  if (good) return "text-emerald-600 font-semibold";
  if (bad) return "text-red-600 font-semibold";
  return "text-amber-600";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-6 text-sm font-medium text-muted-foreground">{children}</div>;
}

export function PerformanceConversionClient({
  rows,
  items = [],
}: {
  rows: ConversionDailyRow[];
  items?: ConversionItemRow[];
}) {
  const allMonths = useMemo(() => monthKeys(rows), [rows]);
  const allTipos = useMemo(
    () => [...new Set(rows.map((r) => campaignTipo(r.campaign)))].sort(),
    [rows],
  );

  const [selMeses, setSelMeses] = useState<string[]>([]);
  const [selTipos, setSelTipos] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const mesOk = (r: ConversionDailyRow) => selMeses.length === 0 || selMeses.includes(isoToMonthKey(r.fecha));
    const tipoOk = (r: ConversionDailyRow) => selTipos.length === 0 || selTipos.includes(campaignTipo(r.campaign));
    return rows.filter((r) => mesOk(r) && tipoOk(r));
  }, [rows, selMeses, selTipos]);

  const filteredItems = useMemo(() => {
    const mesOk = (r: ConversionItemRow) => selMeses.length === 0 || selMeses.includes(isoToMonthKey(r.fecha));
    const tipoOk = (r: ConversionItemRow) => selTipos.length === 0 || selTipos.includes(campaignTipo(r.campaign));
    return items.filter((r) => mesOk(r) && tipoOk(r));
  }, [items, selMeses, selTipos]);

  const kpis = useMemo(() => aggregateConversion(filtered), [filtered]);
  const porCampaña = useMemo(() => aggregateByCampaign(filtered), [filtered]);
  const porTipo = useMemo(() => aggregateByTipo(filtered), [filtered]);
  const porCategoria = useMemo(() => aggregateByCategoria(filtered), [filtered]);
  const porMes = useMemo(() => aggregateByMonth(filtered), [filtered]);
  const top10 = useMemo(() => topProducts(filteredItems, 10), [filteredItems]);

  // Periodo de análisis para el subtítulo.
  const periodo = useMemo(() => {
    const keys = selMeses.length > 0 ? [...selMeses].sort() : allMonths;
    if (keys.length === 0) return "sin datos";
    const first = keys[0];
    const last = keys[keys.length - 1];
    if (!first || !last) return "sin datos";
    return first === last ? monthKeyToLabel(first) : `${monthKeyToLabel(first)} – ${monthKeyToLabel(last)}`;
  }, [selMeses, allMonths]);

  // Best-in-class de la tabla por campaña (sobre campañas con sesiones).
  const campsValidas = porCampaña.filter((c) => c.sesiones > 0);
  const convVals = campsValidas.map((c) => c.tasa_conversion ?? 0).filter((v) => v > 0);
  const bestConv = convVals.length ? Math.max(...convVals) : 0;
  const worstConv = convVals.length ? Math.min(...convVals) : 0;
  const cpaVals = campsValidas.map((c) => c.cpa ?? 0).filter((v) => v > 0);
  const bestCpa = cpaVals.length ? Math.min(...cpaVals) : 0;
  const worstCpa = cpaVals.length ? Math.max(...cpaVals) : 0;
  const roasVals = campsValidas.map((c) => c.roas ?? 0).filter((v) => v > 0);
  const bestRoas = roasVals.length ? Math.max(...roasVals) : 0;
  const worstRoas = roasVals.length ? Math.min(...roasVals) : 0;

  // Embudo de conversión: Sesiones → Sesiones con interacción → Transacciones.
  const interaccion = kpis.bounce_rate != null ? kpis.sesiones * (1 - kpis.bounce_rate) : kpis.sesiones;
  const funnelStages: FunnelStage[] = [
    { label: "Sesiones", value: Math.round(kpis.sesiones), color: "#2b4dff" },
    {
      label: "Sesiones con interacción",
      value: Math.round(interaccion),
      pct: kpis.sesiones > 0 ? `${((interaccion / kpis.sesiones) * 100).toFixed(1)}%` : null,
      color: "#06b6d4",
    },
    {
      label: "Transacciones",
      value: Math.round(kpis.transacciones),
      pct: interaccion > 0 ? `${((kpis.transacciones / interaccion) * 100).toFixed(2)}%` : null,
      color: "#22c55e",
    },
  ];

  // Inversión vs Ingresos por mes (+ ROAS).
  const invRevData: InvRevPoint[] = porMes.map((m) => ({
    mes: mesCorto(m.mesLabel),
    inversion: m.costo,
    ingresos: m.ingresos,
    roas: m.roas,
  }));

  // Distribución de inversión por tipo (donut), solo si hay costo.
  const tipoDonut = porTipo
    .filter((t) => t.costo > 0)
    .map((t) => ({ name: t.tipo, value: t.costo, color: tipoColor(t.tipo) }));
  // Origen de las sesiones de la pauta por tipo (PMax vs Search).
  const sesionesDonut = porTipo
    .filter((t) => t.sesiones > 0)
    .map((t) => ({ name: t.tipo, value: t.sesiones, color: tipoColor(t.tipo) }));
  const totalUnidades = top10.reduce((s, p) => s + p.items_purchased, 0);

  const hayDatos = rows.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pauta Ecommerce</h2>
          <p className="text-sm text-muted-foreground">
            Parte baja del funnel · Campañas <strong>inhouse_*</strong> (100% Google Ads) · Fuente: GA4 · {periodo}
          </p>
        </div>
      </header>

      {/* Aviso de inversión pendiente */}
      {hayDatos && !kpis.hasCosto && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>Inversión por campaña pendiente.</strong> La eficiencia del gasto (CPA, CPC, ROAS) necesita el costo
          de cada campaña. Sale de GA4 (<code>advertiserAdCost</code>) una vez que <strong>Google Ads esté vinculado a
          la propiedad de GA4</strong>. Mientras tanto se muestran sesiones, transacciones, ingresos y conversión.
        </div>
      )}

      {!hayDatos && (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay tráfico de campañas <strong>inhouse_*</strong> en GA4. En cuanto el cron sincronice, aparece acá.
        </div>
      )}

      {/* ===== Filtros ===== */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-wrap gap-3">
          <MultiDropdown
            label="Mes"
            placeholder="Todos"
            selected={selMeses}
            options={allMonths.map((m) => ({ value: m, label: monthKeyToLabel(m) }))}
            onChange={setSelMeses}
          />
          <MultiDropdown
            label="Tipo de campaña"
            placeholder="Todos"
            selected={selTipos}
            options={allTipos.map((t) => ({ value: t, label: t }))}
            onChange={setSelTipos}
          />
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <SectionTitle>Resultados del período</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Sesiones" value={fmtNum(kpis.sesiones)} hint={`${fmtNum(kpis.usuarios_nuevos)} usuarios nuevos`} />
        <KpiCard title="Transacciones" value={fmtNum(kpis.transacciones)} hint={`Tasa de conversión ${fmtPct(kpis.tasa_conversion ? kpis.tasa_conversion * 100 : null)}`} />
        <KpiCard title="Total de ingresos" value={kpis.ingresos > 0 ? fmtARS(kpis.ingresos) : "—"} hint={kpis.ticket_promedio ? `Ticket prom. ${fmtARS(kpis.ticket_promedio)}` : "ingresos (revenue)"} />
        <KpiCard title="% Rebote" value={fmtPct(kpis.bounce_rate != null ? kpis.bounce_rate * 100 : null)} hint={`${fmtNum(kpis.usuarios)} usuarios activos`} />
        <KpiCard title="Inversión" value={kpis.hasCosto ? fmtARS(kpis.costo) : "Pendiente"} hint={kpis.hasCosto ? "advertiserAdCost (GA4)" : "vincular Google Ads ↔ GA4"} />
        <KpiCard title="CPA / CAC" value={kpis.cpa != null ? fmtARS(kpis.cpa) : "—"} hint="inversión ÷ transacciones" />
        <KpiCard title="CPC" value={kpis.cpc != null ? fmtARS(kpis.cpc) : "—"} hint="inversión ÷ clics" />
        <KpiCard title="ROAS" value={fmtRoas(kpis.roas)} hint="ingresos ÷ inversión" />
      </div>

      {/* ===== Origen de las sesiones + inversión vs ingresos (debajo de los cards) ===== */}
      <SectionTitle>Origen de las sesiones de la pauta y resultados</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 text-xs font-semibold">Sesiones por tipo de campaña</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            100% generadas por la pauta paga (campañas <strong>inhouse_*</strong>), según su origen: Performance Max o Search.
          </p>
          {sesionesDonut.length > 0 ? (
            <CompactDonut data={sesionesDonut} />
          ) : (
            <div className="py-10 text-center text-xs text-muted-foreground">Sin sesiones.</div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 text-xs font-semibold">Distribución de inversión por tipo</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Cuánto se gastó en cada tipo de campaña.
          </p>
          {tipoDonut.length > 0 ? (
            <CompactDonut data={tipoDonut} />
          ) : (
            <div className="py-10 text-center text-xs text-muted-foreground">Inversión pendiente (vincular Google Ads ↔ GA4).</div>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-lg border bg-card p-4">
        <div className="mb-2 text-xs font-semibold">Inversión vs. ingresos por mes</div>
        <InvestmentRevenueChart data={invRevData} />
      </div>

      {/* ===== Embudo de conversión ===== */}
      <SectionTitle>Embudo de conversión</SectionTitle>
      <div className="rounded-lg border bg-card p-4">
        <ConversionFunnel stages={funnelStages} />
        <p className="mt-3 text-xs text-muted-foreground">
          De cada <strong>100 sesiones</strong>, {fmtPct(kpis.tasa_conversion != null ? kpis.tasa_conversion * 100 : null, 2)} terminan en transacción.
        </p>
      </div>

      {/* ===== Conversión por categoría ===== */}
      <SectionTitle>Conversión por categoría</SectionTitle>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2 text-right">Sesiones</th>
              <th className="px-3 py-2 text-right">Transac.</th>
              <th className="px-3 py-2 text-right">Conv. %</th>
              <th className="px-3 py-2 text-right">Ingresos</th>
              <th className="px-3 py-2 text-right">Inversión</th>
              <th className="px-3 py-2 text-right">CPA</th>
              <th className="px-3 py-2 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {porCategoria.map((c) => (
              <tr key={c.categoria} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2 font-medium">{c.categoria}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.sesiones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.transacciones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(c.tasa_conversion != null ? c.tasa_conversion * 100 : null)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.ingresos > 0 ? fmtARS(c.ingresos) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.costo > 0 ? fmtARS(c.costo) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.cpa != null ? fmtARS(c.cpa) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRoas(c.roas)}</td>
              </tr>
            ))}
            {porCategoria.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sin datos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Top 10 productos ===== */}
      <SectionTitle>Top 10 productos por ingresos</SectionTitle>
      {top10.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2 text-right">Unidades</th>
                <th className="px-3 py-2 text-right">% Unid.</th>
                <th className="px-3 py-2 text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((p, i) => (
                <tr key={p.item_name} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium" title={p.item_name}>{p.item_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.items_purchased)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{totalUnidades > 0 ? `${((p.items_purchased / totalUnidades) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtARS(p.item_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-xs text-muted-foreground">
          El ranking de productos necesita el reporte de ítems de GA4 (<code>itemName</code> / <code>itemRevenue</code>).
          Corré el workflow <strong>GA4 web traffic sync</strong> (con <code>days=170</code>) después de aplicar la
          migración <code>0064</code> y aparece acá.
        </div>
      )}

      {/* ===== Inversión y resultados por tipo (tabla; el donut está arriba) ===== */}
      <SectionTitle>Inversión y resultados por tipo de campaña</SectionTitle>
      <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Inversión</th>
                <th className="px-3 py-2 text-right">% Inv.</th>
                <th className="px-3 py-2 text-right">Transac.</th>
                <th className="px-3 py-2 text-right">Ingresos</th>
                <th className="px-3 py-2 text-right">CPA</th>
                <th className="px-3 py-2 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {porTipo.map((t) => (
                <tr key={t.tipo} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ backgroundColor: tipoColor(t.tipo) }} />
                    {t.tipo}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.costo > 0 ? fmtARS(t.costo) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{kpis.costo > 0 && t.costo > 0 ? `${((t.costo / kpis.costo) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.transacciones)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.ingresos > 0 ? fmtARS(t.ingresos) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.cpa != null ? fmtARS(t.cpa) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtRoas(t.roas)}</td>
                </tr>
              ))}
              {porTipo.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sin datos.</td></tr>
              )}
            </tbody>
          </table>
      </div>

      {/* ===== Evolución mensual (detalle) ===== */}
      <SectionTitle>Evolución mensual (detalle)</SectionTitle>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Mes</th>
              <th className="px-3 py-2 text-right">Sesiones</th>
              <th className="px-3 py-2 text-right">Transac.</th>
              <th className="px-3 py-2 text-right">Conv. %</th>
              <th className="px-3 py-2 text-right">Ingresos</th>
              <th className="px-3 py-2 text-right">Inversión</th>
              <th className="px-3 py-2 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {porMes.map((m) => (
              <tr key={m.mesKey} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2 font-medium">{m.mesLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.sesiones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.transacciones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(m.tasa_conversion != null ? m.tasa_conversion * 100 : null)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.ingresos > 0 ? fmtARS(m.ingresos) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{m.costo > 0 ? fmtARS(m.costo) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRoas(m.roas)}</td>
              </tr>
            ))}
            {porMes.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sin datos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Detalle por campaña (al final, lo más granular) ===== */}
      <SectionTitle>Detalle por campaña</SectionTitle>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Campaña</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2 text-right">Sesiones</th>
              <th className="px-3 py-2 text-right">% Rebote</th>
              <th className="px-3 py-2 text-right">Transac.</th>
              <th className="px-3 py-2 text-right">Conv. %</th>
              <th className="px-3 py-2 text-right">Ingresos</th>
              <th className="px-3 py-2 text-right">Inversión</th>
              <th className="px-3 py-2 text-right">CPA</th>
              <th className="px-3 py-2 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {porCampaña.map((c) => {
              const convPct = c.tasa_conversion != null ? c.tasa_conversion * 100 : 0;
              return (
                <tr key={c.campaign} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium" title={c.campaign}>{c.nombre}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.tipo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.sesiones)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtPct(c.bounce_rate != null ? c.bounce_rate * 100 : null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.transacciones)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${bicColor(convPct, bestConv, worstConv, "higher")}`}>{fmtPct(convPct)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.ingresos > 0 ? fmtARS(c.ingresos) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.costo > 0 ? fmtARS(c.costo) : "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${c.cpa != null ? bicColor(c.cpa, bestCpa, worstCpa, "lower") : ""}`}>{c.cpa != null ? fmtARS(c.cpa) : "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${c.roas != null ? bicColor(c.roas, bestRoas, worstRoas, "higher") : ""}`}>{fmtRoas(c.roas)}</td>
                </tr>
              );
            })}
            {porCampaña.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">Sin campañas para el período seleccionado.</td></tr>
            )}
          </tbody>
          {porCampaña.length > 0 && (
            <tfoot className="border-t bg-muted/30 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(kpis.sesiones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(kpis.bounce_rate != null ? kpis.bounce_rate * 100 : null)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(kpis.transacciones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(kpis.tasa_conversion != null ? kpis.tasa_conversion * 100 : null)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{kpis.ingresos > 0 ? fmtARS(kpis.ingresos) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{kpis.costo > 0 ? fmtARS(kpis.costo) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{kpis.cpa != null ? fmtARS(kpis.cpa) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRoas(kpis.roas)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
