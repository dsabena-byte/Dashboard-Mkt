"use client";

import { useMemo, useState } from "react";
import {
  type PautaRow,
  PAUTA_INSIGHTS,
  MEDIO_COLORS,
  computeByMedio,
  computeVideoByMedio,
  investmentByCategoria,
  extractMeses,
  defaultMes,
} from "@/lib/pauta-data";
import { InvestmentDonut, HBarChart, ReachImpressionsChart, MonthlyInvestmentChart } from "@/components/pauta/pauta-charts";
import { KpiCard } from "@/components/kpi-card";
import { MultiDropdown } from "@/components/multi-dropdown";
import { MetaPaidGrid } from "@/components/pauta/meta-paid-grid";
import { PautaInsightsPanel } from "@/components/pauta/pauta-insights-panel";
import { computePautaInsights } from "@/lib/pauta-insights";
import type { MetaPaidCreativeRow } from "@/lib/meta-paid-queries";
import {
  type Dv360CreativeRow,
  type Dv360ReachRow,
  aggregateDv360Funnels,
  aggregateDv360Pieces,
  aggregateDv360VideoQuality,
} from "@/lib/dv360-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

const fmtUSD = (n: number): string =>
  `US$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtNum(n: number): string {
  return formatNumber(Math.round(n));
}
const fmtARS = formatCurrency;

const TABS = ["Overview", "Por Medio", "Insights Pauta"] as const;
type Tab = (typeof TABS)[number];

type TipoMedio = "Digital" | "TV Cable" | "DOOH" | "OOH";
function tipoMedio(m: string): TipoMedio {
  if (m === "TV Cable") return "TV Cable";
  if (m === "DOOH") return "DOOH";
  if (m === "OOH") return "OOH";
  return "Digital";
}

// Orden cronológico de un mes "Mayo 2026" → 202605 (para detectar el último mes cerrado).
const MES_IDX: Record<string, number> = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6,
  Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
};
function mesSortKey(label: string): number {
  const [n, y] = label.split(" ");
  return Number(y ?? 0) * 100 + (MES_IDX[n ?? ""] ?? 0);
}
// "Junio 2026" → "2026-06-01" (formato del mes en DV360, para filtrar por los selectores de arriba).
function mesLabelToISO(label: string): string {
  const [n, y] = label.split(" ");
  return `${y}-${String(MES_IDX[n ?? ""] ?? 0).padStart(2, "0")}-01`;
}
// tipo de compra (Meta/TikTok) → rol de comunicación (para responder al filtro Rol).
function tipoCompraToRol(tc: string | null): string | null {
  if (tc === "CPC") return "Consideración";
  if (tc === "CPM" || tc === "CPV") return "Awareness";
  return null;
}

// Agrega por dimensión (categoría o rol) desde los datos AUTOMÁTICOS (DV360 + Meta/
// TikTok), con la MISMA estructura que la tabla maestra por medio (general + efectivo).
function buildDimModel(dv: Dv360CreativeRow[], meta: MetaPaidCreativeRow[], dim: "categoria" | "rol") {
  type Acc = { inv: number; impr: number; clicks: number; comp: number; vimpr: number; reach: number };
  const agg = new Map<string, Acc>();
  const get = (k: string) => { let e = agg.get(k); if (!e) { e = { inv: 0, impr: 0, clicks: 0, comp: 0, vimpr: 0, reach: 0 }; agg.set(k, e); } return e; };
  for (const r of dv) {
    const e = get((dim === "categoria" ? r.categoria : r.rol) || "—");
    e.inv += r.revenue_usd; e.impr += r.impresiones; e.clicks += r.clicks; e.comp += r.q100;
    if (r.starts > 0) e.vimpr += r.impresiones;
  }
  for (const r of meta) {
    if (r.plataforma !== "meta" && r.plataforma !== "tiktok") continue;
    const k = dim === "categoria" ? (r.categoria ?? "—") : (tipoCompraToRol(r.tipo_compra) ?? "—");
    const e = get(k);
    const isVid = (r.video_plays ?? 0) > 0 || (r.views_total ?? 0) > 0 || (r.video_p100 ?? 0) > 0;
    e.inv += r.spend; e.impr += r.impresiones; e.clicks += r.clicks;
    e.comp += (r.video_p100 ?? 0) || (r.views_completed ?? 0);
    if (isVid) e.vimpr += r.impresiones;
    e.reach += r.alcance ?? 0;
  }
  const items = [...agg.entries()]
    .map(([nombre, e]) => ({
      nombre, inversion: e.inv, impresiones: e.impr, alcance: e.reach, clics: e.clicks,
      cpm: e.impr > 0 ? (e.inv / e.impr) * 1000 : 0,
      ctr: e.impr > 0 ? (e.clicks / e.impr) * 100 : 0,
      vtr: e.vimpr > 0 ? (e.comp / e.vimpr) * 100 : 0,
      cpmEf: e.comp > 0 ? (e.inv / e.comp) * 1000 : 0,
    }))
    .filter((i) => i.impresiones > 0)
    .sort((a, b) => b.inversion - a.inversion);
  const posMin = (xs: number[]) => { const f = xs.filter((x) => x > 0); return f.length ? Math.min(...f) : 0; };
  const posMax = (xs: number[]) => { const f = xs.filter((x) => x > 0); return f.length ? Math.max(...f) : 0; };
  return { items, bestVtr: posMax(items.map((i) => i.vtr)), bestCtr: posMax(items.map((i) => i.ctr)), bestCpmEf: posMin(items.map((i) => i.cpmEf)) };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-6 text-sm font-medium text-muted-foreground">{children}</div>;
}

// Tabla por dimensión (categoría o rol) con la MISMA estructura que la tabla maestra
// por medio: general (gris) + efectivo (semáforo).
function DimTable({ titulo, col1, model, money }: { titulo: string; col1: string; model: ReturnType<typeof buildDimModel>; money: (n: number) => string }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="border-b px-3 py-2 text-xs font-semibold">{titulo}</div>
      <table className="w-full text-xs">
        <thead className="border-b">
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">{col1}</th>
            <th className="px-3 py-2 text-right">Inversión</th>
            <th className="px-3 py-2 text-right font-normal">Impr. <span className="normal-case opacity-60">(gral)</span></th>
            <th className="px-3 py-2 text-right">Alcance</th>
            <th className="px-3 py-2 text-right">Frec.</th>
            <th className="px-3 py-2 text-right">VTR real</th>
            <th className="px-3 py-2 text-right font-normal">CPM <span className="normal-case opacity-60">(gral)</span></th>
            <th className="px-3 py-2 text-right">CPM efect.</th>
            <th className="px-3 py-2 text-right">CPC</th>
            <th className="px-3 py-2 text-right">CTR</th>
          </tr>
        </thead>
        <tbody>
          {model.items.map((b) => {
            const cpc = b.clics > 0 ? b.inversion / b.clics : 0;
            const frec = b.alcance > 0 ? b.impresiones / b.alcance : 0;
            return (
              <tr key={b.nombre} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{b.nombre}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(b.inversion)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(b.impresiones)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{b.alcance > 0 ? fmtNum(b.alcance) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{frec > 0 ? frec.toFixed(1) : "—"}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${b.vtr > 0 ? bicColor(b.vtr, model.bestVtr, "higher") : "text-muted-foreground"}`}>{b.vtr > 0 ? `${b.vtr.toFixed(0)}%` : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{b.cpm > 0 ? money(b.cpm) : "—"}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${b.cpmEf > 0 ? bicColor(b.cpmEf, model.bestCpmEf, "lower") : "text-muted-foreground"}`}>{b.cpmEf > 0 ? money(b.cpmEf) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{cpc > 0 ? money(cpc) : "—"}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${b.ctr > 0 ? bicColor(b.ctr, model.bestCtr, "higher") : "text-muted-foreground"}`}>{b.ctr.toFixed(2)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const INSIGHT_STYLES: Record<string, string> = {
  good: "border-emerald-500 bg-emerald-50",
  warn: "border-amber-500 bg-amber-50",
  alert: "border-rose-500 bg-rose-50",
  info: "border-blue-500 bg-blue-50",
};

function Insight({ type, title, text }: { type: "good" | "warn" | "alert" | "info"; title: string; text: string }) {
  return (
    <div className={`rounded-lg border-l-4 p-3 text-xs leading-relaxed ${INSIGHT_STYLES[type]}`}>
      <div className="mb-1 font-semibold text-foreground">{title}</div>
      <div className="text-foreground/80">{text}</div>
    </div>
  );
}

// ===== Resumen ejecutivo: helpers =====
const pctDelta = (curr: number, prev: number | null): number | null =>
  prev == null || prev === 0 ? null : ((curr - prev) / prev) * 100;

// KPI con variación vs mes anterior (Δ% MoM). Color según si "más es mejor"
// (higherBetter), peor (false) o neutral (sin juicio de valor → gris).
function MoMStat({ label, value, delta, dir = "neutral", sub }: {
  label: string; value: string; delta: number | null; dir?: "up-good" | "down-good" | "neutral"; sub?: string;
}) {
  let color = "text-muted-foreground";
  if (delta != null && dir !== "neutral" && delta !== 0) {
    const good = dir === "up-good" ? delta > 0 : delta < 0;
    color = good ? "text-emerald-600" : "text-rose-500";
  }
  const arrow = delta == null || delta === 0 ? "▬" : delta > 0 ? "▲" : "▼";
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
      <div className={`text-[11px] tabular-nums ${color}`}>
        {delta == null ? <span className="text-muted-foreground">— sin mes previo</span> : <>{arrow} {delta > 0 ? "+" : ""}{delta.toFixed(1)}% vs mes ant.</>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

// Semáforo de una métrica vs el mejor medio comparable (best-in-class interno).
// kind "lower" = menos es mejor (CPM); "higher" = más es mejor (CTR/VTR).
function bicColor(value: number, best: number, kind: "lower" | "higher"): string {
  if (best <= 0 || value <= 0) return "text-muted-foreground";
  const ratio = kind === "lower" ? value / best : value / best;
  if (kind === "lower") return ratio <= 1.1 ? "text-emerald-600" : ratio <= 1.4 ? "text-amber-600" : "text-rose-600";
  return ratio >= 0.9 ? "text-emerald-600" : ratio >= 0.6 ? "text-amber-600" : "text-rose-600";
}


export function PerformanceClient({ data, metaPaid = [], dv360 = [], dv360Reach = [], fxRates = {}, planningMonthly = {} }: { data: PautaRow[]; metaPaid?: MetaPaidCreativeRow[]; dv360?: Dv360CreativeRow[]; dv360Reach?: Dv360ReachRow[]; fxRates?: Record<string, number>; planningMonthly?: Record<string, { digital: number; tvCable: number; dooh: number; ooh: number }> }) {
  const meses = useMemo(() => extractMeses(data), [data]);
  const [selMeses, setSelMeses] = useState<string[]>(() => {
    const d = defaultMes(meses);
    return d ? [d] : [];
  });
  const [selMedios, setSelMedios] = useState<string[]>([]);
  const [selCats, setSelCats] = useState<string[]>([]);
  const [selRoles, setSelRoles] = useState<string[]>([]);
  const [selPlats, setSelPlats] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("Overview");

  const opMedios: TipoMedio[] = ["Digital", "TV Cable", "DOOH", "OOH"];
  const opCats = useMemo(() => [...new Set(data.map((r) => r.categoria))].sort(), [data]);
  const opRoles = ["Awareness", "Consideración"];
  const opPlats = useMemo(() => [...new Set(data.map((r) => r.medio))].sort(), [data]);

  const rows = useMemo(
    () =>
      data.filter(
        (r) =>
          (selMeses.length === 0 || selMeses.includes(r.mes)) &&
          (selMedios.length === 0 || selMedios.includes(tipoMedio(r.medio))) &&
          (selCats.length === 0 || selCats.includes(r.categoria)) &&
          (selRoles.length === 0 || selRoles.includes(r.objetivo)) &&
          (selPlats.length === 0 || selPlats.includes(r.medio)),
      ),
    [data, selMeses, selMedios, selCats, selRoles, selPlats],
  );

  // ===== Datos de los procesos AUTOMÁTICOS (Meta API + DV360), conectados a los
  // filtros de arriba. DV360/Meta son digitales: si se filtra solo TV/OOH, quedan vacíos.
  const digitalOk = selMedios.length === 0 || selMedios.includes("Digital");
  const selMesesISO = useMemo(() => new Set(selMeses.map(mesLabelToISO)), [selMeses]);
  const metaPaidF = useMemo(
    () =>
      !digitalOk ? [] : metaPaid.filter(
        (r) =>
          (selMeses.length === 0 || selMeses.includes(r.mes)) &&
          (selCats.length === 0 || (r.categoria != null && selCats.includes(r.categoria))) &&
          (selRoles.length === 0 || selRoles.includes(tipoCompraToRol(r.tipo_compra) ?? "")),
      ),
    [metaPaid, digitalOk, selMeses, selCats, selRoles],
  );
  const dv360F = useMemo(
    () =>
      !digitalOk ? [] : dv360.filter(
        (r) =>
          (selMesesISO.size === 0 || selMesesISO.has(r.mes)) &&
          (selCats.length === 0 || selCats.includes(r.categoria)) &&
          (selRoles.length === 0 || selRoles.includes(r.rol)),
      ),
    [dv360, digitalOk, selMesesISO, selCats, selRoles],
  );
  const dv360ReachF = useMemo(
    () => (!digitalOk ? [] : dv360Reach.filter((r) => selMesesISO.size === 0 || selMesesISO.has(r.mes))),
    [dv360Reach, digitalOk, selMesesISO],
  );

  const byMedio = useMemo(() => computeByMedio(rows), [rows]);
  const videoByMedio = useMemo(() => computeVideoByMedio(rows), [rows]);
  // Embudo de visibilidad real de video (Meta Marketing API): cuántas impresiones
  // llegan a cada % del video. Solo Meta (el cron meta-paid-sync trae los cuartiles).
  const metaVideoFunnel = useMemo(() => {
    const vids = metaPaidF.filter((r) => r.plataforma === "meta" && (r.video_plays ?? 0) > 0);
    const a = vids.reduce(
      (acc, r) => ({
        impresiones: acc.impresiones + r.impresiones,
        plays: acc.plays + (r.video_plays ?? 0),
        p25: acc.p25 + (r.video_p25 ?? 0),
        p50: acc.p50 + (r.video_p50 ?? 0),
        p75: acc.p75 + (r.video_p75 ?? 0),
        p100: acc.p100 + (r.video_p100 ?? 0),
        thruplay: acc.thruplay + (r.video_thruplay ?? 0),
        spend: acc.spend + r.spend,
      }),
      { impresiones: 0, plays: 0, p25: 0, p50: 0, p75: 0, p100: 0, thruplay: 0, spend: 0 },
    );
    return { ...a, count: vids.length };
  }, [metaPaidF]);
  // DV360: si hay cotización (fx_rates) mostramos en pesos (BCRA prom. mensual),
  // convirtiendo el costo USD por el rate del mes de cada fila. Si no, en USD.
  const arsMode = Object.keys(fxRates).length > 0;
  const fxVals = Object.values(fxRates);
  const fxFallback = fxVals.length ? fxVals[fxVals.length - 1]! : 1;
  const dvMoney = arsMode ? fmtARS : fmtUSD;
  const monedaLbl = arsMode ? "ARS" : "USD";
  const dv360Conv = useMemo(
    () => (arsMode ? dv360F.map((r) => ({ ...r, revenue_usd: r.revenue_usd * (fxRates[r.mes] ?? fxFallback) })) : dv360F),
    [dv360F, fxRates, arsMode, fxFallback],
  );
  const dv360Funnels = useMemo(() => aggregateDv360Funnels(dv360Conv), [dv360Conv]);
  const dv360Pieces = useMemo(() => aggregateDv360Pieces(dv360Conv), [dv360Conv]);
  const dv360VideoQ = useMemo(() => aggregateDv360VideoQuality(dv360Conv), [dv360Conv]);
  // Calidad de video unificada (DV360 cuartiles + Meta p25-100). Las cuentas
  // (impresiones, vistas a cada %) son moneda-agnósticas; el costo (CPCV) solo se
  // combina si DV360 ya está en ARS (arsMode), porque Meta spend es ARS.
  const videoQuality = useMemo(() => {
    const m = metaVideoFunnel;
    const imprVideo = dv360VideoQ.imprVideo + m.impresiones;
    const v25 = dv360VideoQ.q25 + m.p25;
    const v50 = dv360VideoQ.q50 + m.p50;
    const v75 = dv360VideoQ.q75 + m.p75;
    const v100 = dv360VideoQ.q100 + m.p100;
    const spend = arsMode ? dv360VideoQ.revenueVideo + m.spend : 0; // ARS solo si DV360 convertido
    const imprTotal = imprVideo + dv360VideoQ.imprDisplay; // total con formato conocido (DV360+Meta video)
    return {
      imprVideo, imprDisplay: dv360VideoQ.imprDisplay, imprTotal,
      v25, v50, v75, v100, spend,
      pct50: imprVideo > 0 ? (v50 / imprVideo) * 100 : 0,
      pct100: imprVideo > 0 ? (v100 / imprVideo) * 100 : 0,
      cpcv: v100 > 0 && spend > 0 ? spend / v100 : 0,
      pctVideoMix: imprTotal > 0 ? (imprVideo / imprTotal) * 100 : 0,
      hasData: imprVideo > 0,
    };
  }, [dv360VideoQ, metaVideoFunnel, arsMode]);
  // Embudo de video de TikTok (desde metaPaid, solo filas de video).
  const tiktokVideoFunnel = useMemo(() => {
    const t = metaPaidF.filter((r) => r.plataforma === "tiktok" && ((r.video_plays ?? 0) > 0 || (r.views_total ?? 0) > 0 || (r.video_p100 ?? 0) > 0 || (r.views_completed ?? 0) > 0));
    const a = t.reduce(
      (acc, r) => ({
        impresiones: acc.impresiones + r.impresiones,
        p25: acc.p25 + (r.video_p25 ?? 0),
        p50: acc.p50 + (r.video_p50 ?? 0),
        p75: acc.p75 + (r.video_p75 ?? 0),
        p100: acc.p100 + ((r.video_p100 ?? 0) || (r.views_completed ?? 0)),
        spend: acc.spend + r.spend,
      }),
      { impresiones: 0, p25: 0, p50: 0, p75: 0, p100: 0, spend: 0 },
    );
    return { ...a, count: t.length };
  }, [metaPaidF]);
  // Embudos de video SEPARADOS por fuente (cada canal DV360 + Meta + TikTok), no mezclados.
  const videoSources = useMemo(() => {
    const arr: Array<{ name: string; impr: number; v25: number; v50: number; v75: number; v100: number; spend: number }> = [];
    const MED: Record<string, string> = { "Demand Gen": "Google Demand Gen" }; // DV360 = plataforma; el medio es el canal
    for (const f of dv360Funnels) arr.push({ name: MED[f.canal] ?? f.canal, impr: f.impresiones, v25: f.q25, v50: f.q50, v75: f.q75, v100: f.q100, spend: arsMode ? f.revenueUsd : 0 });
    if (metaVideoFunnel.count > 0) arr.push({ name: "Meta", impr: metaVideoFunnel.impresiones, v25: metaVideoFunnel.p25, v50: metaVideoFunnel.p50, v75: metaVideoFunnel.p75, v100: metaVideoFunnel.p100, spend: metaVideoFunnel.spend });
    if (tiktokVideoFunnel.count > 0) arr.push({ name: "TikTok", impr: tiktokVideoFunnel.impresiones, v25: tiktokVideoFunnel.p25, v50: tiktokVideoFunnel.p50, v75: tiktokVideoFunnel.p75, v100: tiktokVideoFunnel.p100, spend: tiktokVideoFunnel.spend });
    return arr.sort((a, b) => b.impr - a.impr);
  }, [dv360Funnels, metaVideoFunnel, tiktokVideoFunnel, arsMode]);
  const catModel = useMemo(() => buildDimModel(dv360Conv, metaPaidF, "categoria"), [dv360Conv, metaPaidF]);
  const rolModel = useMemo(() => buildDimModel(dv360Conv, metaPaidF, "rol"), [dv360Conv, metaPaidF]);
  // Mejores valores por columna (para semáforos best-in-class en las tablas de detalle).
  const minPos = (xs: number[]) => { const f = xs.filter((x) => x > 0); return f.length ? Math.min(...f) : 0; };
  const maxPos = (xs: number[]) => { const f = xs.filter((x) => x > 0); return f.length ? Math.max(...f) : 0; };
  const dvPieceBest = useMemo(() => ({
    ctr: maxPos(dv360Pieces.map((p) => p.ctr)),
    cpm: minPos(dv360Pieces.map((p) => p.cpm)),
    vtr: maxPos(dv360Pieces.map((p) => p.vtr)),
  }), [dv360Pieces]);

  // Inversión: total y desglose por tipo de medio (sin doble conteo)
  const totalInv = useMemo(() => rows.reduce((s, r) => s + (r.inversion ?? 0), 0), [rows]);
  const { invDigital, invTv, invDooh, invOoh } = useMemo(() => {
    let d = 0, t = 0, dh = 0, o = 0;
    for (const r of rows) {
      const v = r.inversion ?? 0;
      const k = tipoMedio(r.medio);
      if (k === "TV Cable") t += v;
      else if (k === "DOOH") dh += v;
      else if (k === "OOH") o += v;
      else d += v;
    }
    return { invDigital: d, invTv: t, invDooh: dh, invOoh: o };
  }, [rows]);
  // Volumetría

  // Volumetría mensual (año completo 2026): NO se filtra, siempre muestra el histórico.
  // Alcance e impresiones se suman sobre filas Awareness (upper funnel), igual que la KPI.
  // Meses sin data quedan en 0 hasta que se carguen.
  const HISTORICO_MESES_FIJOS: Array<{ full: string; short: string }> = [
    { full: "Enero", short: "Ene" }, { full: "Febrero", short: "Feb" },
    { full: "Marzo", short: "Mar" }, { full: "Abril", short: "Abr" },
    { full: "Mayo", short: "May" }, { full: "Junio", short: "Jun" },
    { full: "Julio", short: "Jul" }, { full: "Agosto", short: "Ago" },
    { full: "Septiembre", short: "Sep" }, { full: "Octubre", short: "Oct" },
    { full: "Noviembre", short: "Nov" }, { full: "Diciembre", short: "Dic" },
  ];
  // Último mes (1..12) con data: para distinguir "fue cero" (mes pasado sin
  // ejecución) de "todavía no se ejecutó" (mes futuro). Pasados muestran 0,
  // futuros muestran null (gap en línea / sin barra).
  const lastMonthWithData = useMemo(() => {
    let last = 0;
    for (const r of data) {
      const idx = HISTORICO_MESES_FIJOS.findIndex(({ full }) => `${full} 2026` === r.mes);
      if (idx >= 0 && idx + 1 > last) last = idx + 1;
    }
    return last;
  }, [data]);

  const volumetriaMensual = useMemo(
    () =>
      HISTORICO_MESES_FIJOS.map(({ full, short }, i) => {
        const mes = `${full} 2026`;
        const monthRows = data.filter((r) => r.mes === mes && r.objetivo === "Awareness");
        const future = i + 1 > lastMonthWithData;
        return {
          mes: short,
          alcance: future ? null : monthRows.reduce((s, r) => s + (r.alcance ?? 0), 0),
          impresiones: future ? null : monthRows.reduce((s, r) => s + (r.impresiones ?? 0), 0),
        };
      }),
    [data, lastMonthWithData],
  );

  // Mes corriente (1..12) para 2026: el mes en curso y los futuros se muestran
  // como PLANIFICADO (el ejecutado del mes en curso queda muy bajo a mitad de
  // mes); solo los meses ya cerrados muestran ejecutado.
  const currentMonth = useMemo(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    if (y > 2026) return 13;
    if (y < 2026) return 1;
    return now.getUTCMonth() + 1;
  }, []);

  // Inversión mensual ON/OFF (año completo, sin filtros).
  // Meses cerrados (< mes corriente): ejecutado de pauta_performance.
  // Mes corriente y futuros: planificado de planning_media (isPlanned=true → tonos grises).
  const inversionMensual = useMemo(() => {
    type Row = {
      mes: string;
      digital: number | null;
      tvCable: number | null;
      dooh: number | null;
      ooh: number | null;
      isPlanned: boolean;
      mes_pct: number | null;
      pct_marker: number;
    };
    const rows: Row[] = HISTORICO_MESES_FIJOS.map(({ full, short }, i) => {
      const mes = `${full} 2026`;
      const usePlan = i + 1 >= currentMonth;
      if (usePlan) {
        const plan = planningMonthly[mes];
        if (!plan) {
          return { mes: short, digital: null, tvCable: null, dooh: null, ooh: null, isPlanned: true, mes_pct: null, pct_marker: 0 };
        }
        return { mes: short, digital: plan.digital, tvCable: plan.tvCable, dooh: plan.dooh, ooh: plan.ooh, isPlanned: true, mes_pct: null, pct_marker: 1 };
      }
      const row = { mes: short, digital: 0, tvCable: 0, dooh: 0, ooh: 0, isPlanned: false, mes_pct: null as number | null, pct_marker: 1 };
      for (const r of data.filter((x) => x.mes === mes)) {
        const v = r.inversion ?? 0;
        const k = tipoMedio(r.medio);
        if (k === "TV Cable") row.tvCable += v;
        else if (k === "DOOH") row.dooh += v;
        else if (k === "OOH") row.ooh += v;
        else row.digital += v;
      }
      return row;
    });
    const total = rows.reduce((s, r) => s + (r.digital ?? 0) + (r.tvCable ?? 0) + (r.dooh ?? 0) + (r.ooh ?? 0), 0);
    return rows.map((r) => {
      const monthTotal = (r.digital ?? 0) + (r.tvCable ?? 0) + (r.dooh ?? 0) + (r.ooh ?? 0);
      return { ...r, mes_pct: total > 0 && monthTotal > 0 ? (monthTotal / total) * 100 : null };
    });
  }, [data, currentMonth, planningMonthly]);

  // ===== Resumen ejecutivo: scorecard mes vs mes anterior (MoM) =====
  // Mes de referencia = el seleccionado (si es uno) o el último con data.
  // Respeta los filtros de medio/categoría/rol/plataforma, pero NO el de mes.
  const rowsNoMes = useMemo(
    () =>
      data.filter(
        (r) =>
          (selMedios.length === 0 || selMedios.includes(tipoMedio(r.medio))) &&
          (selCats.length === 0 || selCats.includes(r.categoria)) &&
          (selRoles.length === 0 || selRoles.includes(r.objetivo)) &&
          (selPlats.length === 0 || selPlats.includes(r.medio)),
      ),
    [data, selMedios, selCats, selRoles, selPlats],
  );
  const refMes = useMemo(() => {
    if (selMeses.length === 1) return selMeses[0]!; // si el usuario eligió un mes, lo respetamos
    // Por defecto: último mes CERRADO (excluye el mes en curso, que es info parcial).
    const now = new Date();
    const nowKey = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
    const cerrados = meses.filter((m) => mesSortKey(m) < nowKey);
    return cerrados.length ? cerrados[cerrados.length - 1]! : meses.length ? meses[meses.length - 1]! : null;
  }, [selMeses, meses]);
  const prevMes = useMemo(() => {
    if (!refMes) return null;
    const i = meses.indexOf(refMes);
    return i > 0 ? meses[i - 1]! : null;
  }, [meses, refMes]);
  const monthTotals = useMemo(() => {
    const calc = (mes: string | null) => {
      if (!mes) return null;
      let inv = 0, impr = 0, clic = 0, view = 0, alc = 0;
      for (const r of rowsNoMes) {
        if (r.mes !== mes) continue;
        inv += r.inversion ?? 0; impr += r.impresiones ?? 0; clic += r.clics ?? 0; view += r.views ?? 0;
        if (r.objetivo === "Awareness") alc += r.alcance ?? 0;
      }
      return {
        inv, impr, clic, view, alc,
        cpm: impr > 0 ? (inv / impr) * 1000 : 0,
        ctr: impr > 0 ? (clic / impr) * 100 : 0,
        cpc: clic > 0 ? inv / clic : 0,
        frec: alc > 0 ? impr / alc : 0,
        vtr: impr > 0 ? (view / impr) * 100 : 0,
      };
    };
    return { ref: calc(refMes), prev: calc(prevMes) };
  }, [rowsNoMes, refMes, prevMes]);

  // ===== Modelo único de medios (fuente de verdad para TODO el dashboard) =====
  // Todo desde los procesos AUTOMÁTICOS (DV360 reportes + Meta Marketing API), por
  // medio (DV360 es la plataforma de compra; el medio es el canal). Filtrado por los
  // selectores de arriba. Volumen + impacto real (VTR/CPM efectivo desde completions).
  const medioModel = useMemo(() => {
    type Acc = { inv: number; impr: number; clicks: number; comp: number; vimpr: number; reach: number };
    const agg = new Map<string, Acc>();
    const get = (medio: string) => { let e = agg.get(medio); if (!e) { e = { inv: 0, impr: 0, clicks: 0, comp: 0, vimpr: 0, reach: 0 }; agg.set(medio, e); } return e; };
    const DVMED: Record<string, string> = { YouTube: "YouTube", Programmatic: "Programmatic", Marketplace: "Marketplace", "Demand Gen": "Google Demand Gen" };
    for (const r of dv360Conv) {
      const e = get(DVMED[r.canal] ?? r.canal);
      e.inv += r.revenue_usd; e.impr += r.impresiones; e.clicks += r.clicks; e.comp += r.q100;
      if (r.starts > 0) e.vimpr += r.impresiones;
    }
    for (const r of dv360ReachF) get(DVMED[r.canal] ?? r.canal).reach += r.reach;
    for (const r of metaPaidF) {
      const medio = r.plataforma === "meta" ? "Meta" : r.plataforma === "tiktok" ? "TikTok" : null;
      if (!medio) continue;
      const e = get(medio);
      const isVid = (r.video_plays ?? 0) > 0 || (r.views_total ?? 0) > 0 || (r.video_p100 ?? 0) > 0;
      e.inv += r.spend; e.impr += r.impresiones; e.clicks += r.clicks;
      e.comp += (r.video_p100 ?? 0) || (r.views_completed ?? 0);
      if (isVid) e.vimpr += r.impresiones;
      e.reach += r.alcance ?? 0;
    }
    const items = [...agg.entries()]
      .map(([medio, e]) => ({
        medio,
        isDigital: true,
        inversion: e.inv,
        impresiones: e.impr,
        alcance: e.reach,
        clics: e.clicks,
        viewsReales: e.comp, // views completos reales (cuartil 100%)
        cpm: e.impr > 0 ? (e.inv / e.impr) * 1000 : 0, // GENERAL
        ctr: e.impr > 0 ? (e.clicks / e.impr) * 100 : 0, // efectivo (engagement)
        vtr: e.vimpr > 0 ? (e.comp / e.vimpr) * 100 : 0, // efectivo (% completions reales)
        cpmEf: e.comp > 0 ? (e.inv / e.comp) * 1000 : 0, // efectivo (costo real por mil views completos)
      }))
      .filter((i) => i.impresiones > 0)
      .sort((a, b) => b.inversion - a.inversion);
    return {
      items,
      bestCtr: maxPos(items.map((i) => i.ctr)),
      bestVtr: maxPos(items.map((i) => i.vtr)),
      bestCpmEf: minPos(items.map((i) => i.cpmEf)),
    };
  }, [dv360Conv, dv360ReachF, metaPaidF]);

  // Alertas "qué mejorar" auto-generadas.
  const alertas = useMemo(() => {
    const out: Array<{ type: "alert" | "warn" | "good"; title: string; text: string }> = [];
    const vids = videoByMedio.filter((v) => v.views > 0 && v.impresiones > 0);
    if (vids.length) {
      const worst = [...vids].sort((a, b) => a.vtr - b.vtr)[0]!;
      const ratio = worst.cpm > 0 ? worst.cpmEfectivo / worst.cpm : 0;
      if (worst.vtr < 50) out.push({
        type: worst.vtr < 25 ? "alert" : "warn",
        title: `Video poco efectivo · ${worst.medio}`,
        text: `VTR ${worst.vtr.toFixed(0)}% → su CPM efectivo (${fmtARS(worst.cpmEfectivo)}) es ${ratio.toFixed(1)}× el nominal. Revisar formato/duración/targeting de video.`,
      });
    }
    if (medioModel.bestCpmEf > 0) {
      const costly = medioModel.items.filter((i) => i.cpmEf > 0).sort((a, b) => b.cpmEf - a.cpmEf)[0];
      if (costly) {
        const r = costly.cpmEf / medioModel.bestCpmEf;
        if (r > 1.5) out.push({
          type: "warn",
          title: `Costo efectivo caro · ${costly.medio}`,
          text: `Su CPM efectivo (costo por view real) es ${fmtARS(costly.cpmEf)} = ${r.toFixed(1)}× el del mejor medio digital (${fmtARS(medioModel.bestCpmEf)}). El nominal puede parecer barato, pero pocos ven el video → reasignar hacia el más efectivo.`,
        });
      }
    }
    const tr = monthTotals.ref, tp = monthTotals.prev;
    if (tr && tp) {
      const dCpm = pctDelta(tr.cpm, tp.cpm);
      if (dCpm != null && dCpm > 15) out.push({
        type: "warn",
        title: "CPM al alza vs mes anterior",
        text: `El CPM subió ${dCpm.toFixed(0)}% respecto del mes previo (${fmtARS(tp.cpm)} → ${fmtARS(tr.cpm)}). Verificar mix de medios y formatos.`,
      });
      if (tr.frec > 6) out.push({
        type: "warn",
        title: "Frecuencia alta (saturación)",
        text: `Frecuencia ${tr.frec.toFixed(1)} en awareness. Por encima de ~5-6 hay riesgo de saturación y desperdicio de impresiones; conviene ampliar alcance o capear frecuencia.`,
      });
    }
    if (out.length === 0) out.push({ type: "good", title: "Sin alertas críticas", text: "Los indicadores de la selección están dentro de rangos esperables." });
    return out.slice(0, 4);
  }, [videoByMedio, medioModel, monthTotals]);

  // Insights: solo si hay una sola categoría seleccionada
  const insight = selCats.length === 1 ? PAUTA_INSIGHTS[selCats[0]!] : null;

  const donutData = byMedio.map((m) => ({ name: m.medio, value: m.inversion, color: MEDIO_COLORS[m.medio] ?? "#94a3b8" }));
  const catDonutData = useMemo(() => investmentByCategoria(rows), [rows]);
  const mixData = [
    { name: "Digital", value: invDigital, color: "#2b4dff" },
    { name: "TV Cable", value: invTv, color: "#e63946" },
    { name: "DOOH", value: invDooh, color: "#ec4899" },
    { name: "OOH", value: invOoh, color: "#f59e0b" },
  ].filter((d) => d.value > 0);
  // Todo desde los datos AUTOMÁTICOS (Meta + DV360) vía medioModel.
  const autoTot = medioModel.items.reduce(
    (a, i) => ({ impr: a.impr + i.impresiones, reach: a.reach + i.alcance, clics: a.clics + i.clics, views: a.views + i.viewsReales }),
    { impr: 0, reach: 0, clics: 0, views: 0 },
  );
  const reachData = medioModel.items.filter((i) => i.alcance > 0).map((i) => ({ name: i.medio, value: i.alcance })).sort((a, b) => b.value - a.value);
  const clicksData = medioModel.items.filter((i) => i.clics > 0).map((i) => ({ name: i.medio, value: i.clics })).sort((a, b) => b.value - a.value);
  // Impacto EFECTIVO por medio: views completos reales (cuartil 100%), desde DV360+Meta.
  const viewsRealData = medioModel.items.filter((i) => i.viewsReales > 0).map((i) => ({ name: i.medio, value: i.viewsReales })).sort((a, b) => b.value - a.value);

  // Embudo 100% automático (Meta+DV360): de impresiones a la visibilidad REAL del video
  // (cuartiles), no el número inflado de "video views".
  const funnelStages = [
    { label: "Impresiones", value: autoTot.impr, w: 100, bg: "#0a1849", real: false },
    { label: "Alcance (usuarios únicos)", value: autoTot.reach, w: 84, bg: "#142b6f", real: false },
    { label: "Vieron 25% del video", value: videoQuality.v25, w: 68, bg: "#15803d", real: true },
    { label: "Vieron 100% (completo)", value: videoQuality.v100, w: 50, bg: "#15803d", real: true },
    { label: "Clicks", value: autoTot.clics, w: 36, bg: "#2b4dff", real: false },
  ];

  const totalHint =
    selMeses.length === 0
      ? "Todos los meses"
      : selMeses.length === 1
        ? selMeses[0]!
        : `${selMeses.length} meses`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Performance Pauta</h2>
          <p className="text-sm text-muted-foreground">
            Resultados ejecutados (Digital ON + TV + OOH) · Fuente: OMD
          </p>
        </div>
      </header>

      {/* ===== Filtros ===== */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-wrap gap-3">
          <MultiDropdown
            label="Mes"
            placeholder="Todos"
            selected={selMeses}
            options={meses.map((m) => ({ value: m, label: m }))}
            onChange={setSelMeses}
          />
          <MultiDropdown
            label="Medio"
            placeholder="Todos"
            selected={selMedios}
            options={opMedios.map((m) => ({ value: m, label: m }))}
            onChange={setSelMedios}
          />
          <MultiDropdown
            label="Categoría"
            placeholder="Todas"
            selected={selCats}
            options={opCats.map((c) => ({ value: c, label: c }))}
            onChange={setSelCats}
          />
          <MultiDropdown
            label="Rol"
            placeholder="Todos"
            selected={selRoles}
            options={opRoles.map((r) => ({ value: r, label: r }))}
            onChange={setSelRoles}
          />
          <MultiDropdown
            label="Plataforma"
            placeholder="Todas"
            selected={selPlats}
            options={opPlats.map((p) => ({ value: p, label: p }))}
            onChange={setSelPlats}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === "Overview" && (
        <div>
          {/* ===== 1. GENERAL · Distribución de inversión ===== */}
          <SectionTitle>Inversión del período</SectionTitle>
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <KpiCard title="Inversión total" value={fmtARS(totalInv)} hint={totalHint} />
            <KpiCard title="Digital (ON)" value={fmtARS(invDigital)} hint={totalInv > 0 ? `${((invDigital / totalInv) * 100).toFixed(1)}% del total` : ""} />
            <KpiCard title="TV Cable" value={fmtARS(invTv)} hint={totalInv > 0 ? `${((invTv / totalInv) * 100).toFixed(1)}% del total` : ""} />
            <KpiCard title="DOOH" value={fmtARS(invDooh)} hint={totalInv > 0 ? `${((invDooh / totalInv) * 100).toFixed(1)}% del total` : ""} />
            <KpiCard title="OOH" value={fmtARS(invOoh)} hint={totalInv > 0 ? `${((invOoh / totalInv) * 100).toFixed(1)}% del total` : ""} />
          </section>

          <SectionTitle>Distribución de inversión</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Mix ON / OFF</h3>
              <InvestmentDonut data={mixData} />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Inversión ejecutada por medio</h3>
              <InvestmentDonut data={donutData} />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Inversión por categoría</h3>
              <InvestmentDonut data={catDonutData} />
            </div>
          </div>

          <SectionTitle>Evolución mensual · Inversión ON / OFF</SectionTitle>
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 text-[10px] text-muted-foreground">
              Año completo 2026 (no responde a los filtros). Barras apiladas por tipo de medio.
              Meses ejecutados usan el real de pauta_performance; meses futuros usan el plan de OMD
              (planning_media) en tonos más suaves. El % arriba de cada barra es el peso del mes sobre el total anual.
            </p>
            <MonthlyInvestmentChart data={inversionMensual} />
          </div>

          {/* ===== 2. DESEMPEÑO · volumen + impacto real ===== */}
          <SectionTitle>
            Desempeño {refMes ? `· ${refMes}` : ""}
            {prevMes && <span className="ml-1 font-normal normal-case text-muted-foreground/70">(vs {prevMes})</span>}
          </SectionTitle>
          {monthTotals.ref && (
            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MoMStat label="Alcance" value={fmtNum(monthTotals.ref.alc)} delta={monthTotals.prev ? pctDelta(monthTotals.ref.alc, monthTotals.prev.alc) : null} dir="up-good" />
              <MoMStat label="Impresiones" value={fmtNum(monthTotals.ref.impr)} delta={monthTotals.prev ? pctDelta(monthTotals.ref.impr, monthTotals.prev.impr) : null} dir="up-good" />
              <MoMStat label="Frecuencia" value={monthTotals.ref.frec.toFixed(1)} delta={monthTotals.prev ? pctDelta(monthTotals.ref.frec, monthTotals.prev.frec) : null} dir="neutral" sub="awareness" />
              <MoMStat label="Clicks" value={fmtNum(monthTotals.ref.clic)} delta={monthTotals.prev ? pctDelta(monthTotals.ref.clic, monthTotals.prev.clic) : null} dir="up-good" />
              <MoMStat label="Video Views" value={fmtNum(monthTotals.ref.view)} delta={monthTotals.prev ? pctDelta(monthTotals.ref.view, monthTotals.prev.view) : null} dir="up-good" />
            </section>
          )}

          {/* Impacto real (transversal): visibilidad efectiva del video */}
          {videoQuality.hasData && (
            <>
              <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">Impacto real · ¿se vio el mensaje? (video DV360 + Meta)</p>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">Vieron ≥50% del video</div>
                  <div className={`mt-0.5 text-lg font-bold tabular-nums ${videoQuality.pct50 >= 50 ? "text-emerald-600" : videoQuality.pct50 >= 30 ? "text-amber-600" : "text-rose-600"}`}>{videoQuality.pct50.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground/70">visibilidad real efectiva</div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">VTR real (vieron 100%)</div>
                  <div className={`mt-0.5 text-lg font-bold tabular-nums ${videoQuality.pct100 >= 30 ? "text-emerald-600" : videoQuality.pct100 >= 15 ? "text-amber-600" : "text-rose-600"}`}>{videoQuality.pct100.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground/70">completaron el mensaje</div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">CPCV (costo/view completo)</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums">{videoQuality.cpcv > 0 ? dvMoney(videoQuality.cpcv) : "—"}</div>
                  <div className="text-[10px] text-muted-foreground/70">{videoQuality.cpcv > 0 ? "costo real por mensaje visto" : "requiere fx_rates"}</div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">Impresiones desperdiciadas</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-rose-600">{(100 - videoQuality.pct50).toFixed(0)}%</div>
                  <div className="text-[10px] text-muted-foreground/70">{fmtNum(videoQuality.imprVideo - videoQuality.v50)} no llegaron al 50%</div>
                </div>
              </section>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">El detalle por medio/canal y el embudo de atención están en <strong>Por Medio</strong>.</p>
            </>
          )}

          <SectionTitle>Embudo de conversión del período</SectionTitle>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-col items-center gap-1.5">
              {funnelStages.map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-lg px-6 py-3.5 text-white" style={{ width: `${s.w}%`, backgroundColor: s.bg }}>
                  <span className="text-[11px] font-medium uppercase tracking-wide opacity-90">{s.label}{s.real && <span className="ml-1.5 rounded bg-white/20 px-1 py-0.5 text-[8px]">EFECTIVO</span>}</span>
                  <span className="text-xl font-bold">{fmtNum(s.value)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Los <strong>Video Views (general)</strong> cuentan reproducciones superficiales; el hito{" "}
              <span className="font-semibold text-green-700">Views completos reales (100%)</span> es el que el consumidor realmente vio
              hasta el final (cuartil 100% de DV360 + Meta). La caída entre ambos es video que se pagó pero no se vio.
            </p>
          </div>

          <SectionTitle>Evolución mensual · Alcance vs Impresiones</SectionTitle>
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 text-[10px] text-muted-foreground">Año completo 2026 (no responde a los filtros). Doble eje porque las escalas difieren mucho.</p>
            <ReachImpressionsChart data={volumetriaMensual} />
          </div>

          <SectionTitle>Aporte de cada medio al funnel</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-bold">Alcance por medio <span className="text-[10px] font-normal text-muted-foreground">(general)</span></h3>
              <p className="mb-2 text-[10px] text-muted-foreground">Usuarios únicos — incluye solapamiento entre medios.</p>
              <HBarChart data={reachData} color="#94a3b8" />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-bold">Impacto efectivo — <span className="text-green-700">views completos</span> por medio</h3>
              <p className="mb-2 text-[10px] text-muted-foreground">Videos vistos al 100% (cuartil real, DV360+Meta). Acá Meta/TikTok se ven chicos: muchas impresiones, pocos lo vieron entero.</p>
              {viewsRealData.length > 0 ? <HBarChart data={viewsRealData} color="#15803d" /> : <p className="text-xs text-muted-foreground">Sin datos de completion en la selección.</p>}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Clicks por medio <span className="text-[10px] font-normal text-muted-foreground">(acción real)</span></h3>
              <HBarChart data={clicksData} color="#c9a227" />
            </div>
          </div>

          {/* ===== 3. EFICIENCIA · costos + semáforos + alertas ===== */}
          <SectionTitle>
            Eficiencia {refMes ? `· ${refMes}` : ""}
            {prevMes && <span className="ml-1 font-normal normal-case text-muted-foreground/70">(vs {prevMes})</span>}
          </SectionTitle>
          {monthTotals.ref && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MoMStat label="CPM" value={fmtARS(monthTotals.ref.cpm)} delta={monthTotals.prev ? pctDelta(monthTotals.ref.cpm, monthTotals.prev.cpm) : null} dir="down-good" sub="menos es mejor" />
              <MoMStat label="CTR" value={`${monthTotals.ref.ctr.toFixed(2)}%`} delta={monthTotals.prev ? pctDelta(monthTotals.ref.ctr, monthTotals.prev.ctr) : null} dir="up-good" />
              <MoMStat label="CPC" value={fmtARS(monthTotals.ref.cpc)} delta={monthTotals.prev ? pctDelta(monthTotals.ref.cpc, monthTotals.prev.cpc) : null} dir="down-good" sub="menos es mejor" />
              <MoMStat label="CPCV (video)" value={videoQuality.cpcv > 0 ? dvMoney(videoQuality.cpcv) : "—"} delta={null} dir="down-good" sub="costo/view completo" />
            </section>
          )}

          <div className="mt-4 rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold">Qué mejorar</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {alertas.map((a, i) => (
                <Insight key={i} type={a.type} title={a.title} text={a.text} />
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/70">El detalle de eficiencia por medio (general + efectivo) está en el tab <strong>Por Medio</strong>.</p>
          </div>

          {insight && (
            <>
              <SectionTitle>Highlights de ejecución · {selCats[0]}</SectionTitle>
              <p className="mb-3 text-sm leading-relaxed text-foreground/90">{insight.conclusion}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {insight.positivos.map((p, i) => (
                  <Insight key={`p${i}`} type="good" title="✓ Positivo" text={p} />
                ))}
                {insight.alertas.map((a, i) => (
                  <Insight key={`a${i}`} type="warn" title="⚠ Alerta" text={a} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== POR MEDIO · arranca con el marco transversal de Calidad/Impacto ===== */}
      {tab === "Por Medio" && (
        <div>
          <SectionTitle>Calidad de video — ¿el consumidor realmente vio el mensaje?</SectionTitle>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Las impresiones no dicen si el video <strong>se vio</strong>. Acá medimos <strong>visibilidad real</strong> con los cuartiles
            (25/50/75/100%) de DV360 + Meta: cuánto de lo que pautamos se convirtió en atención efectiva, y el <strong>costo real</strong>{" "}
            por view completo (CPCV) — no el CPM sobre impresiones infladas.
          </p>

          {!videoQuality.hasData ? (
            <p className="text-xs text-muted-foreground">
              Sin cuartiles de video en la selección. Se completa con la sincronización de Meta (cuartiles) y el reporte de DV360.
            </p>
          ) : (
            <>
              {/* Scorecard de calidad */}
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">Impresiones de video</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums">{fmtNum(videoQuality.imprVideo)}</div>
                  <div className="text-[10px] text-muted-foreground/70">{videoQuality.pctVideoMix.toFixed(0)}% del total con formato conocido</div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">Vieron ≥50% del video</div>
                  <div className={`mt-0.5 text-lg font-bold tabular-nums ${videoQuality.pct50 >= 50 ? "text-emerald-600" : videoQuality.pct50 >= 30 ? "text-amber-600" : "text-rose-600"}`}>{videoQuality.pct50.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground/70">visibilidad real efectiva</div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">VTR real (vieron 100%)</div>
                  <div className={`mt-0.5 text-lg font-bold tabular-nums ${videoQuality.pct100 >= 30 ? "text-emerald-600" : videoQuality.pct100 >= 15 ? "text-amber-600" : "text-rose-600"}`}>{videoQuality.pct100.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground/70">completaron el mensaje</div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">CPCV (costo/view completo)</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums">{videoQuality.cpcv > 0 ? dvMoney(videoQuality.cpcv) : "—"}</div>
                  <div className="text-[10px] text-muted-foreground/70">{videoQuality.cpcv > 0 ? "costo real por mensaje visto" : "requiere fx_rates (DV360 en ARS)"}</div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-[11px] text-muted-foreground">Impresiones desperdiciadas</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-rose-600">{(100 - videoQuality.pct50).toFixed(0)}%</div>
                  <div className="text-[10px] text-muted-foreground/70">{fmtNum(videoQuality.imprVideo - videoQuality.v50)} no llegaron al 50%</div>
                </div>
              </section>

              {/* Embudo de atención SEPARADO por fuente (no mezclar lo comparable) */}
              <SectionTitle>Embudo de atención · separado por fuente</SectionTitle>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Cada fuente por separado para poder diagnosticarla: <strong>YouTube TrueView es skippable</strong> y no es comparable con
                video no-skippable (programmatic/Meta). El % es la retención sobre las impresiones de video de esa fuente; el salto de
                impresiones a <strong>vieron 25%</strong> es la caída de atención inicial (ahí se desperdicia la inversión).
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {videoSources.map((src) => {
                  const stages: Array<[string, number]> = [
                    ["Impresiones", src.impr], ["Vieron 25%", src.v25], ["Vieron 50%", src.v50], ["Vieron 75%", src.v75], ["Vieron 100%", src.v100],
                  ];
                  const vtr = src.impr > 0 ? (src.v100 / src.impr) * 100 : 0;
                  const cpcv = src.spend > 0 && src.v100 > 0 ? (src.spend / src.v100) * 1000 : 0;
                  return (
                    <div key={src.name} className="rounded-xl border bg-card p-4">
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="text-xs font-bold">{src.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          VTR <span className={`font-semibold ${vtr >= 30 ? "text-emerald-600" : vtr >= 15 ? "text-amber-600" : "text-rose-600"}`}>{vtr.toFixed(0)}%</span>
                          {cpcv > 0 && <> · CPCV {dvMoney(cpcv)}</>}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {stages.map(([label, n], i) => {
                          const pct = src.impr > 0 ? (n / src.impr) * 100 : 0;
                          return (
                            <div key={label} className="flex items-center gap-2">
                              <div className="w-24 shrink-0 text-[10px] text-foreground/70">{label}</div>
                              <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                                <div className="flex h-full items-center rounded px-1.5 text-[9px] font-semibold text-white" style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: i === 0 ? "#0a1849" : i === 4 ? "#2b4dff" : "#1e3a8a" }}>{fmtNum(n)}</div>
                              </div>
                              <div className="w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums">{pct.toFixed(0)}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mb-3 mt-2 text-[10px] text-muted-foreground/70">
                YouTube TrueView es <strong>skippable</strong>: su completion no es comparable con video no-skippable (programmatic/Meta).
                Viewability real (impresiones MRC ≥50% en pantalla) no está en el reporte actual; usamos completion de video como proxy de
                visibilidad efectiva.
              </p>

              {/* Mix de formato */}
              {videoQuality.imprDisplay > 0 && (
                <>
                  <SectionTitle>Mix de formato (DV360)</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-[11px] text-muted-foreground">Video</div>
                      <div className="text-lg font-bold tabular-nums">{fmtNum(dv360VideoQ.imprVideo)} <span className="text-xs font-normal text-muted-foreground">impr.</span></div>
                      <div className="text-[10px] text-muted-foreground/70">{arsMode ? dvMoney(dv360VideoQ.revenueVideo) : ""} · se mide por completion</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-[11px] text-muted-foreground">Display / imagen</div>
                      <div className="text-lg font-bold tabular-nums">{fmtNum(dv360VideoQ.imprDisplay)} <span className="text-xs font-normal text-muted-foreground">impr.</span></div>
                      <div className="text-[10px] text-muted-foreground/70">{arsMode ? dvMoney(dv360VideoQ.revenueDisplay) : ""} · se evalúa por CTR/viewability</div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== POR MEDIO ===== */}
      {tab === "Por Medio" && (
        <div>
          <SectionTitle>Tabla maestra por medio · general + efectivo (todo junto)</SectionTitle>
          <p className="mb-3 text-[10px] text-muted-foreground">
            <strong>Fuente: procesos automáticos de DV360 + Meta API</strong> (responde a los filtros de arriba). Solo medios digitales con
            performance medida (DV360 = plataforma; el medio es el canal). Volumen + impacto real, todo junto:{" "}
            <strong>Impresiones ↔ VTR</strong> (% que completó el video) · <strong>CPM ↔ CPM efectivo</strong> (costo por view completo).
            El semáforo vive solo en lo efectivo (CPM efectivo, CTR, VTR vs el mejor medio). Un CPM barato con VTR bajo no es barato de verdad.
          </p>
          <div className="mb-3 overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Medio</th>
                  <th className="px-3 py-2 text-right">Inversión</th>
                  <th className="px-3 py-2 text-right font-normal">Impres. <span className="normal-case opacity-60">(gral)</span></th>
                  <th className="px-3 py-2 text-right">Alcance</th>
                  <th className="px-3 py-2 text-right">Frec.</th>
                  <th className="px-3 py-2 text-right">VTR real</th>
                  <th className="px-3 py-2 text-right font-normal">CPM <span className="normal-case opacity-60">(gral)</span></th>
                  <th className="px-3 py-2 text-right">CPM efectivo</th>
                  <th className="px-3 py-2 text-right">CPC</th>
                  <th className="px-3 py-2 text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {medioModel.items.map((p) => {
                  const cpc = p.clics > 0 ? p.inversion / p.clics : 0;
                  const frec = p.alcance > 0 ? p.impresiones / p.alcance : 0;
                  return (
                  <tr key={p.medio} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: MEDIO_COLORS[p.medio] ?? "#94a3b8" }} />
                      {p.medio}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtARS(p.inversion)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(p.impresiones)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.alcance > 0 ? fmtNum(p.alcance) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{frec > 0 ? frec.toFixed(1) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${p.isDigital && p.vtr > 0 ? bicColor(p.vtr, medioModel.bestVtr, "higher") : "text-muted-foreground"}`}>{p.vtr > 0 ? `${p.vtr.toFixed(0)}%` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.cpm > 0 ? fmtARS(p.cpm) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${p.isDigital && p.cpmEf > 0 ? bicColor(p.cpmEf, medioModel.bestCpmEf, "lower") : "text-muted-foreground"}`}>{p.cpmEf > 0 ? fmtARS(p.cpmEf) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{cpc > 0 ? fmtARS(cpc) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${p.isDigital && p.ctr > 0 ? bicColor(p.ctr, medioModel.bestCtr, "higher") : "text-muted-foreground"}`}>{p.ctr > 0 ? `${p.ctr.toFixed(2)}%` : "—"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <SectionTitle>Detalle por categoría y rol</SectionTitle>
          {catModel.items.length === 0 ? (
            <p className="mb-3 text-[10px] text-muted-foreground">Sin datos automáticos (DV360 + Meta) en la selección.</p>
          ) : (
            <>
              <div className="space-y-3">
                <DimTable titulo="Por categoría" col1="Categoría" model={catModel} money={dvMoney} />
                <DimTable titulo="Por rol de comunicación" col1="Rol" model={rolModel} money={dvMoney} />
              </div>
              <p className="mb-3 mt-1 text-[10px] text-muted-foreground/70">
                Misma estructura que la tabla maestra (general + efectivo). Fuente: DV360 + Meta automáticos. Categoría/rol se derivan del
                Line Item (DV360) y del tipo de compra (Meta/TikTok). Alcance es aproximado (solapamiento + reach por canal no disponible por
                categoría en DV360).
              </p>
              {dv360Pieces.length > 0 && (
                <>
                  <SectionTitle>Piezas pautadas · Programmatic + Marketplace</SectionTitle>
                  <p className="mb-3 text-[10px] text-muted-foreground">
                    Top piezas por inversión. <strong>YouTube no se incluye</strong>: DV360 no expone el creative (figura como
                    &quot;Unknown&quot;). Sin imagen porque el reporte de métricas no trae el archivo del creative.
                  </p>
                  <div className="mb-3 overflow-x-auto rounded-lg border bg-card">
                    <table className="w-full text-xs">
                      <thead className="border-b">
                        <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2">Pieza</th>
                          <th className="px-3 py-2">Canal</th>
                          <th className="px-3 py-2">Categoría</th>
                          <th className="px-3 py-2">Rol</th>
                          <th className="px-3 py-2 text-right">Costo {monedaLbl}</th>
                          <th className="px-3 py-2 text-right">Impresiones</th>
                          <th className="px-3 py-2 text-right">Clicks</th>
                          <th className="px-3 py-2 text-right">CTR</th>
                          <th className="px-3 py-2 text-right">CPM</th>
                          <th className="px-3 py-2 text-right">VTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dv360Pieces.map((p) => (
                          <tr key={`${p.canal}-${p.categoria}-${p.rol}-${p.creative}`} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{p.creative}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.canal}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.categoria}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.rol}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{dvMoney(p.revenueUsd)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.impresiones)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.clicks)}</td>
                            <td className={`px-3 py-2 text-right font-semibold tabular-nums ${bicColor(p.ctr, dvPieceBest.ctr, "higher")}`}>{p.ctr.toFixed(2)}%</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{dvMoney(p.cpm)}</td>
                            <td className={`px-3 py-2 text-right font-semibold tabular-nums ${p.vtr > 0 ? bicColor(p.vtr, dvPieceBest.vtr, "higher") : "text-muted-foreground"}`}>{p.vtr > 0 ? `${p.vtr.toFixed(0)}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          <SectionTitle>Piezas pautadas · Meta (IG + FB)</SectionTitle>
          <p className="mb-3 text-[10px] text-muted-foreground">
            Ordenadas por inversión del mes. Filtra por mes, categoría y rol (Awareness/Consideración).
          </p>
          <MetaPaidGrid
            data={metaPaid.filter((r) => r.plataforma === "meta")}
            selMeses={selMeses}
            selCats={selCats}
            selRoles={selRoles}
          />

          <SectionTitle>Piezas pautadas · TikTok</SectionTitle>
          <p className="mb-3 text-[10px] text-muted-foreground">
            Ordenadas por inversión del mes. Filtra por mes, categoría y rol (Awareness/Consideración).
          </p>
          <MetaPaidGrid
            data={metaPaid.filter((r) => r.plataforma === "tiktok")}
            selMeses={selMeses}
            selCats={selCats}
            selRoles={selRoles}
          />

          <SectionTitle>Piezas pautadas · Programmatic</SectionTitle>
          <p className="mb-3 text-[10px] text-muted-foreground">
            Display + video CTV. Trae alcance y frecuencia. Ordenadas por inversión del mes.
          </p>
          <MetaPaidGrid
            data={metaPaid.filter((r) => r.plataforma === "programmatic")}
            selMeses={selMeses}
            selCats={selCats}
            selRoles={selRoles}
          />

          <SectionTitle>Piezas pautadas · YouTube</SectionTitle>
          <p className="mb-3 text-[10px] text-muted-foreground">
            TrueView (CPV), Bumper (CPM) y Demand Gen (CPC). El export de Looker no trae inversión por anuncio.
          </p>
          <MetaPaidGrid
            data={metaPaid.filter((r) => r.plataforma === "youtube")}
            selMeses={selMeses}
            selCats={selCats}
            selRoles={selRoles}
          />
        </div>
      )}

      {/* ===== INSIGHTS PAUTA ===== */}
      {tab === "Insights Pauta" && (
        <div>
          <SectionTitle>Insights Pauta — mix óptimo de inversión</SectionTitle>
          <p className="mb-3 text-xs text-muted-foreground">
            Análisis sobre las filas filtradas. Detecta medios sobre/sub-eficientes y recomienda reasignaciones para
            maximizar alcance, impresiones y clics por peso invertido.
          </p>
          {(() => {
            const vids = videoByMedio.filter((v) => v.views > 0 && v.impresiones > 0);
            if (vids.length === 0) return null;
            const worst = [...vids].sort((a, b) => a.vtr - b.vtr)[0]!;
            const ratio = worst.cpm > 0 ? worst.cpmEfectivo / worst.cpm : 0;
            return (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <strong>⚠️ Efectividad de video:</strong> el peor VTR es <strong>{worst.medio}</strong> ({worst.vtr.toFixed(1)}% de las
                impresiones se convierten en views). Su <strong>CPM efectivo</strong> ({fmtARS(worst.cpmEfectivo)}) es{" "}
                {ratio > 0 ? <strong>{ratio.toFixed(1)}×</strong> : "—"} el CPM nominal ({fmtARS(worst.cpm)}): muchas impresiones de
                video no son efectivas, así que el costo real por usuario que ve el video es mucho más alto de lo que parece.
                Para sumar los cuartiles de visibilidad (25/50/75%) hay que automatizar los reportes de Meta Business / DV360.
              </div>
            );
          })()}
          {(() => {
            const { efficiency, insights, benchmarks } = computePautaInsights(rows);
            return <PautaInsightsPanel efficiency={efficiency} insights={insights} benchmarks={benchmarks} />;
          })()}
        </div>
      )}
    </div>
  );
}
