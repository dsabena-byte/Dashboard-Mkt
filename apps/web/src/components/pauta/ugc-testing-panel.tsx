"use client";

import { useMemo } from "react";
import type { MetaPaidCreativeRow } from "@/lib/meta-paid-queries";
import type { UgcPieceAnalysis } from "@/lib/ugc-analysis-queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

// Panel de "Testeo de creativos" para /influencia. Agrupa las piezas UGC
// pauteadas por campaña (un A/B en Ads Manager = una campaña con varias piezas),
// las rankea head-to-head por hook rate y suma la validación cualitativa desde
// los comentarios reales de cada pieza.

const fmtNum = (n: number) => formatNumber(Math.round(n));
const pct = (n: number | null, d = 1) => (n == null ? "—" : `${n.toFixed(d)}%`);

// Umbral de muestra chica: por debajo, los números son ruido y se avisa.
const LOW_IMPR = 1000;

// Semáforo: valor vs. mejor del grupo (más alto = mejor, salvo costos).
function tone(value: number | null, best: number, kind: "higher" | "lower"): string {
  if (value == null || value <= 0 || best <= 0) return "text-muted-foreground";
  const ratio = value / best;
  if (kind === "higher") return ratio >= 0.9 ? "text-emerald-600" : ratio >= 0.6 ? "text-amber-600" : "text-rose-600";
  return ratio <= 1.1 ? "text-emerald-600" : ratio <= 1.4 ? "text-amber-600" : "text-rose-600";
}

function nivelColor(nivel?: string): string {
  const n = (nivel ?? "").toLowerCase();
  if (/alta|positiv/.test(n)) return "text-emerald-600";
  if (/media|neutr/.test(n)) return "text-amber-600";
  if (/baja|negativ/.test(n)) return "text-rose-600";
  return "text-muted-foreground";
}

// Calidad de contenido a partir del engagement que genera la pieza —retención
// (que se vea completo) + reacción (interacciones)—, relativo al mejor del test.
// Da una lectura para TODA pieza, tenga o no comentarios. La retención pesa más:
// que la vean hasta el final es la señal más fuerte de contenido que engancha.
function contentQuality(
  retention: number | null,
  engRate: number | null,
  bestRet: number,
  bestEng: number,
): { nivel: string; detalle: string } | null {
  const hasRet = retention != null && retention > 0;
  const hasEng = engRate != null && engRate > 0;
  if (!hasRet && !hasEng) return null;
  const rr = bestRet > 0 && hasRet ? Math.min(retention! / bestRet, 1) : 0;
  const re = bestEng > 0 && hasEng ? Math.min(engRate! / bestEng, 1) : 0;
  const score = 0.6 * rr + 0.4 * re;
  const nivel = score >= 0.7 ? "alta" : score >= 0.4 ? "media" : "baja";
  const strongRet = rr >= 0.7;
  const strongEng = re >= 0.7;
  const detalle = strongRet && strongEng
    ? "Retiene hasta el final y genera reacción — contenido que engancha."
    : strongRet
      ? "Buena retención (se ve completo), pero genera poca reacción."
      : strongEng
        ? "Genera reacción, pero pocos lo ven hasta el final."
        : "Baja retención y poca reacción frente a las otras del test.";
  return { nivel, detalle };
}

interface Score {
  ad_id: string;
  name: string;
  thumb: string | null;
  permalink: string | null;
  campaign: string;
  impr: number;
  spend: number;
  hookRate: number | null; // % video_plays / impresiones
  q: { p25: number; p50: number; p75: number; p100: number }; // % de impresiones
  retention: number | null; // % p100 / plays
  ctr: number | null;
  cpc: number | null;
  cpThruplay: number | null;
  interactions: number;
  engRate: number | null; // % interacciones / impresiones
  comments: number;
  cred?: string;
  persu?: string;
  percep?: string;
  piece: UgcPieceAnalysis | null; // análisis de comentarios de la pieza (matcheado por permalink)
  lowSample: boolean;
}

// Cuartiles de video como % de impresiones (Meta: conteos; TikTok/Looker: vtr%).
function quartiles(r: MetaPaidCreativeRow): { p25: number; p50: number; p75: number; p100: number } {
  const impr = r.impresiones || 0;
  const hasQ = (r.video_p25 ?? 0) + (r.video_p50 ?? 0) + (r.video_p75 ?? 0) + (r.video_p100 ?? 0) > 0;
  const p = (n: number | null) => (impr > 0 && n != null ? (n / impr) * 100 : 0);
  if (hasQ) return { p25: p(r.video_p25), p50: p(r.video_p50), p75: p(r.video_p75), p100: p(r.video_p100) };
  return { p25: r.vtr_p25 ?? 0, p50: r.vtr_p50 ?? 0, p75: r.vtr_p75 ?? 0, p100: r.vtr_p100 ?? 0 };
}

// ¿La pieza tiene comentarios (y por ende análisis cualitativo)?
const hasQual = (s: Score) => !!s.piece?.analysis || (s.piece?.comments.length ?? 0) > 0;

export function UgcTestingPanel({
  creatives,
  analysis = [],
}: {
  creatives: MetaPaidCreativeRow[];
  analysis?: UgcPieceAnalysis[];
}) {
  const analysisByLink = useMemo(() => {
    const m = new Map<string, UgcPieceAnalysis>();
    for (const a of analysis) m.set(a.permalink, a);
    return m;
  }, [analysis]);

  // Un score por anuncio (colapsando meses del mismo ad_id: sumamos volúmenes).
  const scores = useMemo(() => {
    const byAd = new Map<string, MetaPaidCreativeRow[]>();
    for (const r of creatives) {
      const arr = byAd.get(r.ad_id) ?? [];
      arr.push(r);
      byAd.set(r.ad_id, arr);
    }
    const out: Score[] = [];
    for (const [adId, rows] of byAd) {
      const agg = rows.reduce(
        (a, r) => {
          a.impr += r.impresiones ?? 0;
          a.spend += r.spend ?? 0;
          a.clicks += r.clicks ?? 0;
          a.plays += r.video_plays ?? 0;
          a.p25 += r.video_p25 ?? 0;
          a.p50 += r.video_p50 ?? 0;
          a.p75 += r.video_p75 ?? 0;
          a.p100 += r.video_p100 ?? 0;
          a.thruplay += r.video_thruplay ?? 0;
          a.inter += (r.reactions ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0);
          a.comments += r.comments ?? 0;
          return a;
        },
        { impr: 0, spend: 0, clicks: 0, plays: 0, p25: 0, p50: 0, p75: 0, p100: 0, thruplay: 0, inter: 0, comments: 0 },
      );
      const main = rows.slice().sort((x, y) => (y.impresiones ?? 0) - (x.impresiones ?? 0))[0]!;
      const q = agg.plays + agg.p25 + agg.p100 > 0
        ? { p25: agg.impr ? (agg.p25 / agg.impr) * 100 : 0, p50: agg.impr ? (agg.p50 / agg.impr) * 100 : 0, p75: agg.impr ? (agg.p75 / agg.impr) * 100 : 0, p100: agg.impr ? (agg.p100 / agg.impr) * 100 : 0 }
        : quartiles(main);
      const permalink = main.instagram_permalink_url ?? main.permalink_url;
      const anPiece = analysisByLink.get(main.instagram_permalink_url ?? "") ?? null;
      const an = anPiece?.analysis ?? undefined;
      out.push({
        ad_id: adId,
        name: main.ad_name ?? adId,
        thumb: main.thumbnail_url ?? main.image_url,
        permalink,
        campaign: main.campaign_name || main.adset_name || "Sin campaña",
        impr: agg.impr,
        spend: agg.spend,
        hookRate: agg.impr > 0 && agg.plays > 0 ? (agg.plays / agg.impr) * 100 : null,
        q,
        retention: agg.plays > 0 && agg.p100 > 0 ? (agg.p100 / agg.plays) * 100 : null,
        ctr: agg.impr > 0 ? (agg.clicks / agg.impr) * 100 : null,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : null,
        cpThruplay: agg.thruplay > 0 ? agg.spend / agg.thruplay : null,
        interactions: agg.inter,
        engRate: agg.impr > 0 ? (agg.inter / agg.impr) * 100 : null,
        comments: agg.comments,
        cred: an?.credibilidad?.nivel,
        persu: an?.intencion_compra?.nivel,
        percep: an?.percepcion_marca?.nivel,
        piece: anPiece,
        lowSample: agg.impr < LOW_IMPR,
      });
    }
    return out;
  }, [creatives, analysisByLink]);

  // Tests = grupos por campaña. Dentro de cada uno, ranking por hook rate.
  const tests = useMemo(() => {
    const g = new Map<string, Score[]>();
    for (const s of scores) {
      const arr = g.get(s.campaign) ?? [];
      arr.push(s);
      g.set(s.campaign, arr);
    }
    return [...g.entries()]
      .map(([campaign, items]) => {
        // Primero las piezas con comentarios (las que tienen análisis), y al final
        // las que no; dentro de cada grupo, ranking por hook rate.
        const ranked = items.slice().sort((a, b) => {
          const d = (hasQual(b) ? 1 : 0) - (hasQual(a) ? 1 : 0);
          return d !== 0 ? d : (b.hookRate ?? -1) - (a.hookRate ?? -1);
        });
        const bestHook = Math.max(0, ...ranked.map((s) => s.hookRate ?? 0));
        const bestCtr = Math.max(0, ...ranked.map((s) => s.ctr ?? 0));
        const bestEng = Math.max(0, ...ranked.map((s) => s.engRate ?? 0));
        const bestRet = Math.max(0, ...ranked.map((s) => s.retention ?? 0));
        // Ganador: mejor hook rate con muestra suficiente; si ninguno, tentativo.
        const winner = ranked.find((s) => !s.lowSample && (s.hookRate ?? 0) > 0)?.ad_id ?? ranked[0]?.ad_id;
        return { campaign, ranked, bestHook, bestCtr, bestEng, bestRet, winner, allLow: ranked.every((s) => s.lowSample) };
      })
      .sort((a, b) => b.ranked.length - a.ranked.length || b.bestHook - a.bestHook);
  }, [scores]);

  if (scores.length === 0) {
    return (
      <section className="space-y-3">
        <div className="mt-2">
          <h3 className="text-sm font-medium">Testeo de creativos</h3>
          <p className="text-xs text-muted-foreground">Compará qué videos UGC rinden mejor y sacá aprendizajes para los próximos.</p>
        </div>
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no hay piezas UGC pauteadas sincronizadas para este período.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="mt-2">
        <h3 className="text-sm font-medium">Testeo de creativos</h3>
        <p className="text-xs text-muted-foreground">
          Por pieza dentro de cada campaña (test): primero las métricas del posteo, después la <strong>calidad de contenido</strong> (retención + reacción, para toda pieza) y —si tiene comentarios— la <strong>validación cualitativa</strong> (credibilidad, persuasión y percepción de marca). Las piezas con comentarios van primero; las que no tienen, al final.
        </p>
      </div>

      {tests.map((t) => (
        <div key={t.campaign} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{t.campaign}</div>
              <div className="text-[10px] text-muted-foreground">{t.ranked.length} {t.ranked.length === 1 ? "pieza" : "piezas"} en test</div>
            </div>
            {t.allLow && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-600">muestra chica · tomar con pinzas</span>}
          </div>
          {(() => {
            const conAn = t.ranked.filter(hasQual);
            const sinAn = t.ranked.filter((s) => !hasQual(s));
            const card = (s: Score) => {
              const isWinner = s.ad_id === t.winner && (s.hookRate ?? 0) > 0;
              const cq = contentQuality(s.retention, s.engRate, t.bestRet, t.bestEng);
              return (
                <div key={s.ad_id} className="rounded-lg border bg-background p-3">
                  {/* 1) Info del posteo */}
                  <div className="flex gap-3">
                    <div className="relative shrink-0">
                      {s.thumb ? (
                        s.permalink ? (
                          <a href={s.permalink} target="_blank" rel="noopener" title="Ver el video" className="group relative block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.thumb} alt={s.name} className="h-20 w-[3.5rem] rounded object-cover transition group-hover:opacity-90" loading="lazy" />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 pl-0.5 text-[10px] text-white shadow">▶</span>
                            </span>
                          </a>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.thumb} alt={s.name} className="h-20 w-[3.5rem] rounded object-cover" loading="lazy" />
                        )
                      ) : (
                        <div className="flex h-20 w-[3.5rem] items-center justify-center rounded bg-muted text-[9px] text-muted-foreground">sin<br />thumb</div>
                      )}
                      {isWinner && <span className="absolute -left-1 -top-2 z-10 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">🏆</span>}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {s.permalink ? (
                          <a href={s.permalink} target="_blank" rel="noopener" className="truncate text-xs font-semibold hover:underline">{s.name}</a>
                        ) : (
                          <span className="truncate text-xs font-semibold">{s.name}</span>
                        )}
                        {s.lowSample && <span className="shrink-0 text-[9px] text-amber-600">n bajo</span>}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
                        <Metric label="Hook rate" value={pct(s.hookRate)} big cls={tone(s.hookRate, t.bestHook, "higher")} />
                        <Metric label="Retención" value={pct(s.retention)} hint="del 100%" />
                        <Metric label="CTR" value={pct(s.ctr, 2)} cls={tone(s.ctr, t.bestCtr, "higher")} />
                        <Metric label="Interacción" value={pct(s.engRate, 2)} cls={tone(s.engRate, t.bestEng, "higher")} hint={`${fmtNum(s.interactions)} int.`} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span>{fmtNum(s.impr)} impr.</span>
                        <span>{formatCurrency(s.spend)} inv.</span>
                        {s.cpc != null && <span>CPC {formatCurrency(s.cpc)}</span>}
                        {s.comments > 0 && <span>💬 {fmtNum(s.comments)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Calidad de contenido — lectura por engagement (toda pieza) */}
                  {cq && (
                    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Calidad de contenido</span>
                      <span className={`text-xs font-bold capitalize ${nivelColor(cq.nivel)}`}>{cq.nivel}</span>
                      <span className="text-[11px] text-muted-foreground">· {cq.detalle}</span>
                    </div>
                  )}

                  {/* 2) Análisis desde comentarios reales */}
                  {(s.piece?.analysis || (s.piece?.comments.length ?? 0) > 0) ? (
                    <div className="mt-3 space-y-2.5 border-t pt-3">
                      {s.piece?.analysis ? (
                        <>
                          {/* Señales cualitativas destacadas */}
                          <div className="grid grid-cols-3 gap-2">
                            <QualTile label="Credibilidad" nivel={s.piece.analysis.credibilidad?.nivel} />
                            <QualTile label="Persuasión" nivel={s.piece.analysis.intencion_compra?.nivel} />
                            <QualTile label="Percep. marca" nivel={s.piece.analysis.percepcion_marca?.nivel} />
                          </div>
                          {s.piece.analysis.resumen && <p className="text-xs leading-relaxed text-foreground/80">{s.piece.analysis.resumen}</p>}
                          <ul className="space-y-1 text-[11px] text-muted-foreground">
                            {s.piece.analysis.credibilidad?.detalle && <li><strong className="text-foreground/70">Credibilidad:</strong> {s.piece.analysis.credibilidad.detalle}</li>}
                            {s.piece.analysis.intencion_compra?.detalle && <li><strong className="text-foreground/70">Persuasión / intención de compra:</strong> {s.piece.analysis.intencion_compra.detalle}</li>}
                            {s.piece.analysis.percepcion_marca?.detalle && <li><strong className="text-foreground/70">Percepción de marca:</strong> {s.piece.analysis.percepcion_marca.detalle}</li>}
                          </ul>
                          {s.piece.analysis.mejoras && s.piece.analysis.mejoras.length > 0 && (
                            <div>
                              <div className="text-[11px] font-semibold">Mejoras de contenido/guión</div>
                              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                                {s.piece.analysis.mejoras.map((m, i) => <li key={i}>{m}</li>)}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Análisis de comentarios pendiente — corré el cron <code>ugc-comments-analysis</code>.</p>
                      )}
                      {(s.piece?.comments.length ?? 0) > 0 && (
                        <details>
                          <summary className="cursor-pointer text-[11px] font-medium">Ver comentarios ({s.piece!.comments.length})</summary>
                          <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto">
                            {s.piece!.comments.map((c, i) => (
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
                  ) : (
                    <p className="mt-3 border-t pt-3 text-[11px] italic text-muted-foreground">
                      Sin comentarios para analizar — la lectura de esta pieza es por calidad de contenido (arriba).
                    </p>
                  )}
                </div>
              );
            };
            return (
              <div className="space-y-3 p-3">
                {conAn.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">{conAn.map(card)}</div>
                )}
                {sinAn.length > 0 && (
                  <>
                    {conAn.length > 0 && (
                      <div className="px-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Sin comentarios · lectura por calidad de contenido
                      </div>
                    )}
                    <div className="grid gap-3 lg:grid-cols-2">{sinAn.map(card)}</div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      ))}
    </section>
  );
}

function Metric({ label, value, hint, big, cls }: { label: string; value: string; hint?: string; big?: boolean; cls?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${big ? "text-base font-bold" : "text-xs font-semibold"} tabular-nums ${cls ?? ""}`}>{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// Señal cualitativa destacada (credibilidad · persuasión · percepción de marca).
function QualTile({ label, nivel }: { label: string; nivel?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 text-center">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold capitalize ${nivelColor(nivel)}`}>{nivel ?? "—"}</div>
    </div>
  );
}
