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
function fmtPct(n: number, signed = true, decimals = 1): string {
  return `${signed && n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
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

// KPI con lenguaje visual común: rótulo + badge, valor grande coloreado y línea de objetivo.
function KpiBig({ label, value, status, showBadge, objetivo }: {
  label: string; value: string; status: "ok" | "bad" | "neutral"; showBadge: boolean; objetivo: React.ReactNode;
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
                  <StatusBadge kind={c.estado === "en curso" ? "ok" : "neutral"}>{c.estado}</StatusBadge>
                </div>

                {!c.bgtAvailable ? (
                  <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                    Versión <b>{c.bgtLabel}</b> aún no cargada en el BGT.
                  </div>
                ) : (
                  <>
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

                    <div className="mt-3">
                      <KpiBig
                        label="Desvío vs BGT"
                        value={c.desvio != null ? fmtPct(c.desvio) : "—"}
                        status={c.desvio != null ? (c.desvio < MAX_DESVIO ? "ok" : "bad") : "neutral"}
                        showBadge={c.evaluable && c.desvioOk != null}
                        objetivo={<>meta: sobre-ejecución <b className="font-semibold text-foreground/80">&lt; {MAX_DESVIO}%</b></>}
                      />
                    </div>
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
      </section>

      {/* ===== Comparador libre A vs B ===== */}
      <InversionComparador rows={bgt.rows} facturacion={factRows} year={YEAR} />
    </div>
  );
}
