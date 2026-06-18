"use client";

import { useMemo, useState } from "react";
import { MultiDropdown } from "@/components/multi-dropdown";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  type ConversionDailyRow,
  aggregateConversion,
  aggregateByCampaign,
  aggregateByTipo,
  aggregateByMonth,
  campaignTipo,
  isoToMonthKey,
  monthKeyToLabel,
  monthKeys,
} from "@/lib/pauta-conversion-data";

const fmtNum = (n: number) => formatNumber(Math.round(n));
const fmtARS = formatCurrency;
const fmtPct = (n: number | null, d = 1) => (n == null ? "—" : `${n.toFixed(d)}%`);
const fmtRoas = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}x`);

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

export function PerformanceConversionClient({ rows }: { rows: ConversionDailyRow[] }) {
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

  const kpis = useMemo(() => aggregateConversion(filtered), [filtered]);
  const porCampaña = useMemo(() => aggregateByCampaign(filtered), [filtered]);
  const porTipo = useMemo(() => aggregateByTipo(filtered), [filtered]);
  const porMes = useMemo(() => aggregateByMonth(filtered), [filtered]);

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

  const hayDatos = rows.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Performance Pauta Conversión</h2>
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
          la propiedad de GA4</strong> (Admin → Vinculaciones de productos → Google Ads). Mientras tanto se muestran
          sesiones, transacciones, ingresos y conversión.
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

      {/* ===== Por campaña ===== */}
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

      {/* ===== Por tipo de campaña ===== */}
      <SectionTitle>Resumen por tipo de campaña</SectionTitle>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Tipo</th>
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
            {porTipo.map((t) => (
              <tr key={t.tipo} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2 font-medium">{t.tipo}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.sesiones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.transacciones)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(t.tasa_conversion != null ? t.tasa_conversion * 100 : null)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.ingresos > 0 ? fmtARS(t.ingresos) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{t.costo > 0 ? fmtARS(t.costo) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.cpa != null ? fmtARS(t.cpa) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtRoas(t.roas)}</td>
              </tr>
            ))}
            {porTipo.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sin datos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Evolución mensual ===== */}
      <SectionTitle>Evolución mensual</SectionTitle>
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
    </div>
  );
}
