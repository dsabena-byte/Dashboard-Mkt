"use client";

import { useMemo, useState } from "react";
import {
  type PautaRow,
  PAUTA_INSIGHTS,
  MEDIO_COLORS,
  computeFunnel,
  computeByMedio,
  computeVideoByMedio,
  reachByMedio,
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
  aggregateDv360Channels,
  aggregateDv360Pieces,
  aggregateDv360By,
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

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <KpiCard title={label} value={value} hint={sub} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-6 text-sm font-medium text-muted-foreground">{children}</div>;
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

  const upper = useMemo(() => computeFunnel(rows, "upper"), [rows]);
  const mid = useMemo(() => computeFunnel(rows, "mid"), [rows]);
  const byMedio = useMemo(() => computeByMedio(rows), [rows]);
  const videoByMedio = useMemo(() => computeVideoByMedio(rows), [rows]);
  // Embudo de visibilidad real de video (Meta Marketing API): cuántas impresiones
  // llegan a cada % del video. Solo Meta (el cron meta-paid-sync trae los cuartiles).
  const metaVideoFunnel = useMemo(() => {
    const vids = metaPaid.filter((r) => r.plataforma === "meta" && (r.video_plays ?? 0) > 0);
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
  }, [metaPaid]);
  // DV360: si hay cotización (fx_rates) mostramos en pesos (BCRA prom. mensual),
  // convirtiendo el costo USD por el rate del mes de cada fila. Si no, en USD.
  const arsMode = Object.keys(fxRates).length > 0;
  const fxVals = Object.values(fxRates);
  const fxFallback = fxVals.length ? fxVals[fxVals.length - 1]! : 1;
  const dvMoney = arsMode ? fmtARS : fmtUSD;
  const monedaLbl = arsMode ? "ARS" : "USD";
  const dv360Conv = useMemo(
    () => (arsMode ? dv360.map((r) => ({ ...r, revenue_usd: r.revenue_usd * (fxRates[r.mes] ?? fxFallback) })) : dv360),
    [dv360, fxRates, arsMode, fxFallback],
  );
  const dv360Channels = useMemo(() => aggregateDv360Channels(dv360Conv, dv360Reach), [dv360Conv, dv360Reach]);
  const dv360Funnels = useMemo(() => aggregateDv360Funnels(dv360Conv), [dv360Conv]);
  const dv360Pieces = useMemo(() => aggregateDv360Pieces(dv360Conv), [dv360Conv]);
  const dv360ByCategoria = useMemo(() => aggregateDv360By(dv360Conv, "categoria"), [dv360Conv]);
  const dv360ByRol = useMemo(() => aggregateDv360By(dv360Conv, "rol"), [dv360Conv]);
  const reach = useMemo(() => reachByMedio(rows), [rows]);

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
  const sumReach = upper.alcance;
  const totalViews = useMemo(() => rows.reduce((s, r) => s + (r.views ?? 0), 0), [rows]);

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
  const reachData = reach.map((r) => ({ name: r.medio, value: r.alcance }));

  const funnelStages = [
    { label: "Impresiones", value: upper.impresiones, w: 100, bg: "#0a1849" },
    { label: "Alcance (suma medios)", value: sumReach, w: 82, bg: "#142b6f" },
    { label: "Video Views", value: totalViews, w: 64, bg: "#1e3a8a" },
    { label: "Clicks", value: mid.clics, w: 46, bg: "#2b4dff" },
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
          {/* Inversión: total + desglose ON / OFF */}
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <KpiCard title="Inversión total" value={fmtARS(totalInv)} hint={totalHint} />
            <KpiCard
              title="Digital (ON)"
              value={fmtARS(invDigital)}
              hint={totalInv > 0 ? `${((invDigital / totalInv) * 100).toFixed(1)}% del total` : ""}
            />
            <KpiCard
              title="TV Cable"
              value={fmtARS(invTv)}
              hint={totalInv > 0 ? `${((invTv / totalInv) * 100).toFixed(1)}% del total` : ""}
            />
            <KpiCard
              title="DOOH"
              value={fmtARS(invDooh)}
              hint={totalInv > 0 ? `${((invDooh / totalInv) * 100).toFixed(1)}% del total` : ""}
            />
            <KpiCard
              title="OOH"
              value={fmtARS(invOoh)}
              hint={totalInv > 0 ? `${((invOoh / totalInv) * 100).toFixed(1)}% del total` : ""}
            />
          </section>

          {/* Distribución de inversión: Mix ON/OFF + por medio + por categoría */}
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
              (tabla planning_media) y van en tonos más suaves. El % arriba de cada barra es el peso
              del mes sobre el total anual.
            </p>
            <MonthlyInvestmentChart data={inversionMensual} />
          </div>

          <SectionTitle>Desempeño por etapa del funnel</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4" style={{ borderTopWidth: 4, borderTopColor: "#2b4dff" }}>
              <h3 className="mb-3 text-sm font-bold">🎯 Upper Funnel — Awareness</h3>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Alcance (suma)" value={fmtNum(sumReach)} />
                <Kpi label="Impresiones" value={fmtNum(upper.impresiones)} />
                <Kpi label="Frecuencia" value={upper.frecuenciaPond.toFixed(2)} />
                <Kpi label="CPM prom." value={fmtARS(upper.cpm)} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4" style={{ borderTopWidth: 4, borderTopColor: "#c9a227" }}>
              <h3 className="mb-3 text-sm font-bold">🔥 Mid Funnel — Consideración</h3>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Clicks" value={fmtNum(mid.clics)} />
                <Kpi label="Video Views" value={fmtNum(totalViews)} />
                <Kpi label="CTR" value={`${mid.ctr.toFixed(2)}%`} />
                <Kpi label="CPC" value={fmtARS(mid.cpc)} />
              </div>
            </div>
          </div>

          <SectionTitle>Evolución mensual · Alcance vs Impresiones</SectionTitle>
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 text-[10px] text-muted-foreground">
              Año completo 2026 (no responde a los filtros). Doble eje porque las escalas difieren mucho.
            </p>
            <ReachImpressionsChart data={volumetriaMensual} />
          </div>

          <SectionTitle>Embudo de conversión del período</SectionTitle>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-col items-center gap-1.5">
              {funnelStages.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg px-6 py-3.5 text-white"
                  style={{ width: `${s.w}%`, backgroundColor: s.bg }}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide opacity-90">{s.label}</span>
                  <span className="text-xl font-bold">{fmtNum(s.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <SectionTitle>Aporte de cada medio al funnel</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-bold">Upper Funnel — Alcance por plataforma</h3>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Alcance sumado por plataforma — incluye solapamiento entre medios (la misma persona puede estar en varios).
              </p>
              <HBarChart data={reachData} color="#2b4dff" />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Mid Funnel — Clicks por plataforma</h3>
              <HBarChart
                data={byMedio.filter((m) => m.clics > 0).map((m) => ({ name: m.medio, value: m.clics })).sort((a, b) => b.value - a.value)}
                color="#c9a227"
              />
            </div>
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

      {/* ===== POR MEDIO ===== */}
      {tab === "Por Medio" && (
        <div>
          <SectionTitle>Desglose por plataforma</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byMedio.map((p) => (
              <div key={p.medio} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MEDIO_COLORS[p.medio] ?? "#94a3b8" }} />
                  <span className="text-xs font-semibold">{p.medio}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Inversión</div><div className="font-semibold">{fmtARS(p.inversion)}</div></div>
                  <div><div className="text-muted-foreground">CPM</div><div className="font-semibold">{fmtARS(p.cpm)}</div></div>
                  <div><div className="text-muted-foreground">Impresiones</div><div className="font-semibold">{fmtNum(p.impresiones)}</div></div>
                  <div><div className="text-muted-foreground">Alcance</div><div className="font-semibold">{p.alcance > 0 ? fmtNum(p.alcance) : "—"}</div></div>
                </div>
              </div>
            ))}
          </div>

          <SectionTitle>Efectividad real de video — impresiones vs views</SectionTitle>
          <p className="mb-3 text-[10px] text-muted-foreground">
            Cuando la pauta es video, muchas impresiones <strong>no se convierten en views</strong>. El <strong>VTR</strong>{" "}
            (views/impresiones) y el <strong>CPM efectivo</strong> (costo por mil sobre views reales) muestran el costo real:
            si el CPM efectivo es mucho mayor al CPM nominal, esas impresiones no son efectivas.
          </p>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Medio (video)</th>
                  <th className="px-3 py-2 text-right">Inversión</th>
                  <th className="px-3 py-2 text-right">Impresiones</th>
                  <th className="px-3 py-2 text-right">Views</th>
                  <th className="px-3 py-2 text-right">VTR</th>
                  <th className="px-3 py-2 text-right">CPM</th>
                  <th className="px-3 py-2 text-right">CPM efectivo</th>
                  <th className="px-3 py-2 text-right">CPV</th>
                </tr>
              </thead>
              <tbody>
                {videoByMedio.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sin pauta de video en la selección.</td></tr>
                ) : (
                  videoByMedio.map((m) => {
                    const ratio = m.cpm > 0 ? m.cpmEfectivo / m.cpm : 0;
                    const vtrColor = m.vtr < 20 ? "text-rose-600" : m.vtr < 50 ? "text-amber-600" : "text-emerald-600";
                    return (
                      <tr key={m.medio} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: MEDIO_COLORS[m.medio] ?? "#94a3b8" }} />
                          {m.medio}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtARS(m.inversion)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(m.impresiones)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.views)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${vtrColor}`}>{m.vtr.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtARS(m.cpm)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {fmtARS(m.cpmEfectivo)}
                          {ratio > 1.2 && <span className="ml-1 text-[9px] text-rose-600">{ratio.toFixed(1)}×</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{m.cpv > 0 ? fmtARS(m.cpv) : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mb-3 mt-2 text-[10px] text-muted-foreground/70">
            VTR ≈ views/impresiones (&quot;views&quot; según definición de cada plataforma). Para la <strong>visibilidad real por
            cuartil</strong>, ver los paneles de Meta y DV360 más abajo.
          </p>

          <SectionTitle>Visibilidad real de video · Meta</SectionTitle>
          {metaVideoFunnel.count === 0 ? (
            <p className="mb-3 text-[10px] text-muted-foreground">
              Se completa automáticamente con la próxima sincronización de Meta (el cron <code>meta-paid-sync</code> ahora trae los
              cuartiles de video: 25/50/75/100% y ThruPlay desde la Marketing API).
            </p>
          ) : (
            <>
              <p className="mb-3 text-[10px] text-muted-foreground">
                Datos reales de Meta (Marketing API): cuántas impresiones llegan a cada % del video y el <strong>CPM efectivo</strong>{" "}
                (costo por mil) en cada hito. {metaVideoFunnel.count} anuncios de video. Muestra cómo cae la audiencia efectiva y por qué
                el costo real sube a medida que se exige más completion.
              </p>
              <div className="mb-3 overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Hito</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">% de impresiones</th>
                      <th className="px-3 py-2 text-right">CPM efectivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["Impresiones", metaVideoFunnel.impresiones],
                      ["Reproducciones (plays)", metaVideoFunnel.plays],
                      ["Vieron 25%", metaVideoFunnel.p25],
                      ["Vieron 50%", metaVideoFunnel.p50],
                      ["Vieron 75%", metaVideoFunnel.p75],
                      ["Vieron 100%", metaVideoFunnel.p100],
                      ["ThruPlay (≥15s)", metaVideoFunnel.thruplay],
                    ] as Array<[string, number]>).map(([label, n]) => {
                      const pct = metaVideoFunnel.impresiones > 0 ? (n / metaVideoFunnel.impresiones) * 100 : 0;
                      const cpmEf = n > 0 ? (metaVideoFunnel.spend / n) * 1000 : 0;
                      const dim = label === "Impresiones";
                      return (
                        <tr key={label} className="border-b last:border-0">
                          <td className={`px-3 py-2 ${dim ? "text-muted-foreground" : "font-medium"}`}>{label}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(n)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{n > 0 ? fmtARS(cpmEf) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <SectionTitle>DV360 · inversión y performance por canal</SectionTitle>
          {dv360Channels.canales.length === 0 ? (
            <p className="mb-3 text-[10px] text-muted-foreground">
              Se completa con el reporte de DV360. Costo en USD (sin comisión de agencia ni impuestos). No incluye Google Search (vive
              en Google Ads, no en DV360).
            </p>
          ) : (
            <>
              <p className="mb-3 text-[10px] text-muted-foreground">
                Toda la pauta de DV360 (YouTube, Programmatic, Marketplace, Demand Gen).{" "}
                <strong>Costo en {arsMode ? "ARS (BCRA prom. mensual)" : "USD"}</strong>; CPM/CPC/CTR calculados.{" "}
                <strong>Alcance</strong> = usuarios únicos (Unique Reach); a nivel canal es una suma aproximada (hay
                solapamiento de usuarios entre líneas). <strong>Frec.</strong> = impresiones / alcance.
              </p>
              <div className="mb-3 overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Canal</th>
                      <th className="px-3 py-2 text-right">Costo {monedaLbl}</th>
                      <th className="px-3 py-2 text-right">Impresiones</th>
                      <th className="px-3 py-2 text-right">Alcance</th>
                      <th className="px-3 py-2 text-right">Frec.</th>
                      <th className="px-3 py-2 text-right">Clicks</th>
                      <th className="px-3 py-2 text-right">CPM</th>
                      <th className="px-3 py-2 text-right">CPC</th>
                      <th className="px-3 py-2 text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dv360Channels.canales.map((c) => (
                      <tr key={c.canal} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{c.canal}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{dvMoney(c.revenueUsd)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.impresiones)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.reach > 0 ? fmtNum(c.reach) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.frequency > 0 ? c.frequency.toFixed(1) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.clicks)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{dvMoney(c.cpm)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.cpc > 0 ? dvMoney(c.cpc) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.ctr.toFixed(2)}%</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">{dvMoney(dv360Channels.total.revenueUsd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(dv360Channels.total.impresiones)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{dv360Channels.total.reach > 0 ? fmtNum(dv360Channels.total.reach) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{dv360Channels.total.frequency > 0 ? dv360Channels.total.frequency.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(dv360Channels.total.clicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{dvMoney(dv360Channels.total.cpm)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{dv360Channels.total.cpc > 0 ? dvMoney(dv360Channels.total.cpc) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{dv360Channels.total.ctr.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <div className="border-b px-3 py-2 text-xs font-semibold">Por categoría</div>
                  <table className="w-full text-xs">
                    <thead className="border-b">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Categoría</th>
                        <th className="px-3 py-2 text-right">Costo {monedaLbl}</th>
                        <th className="px-3 py-2 text-right">Impr.</th>
                        <th className="px-3 py-2 text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dv360ByCategoria.map((b) => (
                        <tr key={b.nombre} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{b.nombre}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{dvMoney(b.revenueUsd)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(b.impresiones)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{b.ctr.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <div className="border-b px-3 py-2 text-xs font-semibold">Por rol de comunicación</div>
                  <table className="w-full text-xs">
                    <thead className="border-b">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Rol</th>
                        <th className="px-3 py-2 text-right">Costo {monedaLbl}</th>
                        <th className="px-3 py-2 text-right">Impr.</th>
                        <th className="px-3 py-2 text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dv360ByRol.map((b) => (
                        <tr key={b.nombre} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{b.nombre}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{dvMoney(b.revenueUsd)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(b.impresiones)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{b.ctr.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="mb-3 mt-1 text-[10px] text-muted-foreground/70">
                Categoría y rol (Awareness/Consideración) se derivan del nombre del Line Item. Incluye YouTube.
              </p>
              {dv360Pieces.length > 0 && (
                <>
                  <SectionTitle>Piezas pautadas · DV360 (Programmatic + Marketplace)</SectionTitle>
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
                            <td className="px-3 py-2 text-right tabular-nums">{p.ctr.toFixed(2)}%</td>
                            <td className="px-3 py-2 text-right tabular-nums">{dvMoney(p.cpm)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{p.vtr > 0 ? `${p.vtr.toFixed(0)}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          <SectionTitle>Visibilidad real de video · DV360</SectionTitle>
          {dv360Funnels.length === 0 ? (
            <p className="mb-3 text-[10px] text-muted-foreground">
              Se completa con el reporte de DV360. Costo en USD, sin comisión de agencia ni impuestos.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[10px] text-muted-foreground">
                Embudo real de DV360 separado por canal, porque <strong>TrueView (YouTube) es skippable</strong> y su
                &quot;completion&quot; no es comparable con el video programmático. <strong>CPM efectivo en {monedaLbl}</strong> por hito.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {dv360Funnels.map((f) => {
                  const rows: Array<[string, number]> = [
                    ["Impresiones", f.impresiones],
                    ["Reproducciones (starts)", f.starts],
                    ["Vieron 25%", f.q25],
                    ["Vieron 50%", f.q50],
                    ["Vieron 75%", f.q75],
                    ["Vieron 100%", f.q100],
                  ];
                  return (
                    <div key={f.canal} className="overflow-x-auto rounded-lg border bg-card">
                      <div className="border-b px-3 py-2 text-xs font-semibold">
                        {f.canal}
                        <span className="ml-2 font-normal text-muted-foreground">· {dvMoney(f.revenueUsd)}</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="border-b">
                          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2">Hito</th>
                            <th className="px-3 py-2 text-right">Cantidad</th>
                            <th className="px-3 py-2 text-right">% impr.</th>
                            <th className="px-3 py-2 text-right">CPM ef. {monedaLbl}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(([label, n]) => {
                            const pct = f.impresiones > 0 ? (n / f.impresiones) * 100 : 0;
                            const cpmEf = n > 0 ? (f.revenueUsd / n) * 1000 : 0;
                            const dim = label === "Impresiones";
                            return (
                              <tr key={label} className="border-b last:border-0">
                                <td className={`px-3 py-2 ${dim ? "text-muted-foreground" : "font-medium"}`}>{label}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(n)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold">{n > 0 ? dvMoney(cpmEf) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
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
