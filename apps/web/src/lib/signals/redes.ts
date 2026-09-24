// Señales de REDES (orgánico IG + FB). Port de organic-insights de Drean (30d vs 30d previos
// por plataforma × formato) + reglas nuevas: ER por formato vs la mediana propia, mejor día,
// top/bottom post, tendencia mensual, sentimiento (nivel, giro y temas negativos) y brecha
// competitiva (ER, cadencia, pilares, sentimiento). Puro: recibe la data ya leída.
import type { IgOrganicSummary, FbOrganicSummary, CompetitorPost, Red } from "./model";
import { computeBrandStats, normalizePilar } from "./model";
import { type Signal, sortSignals, median, sum, avg, deltaPct, fInt, fNum, fPct, fDelta, clip, r2 } from "./types";

export interface SentimentLite { network: "IG" | "FB"; postId: string; ts?: number; sentiment: { positivo: number; negativo: number; neutro: number; temas?: string[]; resumen?: string } | null }
export interface RedesSignalInput {
  ig?: IgOrganicSummary | null;
  fb?: FbOrganicSummary | null;
  sentiment?: SentimentLite[];
  competitor?: { posts: CompetitorPost[]; followers: { marca: string; red_social: Red; followers: number }[]; ownBrand: string } | null;
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
        titulo: `${lbl}: el alcance por pieza cayó ${fDelta(d)} vs los 30 días previos`,
        descripcion: `Últimos 30 días: ${c.posts} piezas con ${fInt(c.rpp)} de alcance promedio, vs ${pv.posts} con ${fInt(pv.rpp)} en los 30 días anteriores.`,
        acciones: [`Revisar el hook y el tema de los mejores ${fmt.toLowerCase()} del período anterior y replicarlos`, "Validar si cambió la cadencia o el horario de publicación", "Chequear si cambió el mix de pilares (producto / branding / promo)"],
        datos: { ...datos, deltaPct: r2(d) },
        impacto: { metrica: "Alcance perdido en el período", valor: Math.round((pv.rpp - c.rpp) * c.posts), unidad: "personas" },
      });
      if (d >= 25) S({
        key: `redes_${rd}_${fmt}_reach_opportunity`, tipo: "oportunidad", prioridad: d > 50 ? "alta" : "media",
        titulo: `${lbl}: el alcance por pieza mejoró ${fDelta(d)} — doblar la apuesta`,
        descripcion: `${c.posts} piezas en los últimos 30 días promediaron ${fInt(c.rpp)} de alcance (vs ${fInt(pv.rpp)} antes).`,
        acciones: [`Subir la frecuencia de ${fmt.toLowerCase()} en ${red(rd)}`, "Identificar qué comparten las mejores piezas (tema, duración, hook) y sistematizarlo", "Amplificar con pauta las 1-2 mejores piezas"],
        datos: { ...datos, deltaPct: r2(d) },
        impacto: { metrica: "Alcance adicional en el período", valor: Math.round((c.rpp - pv.rpp) * c.posts), unidad: "personas" },
      });
    }
    if (c.reach >= 1000 && pv.reach >= 1000) {
      const d = deltaPct(c.er, pv.er) ?? 0;
      if (d < -15) S({
        key: `redes_${rd}_${fmt}_eng_rate_drop`, tipo: "alerta", prioridad: d < -30 ? "alta" : "media",
        titulo: `${lbl}: el engagement rate cayó ${fDelta(d)} vs los 30 días previos`,
        descripcion: `ER ${fPct(c.er, 2)} (vs ${fPct(pv.er, 2)}): el alcance se traduce en menos interacciones por persona alcanzada.`,
        acciones: ["Sumar CTAs conversacionales (preguntas, encuestas, guardá/compartí)", "Revisar los primeros 3 segundos / la primera línea del copy", "Leer los comentarios: ¿se entiende el mensaje?"],
        datos: { ...datos, deltaPct: r2(d) },
        impacto: { metrica: "Interacciones perdidas en el período", valor: Math.round(((pv.er - c.er) / 100) * c.reach), unidad: "interacciones" },
      });
    }
    if (c.posts >= 3 || pv.posts >= 3) {
      const d = deltaPct(c.posts, pv.posts);
      if (d != null && Math.abs(d) >= 50) S({
        key: `redes_${rd}_${fmt}_volume_change`, tipo: "info", prioridad: "baja",
        titulo: `${lbl}: el volumen ${d > 0 ? "subió" : "bajó"} ${fDelta(d)} (${pv.posts} → ${c.posts} piezas)`,
        descripcion: d > 0 ? "Si el alcance por pieza no acompaña, puede estar saturando a la audiencia." : "Confirmar si la baja de cadencia es una decisión o una pérdida de ritmo.",
        acciones: d > 0 ? ["Comparar alcance por pieza antes y después del aumento"] : ["Confirmar si fue intencional", "Ver si el alcance por pieza compensa el menor volumen"],
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
        titulo: `${red(rd)}: ${best.formato} rinde ${(best.er / med).toFixed(1)}× la mediana de ER y es solo el ${fPct((best.posts / ps.length) * 100, 0)} de lo publicado`,
        descripcion: `ER de ${best.formato} ${fPct(best.er, 2)} vs mediana propia por pieza ${fPct(med, 2)} (${best.posts} piezas en el año).${worst && worst.formato !== best.formato ? ` El formato más flojo es ${worst.formato} (ER ${fPct(worst.er, 2)}, ${worst.posts} piezas).` : ""}`,
        acciones: [`Mover parte del calendario hacia ${best.formato}`, worst && worst.formato !== best.formato ? `Reemplazar ~30% de las piezas de ${worst.formato} por ${best.formato}` : "Sostener la cadencia del formato ganador", "Medir el efecto en 30 días (alcance por pieza y ER)"],
        datos: { red: rd, medianaEr: r2(med), formatos: fmts },
        ...(extra > 0 ? { impacto: { metrica: "Interacciones adicionales estimadas (mix de formatos)", valor: Math.round(extra), unidad: "interacciones" } } : {}),
      });
    }
    if (worst && worst !== best && worst.er <= med * 0.7 && worst.posts / ps.length >= 0.2) S({
      key: `redes_${rd}_format_lagging`, tipo: "alerta", prioridad: "media",
      titulo: `${red(rd)}: ${worst.formato} rinde ${fPct((worst.er / med) * 100, 0)} de la mediana de ER y pesa ${fPct((worst.posts / ps.length) * 100, 0)} del calendario`,
      descripcion: `ER ${fPct(worst.er, 2)} vs mediana propia ${fPct(med, 2)} en ${worst.posts} piezas.`,
      acciones: [`Revisar el enfoque creativo de ${worst.formato}`, "Reasignar parte de esas piezas al formato de mejor ER"],
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
        key: "redes_best_weekday", tipo: "info", prioridad: "baja",
        titulo: `Los ${rows[0].dia} rinden mejor: ER ${fPct(rows[0].er, 2)} vs mediana ${fPct(med, 2)}`,
        descripcion: `Sobre ${ps.length} piezas orgánicas del año. Ranking por día: ${rows.slice(0, 4).map((r) => `${r.dia} ${fPct(r.er, 2)} (${r.posts})`).join(" · ")}.`,
        acciones: [`Programar las piezas clave los ${rows[0].dia}`, "Validar con un test de 4 semanas"],
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
        titulo: `Pieza destacada en ${red(top.red)}: ER ${fPct(erOf(top), 2)} (${(erOf(top) / medEr).toFixed(1)}× la mediana)`,
        descripcion: `"${clip(top.caption, 110)}" — ${top.formato}, ${fInt(top.reach)} de alcance, ${fInt(top.eng)} interacciones.`,
        acciones: ["Replicar el tema/formato en las próximas piezas", "Amplificarla con pauta si encaja con la campaña vigente"],
        datos: { permalink: top.permalink, red: top.red, formato: top.formato, alcance: top.reach, interacciones: top.eng, er: r2(erOf(top)), medianaEr: r2(medEr) },
      });
      const bottom = win.filter((p) => p.reach >= medR).sort((a, b) => erOf(a) - erOf(b))[0];
      if (bottom && bottom !== top && medEr > 0 && erOf(bottom) <= medEr * 0.5) S({
        key: "redes_bottom_post", tipo: "info", prioridad: "baja",
        titulo: `Pieza con buen alcance pero baja interacción en ${red(bottom.red)}: ER ${fPct(erOf(bottom), 2)}`,
        descripcion: `"${clip(bottom.caption, 110)}" — ${fInt(bottom.reach)} de alcance pero solo ${fInt(bottom.eng)} interacciones (mediana ER ${fPct(medEr, 2)}).`,
        acciones: ["Identificar por qué no enganchó (tema, formato o CTA)", "No repetir el patrón"],
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
      if (dA <= -20) S({
        key: "redes_ig_monthly_reach_drop", tipo: "alerta", prioridad: dA <= -35 ? "alta" : "media",
        titulo: `Instagram ${MES[last.mesIdx]}: alcance mensual ${fDelta(dA)} vs el promedio de los 3 meses previos`,
        descripcion: `${fNum(last.alcance ?? 0)} vs promedio ${fNum(baseAlc)} (${base.map((m) => `${MES[m.mesIdx]} ${fNum(m.alcance ?? 0)}`).join(", ")}).`,
        acciones: ["Cruzar con la cadencia y el mix de formatos del mes", "Revisar si hubo menos Reels (el formato de mayor alcance)"],
        datos: { mes: MES[last.mesIdx], alcance: last.alcance, promedio3m: Math.round(baseAlc), deltaPct: r2(dA) },
        impacto: { metrica: "Alcance mensual perdido vs tendencia", valor: Math.round(baseAlc - (last.alcance ?? 0)), unidad: "personas" },
      });
      if (dE <= -20) S({
        key: "redes_ig_monthly_er_drop", tipo: "alerta", prioridad: "media",
        titulo: `Instagram ${MES[last.mesIdx]}: engagement rate mensual ${fDelta(dE)} vs los 3 meses previos`,
        descripcion: `ER ${fPct(erM(last), 2)} vs promedio ${fPct(avg(base.map(erM)), 2)}.`,
        acciones: ["Revisar pilares y CTAs del mes", "Comparar con la competencia para descartar un efecto de algoritmo"],
        datos: { mes: MES[last.mesIdx], er: r2(erM(last)), promedio3m: r2(avg(base.map(erM))), deltaPct: r2(dE) },
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
      titulo: `${fPct(T.negPct, 0)} de los comentarios analizados son negativos`,
      descripcion: `${fInt(T.neg)} negativos, ${fInt(T.pos)} positivos y ${fInt(T.neu)} neutros en ${sent.length} piezas.${temas.length ? ` Temas recurrentes en las piezas con más críticas: ${temas.join(", ")}.` : ""}`,
      acciones: ["Responder y derivar los reclamos a atención al cliente", temas.length ? `Preparar contenido que responda a: ${temas.slice(0, 3).join(", ")}` : "Clasificar los reclamos por tema", "Revisar si el problema es de producto/servicio (no de comunicación)"],
      datos: { positivos: T.pos, negativos: T.neg, neutros: T.neu, negPct: r2(T.negPct), temasNegativos: temas },
    });
    else if (T.t >= 20 && T.posPct >= 60) S({
      key: "redes_sentiment_positive", tipo: "info", prioridad: "baja",
      titulo: `Conversación favorable: ${fPct(T.posPct, 0)} de los comentarios son positivos`,
      descripcion: `${fInt(T.pos)} positivos vs ${fInt(T.neg)} negativos en ${sent.length} piezas.`,
      acciones: ["Usar las reseñas/comentarios positivos como prueba social en pauta y web"],
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
        key: "redes_sentiment_shift_negative", tipo: "alerta", prioridad: dpp >= 20 ? "alta" : "media",
        titulo: `El sentimiento empeoró: negativos ${fPct(P.negPct, 0)} → ${fPct(C.negPct, 0)} (+${dpp.toFixed(0)} pp) en los últimos 30 días`,
        descripcion: `Base: ${fInt(C.t)} comentarios recientes vs ${fInt(P.t)} de los 60 días previos.`,
        acciones: ["Revisar qué piezas concentran las críticas y por qué", "Definir un protocolo de respuesta si es un tema de producto"],
        datos: { negPctActual: r2(C.negPct), negPctPrevio: r2(P.negPct) },
      });
      else if (dpp <= -10) S({
        key: "redes_sentiment_shift_positive", tipo: "info", prioridad: "baja",
        titulo: `El sentimiento mejoró: negativos ${fPct(P.negPct, 0)} → ${fPct(C.negPct, 0)}`,
        descripcion: `Base: ${fInt(C.t)} comentarios recientes vs ${fInt(P.t)} previos.`,
        acciones: ["Identificar qué contenido explica la mejora y sostenerlo"],
        datos: { negPctActual: r2(C.negPct), negPctPrevio: r2(P.negPct) },
      });
    }
    // Pieza con foco de crisis: ≥ 10 comentarios y ≥ 50% negativos.
    const crisis = sent.map((s) => ({ s, t: s.sentiment!.positivo + s.sentiment!.negativo + s.sentiment!.neutro })).filter(({ s, t }) => t >= 10 && s.sentiment!.negativo / t >= 0.5).sort((a, b) => b.s.sentiment!.negativo - a.s.sentiment!.negativo)[0];
    if (crisis) S({
      key: "redes_sentiment_post_crisis", tipo: "alerta", prioridad: "alta",
      titulo: `Una pieza concentra críticas: ${fPct((crisis.s.sentiment!.negativo / crisis.t) * 100, 0)} de ${crisis.t} comentarios son negativos`,
      descripcion: `${crisis.s.sentiment!.resumen ? clip(crisis.s.sentiment!.resumen, 200) : "Sin resumen."}${crisis.s.sentiment!.temas?.length ? ` Temas: ${crisis.s.sentiment!.temas.join(", ")}.` : ""}`,
      acciones: ["Responder públicamente y derivar los casos", "Evaluar si conviene pausar la amplificación de esa pieza"],
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
      const leader = [...rivals].sort((a, b) => b.engagement_promedio - a.engagement_promedio)[0]!;
      const medRivalEr = median(rivals.map((b) => b.engagement_promedio));
      if (leader.engagement_promedio > 0 && own.engagement_promedio < leader.engagement_promedio * 0.7) S({
        key: "redes_comp_er_gap", tipo: "alerta", prioridad: own.engagement_promedio < medRivalEr ? "alta" : "media",
        titulo: `Engagement por seguidor: ${fPct(own.engagement_promedio, 2)} vs ${fPct(leader.engagement_promedio, 2)} de ${leader.marca} (líder)`,
        descripcion: `Mediana de la competencia ${fPct(medRivalEr, 2)}. ${own.engagement_promedio < medRivalEr ? "Estás por debajo de la mediana del set competitivo." : "Estás sobre la mediana pero lejos del líder."}`,
        acciones: [`Analizar las piezas top de ${leader.marca} (pilar, formato, tono)`, "Testear los pilares donde el líder obtiene más engagement"],
        datos: { propio: r2(own.engagement_promedio), lider: { marca: leader.marca, er: r2(leader.engagement_promedio) }, medianaCompetencia: r2(medRivalEr) },
      });
      else if (own.engagement_promedio >= leader.engagement_promedio) S({
        key: "redes_comp_er_leader", tipo: "info", prioridad: "baja",
        titulo: `Liderás el engagement por seguidor del set competitivo (${fPct(own.engagement_promedio, 2)})`,
        descripcion: `Siguiente: ${leader.marca} con ${fPct(leader.engagement_promedio, 2)}.`,
        acciones: ["Sostener los pilares que explican el liderazgo", "Aprovecharlo con más volumen si la cadencia es menor que la competencia"],
        datos: { propio: r2(own.engagement_promedio), segundo: { marca: leader.marca, er: r2(leader.engagement_promedio) } },
      });
      const medPpw = median(rivals.map((b) => b.posts_per_week));
      if (medPpw > 0 && own.posts_per_week < medPpw * 0.6) S({
        key: "redes_comp_cadence_gap", tipo: "oportunidad", prioridad: "media",
        titulo: `Publicás ${own.posts_per_week.toFixed(1)} piezas/semana vs ${medPpw.toFixed(1)} de la mediana competitiva`,
        descripcion: "Menor presencia que el set competitivo: menos oportunidades de alcance orgánico.",
        acciones: ["Subir la cadencia gradualmente con los formatos de mejor ER", "Reutilizar piezas de pauta/UGC para sostener volumen"],
        datos: { propio: r2(own.posts_per_week), medianaCompetencia: r2(medPpw) },
      });
      const medNeg = median(rivals.filter((b) => b.negativo > 0 || b.positivo > 0).map((b) => b.negativo));
      if (own.negativo > 0 && medNeg >= 0 && own.negativo >= medNeg + 10) S({
        key: "redes_comp_sentiment_gap", tipo: "alerta", prioridad: "media",
        titulo: `Sentimiento negativo ${fPct(own.negativo, 0)} vs ${fPct(medNeg, 0)} de la mediana competitiva`,
        descripcion: "La conversación de tu marca es más crítica que la de la competencia.",
        acciones: ["Identificar el tema que diferencia tu conversación (producto, servicio, precio)"],
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
        key: "redes_comp_pillar_gap", tipo: "oportunidad", prioridad: "media",
        titulo: `El pilar "${top.pilar}" es el de mayor engagement en la competencia (${fPct(top.er, 2)}) y es solo el ${fPct(ownShare, 0)} de tus piezas`,
        descripcion: `Engagement promedio por pilar en la competencia: ${catRows.slice(0, 4).map((r) => `${r.pilar} ${fPct(r.er, 2)}`).join(" · ")}.`,
        acciones: [`Testear 4-6 piezas del pilar ${top.pilar} en el próximo mes`, "Medir ER vs tu mediana"],
        datos: { pilaresCompetencia: catRows.slice(0, 5).map((r) => ({ ...r, er: r2(r.er) })), sharePropio: r2(ownShare) },
      });
    }
  }

  return sortSignals(out);
}
