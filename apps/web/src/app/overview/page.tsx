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

function FsCard({ label, cat }: { label: string; cat: FsCatU4M }) {
  const hasData = cat.months.length > 0;
  const delta = cat.avgU4M - cat.target;
  const lastMes = hasData ? cat.months[cat.months.length - 1]!.mes : null;
  const projOnTrack = cat.projection != null && cat.projection >= cat.target;
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-base font-semibold tracking-tight">{label}</div>
        <span className="text-[11px] text-muted-foreground">Obj {cat.target}%</span>
      </div>

      {!hasData ? (
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Sin datos en la ventana.</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums ${cat.meetsAvg ? "text-emerald-600" : "text-rose-500"}`}>
              {cat.avgU4M.toFixed(1)}%
            </span>
            <StatusBadge kind={cat.meetsAvg ? "ok" : "bad"}>{cat.meetsAvg ? "cumple" : "no cumple"}</StatusBadge>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Promedio U4M · {delta >= 0 ? "+" : ""}{delta.toFixed(1)} pp vs objetivo
          </div>

          <dl className="mt-3 space-y-1.5 border-t pt-2.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Último mes{lastMes ? ` (${lastMes})` : ""}</dt>
              <dd className="font-semibold tabular-nums">{cat.latest != null ? `${cat.latest.toFixed(1)}%` : "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Proyección próx. mes</dt>
              <dd className={`font-semibold tabular-nums ${cat.projection != null ? (projOnTrack ? "text-emerald-600" : "text-rose-500") : ""}`}>
                {cat.projection != null ? `${cat.projection.toFixed(1)}%` : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {cat.months.map((m) => (
              <span key={m.mes}>
                {m.mes} <span className="font-semibold tabular-nums text-foreground">{m.share.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default async function OverviewPage() {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;

  const [bgt, factRows, floorShareRes] = await Promise.all([
    safe(getBgtData(), { rows: [], syncedAt: null }),
    safe(getFacturacionMensual(), [] as Awaited<ReturnType<typeof getFacturacionMensual>>),
    tryFloorShare(),
  ]);
  const floorShare = floorShareRes.data;
  const fsError = floorShareRes.error;

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
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Objetivos de Marketing {YEAR}</h2>
        <p className="text-sm text-muted-foreground">
          Seguimiento descriptivo de los objetivos del área · Fuente BGT: SharePoint → Supabase · Última sincronización: {syncLabel}
        </p>
      </header>

      {/* ===== OBJETIVO 1 ===== */}
      <section className="mt-6 rounded-xl border border-l-4 border-l-primary bg-primary/[0.035] px-4 py-3">
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
      </section>

      {!dataLoaded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          No se pudo cargar la data de BGT (data.json). Verificá la conectividad o la variable <code>BGT_DATA_JSON_URL</code>.
        </div>
      )}

      {/* Tarjetas por cuatrimestre */}
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
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">BGT vigente{c.partial ? " (a la fecha)" : ""}</dt>
                  <dd className="font-semibold tabular-nums">{fmtUSD(c.bgtVal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Real ejecutado{c.partial ? " (a la fecha)" : ""}</dt>
                  <dd className="font-semibold tabular-nums">{fmtUSD(c.realVal)}</dd>
                </div>

                <div className="border-t pt-2.5">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Desvío vs BGT</dt>
                    <dd className="flex items-center gap-2">
                      <span className={`font-semibold tabular-nums ${c.desvio != null ? (c.desvio < MAX_DESVIO ? "text-emerald-600" : "text-red-600") : ""}`}>
                        {c.desvio != null ? fmtPct(c.desvio) : "—"}
                      </span>
                      {c.evaluable && c.desvioOk != null && (
                        <StatusBadge kind={c.desvioOk ? "ok" : "bad"}>{c.desvioOk ? "cumple" : "no cumple"}</StatusBadge>
                      )}
                    </dd>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Meta: sobre-ejecución &lt; {MAX_DESVIO}% (sub-ejecución permitida)</div>
                </div>

                <div className="border-t pt-2.5">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Inv. Mkt / Facturación</dt>
                    <dd className="flex items-center gap-2">
                      <span className={`font-semibold tabular-nums ${c.invFact != null && c.invFact <= MAX_INV_FACT ? "text-emerald-600" : c.invFact != null ? "text-red-600" : ""}`}>
                        {c.invFact != null ? fmtPct(c.invFact, false, 2) : "—"}
                      </span>
                      {c.evaluable && c.invFactOk != null && (
                        <StatusBadge kind={c.invFactOk ? "ok" : "bad"}>{c.invFactOk ? "cumple" : "no cumple"}</StatusBadge>
                      )}
                    </dd>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Meta: ≤ {MAX_INV_FACT.toString().replace(".", ",")}%
                    {c.fact == null && " · falta facturación del período"}
                  </div>
                </div>
              </dl>
            )}
          </div>
        ))}
      </div>

      {/* ===== OBJETIVO 2 ===== */}
      <section className="mt-6 rounded-xl border border-l-4 border-l-primary bg-primary/[0.035] px-4 py-3">
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
      </section>

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
            <FsCard key={k} label={FS_CAT_LABEL[k]} cat={floorShare[k]} />
          ))}
        </div>
      )}
    </div>
  );
}
