// Señales de REDES (orgánico IG + FB). Port de organic-insights de Drean (30d vs 30d previos
// por plataforma × formato) + reglas nuevas: ER por formato vs la mediana propia, mejor día,
// top/bottom post, tendencia mensual, sentimiento (nivel, giro y temas negativos) y brecha
// competitiva (ER, cadencia, pilares, sentimiento). Puro: recibe la data ya leída.
import type { IgOrganicSummary, FbOrganicSummary, CompetitorPost, Red } from "./model";
import { computeBrandStats, normalizePilar } from "./model";
import { type Signal, sortSignals, median, sum, avg, deltaPct, fInt, fNum, fPct, fDelta, clip, r2 } from "./types";
import { rangoEsperado, dentroDeLoNormal, datosRango } from "./banda";
import { erComparablePorMarca, pautaPorMarca } from "../redes-competencia";
import { temaGaps } from "../redes-temas";
import { paidShare } from "../fb-paid";
import type { AgeSnap } from "../post-snapshots-core";

export interface SentimentLite { network: "IG" | "FB"; postId: string; ts?: number; sentiment: { positivo: number; negativo: number; neutro: number; temas?: string[]; resumen?: string } | null }
export interface RedesSignalInput {
  ig?: IgOrganicSummary | null;
  fb?: FbOrganicSummary | null;
  sentiment?: SentimentLite[];
  competitor?: { posts: CompetitorPost[]; followers: { marca: string; red_social: Red; followers: number }[]; ownBrand: string; snaps?: AgeSnap[] } | null;
  refDate?: Date; // "hoy" del análisis (default: ahora)
}

// Post unificado (solo ORGÁNICO: los pautados se excluyen — inflan alcance y ensucian el ER).
export interface UPost { red: "IG" | "FB"; id: string; ts: number; formato: string; reach: number; eng: number; caption: string; permalink: string | null }

const DAY = 86_400_000;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatoDe(red: "IG" | "FB", mt: string | null | undefined): string {
  const m = (mt ?? "").toUpperCase();
  if (/STORY|STORIES/.test(m)) return "Stories"; // Drean: meta_posts trae STORY / FEED / REELS
  if (/REEL|VIDEO/.test(m)) return "Reels/Video";
  if (/FEED/.test(m)) return "Feed";
  if (/CAROUSEL|ALBUM|SIDECAR/.test(m)) return "Carrusel";
  if (/IMAGE|PHOTO/.test(m)) return "Imagen";
  if (red === "FB" && /LINK|SHARE/.test(m)) return "Link";
  if (red === "FB" && /STATUS/.test(m)) return "Texto";
  return m ? "Otro" : "Imagen";
}

export function unifyPosts(ig?: IgOrganicSummary | null, fb?: FbOrganicSummary | null): UPost[] {
  const out: UPost[] = [];
  if (ig?.ok) for (const p of ig.topPosts ?? []) {
    if (p.insightsFailed || (p as { paid?: boolean }).paid) continue;
    out.push({ red: "IG", id: p.id, ts: new Date(p.timestamp).getTime(), formato: formatoDe("IG", p.media_type), reach: p.reach || 0, eng: p.engagement || 0, caption: p.caption ?? "", permalink: p.permalink });
  }
  if (fb?.ok) for (const p of fb.topPosts ?? []) {
    if (p.insightsFailed || p.paid) continue;
    out.push({ red: "FB", id: p.id, ts: new Date(p.timestamp).getTime(), formato: formatoDe("FB", p.media_type), reach: p.reach || 0, eng: p.engagement || 0, caption: p.message ?? "", permalink: p.permalink });
  }
  return out.filter((p) => Number.isFinite(p.ts));
}

export interface Bucket { posts: number; reach: number; eng: number; rpp: number; er: number }
export function bucketOf(ps: UPost[]): Bucket {
  const reach = sum(ps.map((p) => p.reach)), eng = sum(ps.map((p) => p.eng));
  return { posts: ps.length, reach, eng, rpp: ps.length ? reach / ps.length : 0, er: reach > 0 ? (eng / reach) * 100 : 0 };
}
const erOf = (p: UPost) => (p.reach > 0 ? (p.eng / p.reach) * 100 : 0);
const red = (r: string) => (r === "IG" ? "Instagram" : "Facebook");

// Agregado por formato de una plataforma (para el pack de datos y las reglas).
export function formatTable(posts: UPost[]): { red: string; formato: string; posts: number; alcancePorPost: number; er: number }[] {
  const m = new Map<string, UPost[]>();
  for (const p of posts) { const k = `${p.red}|${p.formato}`; m.set(k, [...(m.get(k) ?? []), p]); }
  return [...m.entries()].map(([k, ps]) => { const b = bucketOf(ps); const [rd = "", formato = ""] = k.split("|"); return { red: rd, formato, posts: b.posts, alcancePorPost: Math.round(b.rpp), er: r2(b.er) }; })
    .sort((a, b) => b.posts - a.posts);
}

export function computeRedesSignals(inp: RedesSignalInput): Signal[] {
  const out: Signal[] = [];
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "redes" });
  const now = (inp.refDate ?? new Date()).getTime();
  const posts = unifyPosts(inp.ig, inp.fb);

  // ── 1. 30 días vs 30 días previos, por plataforma × formato (port Drean) ──
  const curP = posts.filter((p) => p.ts > now - 30 * DAY && p.ts <= now);
  const prevP = posts.filter((p) => p.ts > now - 60 * DAY && p.ts <= now - 30 * DAY);
  const keys = new Set([...curP, ...prevP].map((p) => `${p.red}|${p.formato}`));
  for (const k of keys) {
    const [rd = "", fmt = ""] = k.split("|");
    const c = bucketOf(curP.filter((p) => `${p.red}|${p.formato}` === k));
    const pv = bucketOf(prevP.filter((p) => `${p.red}|${p.formato}` === k));
    const lbl = `${red(rd)} ${fmt}`;
    const datos = { red: rd, formato: fmt, actual: { posts: c.posts, alcancePorPost: Math.round(c.rpp), er: r2(c.er) }, previo: { posts: pv.posts, alcancePorPost: Math.round(pv.rpp), er: r2(pv.er) } };
    if (c.posts >= 3 && pv.posts >= 3) {
      const d = deltaPct(c.rpp, pv.rpp) ?? 0;
      if (d < -15) S({
        key: `redes_${rd}_${fmt}_reach_per_post_drop`, tipo: "alerta", prioridad: d < -30 ? "alta" : "media",
        titulo: `${lbl}: cada publicación llega a ${fDelta(d)} gente que en los 30 días anteriores (alcance por pieza)`,
        descripcion: `Últimos 30 días: ${c.posts} publicaciones que vio, en promedio, ${fInt(c.rpp)} personas cada una (alcance); en los 30 días anteriores fueron ${pv.posts} publicaciones con ${fInt(pv.rpp)} personas cada una.`,
        acciones: [`Mirá los mejores ${fmt.toLowerCase()} del período anterior: cómo arrancaban (el gancho) y de qué hablaban, y pedile al equipo de contenido que repita esa idea`, "Fijate si cambió cuántas veces por semana o en qué horario se publica", "Revisá si cambió la mezcla de temas (producto / marca / promociones)"],
        datos: { ...datos, deltaPct: r2(d) },
        impacto: { metrica: "Alcance perdido en el período", valor: Math.round((pv.rpp - c.rpp) * c.posts), unidad: "personas" },
      });
      if (d >= 25) S({
        key: `redes_${rd}_${fmt}_reach_opportunity`, tipo: "oportunidad", prioridad: d > 50 ? "alta" : "media",
        titulo: `${lbl}: cada publicación llega a ${fDelta(d)} gente que antes (alcance por pieza) — conviene hacer más`,
        descripcion: `${c.posts} publicaciones en los últimos 30 días llegaron, en promedio, a ${fInt(c.rpp)} personas cada una (antes, ${fInt(pv.rpp)}).`,
        acciones: [`Publicá más ${fmt.toLowerCase()} en ${red(rd)}`, "Anotá qué tienen en común las mejores (tema, duración, cómo arrancan) y convertilo en una receta para el equipo", "Poné plata de pauta detrás de las 1 o 2 mejores publicaciones"],
        datos: { ...datos, deltaPct: r2(d) },
        impacto: { metrica: "Alcance adicional en el período", valor: Math.round((c.rpp - pv.rpp) * c.posts), unidad: "personas" },
      });
    }
    if (c.reach >= 1000 && pv.reach >= 1000) {
      const d = deltaPct(c.er, pv.er) ?? 0;
      if (d < -15) S({
        key: `redes_${rd}_${fmt}_eng_rate_drop`, tipo: "alerta", prioridad: d < -30 ? "alta" : "media",
        titulo: `${lbl}: la gente interactúa ${fDelta(d)} que en los 30 días anteriores (tasa de interacción o engagement rate)`,
        descripcion: `De cada 100 personas que ven una publicación, ahora ${fPct(c.er, 2)} le da me gusta, comenta, guarda o comparte (antes, ${fPct(pv.er, 2)}). Llegás a gente, pero responde menos.`,
        acciones: ["Invitá a responder: preguntas, encuestas, \"guardalo\" o \"compartilo con alguien\" (llamados a la acción)", "Revisá los primeros 3 segundos del video o la primera línea del texto: ahí se decide si la gente se queda", "Leé los comentarios: ¿se entiende el mensaje?"],
        datos: { ...datos, deltaPct: r2(d) },
        impacto: { metrica: "Interacciones perdidas en el período", valor: Math.round(((pv.er - c.er) / 100) * c.reach), unidad: "interacciones" },
      });
    }
    if (c.posts >= 3 || pv.posts >= 3) {
      const d = deltaPct(c.posts, pv.posts);
      if (d != null && Math.abs(d) >= 50) S({
        key: `redes_${rd}_${fmt}_volume_change`, tipo: "info", prioridad: "baja",
        titulo: `${lbl}: se publicó ${fDelta(d)} ${d > 0 ? "más" : "menos"} (${pv.posts} → ${c.posts} publicaciones)`,
        descripcion: d > 0 ? "Si cada publicación no llega a más gente, puede que la audiencia se esté cansando de ver tanto." : "Confirmá si publicar menos fue una decisión o se perdió el ritmo.",
        acciones: d > 0 ? ["Compará a cuánta gente llega cada publicación antes y después de publicar más"] : ["Confirmá con el equipo si fue a propósito", "Fijate si cada publicación llega a más gente y compensa que haya menos"],
        datos,
      });
    }
  }

  // ── 2. ER por formato vs la mediana propia (año) — qué formato rinde y cuál está subutilizado ──
  for (const rd of ["IG", "FB"] as const) {
    const ps = posts.filter((p) => p.red === rd && p.reach > 0);
    if (ps.length < 8) continue;
    const med = median(ps.map(erOf));
    if (med <= 0) continue;
    const fmts = formatTable(ps).filter((f) => f.posts >= 3);
    const best = [...fmts].sort((a, b) => b.er - a.er)[0];
    const worst = [...fmts].sort((a, b) => a.er - b.er)[0];
    if (best && best.er >= med * 1.3 && best.posts / ps.length < 0.4) {
      const extra = worst && worst.formato !== best.formato ? Math.round(worst.posts * 0.3) * worst.alcancePorPost * ((best.er - worst.er) / 100) : 0;
      S({
        key: `redes_${rd}_format_underused`, tipo: "oportunidad", prioridad: best.er >= med * 1.6 ? "alta" : "media",
        titulo: `${red(rd)}: en ${best.formato} la gente interactúa ${(best.er / med).toFixed(1)} veces más que en tu publicación típica, pero es solo el ${fPct((best.posts / ps.length) * 100, 0)} de lo que publicás`,
        descripcion: `En ${best.formato}, ${fPct(best.er, 2)} de los que lo ven interactúa (tasa de interacción o ER); en tu publicación típica, ${fPct(med, 2)} (${best.posts} publicaciones en el año).${worst && worst.formato !== best.formato ? ` El formato más flojo es ${worst.formato} (${fPct(worst.er, 2)}, ${worst.posts} publicaciones).` : ""}`,
        acciones: [`Pasá parte del calendario de publicaciones a ${best.formato}`, worst && worst.formato !== best.formato ? `Cambiá ~30% de las publicaciones de ${worst.formato} por ${best.formato}` : "Mantené cuántas veces publicás el formato que mejor funciona", "En 30 días, mirá si subieron el alcance por publicación y la interacción"],
        datos: { red: rd, medianaEr: r2(med), formatos: fmts },
        ...(extra > 0 ? { impacto: { metrica: "Interacciones adicionales estimadas (mix de formatos)", valor: Math.round(extra), unidad: "interacciones" } } : {}),
      });
    }
    if (worst && worst !== best && worst.er <= med * 0.7 && worst.posts / ps.length >= 0.2) S({
      key: `redes_${rd}_format_lagging`, tipo: "alerta", prioridad: "media",
      titulo: `${red(rd)}: ${worst.formato} genera apenas el ${fPct((worst.er / med) * 100, 0)} de la interacción de tu publicación típica y ocupa el ${fPct((worst.posts / ps.length) * 100, 0)} del calendario`,
      descripcion: `Interactúa el ${fPct(worst.er, 2)} de los que lo ven (tasa de interacción o ER), contra ${fPct(med, 2)} en tu publicación típica, en ${worst.posts} publicaciones.`,
      acciones: [`Revisá con el equipo de contenido cómo se están haciendo los ${worst.formato}`, "Reasigná parte de esas publicaciones al formato donde la gente más interactúa"],
      datos: { red: rd, medianaEr: r2(med), formato: worst },
    });
  }

  // ── 3. Mejor día de publicación (≥ 20 piezas; día con ≥ 3 piezas y ER ≥ 1,3× la mediana) ──
  {
    const ps = posts.filter((p) => p.reach > 0);
    if (ps.length >= 20) {
      const med = median(ps.map(erOf));
      const byDay = new Map<number, UPost[]>();
      for (const p of ps) { const d = new Date(p.ts - 3 * 3600_000).getUTCDay(); byDay.set(d, [...(byDay.get(d) ?? []), p]); } // hora AR
      const rows = [...byDay.entries()].filter(([, v]) => v.length >= 3).map(([d, v]) => ({ dia: DIAS[d], posts: v.length, er: r2(bucketOf(v).er) })).sort((a, b) => b.er - a.er);
      if (rows[0] && med > 0 && rows[0].er >= med * 1.3) S({
        key: "redes_best_weekday", metrica: null, tipo: "info", prioridad: "baja",
        titulo: `Lo que se publica los ${rows[0].dia} genera más interacción: ${fPct(rows[0].er, 2)} contra ${fPct(med, 2)} de tu publicación típica (tasa de interacción o ER)`,
        descripcion: `Sobre ${ps.length} publicaciones sin pauta del año. Ranking por día: ${rows.slice(0, 4).map((r) => `${r.dia} ${fPct(r.er, 2)} (${r.posts})`).join(" · ")}.`,
        acciones: [`Programá las publicaciones más importantes para los ${rows[0].dia}`, "Probalo durante 4 semanas y compará"],
        datos: { medianaEr: r2(med), porDia: rows },
      });
    }
  }

  // ── 4. Top / bottom post (30 días; si hay pocas piezas, 90 días) ──
  {
    let win = curP.filter((p) => p.reach > 0);
    if (win.length < 5) win = posts.filter((p) => p.ts > now - 90 * DAY && p.reach > 0);
    if (win.length >= 3) {
      const medR = median(win.map((p) => p.reach));
      const medEr = median(win.map(erOf));
      const top = win.filter((p) => p.reach >= Math.max(300, medR * 0.5)).sort((a, b) => erOf(b) - erOf(a))[0];
      if (top && medEr > 0 && erOf(top) >= medEr * 1.5) S({
        key: "redes_top_post", tipo: "oportunidad", prioridad: "media",
        titulo: `Publicación destacada en ${red(top.red)}: la gente interactuó ${(erOf(top) / medEr).toFixed(1)} veces más que con tu publicación típica (${fPct(erOf(top), 2)} — ER)`,
        descripcion: `"${clip(top.caption, 110)}" — ${top.formato}, la vieron ${fInt(top.reach)} personas y tuvo ${fInt(top.eng)} interacciones.`,
        acciones: ["Repetí el tema y el formato en las próximas publicaciones", "Si encaja con la campaña del momento, ponele plata de pauta"],
        datos: { permalink: top.permalink, red: top.red, formato: top.formato, alcance: top.reach, interacciones: top.eng, er: r2(erOf(top)), medianaEr: r2(medEr) },
      });
      const bottom = win.filter((p) => p.reach >= medR).sort((a, b) => erOf(a) - erOf(b))[0];
      if (bottom && bottom !== top && medEr > 0 && erOf(bottom) <= medEr * 0.5) S({
        key: "redes_bottom_post", metrica: "alcance_organico", tipo: "info", prioridad: "baja",
        titulo: `Publicación que vio mucha gente pero casi nadie respondió en ${red(bottom.red)}: ${fPct(erOf(bottom), 2)} de interacción (ER)`,
        descripcion: `"${clip(bottom.caption, 110)}" — la vieron ${fInt(bottom.reach)} personas pero solo tuvo ${fInt(bottom.eng)} interacciones (tu publicación típica: ${fPct(medEr, 2)}).`,
        acciones: ["Pensá por qué no enganchó: el tema, el formato o que no invitaba a hacer nada (llamado a la acción)", "No repetir esa fórmula"],
        datos: { permalink: bottom.permalink, red: bottom.red, formato: bottom.formato, alcance: bottom.reach, interacciones: bottom.eng, er: r2(erOf(bottom)) },
      });
    }
  }

  // ── 5. Tendencia mensual (IG): último mes cerrado vs promedio de los 3 anteriores ──
  {
    const ref = new Date(now);
    const closed = (inp.ig?.ok ? inp.ig.monthly : []).filter((m) => (m.anio ?? ref.getFullYear()) < ref.getFullYear() || m.mesIdx < ref.getMonth());
    const withReach = closed.filter((m) => (m.alcance ?? 0) > 0);
    if (withReach.length >= 4) {
      const last = withReach[withReach.length - 1]!;
      const base = withReach.slice(-4, -1);
      const baseAlc = avg(base.map((m) => m.alcance ?? 0));
      const dA = deltaPct(last.alcance ?? 0, baseAlc) ?? 0;
      const erM = (m: typeof last) => ((m.alcance ?? 0) > 0 ? ((m.engagement ?? 0) / (m.alcance ?? 1)) * 100 : 0);
      const dE = deltaPct(erM(last), avg(base.map(erM))) ?? 0;
      // Rango esperado con toda la historia cerrada (lib/stats): caídas dentro de lo normal no alertan.
      const prevs = withReach.slice(0, -1);
      const evA = rangoEsperado(prevs.map((m) => m.alcance ?? 0), last.alcance ?? 0);
      const evE = rangoEsperado(prevs.map(erM), erM(last));
      const rA = datosRango(evA), rE = datosRango(evE);
      if (dA <= -20 && !dentroDeLoNormal(evA)) S({
        key: "redes_ig_monthly_reach_drop", tipo: "alerta", prioridad: dA <= -35 ? "alta" : "media",
        titulo: `Instagram ${MES[last.mesIdx]}: llegaste a ${fDelta(dA)} gente que en el promedio de los 3 meses anteriores (alcance)`,
        descripcion: `${fNum(last.alcance ?? 0)} personas contra ${fNum(baseAlc)} en promedio (${base.map((m) => `${MES[m.mesIdx]} ${fNum(m.alcance ?? 0)}`).join(", ")}).${rA ? ` Fuera del rango esperado (${fNum(rA.min)}–${fNum(rA.max)}).` : ""}`,
        acciones: ["Fijate cuántas veces se publicó ese mes y en qué formatos", "Revisá si hubo menos Reels: es el formato que llega a más gente"],
        datos: { mes: MES[last.mesIdx], alcance: last.alcance, promedio3m: Math.round(baseAlc), deltaPct: r2(dA), ...(rA ? { rangoEsperado: rA } : {}) },
        impacto: { metrica: "Alcance mensual perdido vs tendencia", valor: Math.round(baseAlc - (last.alcance ?? 0)), unidad: "personas" },
      });
      if (dE <= -20 && !dentroDeLoNormal(evE)) S({
        key: "redes_ig_monthly_er_drop", metrica: "engagement", tipo: "alerta", prioridad: "media",
        titulo: `Instagram ${MES[last.mesIdx]}: la gente interactuó ${fDelta(dE)} que en los 3 meses anteriores (tasa de interacción o engagement rate)`,
        descripcion: `Interactuó el ${fPct(erM(last), 2)} de los que vieron las publicaciones, contra ${fPct(avg(base.map(erM)), 2)} en promedio.${rE ? ` Fuera del rango esperado (${fPct(rE.min, 2)}–${fPct(rE.max, 2)}).` : ""}`,
        acciones: ["Revisá los temas del mes y si las publicaciones invitaban a responder (llamados a la acción)", "Mirá si a la competencia también le bajó: si le pasó a todos, es un cambio de Instagram (el algoritmo), no tuyo"],
        datos: { mes: MES[last.mesIdx], er: r2(erM(last)), promedio3m: r2(avg(base.map(erM))), deltaPct: r2(dE), ...(rE ? { rangoEsperado: rE } : {}) },
      });
    }
  }

  // ── 6. Sentimiento de comentarios ──
  const sent = (inp.sentiment ?? []).filter((s) => s.sentiment && s.sentiment.positivo + s.sentiment.negativo + s.sentiment.neutro > 0);
  if (sent.length) {
    const tot = (xs: SentimentLite[]) => { const pos = sum(xs.map((s) => s.sentiment!.positivo)), neg = sum(xs.map((s) => s.sentiment!.negativo)), neu = sum(xs.map((s) => s.sentiment!.neutro)); const t = pos + neg + neu; return { pos, neg, neu, t, negPct: t ? (neg / t) * 100 : 0, posPct: t ? (pos / t) * 100 : 0 }; };
    const T = tot(sent);
    // Temas de las piezas con ≥ 30% de comentarios negativos (frecuencia).
    const temasNeg = new Map<string, number>();
    for (const s of sent) { const x = s.sentiment!; const t = x.positivo + x.negativo + x.neutro; if (t && x.negativo / t >= 0.3) for (const tm of x.temas ?? []) { const k = tm.trim().toLowerCase(); if (k) temasNeg.set(k, (temasNeg.get(k) ?? 0) + x.negativo); } }
    const temas = [...temasNeg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    if (T.t >= 20 && T.negPct >= 20) S({
      key: "redes_sentiment_negative_high", tipo: "alerta", prioridad: T.negPct >= 30 ? "alta" : "media",
      titulo: `El ${fPct(T.negPct, 0)} de los comentarios analizados son negativos`,
      descripcion: `${fInt(T.neg)} negativos, ${fInt(T.pos)} positivos y ${fInt(T.neu)} neutros en ${sent.length} publicaciones.${temas.length ? ` Temas que más se repiten en las publicaciones con más críticas: ${temas.join(", ")}.` : ""}`,
      acciones: ["Respondé los comentarios y pasale los reclamos a atención al cliente", temas.length ? `Prepará publicaciones que respondan a: ${temas.slice(0, 3).join(", ")}` : "Agrupá los reclamos por tema", "Revisá si el problema es del producto o del servicio (no de cómo se comunica)"],
      datos: { positivos: T.pos, negativos: T.neg, neutros: T.neu, negPct: r2(T.negPct), temasNegativos: temas },
    });
    else if (T.t >= 20 && T.posPct >= 60) S({
      key: "redes_sentiment_positive", tipo: "info", prioridad: "baja",
      titulo: `La conversación es buena: el ${fPct(T.posPct, 0)} de los comentarios son positivos`,
      descripcion: `${fInt(T.pos)} positivos contra ${fInt(T.neg)} negativos en ${sent.length} publicaciones.`,
      acciones: ["Usá esos comentarios positivos como testimonio en avisos y en la web (prueba social)"],
      datos: { positivos: T.pos, negativos: T.neg, neutros: T.neu, posPct: r2(T.posPct) },
    });
    // Giro: últimos 30 días vs previos (se ubica cada pieza por su fecha de publicación).
    const tsById = new Map(posts.map((p) => [p.id, p.ts]));
    const sc = sent.filter((s) => (tsById.get(s.postId) ?? s.ts ?? 0) > now - 30 * DAY);
    const sp = sent.filter((s) => { const t = tsById.get(s.postId) ?? s.ts ?? 0; return t > now - 90 * DAY && t <= now - 30 * DAY; });
    const C = tot(sc), P = tot(sp);
    if (C.t >= 20 && P.t >= 20) {
      const dpp = C.negPct - P.negPct;
      if (dpp >= 10) S({
        key: "redes_sentiment_shift_negative", metrica: "sentimiento", tipo: "alerta", prioridad: dpp >= 20 ? "alta" : "media",
        titulo: `Los comentarios se pusieron más negativos: de ${fPct(P.negPct, 0)} a ${fPct(C.negPct, 0)} negativos (+${dpp.toFixed(0)} puntos) en los últimos 30 días`,
        descripcion: `Se compararon ${fInt(C.t)} comentarios recientes con ${fInt(P.t)} de los 60 días anteriores.`,
        acciones: ["Mirá qué publicaciones juntan las críticas y por qué", "Si es un tema del producto, armá con atención al cliente una respuesta estándar"],
        datos: { negPctActual: r2(C.negPct), negPctPrevio: r2(P.negPct) },
      });
      else if (dpp <= -10) S({
        key: "redes_sentiment_shift_positive", metrica: "sentimiento", tipo: "info", prioridad: "baja",
        titulo: `Los comentarios mejoraron: los negativos bajaron de ${fPct(P.negPct, 0)} a ${fPct(C.negPct, 0)}`,
        descripcion: `Se compararon ${fInt(C.t)} comentarios recientes con ${fInt(P.t)} anteriores.`,
        acciones: ["Identificá qué publicaciones explican la mejora y seguí por ahí"],
        datos: { negPctActual: r2(C.negPct), negPctPrevio: r2(P.negPct) },
      });
    }
    // Pieza con foco de crisis: ≥ 10 comentarios y ≥ 50% negativos.
    const crisis = sent.map((s) => ({ s, t: s.sentiment!.positivo + s.sentiment!.negativo + s.sentiment!.neutro })).filter(({ s, t }) => t >= 10 && s.sentiment!.negativo / t >= 0.5).sort((a, b) => b.s.sentiment!.negativo - a.s.sentiment!.negativo)[0];
    if (crisis) S({
      key: "redes_sentiment_post_crisis", tipo: "alerta", prioridad: "alta",
      titulo: `Una publicación junta críticas: el ${fPct((crisis.s.sentiment!.negativo / crisis.t) * 100, 0)} de ${crisis.t} comentarios son negativos`,
      descripcion: `${crisis.s.sentiment!.resumen ? clip(crisis.s.sentiment!.resumen, 200) : "Sin resumen."}${crisis.s.sentiment!.temas?.length ? ` Temas: ${crisis.s.sentiment!.temas.join(", ")}.` : ""}`,
      acciones: ["Respondé en público y pasale cada caso a atención al cliente", "Evaluá si conviene pausar la pauta de esa publicación"],
      datos: { postId: crisis.s.postId, red: crisis.s.network, negativos: crisis.s.sentiment!.negativo, total: crisis.t },
    });
  }

  // ── 7. Benchmark competitivo (misma metodología para todas las marcas: ER por seguidor) ──
  const comp = inp.competitor;
  if (comp && comp.posts.length) {
    const stats = computeBrandStats(comp.posts, comp.followers);
    const own = stats.find((b) => b.marca === comp.ownBrand);
    const rivals = stats.filter((b) => b.marca !== comp.ownBrand && b.posts >= 3);
    if (own && own.posts >= 3 && rivals.length) {
      // ER COMPARABLE (sep-2026, corrige el sesgo de maduración): mediana de posts con 7+ días, o foto a
      // los 7 días de publicado (social_post_snapshots) si la marca tiene ≥ 3. Sin base madura → sin señal.
      const erc = erComparablePorMarca(comp.posts, comp.snaps ?? null);
      const erOf = (m: string) => erc.get(m);
      const ownEr = erOf(own.marca);
      const erRivals = rivals.map((b) => ({ marca: b.marca, er: erOf(b.marca) })).filter((x) => x.er && x.er.disponible && x.er.metodo !== "preliminar") as { marca: string; er: NonNullable<ReturnType<typeof erOf>> }[];
      const metodoEr = ownEr?.metodo === "edad_fija" && erRivals.every((x) => x.er.metodo === "edad_fija") ? "a 7 días de publicado (misma edad para todas las marcas)" : "mediana de posts con 7+ días";
      const leader = [...erRivals].sort((a, b) => b.er.value - a.er.value)[0];
      const medRivalEr = median(erRivals.map((x) => x.er.value));
      if (!leader || !ownEr || ownEr.metodo === "preliminar" || !ownEr.disponible) { /* sin base madura comparable → sin señal de ER */ }
      else if (leader.er.value > 0 && ownEr.value < leader.er.value * 0.7) S({
        key: "redes_comp_er_gap", tipo: "alerta", prioridad: ownEr.value < medRivalEr ? "alta" : "media",
        titulo: `Interacción por seguidor: ${fPct(ownEr.value, 3)} contra ${fPct(leader.er.value, 3)} de ${leader.marca}, la marca que más logra (engagement por seguidor o ER)`,
        descripcion: `La competencia típica logra ${fPct(medRivalEr, 3)} (medido ${metodoEr}). ${ownEr.value < medRivalEr ? "Estás por debajo de la competencia típica." : "Estás mejor que la competencia típica, pero lejos de la que más logra."}`,
        acciones: [`Mirá las mejores publicaciones de ${leader.marca}: de qué hablan, en qué formato y con qué tono`, "Probá publicaciones sobre los temas donde esa marca logra más interacción"],
        datos: { propio: r2(ownEr.value * 1000) / 1000, lider: { marca: leader.marca, er: r2(leader.er.value * 1000) / 1000 }, medianaCompetencia: r2(medRivalEr * 1000) / 1000, metodo: metodoEr },
      });
      else if (ownEr.value >= leader.er.value) S({
        key: "redes_comp_er_leader", tipo: "info", prioridad: "baja",
        titulo: `Sos la marca con más interacción por seguidor entre tus competidores (${fPct(ownEr.value, 3)} — engagement por seguidor)`,
        descripcion: `La sigue ${leader.marca} con ${fPct(leader.er.value, 3)} (medido ${metodoEr}).`,
        acciones: ["Seguí con los temas que te dan ese resultado", "Si publicás menos seguido que la competencia, aprovechalo publicando más"],
        datos: { propio: r2(ownEr.value * 1000) / 1000, segundo: { marca: leader.marca, er: r2(leader.er.value * 1000) / 1000 }, metodo: metodoEr },
      });
      const medPpw = median(rivals.map((b) => b.posts_per_week));
      if (medPpw > 0 && own.posts_per_week < medPpw * 0.6) S({
        key: "redes_comp_cadence_gap", tipo: "oportunidad", prioridad: "media",
        titulo: `Publicás ${own.posts_per_week.toFixed(1)} veces por semana; la competencia típica, ${medPpw.toFixed(1)}`,
        descripcion: "Aparecés menos que tus competidores: menos oportunidades de llegar a gente sin pagar (alcance orgánico).",
        acciones: ["Publicá más seguido, de a poco, con los formatos donde la gente más interactúa", "Reusá piezas de pauta o de creadores de contenido (UGC) para sostener el ritmo"],
        datos: { propio: r2(own.posts_per_week), medianaCompetencia: r2(medPpw) },
      });
      const medNeg = median(rivals.filter((b) => b.negativo > 0 || b.positivo > 0).map((b) => b.negativo));
      if (own.negativo > 0 && medNeg >= 0 && own.negativo >= medNeg + 10) S({
        key: "redes_comp_sentiment_gap", metrica: "sentimiento", tipo: "alerta", prioridad: "media",
        titulo: `Tus comentarios negativos son el ${fPct(own.negativo, 0)}; en la competencia típica, ${fPct(medNeg, 0)}`,
        descripcion: "La gente es más crítica con tu marca que con la competencia.",
        acciones: ["Identificá de qué se queja la gente con vos y no con los demás (producto, servicio, precio)"],
        datos: { propio: r2(own.negativo), medianaCompetencia: r2(medNeg) },
      });
    }
    // Pilares: el pilar que mejor rinde en la categoría y que la marca casi no usa.
    const pil = (xs: CompetitorPost[]) => { const m = new Map<string, number[]>(); for (const p of xs) { const k = normalizePilar(p.pilar); if (k && p.engagement != null) m.set(k, [...(m.get(k) ?? []), p.engagement]); } return m; };
    const ownPosts = comp.posts.filter((p) => p.marca === comp.ownBrand);
    const catP = pil(comp.posts.filter((p) => p.marca !== comp.ownBrand));
    const ownP = pil(ownPosts);
    const catRows = [...catP.entries()].filter(([, v]) => v.length >= 5).map(([k, v]) => ({ pilar: k, er: avg(v), posts: v.length })).sort((a, b) => b.er - a.er);
    const top = catRows[0];
    if (top && ownPosts.length >= 5) {
      const ownShare = ((ownP.get(top.pilar)?.length ?? 0) / ownPosts.length) * 100;
      if (ownShare < 10) S({
        key: "redes_comp_pillar_gap", metrica: "engagement", tipo: "oportunidad", prioridad: "media",
        titulo: `El tema "${top.pilar}" es el que más interacción le da a la competencia (${fPct(top.er, 2)}) y es solo el ${fPct(ownShare, 0)} de lo que publicás`,
        descripcion: `Interacción promedio por tema (pilar) en la competencia: ${catRows.slice(0, 4).map((r) => `${r.pilar} ${fPct(r.er, 2)}`).join(" · ")}.`,
        acciones: [`Probá 4 a 6 publicaciones sobre "${top.pilar}" el mes que viene`, "Compará su interacción contra tu publicación típica"],
        datos: { pilaresCompetencia: catRows.slice(0, 5).map((r) => ({ ...r, er: r2(r.er) })), sharePropio: r2(ownShare) },
      });
    }
  }

  // ── 8. Competencia que probablemente pauta sus posts (modelo de outliers, no dato cierto) ──
  if (comp && comp.posts.length) {
    const pauta = pautaPorMarca(comp.posts).filter((x) => x.marca !== comp.ownBrand && x.probables >= 2 && x.share >= 15);
    const top = pauta[0];
    if (top) S({
      key: "redes_comp_pauta_probable", tipo: "info", prioridad: top.alta >= 2 ? "media" : "baja",
      titulo: `${top.marca} probablemente le pone plata a ${top.probables} de sus ${top.posts} publicaciones (${fPct(top.share, 0)})`,
      descripcion: `Son publicaciones con muchísimas más reproducciones que lo normal para esa marca y muy pocas interacciones: el patrón de una publicación promocionada con pauta. Es una estimación (no hay dato público de pauta), sirve para no confundirse: parte de su alcance es pago.${pauta.length > 1 ? ` También: ${pauta.slice(1, 4).map((x) => `${x.marca} (${x.probables})`).join(", ")}.` : ""}`,
      acciones: ["No compares tu alcance sin pauta con el de esas publicaciones", "Confirmalo en Pauta de la competencia (Biblioteca de anuncios de Meta)"],
      datos: { marcas: pauta.slice(0, 5) },
    });
  }

  // ── 9. Temas que rinden en la competencia y no usás (tema corto por post, gpt-4o-mini en el cron) ──
  if (comp && comp.posts.length) {
    const gaps = temaGaps(comp.posts, comp.ownBrand);
    const g = gaps[0];
    if (g) S({
      key: "redes_comp_tema_gap", tipo: "oportunidad", prioridad: g.vsMediana >= 1.5 ? "media" : "baja",
      titulo: `El tema "${g.tema}" le da a la competencia ${g.vsMediana.toFixed(1)} veces más interacción que lo normal, y vos casi no lo usás`,
      descripcion: `${g.posts} publicaciones de ${g.marcas.slice(0, 4).join(", ")}, con ${fPct(g.er_mediana, 3)} de interacción por seguidor (valor típico).${gaps.length > 1 ? ` Otros temas en la misma situación: ${gaps.slice(1, 4).map((x) => `"${x.tema}"`).join(", ")}.` : ""} Ojo: es lo que se observa, no prueba que el tema sea la causa (puede venir con otro formato o con pauta).`,
      acciones: [`Probá 3 o 4 publicaciones sobre "${g.tema}" con el tono de Drean`, "A los 7 días, compará su interacción con tu publicación típica"],
      datos: { gaps: gaps.slice(0, 5).map((x) => ({ ...x, er_mediana: r2(x.er_mediana * 1000) / 1000 })) },
    });
  }

  // ── 10. Facebook: qué parte de las vistas de los posts viene de pauta (API is_from_ads) ──
  {
    const t = inp.fb?.ok ? inp.fb.totals : null;
    const sh = t && t.viewsSplitPosts ? paidShare({ organic: t.viewsOrganic ?? 0, paid: t.viewsPaid ?? 0 }) : null;
    if (t && sh != null && sh >= 0.4 && (t.viewsSplitPosts ?? 0) >= 5) S({
      key: "redes_fb_paid_share", tipo: "info", prioridad: "baja",
      titulo: `Facebook: el ${fPct(sh * 100, 0)} de las vistas de las publicaciones vino de pauta (pagas)`,
      descripcion: `Sobre ${t.viewsSplitPosts} publicaciones recientes donde Meta dice qué vistas fueron pagas (dato is_from_ads). ${t.paidByApi ? `${t.paidByApi} publicaciones quedaron fuera de lo "sin pauta" (orgánico) por ser mayormente pagas (y ${t.paidByHeuristic ?? 0} más porque llegaron a muchísima más gente que lo normal).` : ""} El alcance sin pauta del tablero ya las deja afuera.`,
      acciones: ["Mirá el alcance sin pauta de Facebook sin esas publicaciones", "Si la meta de alcance sin pauta se está cumpliendo gracias a publicaciones pagas, separalas"],
      datos: { vistasOrganicas: t.viewsOrganic ?? 0, vistasPagas: t.viewsPaid ?? 0, sharePago: r2(sh * 100), postsConDato: t.viewsSplitPosts },
    });
  }

  return sortSignals(out);
}
