"use client";

import { useMemo, useState } from "react";
import {
  type PautaRow,
  PAUTA_INSIGHTS,
  MEDIO_COLORS,
  computeFunnel,
  computeByMedio,
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
import { formatCurrency, formatNumber } from "@/lib/utils";

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

export function PerformanceClient({ data, metaPaid = [], planningMonthly = {} }: { data: PautaRow[]; metaPaid?: MetaPaidCreativeRow[]; planningMonthly?: Record<string, { digital: number; tvCable: number; dooh: number; ooh: number }> }) {
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

  // Inversión mensual ON/OFF (año completo, sin filtros).
  // Pasados: ejecutado de pauta_performance. Futuros: planificado de planning_media.
  // Se marca isPlanned=true para que el chart use tonos grises en esos meses.
  // mes_pct = % del total anual (ejecutado + plan) que representa ese mes.
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
      const future = i + 1 > lastMonthWithData;
      if (future) {
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
  }, [data, lastMonthWithData, planningMonthly]);

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
            const { efficiency, insights, benchmarks } = computePautaInsights(rows);
            return <PautaInsightsPanel efficiency={efficiency} insights={insights} benchmarks={benchmarks} />;
          })()}
        </div>
      )}
    </div>
  );
}
