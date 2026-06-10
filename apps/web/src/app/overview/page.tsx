import {
  getBgtData,
  sumVersion,
  hasVersion,
  MESES_UP,
} from "@/lib/bgt-queries";
import { getFacturacionMensual, sumFacturacion } from "@/lib/facturacion-queries";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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

export default async function OverviewPage() {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;

  const [bgt, factRows] = await Promise.all([
    safe(getBgtData(), { rows: [], syncedAt: null }),
    safe(getFacturacionMensual(), [] as Awaited<ReturnType<typeof getFacturacionMensual>>),
  ]);

  // ===== Cálculo por cuatrimestre (todo en USD) =====
  const cuatris = CUATRIS.map((c) => {
    const mesesUp = mesesUpFor(c.months);
    const mesesYm = mesesYmFor(c.months);
    const estado = estadoFor(c.months, curYear, curMonth);
    const bgtAvailable = hasVersion(bgt.rows, c.bgtVersion);

    const bgtVal = sumVersion(bgt.rows, c.bgtVersion, mesesUp, "usd");
    const realVal = sumVersion(bgt.rows, REAL_VERSION, mesesUp, "usd");
    const fact = sumFacturacion(factRows, mesesYm);

    const desvio = bgtAvailable && bgtVal > 0 ? ((realVal - bgtVal) / bgtVal) * 100 : null;
    const invFact = fact && fact > 0 ? (realVal / fact) * 100 : null;

    const evaluable = estado === "cerrado";
    // Solo incumple si se SOBRE-ejecuta el BGT en más del umbral.
    // Sub-ejecutar (desvío negativo) está permitido.
    const desvioOk = desvio != null ? desvio < MAX_DESVIO : null;
    const invFactOk = invFact != null ? invFact <= MAX_INV_FACT : null;

    return { ...c, estado, bgtAvailable, bgtVal, realVal, fact, desvio, invFact, evaluable, desvioOk, invFactOk };
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
          Seguimiento descriptivo de los objetivos del área · Fuente BGT: SharePoint · Última sincronización: {syncLabel}
        </p>
      </header>

      {/* ===== OBJETIVO 1 ===== */}
      <section className="mt-6 rounded-xl border border-l-4 border-l-primary bg-primary/[0.035] p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Objetivo 1</div>
        <h3 className="mt-0.5 text-lg font-bold tracking-tight">Ejecución del Presupuesto de Marketing</h3>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-foreground/90">
          Ejecutar el presupuesto del Plan de Marketing con un <b>desvío menor al {MAX_DESVIO}%</b> vs
          el <b>BGT vigente del cuatrimestre</b>, y <b>nunca superando el {invFactLabel}%</b> de
          la <b>Inversión real / Facturación</b>.
        </p>

        {/* Metas (destacado inline) */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-base font-bold text-primary">&lt; {MAX_DESVIO}%</span>
            <span className="text-xs text-muted-foreground">sobre-ejecución vs BGT vigente</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-base font-bold text-primary">≤ {invFactLabel}%</span>
            <span className="text-xs text-muted-foreground">Inversión Mkt / Facturación</span>
          </span>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          El límite del {MAX_DESVIO}% aplica solo a la <b>sobre-ejecución</b>: gastar menos que el BGT no se considera desvío.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-md border bg-card px-2 py-1">T1 → Real vs <b>BGT</b></span>
          <span className="rounded-md border bg-card px-2 py-1">T2 → Real vs <b>BGT 4+8</b></span>
          <span className="rounded-md border bg-card px-2 py-1">T3 → Real vs <b>BGT 8+4</b></span>
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
                <div className="text-xs text-muted-foreground">Real vs {c.bgtLabel}</div>
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
                  <dt className="text-muted-foreground">BGT vigente</dt>
                  <dd className="font-semibold tabular-nums">{fmtUSD(c.bgtVal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Real ejecutado</dt>
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
    </div>
  );
}
