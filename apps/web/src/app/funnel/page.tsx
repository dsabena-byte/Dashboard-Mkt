import { getBgtData, hasVersion } from "@/lib/bgt-queries";
import { getFacturacionMensual, sumFacturacion } from "@/lib/facturacion-queries";
import { computeCuatris, MAX_DESVIO, MAX_INV_FACT } from "@/lib/bgt-dashboard";
import { InversionComparador } from "@/components/inversion/inversion-comparador";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const YEAR = 2026;
const invFactLabel = MAX_INV_FACT.toString().replace(".", ","); // "1,3"

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

function fmtUSD(n: number): string {
  const a = Math.abs(n), sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}US$ ${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}US$ ${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}US$ ${(a / 1e3).toFixed(0)}K`;
  return `${sign}US$ ${Math.round(a)}`;
}
function StatusBadge({ kind, children }: { kind: "ok" | "bad" | "neutral"; children: React.ReactNode }) {
  const cls =
    kind === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : kind === "bad" ? "bg-red-50 text-red-700 border-red-200"
    : "bg-muted text-muted-foreground border-transparent";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

// Semáforo (mismo sistema visual que MetaKpiCard).
type Sem = "verde" | "rojo" | "sin-meta";
const SEM_COLOR: Record<Sem, string> = { verde: "#16a34a", rojo: "#dc2626", "sin-meta": "#94a3b8" };
const SEM_BG: Record<Sem, string> = { verde: "rgba(22,163,74,.12)", rojo: "rgba(220,38,38,.12)", "sin-meta": "rgba(100,116,139,.10)" };

// Fila de comparación estilo MetaKpiCard: puntito + label + meta, chip a la derecha, barra abajo.
function CompRow({ label, metaTxt, sem, chip, barPct }: {
  label: string; metaTxt: string; sem: Sem; chip: React.ReactNode; barPct: number;
}) {
  const color = SEM_COLOR[sem];
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="text-muted-foreground">{label}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">meta</span>
          <span className="font-semibold tabular-nums">{metaTxt}</span>
        </div>
        <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ color, background: SEM_BG[sem] }}>
          {chip}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(barPct, 100))}%`, background: color }} />
      </div>
    </div>
  );
}

// Card de un cuatrimestre — estilo MetaKpiCard (headline + filas con chip y barra).
function CuatriCard({ c }: { c: ReturnType<typeof computeCuatris>[number] }) {
  const invFactLabel = MAX_INV_FACT.toString().replace(".", ","); // "1,3"
  const desvioSem: Sem = !c.evaluable || c.desvio == null ? "sin-meta" : c.desvioOk ? "verde" : "rojo";
  const invSem: Sem = !c.evaluable || c.invFact == null ? "sin-meta" : c.invFactOk ? "verde" : "rojo";
  const exec = c.bgtVal > 0 ? (c.realVal / c.bgtVal) * 100 : 0;
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.id} · {c.label}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground/70">Real vs {c.bgtLabel}{c.coverage ? ` · acum. a ${c.coverage}` : ""}</div>
        </div>
        <StatusBadge kind={c.estado === "en curso" ? "ok" : "neutral"}>{c.estado}</StatusBadge>
      </div>

      {!c.bgtAvailable ? (
        <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Versión <b>{c.bgtLabel}</b> aún no cargada en el BGT.
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{fmtUSD(c.realVal)}</span>
            <span className="text-[11px] font-medium text-muted-foreground">Real ejecutado{c.partial ? " (a la fecha)" : ""}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            BGT vigente {fmtUSD(c.bgtVal)} · Facturación {c.fact != null ? fmtUSD(c.fact) : "—"}
          </div>

          <div className="mt-3 space-y-2.5 border-t pt-2.5">
            <CompRow
              label="Desvío vs BGT" metaTxt={`< ${MAX_DESVIO}%`} sem={desvioSem} barPct={exec}
              chip={c.desvio == null ? "—" : <><span>{c.desvio >= 0 ? "▲" : "▼"}</span><span>{Math.abs(c.desvio).toFixed(1)}%</span></>}
            />
            <CompRow
              label="Inv / Facturación" metaTxt={`≤ ${invFactLabel}%`} sem={invSem}
              barPct={c.invFact != null ? (c.invFact / MAX_INV_FACT) * 100 : 0}
              chip={c.invFact == null ? "s/ fact" : <span>{c.invFact.toFixed(2)}%</span>}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default async function InversionMarketingPage() {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;

  const [bgt, factRows] = await Promise.all([
    safe(getBgtData(), { rows: [], syncedAt: null }),
    safe(getFacturacionMensual(), [] as Awaited<ReturnType<typeof getFacturacionMensual>>),
  ]);

  const cuatris = computeCuatris(
    bgt.rows, YEAR, curYear, curMonth,
    (v) => hasVersion(bgt.rows, v),
    (mesesYm) => sumFacturacion(factRows, mesesYm),
  );

  const syncLabel = bgt.syncedAt
    ? new Date(bgt.syncedAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const dataLoaded = bgt.rows.length > 0;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Inversión de Marketing</h2>
        <p className="text-sm text-muted-foreground">
          Ejecución del presupuesto de Marketing vs el BGT vigente por cuatrimestre, y comparador libre entre versiones de presupuesto.
        </p>
      </header>
      <p className="-mt-2 text-xs text-muted-foreground">
        Fuente BGT: SharePoint → Supabase · Última sincronización: {syncLabel}
      </p>

      {/* ===== Ejecución del Presupuesto (por cuatrimestre) ===== */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-bold tracking-tight">Ejecución del Presupuesto</h3>
          <p className="text-[11px] text-muted-foreground">
            Real {YEAR} vs BGT vigente por cuatrimestre (T1 · BGT, T2 · 4+8, T3 · 8+4) · meta: desvío &lt; {MAX_DESVIO}% y Inv / Facturación ≤ {invFactLabel}%.
          </p>
        </div>

        {!dataLoaded && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            No se pudo cargar la data de BGT. Verificá la conectividad o la variable <code>BGT_DATA_JSON_URL</code>.
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          {cuatris.map((c) => <CuatriCard key={c.id} c={c} />)}
        </div>
      </section>

      {/* ===== Comparador libre A vs B ===== */}
      <InversionComparador rows={bgt.rows} facturacion={factRows} year={YEAR} />
    </div>
  );
}
