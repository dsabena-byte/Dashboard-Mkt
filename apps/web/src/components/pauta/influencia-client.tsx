"use client";

import { useMemo, useState } from "react";
import { MultiDropdown } from "@/components/multi-dropdown";
import { KpiCard } from "@/components/kpi-card";
import { MetaPaidGrid } from "@/components/pauta/meta-paid-grid";
import { MEDIO_COLORS, extractMeses, type PautaRow } from "@/lib/pauta-data";
import type { MetaPaidCreativeRow } from "@/lib/meta-paid-queries";
import type { UgcPieceAnalysis } from "@/lib/ugc-analysis-queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

const fmtNum = (n: number) => formatNumber(Math.round(n));
const fmtARS = formatCurrency;

// Color del nivel del análisis (alta/positiva = verde, media/neutra = ámbar, baja/negativa = rojo).
function nivelColor(nivel?: string): string {
  const n = (nivel ?? "").toLowerCase();
  if (/alta|positiv/.test(n)) return "text-emerald-600";
  if (/media|neutr/.test(n)) return "text-amber-600";
  if (/baja|negativ/.test(n)) return "text-rose-600";
  return "text-muted-foreground";
}

// Semáforo best-in-class (igual que Pauta Mkt).
function bicColor(value: number, best: number, kind: "lower" | "higher"): string {
  if (best <= 0 || value <= 0) return "text-muted-foreground";
  const ratio = value / best;
  if (kind === "lower") return ratio <= 1.1 ? "text-emerald-600" : ratio <= 1.4 ? "text-amber-600" : "text-rose-600";
  return ratio >= 0.9 ? "text-emerald-600" : ratio >= 0.6 ? "text-amber-600" : "text-rose-600";
}

// Visibilidad de video de una pieza (Meta: cuartiles; TikTok/Looker: vtr%/views).
function metaRowVideo(r: MetaPaidCreativeRow): { vbase: number; comp: number } {
  const hasQuartiles = (r.video_p25 ?? 0) + (r.video_p50 ?? 0) + (r.video_p75 ?? 0) > 0;
  if (hasQuartiles) return { vbase: r.impresiones, comp: r.video_p100 ?? 0 };
  if ((r.vtr_p100 ?? 0) > 0) return { vbase: r.impresiones, comp: (r.impresiones * (r.vtr_p100 ?? 0)) / 100 };
  const comp = r.views_completed ?? 0;
  const total = r.views_total ?? 0;
  return comp > 0 && total > 0 ? { vbase: total, comp } : { vbase: 0, comp: 0 };
}

export function InfluenciaClient({ rows, ugcCreatives, ugcAnalysis = [] }: { rows: PautaRow[]; ugcCreatives: MetaPaidCreativeRow[]; ugcAnalysis?: UgcPieceAnalysis[] }) {
  const meses = useMemo(() => extractMeses(rows), [rows]);
  const [selMeses, setSelMeses] = useState<string[]>([]);

  const rowsF = useMemo(() => rows.filter((r) => selMeses.length === 0 || selMeses.includes(r.mes)), [rows, selMeses]);
  const piecesF = useMemo(
    () => ugcCreatives.filter((r) => selMeses.length === 0 || selMeses.includes(r.mes)),
    [ugcCreatives, selMeses],
  );

  // KPIs (volumen OMD).
  const totalInv = rowsF.reduce((s, r) => s + (r.inversion ?? 0), 0);
  const totalInvPlan = rowsF.reduce((s, r) => s + (r.inversion_plan ?? 0), 0);
  const totalAlcance = rowsF.reduce((s, r) => s + (r.alcance ?? 0), 0);
  const totalImpr = rowsF.reduce((s, r) => s + (r.impresiones ?? 0), 0);
  const totalClicks = rowsF.reduce((s, r) => s + (r.clics ?? 0), 0);
  const totalViews = rowsF.reduce((s, r) => s + (r.views ?? 0), 0);
  const ctr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
  const cpm = totalImpr > 0 ? (totalInv / totalImpr) * 1000 : 0;

  // Tabla maestra por medio (Meta / TikTok). Volumen OMD + efectivo de video de las piezas.
  const medioModel = useMemo(() => {
    const vol = new Map<string, { inv: number; impr: number; alc: number; clics: number }>();
    for (const r of rowsF) {
      const e = vol.get(r.medio) ?? { inv: 0, impr: 0, alc: 0, clics: 0 };
      e.inv += r.inversion ?? 0;
      e.impr += r.impresiones ?? 0;
      e.alc += r.alcance ?? 0;
      e.clics += r.clics ?? 0;
      vol.set(r.medio, e);
    }
    const eff = new Map<string, { comp: number; vbase: number }>();
    for (const r of piecesF) {
      const medio = r.plataforma === "meta" ? "Meta" : r.plataforma === "tiktok" ? "TikTok" : null;
      if (!medio) continue;
      const v = metaRowVideo(r);
      const e = eff.get(medio) ?? { comp: 0, vbase: 0 };
      e.comp += v.comp;
      e.vbase += v.vbase;
      eff.set(medio, e);
    }
    const items = [...vol.entries()]
      .filter(([, e]) => e.impr > 0)
      .map(([medio, e]) => {
        const ef = eff.get(medio) ?? { comp: 0, vbase: 0 };
        return {
          medio,
          inversion: e.inv,
          impresiones: e.impr,
          alcance: e.alc,
          clics: e.clics,
          frec: e.alc > 0 ? e.impr / e.alc : 0,
          cpm: e.impr > 0 ? (e.inv / e.impr) * 1000 : 0,
          ctr: e.impr > 0 ? (e.clics / e.impr) * 100 : 0,
          cpc: e.clics > 0 ? e.inv / e.clics : 0,
          vtr: ef.vbase > 0 ? (ef.comp / ef.vbase) * 100 : 0,
          cpmEf: ef.comp > 0 ? (e.inv / ef.comp) * 1000 : 0,
        };
      })
      .sort((a, b) => b.inversion - a.inversion);
    const pos = (xs: number[], fn: (...n: number[]) => number) => {
      const f = xs.filter((x) => x > 0);
      return f.length ? fn(...f) : 0;
    };
    const total = items.reduce(
      (t, i) => ({ inv: t.inv + i.inversion, impr: t.impr + i.impresiones, alc: t.alc + i.alcance, clics: t.clics + i.clics }),
      { inv: 0, impr: 0, alc: 0, clics: 0 },
    );
    return {
      items,
      total,
      bestVtr: pos(items.map((i) => i.vtr), Math.max),
      bestCpmEf: pos(items.map((i) => i.cpmEf), Math.min),
      bestCtr: pos(items.map((i) => i.ctr), Math.max),
    };
  }, [rowsF, piecesF]);

  // Embudo de atención por fuente (Meta / TikTok), desde las piezas.
  const videoSources = useMemo(() => {
    const mk = (name: string, pieces: MetaPaidCreativeRow[], isMeta: boolean) => {
      let impr = 0, v25 = 0, v50 = 0, v75 = 0, v100 = 0, spend = 0;
      for (const r of pieces) {
        impr += r.impresiones ?? 0;
        spend += r.spend ?? 0;
        if (isMeta) {
          v25 += r.video_p25 ?? 0;
          v50 += r.video_p50 ?? 0;
          v75 += r.video_p75 ?? 0;
          v100 += r.video_p100 ?? 0;
        } else {
          const i = r.impresiones ?? 0;
          v25 += (i * (r.vtr_p25 ?? 0)) / 100;
          v50 += (i * (r.vtr_p50 ?? 0)) / 100;
          v75 += (i * (r.vtr_p75 ?? 0)) / 100;
          v100 += (i * (r.vtr_p100 ?? 0)) / 100;
        }
      }
      return { name, impr, v25, v50, v75, v100, spend };
    };
    return [
      mk("Meta", piecesF.filter((r) => r.plataforma === "meta"), true),
      mk("TikTok", piecesF.filter((r) => r.plataforma === "tiktok"), false),
    ].filter((s) => s.impr > 0);
  }, [piecesF]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Mkt de Influencia</h2>
        <p className="text-sm text-muted-foreground">Campañas UGC e influencer marketing · Fuente: OMD</p>
        <div className="mt-3">
          <MultiDropdown
            label="Mes"
            placeholder="Todos los meses"
            selected={selMeses}
            options={meses.map((m) => ({ value: m, label: m }))}
            onChange={setSelMeses}
          />
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
          Sin campañas UGC cargadas todavía.
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Inversión ejecutada" value={fmtARS(totalInv)} hint={totalInvPlan > 0 ? `Plan: ${fmtARS(totalInvPlan)}` : undefined} />
            <KpiCard title="Alcance" value={fmtNum(totalAlcance)} hint="Suma de plataformas" />
            <KpiCard title="Impresiones" value={fmtNum(totalImpr)} hint={`CPM ${fmtARS(cpm)}`} />
            <KpiCard title="Clicks" value={fmtNum(totalClicks)} hint={`CTR ${ctr.toFixed(2)}%`} />
          </section>
          {totalViews > 0 && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Video Views" value={fmtNum(totalViews)} hint="Suma del período" />
            </section>
          )}

          {/* Tabla maestra (misma estructura que Pauta Mkt: general + efectivo). */}
          <div className="mt-2 mb-3 text-sm font-medium text-muted-foreground">Tabla maestra · por medio · general + efectivo</div>
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
                {medioModel.items.map((p) => (
                  <tr key={p.medio} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: MEDIO_COLORS[p.medio] ?? "#94a3b8" }} />
                      {p.medio}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtARS(p.inversion)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(p.impresiones)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.alcance > 0 ? fmtNum(p.alcance) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.frec > 0 ? p.frec.toFixed(1) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${p.vtr > 0 ? bicColor(p.vtr, medioModel.bestVtr, "higher") : "text-muted-foreground"}`}>{p.vtr > 0 ? `${p.vtr.toFixed(0)}%` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.cpm > 0 ? fmtARS(p.cpm) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${p.cpmEf > 0 ? bicColor(p.cpmEf, medioModel.bestCpmEf, "lower") : "text-muted-foreground"}`}>{p.cpmEf > 0 ? fmtARS(p.cpmEf) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.cpc > 0 ? fmtARS(p.cpc) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${p.ctr > 0 ? bicColor(p.ctr, medioModel.bestCtr, "higher") : "text-muted-foreground"}`}>{p.ctr > 0 ? `${p.ctr.toFixed(2)}%` : "—"}</td>
                  </tr>
                ))}
                {(() => {
                  const t = medioModel.total;
                  const tcpm = t.impr > 0 ? (t.inv / t.impr) * 1000 : 0;
                  const tctr = t.impr > 0 ? (t.clics / t.impr) * 100 : 0;
                  const tcpc = t.clics > 0 ? t.inv / t.clics : 0;
                  const tfrec = t.alc > 0 ? t.impr / t.alc : 0;
                  return (
                    <tr className="border-t-2 bg-muted/40 font-semibold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtARS(t.inv)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.impr)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.alc > 0 ? fmtNum(t.alc) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{tfrec > 0 ? tfrec.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">—</td>
                      <td className="px-3 py-2 text-right tabular-nums">{tcpm > 0 ? fmtARS(tcpm) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">—</td>
                      <td className="px-3 py-2 text-right tabular-nums">{tcpc > 0 ? fmtARS(tcpc) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{tctr.toFixed(2)}%</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Embudo de atención por fuente (antes de las piezas). */}
          {videoSources.length > 0 && (
            <>
              <div className="mt-2 mb-2 text-sm font-medium text-muted-foreground">Embudo de atención · separado por fuente</div>
              <div className="grid gap-3 lg:grid-cols-2">
                {videoSources.map((src) => {
                  const noQ = src.v25 + src.v50 + src.v75 === 0;
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
                          {noQ ? <span className="font-semibold text-muted-foreground">s/d cuartiles</span> : <>VTR <span className={`font-semibold ${vtr >= 30 ? "text-emerald-600" : vtr >= 15 ? "text-amber-600" : "text-rose-600"}`}>{vtr.toFixed(0)}%</span>{cpcv > 0 && <> · CPCV {fmtARS(cpcv)}</>}</>}
                        </span>
                      </div>
                      {noQ && <p className="mb-1 text-[9px] text-amber-600">Sin datos de cuartiles en el feed. Solo impresiones.</p>}
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
            </>
          )}

          {/* Piezas pautadas (al final). */}
          {piecesF.length > 0 && (
            <section className="space-y-3">
              <div className="mt-2">
                <h3 className="text-sm font-medium">Piezas pautadas · UGC (Meta IG + FB)</h3>
                <p className="text-xs text-muted-foreground">Ordenadas por inversión. {piecesF.length} piezas en total.</p>
              </div>
              <MetaPaidGrid data={piecesF} selMeses={selMeses} selCats={[]} selRoles={[]} />
            </section>
          )}

          {ugcAnalysis.some((p) => p.comments.length > 0 || p.analysis) && (
            <section className="space-y-3">
              <div className="mt-2">
                <h3 className="text-sm font-medium">Análisis de comentarios por pieza</h3>
                <p className="text-xs text-muted-foreground">
                  Validación del contenido (credibilidad · intención de compra · percepción de marca) + mejoras de guión, desde los comentarios reales.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {ugcAnalysis.filter((p) => p.comments.length > 0 || p.analysis).map((p) => {
                  const a = p.analysis;
                  const dims: Array<[string, { nivel?: string; detalle?: string } | undefined]> = [
                    ["Credibilidad", a?.credibilidad], ["Intención compra", a?.intencion_compra], ["Percep. marca", a?.percepcion_marca],
                  ];
                  return (
                    <div key={p.permalink} className="rounded-xl border bg-card p-4">
                      <div className="flex items-center gap-3">
                        {p.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt={p.ad_name ?? ""} className="h-12 w-12 shrink-0 rounded object-cover" loading="lazy" />
                        )}
                        <div className="min-w-0">
                          <a href={p.permalink} target="_blank" rel="noopener" className="block truncate text-xs font-semibold hover:underline">{p.ad_name ?? p.permalink}</a>
                          <p className="text-[10px] text-muted-foreground">{p.comments.length} comentarios</p>
                        </div>
                      </div>
                      {a ? (
                        <div className="mt-3 space-y-2 text-[11px]">
                          {a.resumen && <p className="text-muted-foreground">{a.resumen}</p>}
                          <div className="grid grid-cols-3 gap-2">
                            {dims.map(([label, v]) => (
                              <div key={label} className="rounded border bg-muted/30 p-1.5 text-center">
                                <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
                                <div className={`text-[11px] font-semibold capitalize ${nivelColor(v?.nivel)}`}>{v?.nivel ?? "—"}</div>
                              </div>
                            ))}
                          </div>
                          <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                            {a.credibilidad?.detalle && <li><strong>Credibilidad:</strong> {a.credibilidad.detalle}</li>}
                            {a.intencion_compra?.detalle && <li><strong>Intención:</strong> {a.intencion_compra.detalle}</li>}
                            {a.percepcion_marca?.detalle && <li><strong>Marca:</strong> {a.percepcion_marca.detalle}</li>}
                          </ul>
                          {a.mejoras && a.mejoras.length > 0 && (
                            <div>
                              <div className="text-[11px] font-medium">Mejoras de contenido/guión</div>
                              <ul className="list-disc pl-4 text-[10px] text-muted-foreground">
                                {a.mejoras.map((m, i) => <li key={i}>{m}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-[10px] text-muted-foreground">Análisis pendiente — corré el cron <code>ugc-comments-analysis</code>.</p>
                      )}
                      {p.comments.length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-[11px] font-medium">Ver comentarios ({p.comments.length})</summary>
                          <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto">
                            {p.comments.map((c, i) => (
                              <div key={i} className="rounded bg-muted/40 p-2 text-[11px]">
                                {c.author && <span className="font-semibold">@{c.author} </span>}
                                {c.text}
                                {c.likes > 0 && <span className="ml-1 text-muted-foreground">· ❤️ {fmtNum(c.likes)}</span>}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
