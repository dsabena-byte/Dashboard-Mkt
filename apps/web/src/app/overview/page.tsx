import {
  getBgtData,
  sumVersion,
  hasVersion,
  MESES_UP,
} from "@/lib/bgt-queries";
import { getFacturacionMensual, sumFacturacion } from "@/lib/facturacion-queries";
import {
  getFloorShareU4M,
  FS_CAT_LABEL,
  type FsCatKey,
  type FsCatU4M,
} from "@/lib/floor-share-queries";
import { getCbU3M, type CbMetricU3M } from "@/lib/cb-queries";
import { getDreanSerie, type DreanMesSeg } from "@/lib/salud-marca-queries";
import { computeDreanConsolidado, SM_DIMS, type SMRow, type SMState } from "@/lib/salud-marca-model";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const YEAR = 2026;
const REAL_VERSION = `REAL ${YEAR}`;

// Umbrales del Objetivo 1
const MAX_DESVIO = 5; // % — desvío Real vs BGT vigente
const MAX_INV_FACT = 1.3; // % — Inversión Mkt real / Facturación
const invFactLabel = MAX_INV_FACT.toString().replace(".", ","); // "1,3"

// Cuatrimestres 2026 y la versión de BGT "vigente" que se compara en cada uno.
interface Cuatri {
  id: "T1" | "T2" | "T3";
  label: string;
  months: number[]; // 1-12
  bgtVersion: string;
  bgtLabel: string;
}
const CUATRIS: Cuatri[] = [
  { id: "T1", label: "Ene–Abr", months: [1, 2, 3, 4], bgtVersion: `BGT ${YEAR}`, bgtLabel: "BGT" },
  { id: "T2", label: "May–Ago", months: [5, 6, 7, 8], bgtVersion: `4+8 ${YEAR}`, bgtLabel: "BGT 4+8" },
  { id: "T3", label: "Sep–Dic", months: [9, 10, 11, 12], bgtVersion: `8+4 ${YEAR}`, bgtLabel: "BGT 8+4" },
];

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

// Floor Share con error explícito (para distinguir "error" de "sin datos").
async function tryFloorShare(): Promise<{ data: Awaited<ReturnType<typeof getFloorShareU4M>>; error: string | null }> {
  try {
    return { data: await getFloorShareU4M(), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function tryCb(): Promise<{ data: Awaited<ReturnType<typeof getCbU3M>>; error: string | null }> {
  try {
    return { data: await getCbU3M(), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

const MES_CAP = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function coverageLabel(months: number[]): string {
  if (months.length === 0) return "";
  if (months.length === 1) return MES_CAP[months[0]! - 1]!;
  return `${MES_CAP[months[0]! - 1]}–${MES_CAP[months[months.length - 1]! - 1]}`;
}

function mesesUpFor(months: number[]): string[] {
  return months.map((m) => MESES_UP[m - 1]!);
}
function mesesYmFor(months: number[]): string[] {
  return months.map((m) => `${YEAR}-${String(m).padStart(2, "0")}-01`);
}

function fmtUSD(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}US$ ${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}US$ ${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}US$ ${(a / 1e3).toFixed(0)}K`;
  return `${sign}US$ ${Math.round(a)}`;
}
function fmtPct(n: number, signed = true, decimals = 1): string {
  return `${signed && n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

type Estado = "cerrado" | "en curso" | "futuro";
function estadoFor(months: number[], curYear: number, curMonth: number): Estado {
  if (curYear > YEAR) return "cerrado";
  if (curYear < YEAR) return "futuro";
  const last = Math.max(...months);
  const first = Math.min(...months);
  if (curMonth > last) return "cerrado";
  if (curMonth < first) return "futuro";
  return "en curso";
}

function StatusBadge({ kind, children }: { kind: "ok" | "bad" | "neutral"; children: React.ReactNode }) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : kind === "bad"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-muted text-muted-foreground border-transparent";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

// KPI con el lenguaje visual común: rótulo + badge de estado, valor grande
// coloreado y línea de objetivo. Reutilizado por los KPIs del Objetivo 1.
function KpiBig({
  label,
  value,
  status,
  showBadge,
  objetivo,
}: {
  label: string;
  value: string;
  status: "ok" | "bad" | "neutral";
  showBadge: boolean;
  objetivo: React.ReactNode;
}) {
  const color = status === "ok" ? "text-emerald-600" : status === "bad" ? "text-rose-500" : "text-foreground";
  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {showBadge && status !== "neutral" && (
          <StatusBadge kind={status}>{status === "ok" ? "cumple" : "no cumple"}</StatusBadge>
        )}
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
        <span className="text-[11px] text-muted-foreground">{objetivo}</span>
      </div>
    </div>
  );
}

// Card de progreso reutilizable (Floor Share U4M, CB U3M): resultado promedio
// grande + badge, objetivo, último mes, proyección y trayectoria mensual.
interface ProgressMetric {
  label: string;
  target: number;
  avg: number;
  latest: number | null;
  projection: number | null;
  meets: boolean;
  months: { mes: string; pct: number }[];
  avgLabel: string; // "Promedio U4M" / "Promedio U3M"
  info?: boolean;   // true = indicador de referencia (sin scoring de meta)
}

function ProgressCard({ m }: { m: ProgressMetric }) {
  const hasData = m.months.length > 0;
  const delta = m.avg - m.target;
  const lastMes = hasData ? m.months[m.months.length - 1]!.mes : null;
  const projOnTrack = m.projection != null && m.projection >= m.target;
  const valueColor = m.info ? "text-foreground" : m.meets ? "text-emerald-600" : "text-rose-500";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-base font-semibold tracking-tight">{m.label}</div>
        {m.info ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">info</span>
        ) : (
          <span className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground/80">Meta {m.target}%</span>
        )}
      </div>

      {!hasData ? (
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Sin datos en la ventana.</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums ${valueColor}`}>
              {m.avg.toFixed(1)}%
            </span>
            {!m.info && (
              <StatusBadge kind={m.meets ? "ok" : "bad"}>{m.meets ? "cumple" : "no cumple"}</StatusBadge>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {m.avgLabel}
            {m.info ? "" : <> · {delta >= 0 ? "+" : ""}{delta.toFixed(1)} pp vs objetivo</>}
          </div>

          <dl className="mt-3 space-y-1.5 border-t pt-2.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Último mes{lastMes ? ` (${lastMes})` : ""}</dt>
              <dd className="font-semibold tabular-nums">{m.latest != null ? `${m.latest.toFixed(1)}%` : "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Proyección próx. mes</dt>
              <dd className={`font-semibold tabular-nums ${m.projection != null ? (projOnTrack ? "text-emerald-600" : "text-rose-500") : ""}`}>
                {m.projection != null ? `${m.projection.toFixed(1)}%` : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {m.months.map((mm) => (
              <span key={mm.mes}>
                {mm.mes} <span className="font-semibold tabular-nums text-foreground">{mm.pct.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function fsToProgress(label: string, c: FsCatU4M): ProgressMetric {
  return {
    label,
    target: c.target,
    avg: c.avgU4M,
    latest: c.latest,
    projection: c.projection,
    meets: c.meetsAvg,
    months: c.months.map((mm) => ({ mes: mm.mes, pct: mm.share })),
    avgLabel: "Promedio U4M",
  };
}

function cbToProgress(label: string, c: CbMetricU3M, info = false): ProgressMetric {
  return {
    label,
    target: c.target,
    avg: c.avg,
    latest: c.latest,
    projection: c.projection,
    meets: c.meets,
    months: c.months,
    avgLabel: "Promedio U3M",
    info,
  };
}

// Obj.4 Salud de Marca: arma el card desde las olas consolidadas de Drean.
function buildSaludMarca(rows: SMRow[], target: number) {
  const r26 = rows.find((r) => r.w === "nov-26");
  const r25 = rows.find((r) => r.w === "nov-25");
  const proj = r26?.comp ?? null;
  const prev = r25?.comp ?? null;
  const cat = (k: "lav" | "ref" | "coc", label: string) => {
    const sm26 = r26 ? r26[k].sm.v : null;
    const sm25 = r25 ? r25[k].sm.v : null;
    const w = r26 ? r26.wt[k] : 0;
    return { label, sm26, sm25, w, ap: sm26 == null ? null : sm26 * w, delta: sm26 == null || sm25 == null ? null : sm26 - sm25 };
  };
  const lav = cat("lav", "Lavado"), ref = cat("ref", "Refrigeración"), coc = cat("coc", "Cocción");
  const cats = [lav, ref, coc];
  const desvio = proj == null ? null : proj - target;
  const desvioPct = proj == null || target === 0 ? null : ((proj - target) / target) * 100;
  const lavDir = (lav.delta ?? 0) < -0.05 ? "baja levemente" : (lav.delta ?? 0) > 0.05 ? "sube" : "se mantiene";
  return { target, proj, prev, cats, lav, coc, row26: r26 ?? null, desvio, desvioPct, lavDir, meets: proj != null && proj >= target };
}
const f1 = (v: number | null) => (v == null ? "—" : v.toFixed(1).replace(".", ","));
const smCls = (s: SMState) => (s === "proj" ? "text-blue-600" : s === "carry" ? "text-amber-600" : "text-foreground");

export default async function OverviewPage() {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;

  const [bgt, factRows, floorShareRes, cbRes] = await Promise.all([
    safe(getBgtData(), { rows: [], syncedAt: null }),
    safe(getFacturacionMensual(), [] as Awaited<ReturnType<typeof getFacturacionMensual>>),
    tryFloorShare(),
    tryCb(),
  ]);
  const floorShare = floorShareRes.data;
  const fsError = floorShareRes.error;
  const cb = cbRes.data;
  const cbError = cbRes.error;

  // ===== Obj.4 Salud de Marca: misma fuente que /salud-marca (tab Marca) =====
  const [serLav, serRef, serCoc] = await Promise.all([
    safe(getDreanSerie("Lavado", "MAT", "DREAN"), new Map<string, DreanMesSeg>()),
    safe(getDreanSerie("Refrigeración", "MAT", "DREAN"), new Map<string, DreanMesSeg>()),
    safe(getDreanSerie("Cocción", "MAT", "DREAN"), new Map<string, DreanMesSeg>()),
  ]);
  const smRows = computeDreanConsolidado({ lav: serLav, ref: serRef, coc: serCoc });
  const sm = buildSaludMarca(smRows, 34);

  // ===== Cálculo por cuatrimestre (todo en USD) =====
  const cuatris = CUATRIS.map((c) => {
    const estado = estadoFor(c.months, curYear, curMonth);
    const bgtAvailable = hasVersion(bgt.rows, c.bgtVersion);

    // En curso: medimos "cómo venimos" sobre los meses ya cerrados del
    // cuatrimestre (los que tienen Real + BGT + facturación). Cerrado/futuro:
    // cuatrimestre completo.
    const closedMonths = c.months.filter((m) => m < curMonth);
    const partial = estado === "en curso" && closedMonths.length > 0;
    const useMonths = partial ? closedMonths : c.months;

    const mesesUp = mesesUpFor(useMonths);
    const mesesYm = mesesYmFor(useMonths);

    const bgtVal = sumVersion(bgt.rows, c.bgtVersion, mesesUp, "usd");
    const realVal = sumVersion(bgt.rows, REAL_VERSION, mesesUp, "usd");
    const fact = sumFacturacion(factRows, mesesYm);

    const desvio = bgtAvailable && bgtVal > 0 ? ((realVal - bgtVal) / bgtVal) * 100 : null;
    const invFact = fact && fact > 0 ? (realVal / fact) * 100 : null;

    // Cerrado se evalúa sobre el cuatrimestre; en curso, sobre lo acumulado a la fecha.
    const evaluable = estado === "cerrado" || partial;
    // Solo incumple si se SOBRE-ejecuta el BGT en más del umbral.
    // Sub-ejecutar (desvío negativo) está permitido.
    const desvioOk = desvio != null ? desvio < MAX_DESVIO : null;
    const invFactOk = invFact != null ? invFact <= MAX_INV_FACT : null;

    const coverage = partial ? coverageLabel(useMonths) : null;

    return { ...c, estado, bgtAvailable, partial, coverage, bgtVal, realVal, fact, desvio, invFact, evaluable, desvioOk, invFactOk };
  });

  const syncLabel = bgt.syncedAt
    ? new Date(bgt.syncedAt).toLocaleString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";
  const dataLoaded = bgt.rows.length > 0;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Objetivos de Marketing {YEAR}</h2>
        <p className="text-sm text-muted-foreground">
          Seguimiento descriptivo de los objetivos del área · Fuente BGT: SharePoint → Supabase · Última sincronización: {syncLabel}
        </p>
      </header>

      {/* ===== OBJETIVO 1 ===== */}
      <section className="overflow-hidden rounded-xl border border-l-[5px] border-l-primary bg-primary/[0.03]">
        <div className="border-b border-primary/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Obj. 1</span>
                <h3 className="text-sm font-bold tracking-tight">Ejecución del Presupuesto de Marketing</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ejecutar el presupuesto del Plan de Marketing con un desvío menor al {MAX_DESVIO}% vs el BGT vigente del cuatrimestre (T1 · BGT, T2 · 4+8, T3 · 8+4), sin superar el {invFactLabel}% de Inversión real / Facturación.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-sm font-bold text-primary">&lt; {MAX_DESVIO}%</span>
                <span className="text-muted-foreground">desvío</span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-sm font-bold text-primary">≤ {invFactLabel}%</span>
                <span className="text-muted-foreground">Inv / Fact</span>
              </span>
            </div>
          </div>
        </div>

        <div className="p-4">
          {!dataLoaded && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              No se pudo cargar la data de BGT (data.json). Verificá la conectividad o la variable <code>BGT_DATA_JSON_URL</code>.
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
        {cuatris.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold tracking-tight">
                  {c.id} <span className="text-sm font-normal text-muted-foreground">· {c.label}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Real vs {c.bgtLabel}
                  {c.coverage && <span className="text-foreground/70"> · acum. a {c.coverage}</span>}
                </div>
              </div>
              <StatusBadge kind={c.estado === "cerrado" ? "neutral" : c.estado === "en curso" ? "ok" : "neutral"}>
                {c.estado}
              </StatusBadge>
            </div>

            {!c.bgtAvailable ? (
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Versión <b>{c.bgtLabel}</b> aún no cargada en el BGT.
              </div>
            ) : (
              <>
                {/* Contexto: montos del cuatrimestre */}
                <dl className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">BGT vigente{c.partial ? " (a la fecha)" : ""}</dt>
                    <dd className="font-semibold tabular-nums">{fmtUSD(c.bgtVal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Real ejecutado{c.partial ? " (a la fecha)" : ""}</dt>
                    <dd className="font-semibold tabular-nums">{fmtUSD(c.realVal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Facturación{c.partial ? " (a la fecha)" : ""}</dt>
                    <dd className="font-semibold tabular-nums">{c.fact != null ? fmtUSD(c.fact) : "—"}</dd>
                  </div>
                </dl>

                {/* KPI 1 — Desvío vs BGT */}
                <div className="mt-3">
                  <KpiBig
                    label="Desvío vs BGT"
                    value={c.desvio != null ? fmtPct(c.desvio) : "—"}
                    status={c.desvio != null ? (c.desvio < MAX_DESVIO ? "ok" : "bad") : "neutral"}
                    showBadge={c.evaluable && c.desvioOk != null}
                    objetivo={<>meta: sobre-ejecución <b className="font-semibold text-foreground/80">&lt; {MAX_DESVIO}%</b></>}
                  />
                </div>

                {/* KPI 2 — Inversión Mkt / Facturación */}
                <div className="mt-3">
                  <KpiBig
                    label="Inv. Mkt / Facturación"
                    value={c.invFact != null ? fmtPct(c.invFact, false, 2) : "—"}
                    status={c.invFact != null ? (c.invFact <= MAX_INV_FACT ? "ok" : "bad") : "neutral"}
                    showBadge={c.evaluable && c.invFactOk != null}
                    objetivo={<>meta: <b className="font-semibold text-foreground/80">≤ {invFactLabel}%</b>{c.fact == null ? " · falta facturación" : ""}</>}
                  />
                </div>
              </>
            )}
          </div>
        ))}
          </div>
        </div>
      </section>

      {/* ===== OBJETIVO 2 ===== */}
      <section className="overflow-hidden rounded-xl border border-l-[5px] border-l-primary bg-primary/[0.03]">
        <div className="border-b border-primary/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Obj. 2</span>
                <h3 className="text-sm font-bold tracking-tight">Floor Share de exhibición — categorías core</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Alcanzar el Floor Share objetivo en las tres categorías core, en promedio de los últimos 4 meses: Lavado 32%, Refrigeración 25%, Cocción 23%.
                {floorShare && floorShare.mesesUsados.length > 0 && (
                  <span className="text-foreground/70"> · U4M: {floorShare.mesesUsados.join(" · ")}</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-baseline gap-1"><span className="text-sm font-bold text-primary">32%</span><span className="text-muted-foreground">Lavado</span></span>
              <span className="inline-flex items-baseline gap-1"><span className="text-sm font-bold text-primary">25%</span><span className="text-muted-foreground">Refri</span></span>
              <span className="inline-flex items-baseline gap-1"><span className="text-sm font-bold text-primary">23%</span><span className="text-muted-foreground">Cocción</span></span>
            </div>
          </div>
        </div>
        <div className="p-4">
          {fsError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              No se pudo cargar Floor Share: <code className="break-all">{fsError}</code>
            </div>
          ) : floorShare == null ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Sin datos de Floor Share en la ventana de los últimos 4 meses.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {(["lavado", "refri", "coccion"] as FsCatKey[]).map((k) => (
                <ProgressCard key={k} m={fsToProgress(FS_CAT_LABEL[k], floorShare[k])} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== OBJETIVO 3 ===== */}
      <section className="overflow-hidden rounded-xl border border-l-[5px] border-l-primary bg-primary/[0.03]">
        <div className="border-b border-primary/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Obj. 3</span>
                <h3 className="text-sm font-bold tracking-tight">Cumplimiento de Cuadro Básico (% CB)</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Desarrollar y ejecutar el nuevo proceso de CB del área comercial para alcanzar un % CB promedio del 80% en los últimos 3 meses. Infaltables y Estratégicos se muestran como referencia.
                {cb && cb.mesesUsados.length > 0 && (
                  <span className="text-foreground/70"> · U3M: {cb.mesesUsados.join(" · ")}</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-baseline gap-1"><span className="text-sm font-bold text-primary">80%</span><span className="text-muted-foreground">% CB</span></span>
            </div>
          </div>
        </div>
        <div className="p-4">
          {cbError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              No se pudo cargar Cuadros Básicos: <code className="break-all">{cbError}</code>
            </div>
          ) : cb == null ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Sin datos de Cuadros Básicos en la ventana de los últimos 3 meses.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <ProgressCard m={cbToProgress("% CB", cb.cb)} />
              <ProgressCard m={cbToProgress("Infaltables", cb.infaltables, true)} />
              <ProgressCard m={cbToProgress("Estratégicos", cb.estrategicos, true)} />
            </div>
          )}
        </div>
      </section>

      {/* ===== OBJETIVO 4 ===== */}
      <section className="overflow-hidden rounded-xl border border-l-[5px] border-l-primary bg-primary/[0.03]">
        <div className="border-b border-primary/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Obj. 4</span>
                <h3 className="text-sm font-bold tracking-tight">Salud de Marca</h3>
              </div>
              <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
                Ejecutar campañas de comunicación 360 en cada categoría core del negocio (Lavado, Refrigeración y Cocción) para
                alcanzar una <b>Salud de Marca Drean de 34 puntos</b>, medida por la investigación Kantar de fin de año.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-baseline gap-1"><span className="text-sm font-bold text-primary">{f1(sm.target)} pts</span><span className="text-muted-foreground">objetivo</span></span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Resultado proyectado */}
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-base font-semibold tracking-tight">Salud de Marca Drean</div>
                <span className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground/80">Meta {f1(sm.target)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold tabular-nums ${sm.meets ? "text-emerald-600" : "text-rose-500"}`}>{f1(sm.proj)}</span>
                {sm.desvio != null && (
                  <StatusBadge kind={sm.meets ? "ok" : "bad"}>{sm.desvio >= 0 ? "+" : "−"}{f1(Math.abs(sm.desvio))} vs meta</StatusBadge>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Proyección Nov-2026 (modelo de mercado)</div>
              <dl className="mt-3 space-y-1.5 border-t pt-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Objetivo</dt>
                  <dd className="font-semibold tabular-nums">{f1(sm.target)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Desvío vs objetivo</dt>
                  <dd className={`font-semibold tabular-nums ${sm.meets ? "text-emerald-600" : "text-rose-500"}`}>
                    {sm.desvio == null ? "—" : `${sm.desvio >= 0 ? "+" : "−"}${f1(Math.abs(sm.desvio))} pts${sm.desvioPct != null ? ` (${sm.desvioPct >= 0 ? "+" : "−"}${f1(Math.abs(sm.desvioPct))}%)` : ""}`}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Proyección Salud de Marca — detalle Nov-2026 por dimensión + aporte */}
            <div className="rounded-xl border bg-card p-5 lg:col-span-2">
              <div className="mb-2 text-base font-semibold tracking-tight">Proyección Salud de Marca
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">Nov-2026 · SM = 0,25·(TOM+SOM+Int+Poder) · Global = Σ SM×peso</span>
              </div>
              {sm.row26 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 text-left">Dimensión</th>
                      <th className="py-1.5 text-center">Lav</th>
                      <th className="py-1.5 text-center">Refri</th>
                      <th className="py-1.5 text-center">Cocc</th>
                      <th className="bg-sky-50 py-1.5 text-center text-sky-700">SM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SM_DIMS.map((d) => (
                      <tr key={d.key} className="border-t">
                        <td className="py-1.5">{d.label}</td>
                        <td className={`py-1.5 text-center tabular-nums ${smCls(sm.row26!.lav[d.key].s)}`}>{f1(sm.row26!.lav[d.key].v)}</td>
                        <td className={`py-1.5 text-center tabular-nums ${smCls(sm.row26!.ref[d.key].s)}`}>{f1(sm.row26!.ref[d.key].v)}</td>
                        <td className={`py-1.5 text-center tabular-nums ${smCls(sm.row26!.coc[d.key].s)}`}>{f1(sm.row26!.coc[d.key].v)}</td>
                        <td className="bg-sky-50 py-1.5"></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/40 font-bold">
                      <td className="py-1.5">Salud de Marca</td>
                      <td className={`py-1.5 text-center tabular-nums ${smCls(sm.row26.lav.sm.s)}`}>{f1(sm.row26.lav.sm.v)}</td>
                      <td className={`py-1.5 text-center tabular-nums ${smCls(sm.row26.ref.sm.s)}`}>{f1(sm.row26.ref.sm.v)}</td>
                      <td className={`py-1.5 text-center tabular-nums ${smCls(sm.row26.coc.sm.s)}`}>{f1(sm.row26.coc.sm.v)}</td>
                      <td className={`bg-sky-100 py-1.5 text-center tabular-nums font-bold ${sm.meets ? "text-emerald-700" : "text-rose-600"}`}>{f1(sm.proj)}</td>
                    </tr>
                    <tr className="border-t text-[11px] text-muted-foreground">
                      <td className="py-1.5">Peso categoría</td>
                      <td className="py-1.5 text-center tabular-nums">{(sm.lav.w * 100).toFixed(0)}%</td>
                      <td className="py-1.5 text-center tabular-nums">{(sm.cats[1]!.w * 100).toFixed(0)}%</td>
                      <td className="py-1.5 text-center tabular-nums">{(sm.coc.w * 100).toFixed(0)}%</td>
                      <td className="bg-sky-50 py-1.5 text-center tabular-nums">100%</td>
                    </tr>
                    <tr className="border-t bg-sky-50/40 font-semibold">
                      <td className="py-1.5">Aporte al total</td>
                      <td className="py-1.5 text-center tabular-nums">{f1(sm.lav.ap)}</td>
                      <td className="py-1.5 text-center tabular-nums">{f1(sm.cats[1]!.ap)}</td>
                      <td className="py-1.5 text-center tabular-nums">{f1(sm.coc.ap)}</td>
                      <td className={`bg-sky-100 py-1.5 text-center tabular-nums ${sm.meets ? "text-emerald-700" : "text-rose-600"}`}>{f1(sm.proj)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-blue-600">Azul</span> = proyectado · <span className="font-semibold text-amber-600">ámbar</span> = se
                arrastra nov-25 (sin proyección de marca). <b>Por qué el desvío:</b> lo domina <b>Lavado</b> ({(sm.lav.w * 100).toFixed(0)}% del mix), cuya
                proyección de marca {sm.lavDir} ({f1(sm.lav.sm25)} → {f1(sm.lav.sm26)}), y eso pesa más que la mejora de <b>Cocción</b>{" "}
                ({f1(sm.coc.sm25)} → {f1(sm.coc.sm26)}, pero solo {(sm.coc.w * 100).toFixed(0)}% del mix). <b>Refrigeración</b> se mantiene.
              </p>
            </div>
          </div>
          <Link
            href="/salud-marca?tab=marca"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
          >
            Ver evolución completa →
          </Link>
        </div>
      </section>
    </div>
  );
}
