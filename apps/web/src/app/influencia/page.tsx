import { KpiCard } from "@/components/kpi-card";
import { getInfluenciaPerformance } from "@/lib/pauta-queries";
import { getMetaUgcCreatives } from "@/lib/meta-paid-queries";
import { MEDIO_COLORS } from "@/lib/pauta-data";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { MetaPaidGrid } from "@/components/pauta/meta-paid-grid";

export const dynamic = "force-dynamic";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

function fmtNum(n: number): string {
  return formatNumber(Math.round(n));
}
const fmtARS = formatCurrency;

export default async function InfluenciaPage() {
  const [rows, ugcCreatives] = await Promise.all([
    getInfluenciaPerformance(),
    safe(getMetaUgcCreatives(), [] as Awaited<ReturnType<typeof getMetaUgcCreatives>>),
  ]);

  const totalInv = rows.reduce((s, r) => s + (r.inversion ?? 0), 0);
  const totalInvPlan = rows.reduce((s, r) => s + (r.inversion_plan ?? 0), 0);
  const totalAlcance = rows.reduce((s, r) => s + (r.alcance ?? 0), 0);
  const totalImpresiones = rows.reduce((s, r) => s + (r.impresiones ?? 0), 0);
  const totalClicks = rows.reduce((s, r) => s + (r.clics ?? 0), 0);
  const totalViews = rows.reduce((s, r) => s + (r.views ?? 0), 0);
  const ctr = totalImpresiones > 0 ? (totalClicks / totalImpresiones) * 100 : 0;
  const cpm = totalImpresiones > 0 ? (totalInv / totalImpresiones) * 1000 : 0;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Mkt de Influencia</h2>
        <p className="text-sm text-muted-foreground">
          Campañas UGC e influencer marketing · Fuente: OMD
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
          Sin campañas UGC cargadas todavía.
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Inversión ejecutada"
              value={fmtARS(totalInv)}
              hint={totalInvPlan > 0 ? `Plan: ${fmtARS(totalInvPlan)}` : undefined}
            />
            <KpiCard title="Alcance" value={fmtNum(totalAlcance)} hint="Suma de plataformas" />
            <KpiCard title="Impresiones" value={fmtNum(totalImpresiones)} hint={`CPM ${fmtARS(cpm)}`} />
            <KpiCard title="Clicks" value={fmtNum(totalClicks)} hint={`CTR ${ctr.toFixed(2)}%`} />
          </section>

          {totalViews > 0 && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Video Views" value={fmtNum(totalViews)} hint="Suma del período" />
            </section>
          )}

          <div className="mt-2 mb-3 text-sm font-medium text-muted-foreground">Detalle por línea</div>
          <div className="rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Mes</th>
                    <th className="px-3 py-2">Plataforma</th>
                    <th className="px-3 py-2">Tipo compra</th>
                    <th className="px-3 py-2 text-right">Inv. Plan</th>
                    <th className="px-3 py-2 text-right">Inv. Real</th>
                    <th className="px-3 py-2 text-right">Alcance</th>
                    <th className="px-3 py-2 text-right">Impresiones</th>
                    <th className="px-3 py-2 text-right">Clicks</th>
                    <th className="px-3 py-2 text-right">Views</th>
                    <th className="px-3 py-2 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{r.mes}</td>
                      <td className="px-3 py-2 font-medium">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: MEDIO_COLORS[r.medio] ?? "#94a3b8" }}
                        />
                        {r.medio}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.tipo_compra}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.inversion_plan ? fmtARS(r.inversion_plan) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.inversion ? fmtARS(r.inversion) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.alcance ? fmtNum(r.alcance) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.impresiones ? fmtNum(r.impresiones) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.clics ? fmtNum(r.clics) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.views ? fmtNum(r.views) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.ctr != null ? `${r.ctr.toFixed(2)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {ugcCreatives.length > 0 && (
            <section className="space-y-3">
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <h3 className="text-sm font-medium">Piezas pautadas · UGC (Meta IG + FB)</h3>
                  <p className="text-xs text-muted-foreground">
                    Ordenadas por inversión. {ugcCreatives.length} piezas en total.
                  </p>
                </div>
              </div>
              <MetaPaidGrid
                data={ugcCreatives}
                selMeses={[]}
                selCats={[]}
                selRoles={[]}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
