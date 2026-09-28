// Señales de SEO / SEARCH. Por categoría: keywords faltantes de alta demanda, quick wins
// (posición 4-20), keywords fuertes a defender, share of search vs el líder y su tendencia,
// visibilidad en LLMs (GEO) vs la de búsqueda, demanda genérica y brecha regional.
// Mismos buckets que el tablero (SerpSection): faltante = no rankea; débil = 4-20; fuerte = top-3.
// Puro: recibe SeoData ya leído.
import type { SeoData, SerpRow } from "./model";
import { ctrAt } from "../ctr-curve";
import { type Signal, sortSignals, sum, avg, deltaPct, fNum, fPct, fDelta, r2 } from "./types";
import { keywordBucketsCore as coreBuckets } from "./model";

// CTR orgánico por posición (solo para ESTIMAR clicks): curva única de lib/ctr-curve.ts (AWR 2026,
// punto medio con/sin Resumen IA). Reemplazó la curva vieja 28/15/10… que sobreestimaba el top-3.
export function ctrPos(p: number | null): number {
  return p == null ? 0 : ctrAt(p);
}

export interface KwBuckets { faltantes: { keyword: string; vol: number; lider: string; posLider: number | null }[]; quickWins: { keyword: string; vol: number; pos: number }[]; fuertes: { keyword: string; vol: number; pos: number }[]; volTotal: number }
// Delegado al núcleo único (lib/competencia-core.ts): mismos buckets que el tablero y el chat.
export function keywordBuckets(rows: SerpRow[]): KwBuckets {
  const b = coreBuckets(rows);
  return { faltantes: b.faltantes, quickWins: b.debiles.map(({ keyword, vol, pos }) => ({ keyword, vol, pos })), fuertes: b.fuertes, volTotal: b.volTotal };
}

export function computeSeoSignals(data: SeoData | null | undefined): Signal[] {
  const out: Signal[] = [];
  if (!data) return out;
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, titulo: s.titulo.charAt(0).toUpperCase() + s.titulo.slice(1), dash: "seo-search" });
  const cats = data.categorias?.length ? data.categorias : [data.categoria].filter(Boolean);
  const multi = cats.length > 1;
  const ownMarca = data.brands.find((b) => b.own)?.marca ?? (data.share ?? []).find((s) => s.own)?.marca ?? "";

  for (const cat of cats) {
    const pre = multi ? `${cat}: ` : "";
    const k = (s: string) => `seo_${s}_${cat}`.replace(/\s+/g, "_");

    // ── 1-3. Keywords (SERP) ──
    const b = keywordBuckets((data.serp ?? []).filter((r) => r.categoria === cat));
    if (b.volTotal > 0) {
      const fv = sum(b.faltantes.map((f) => f.vol));
      const fvPct = (fv / b.volTotal) * 100;
      if (b.faltantes.length && fvPct >= 15) {
        const top = b.faltantes.slice(0, 5);
        S({
          key: k("keywords_missing"), tipo: "alerta", prioridad: fvPct >= 40 ? "alta" : "media",
          titulo: `${pre}no aparecés en Google para ${b.faltantes.length} búsquedas (keywords) que suman ${fNum(fv)} búsquedas por mes (${fPct(fvPct, 0)} de todas las que medimos)`,
          descripcion: `Las más buscadas: ${top.map((f) => `"${f.keyword}" (${fNum(f.vol)} por mes; primero sale ${f.lider}${f.posLider ? `, en el lugar ${f.posLider}` : ""})`).join(" · ")}.`,
          acciones: ["Para las búsquedas más grandes, tener una página del sitio que responda justo eso (la categoría, una comparativa o una guía de compra); si ya existe, mejorarla", "Mirar la página del competidor que sale primero en Google: qué formato usa, qué tan completa es y qué preguntas responde", "Poner links hacia esas páginas desde la home y las páginas más visitadas del sitio"],
          datos: { volumenFaltante: fv, pctDemanda: r2(fvPct), top: top },
          impacto: { metrica: "Clicks/mes estimados si llegaras al top-5 en las 5 mayores", valor: Math.round(sum(top.map((f) => f.vol * (ctrPos(5) / 100)))), unidad: "clicks/mes" },
        });
      }
      const qw = b.quickWins.slice(0, 6);
      if (qw.length) {
        const gain = sum(qw.map((q) => q.vol * ((ctrPos(3) - ctrPos(q.pos)) / 100)));
        S({
          key: k("keywords_quick_wins"), tipo: "oportunidad", prioridad: gain >= 500 ? "alta" : "media",
          titulo: `${pre}${b.quickWins.length} búsquedas donde aparecés entre el 4° y el 20° lugar de Google: subirlas al top-3 suma ≈${fNum(gain)} clicks/mes`,
          descripcion: `${qw.map((q) => `"${q.keyword}" #${q.pos} (${fNum(q.vol)}/mes)`).join(" · ")}. Estimación: en Google, los 3 primeros resultados se llevan la mayoría de los clics; se usa el % de clics típico de cada posición (curva de CTR de la industria).`,
          acciones: ["Mejorar la página que ya aparece (no crear otra): que el título que muestra Google y el título principal de la página digan la búsqueda (title y H1), y que el texto responda mejor lo que la gente busca", "Desde otras páginas del sitio, poner links hacia esa página usando las mismas palabras de la búsqueda como texto del link (enlaces internos con anchor)", "Sumar preguntas frecuentes a la página, marcadas para que Google las entienda (FAQ con datos estructurados o schema), y revisar que cargue rápido en el celular"],
          datos: { quickWins: qw },
          impacto: { metrica: "Clicks orgánicos adicionales estimados", valor: Math.round(gain), unidad: "clicks/mes" },
        });
      }
      if (b.fuertes.length) S({
        key: k("keywords_strong"), tipo: "info", prioridad: "baja",
        titulo: `${pre}aparecés entre los 3 primeros de Google en ${b.fuertes.length} búsquedas (${fNum(sum(b.fuertes.map((f) => f.vol)))} búsquedas/mes): hay que cuidarlas`,
        descripcion: b.fuertes.slice(0, 5).map((f) => `"${f.keyword}" (lugar ${f.pos})`).join(" · "),
        acciones: ["Mantené esas páginas actualizadas y fijate quién está en el 4° y 5° lugar, que son los que te pueden pasar"],
        datos: { fuertes: b.fuertes.slice(0, 8) },
      });
    }

    // ── 4. Share of search vs líder + tendencia ──
    const sh = (data.share ?? []).filter((s) => s.categoria === cat);
    const meses = [...new Set(sh.map((s) => s.mes))].sort();
    const lastMes = meses[meses.length - 1];
    if (lastMes) {
      const cur = sh.filter((s) => s.mes === lastMes).sort((a, b2) => b2.share_pct - a.share_pct);
      const own = cur.find((s) => s.own);
      const leader = cur.find((s) => !s.own);
      if (own && leader) {
        const gap = leader.share_pct - own.share_pct;
        if (gap >= 10) S({
          key: k("share_gap"), tipo: "alerta", prioridad: gap >= 25 ? "alta" : "media",
          titulo: `${pre}te buscan menos que a ${leader.marca}: tenés el ${fPct(own.share_pct, 0)} de las búsquedas de marcas contra su ${fPct(leader.share_pct, 0)} (−${gap.toFixed(0)} puntos de share of search)`,
          descripcion: `Mes ${lastMes}. Qué parte de las búsquedas de marcas del rubro son de tu marca (share of search) anticipa las ganas de comprar: si la diferencia sigue, después suele verse en las ventas (share de mercado).`,
          acciones: ["Invertí en avisos para que te conozcan (video y alcance): hacen que más gente busque la marca", "Aparecé cuando buscan sin marca (por ejemplo, \"lavarropas\"): posicionamiento en Google (SEO) y avisos en el buscador"],
          datos: { mes: lastMes, propio: r2(own.share_pct), lider: { marca: leader.marca, share: r2(leader.share_pct) }, ranking: cur.slice(0, 6).map((s) => ({ marca: s.marca, share: r2(s.share_pct) })) },
        });
        else if (own.share_pct >= leader.share_pct) S({
          key: k("share_leader"), tipo: "info", prioridad: "baja",
          titulo: `${pre}sos la marca más buscada en Google (${fPct(own.share_pct, 0)} de las búsquedas de marcas — share of search; segunda ${leader.marca} con ${fPct(leader.share_pct, 0)})`,
          descripcion: `Mes ${lastMes}.`,
          acciones: ["Mantené la inversión en avisos para que te conozcan y seguí de cerca al segundo"],
          datos: { mes: lastMes, propio: r2(own.share_pct), segundo: { marca: leader.marca, share: r2(leader.share_pct) } },
        });
      }
      if (own && meses.length >= 4) {
        const prevMes = meses[meses.length - 4];
        const prev = sh.find((s) => s.mes === prevMes && s.own);
        if (prev) {
          const dpp = own.share_pct - prev.share_pct;
          if (dpp <= -3) S({
            key: k("share_trend_down"), tipo: "alerta", prioridad: dpp <= -6 ? "alta" : "media",
            titulo: `${pre}te buscan menos en Google: tu parte de las búsquedas de marcas bajó ${Math.abs(dpp).toFixed(1)} puntos en 3 meses (${fPct(prev.share_pct, 1)} → ${fPct(own.share_pct, 1)} — share of search)`,
            descripcion: `${prevMes} → ${lastMes}.`,
            acciones: ["Fijate si bajó la inversión en avisos para que te conozcan o si un competidor lanzó una campaña"],
            datos: { desde: prevMes, hasta: lastMes, shareDesde: r2(prev.share_pct), shareHasta: r2(own.share_pct) },
          });
          else if (dpp >= 3) S({
            key: k("share_trend_up"), tipo: "info", prioridad: "baja",
            titulo: `${pre}te buscan más en Google: tu parte de las búsquedas de marcas subió ${dpp.toFixed(1)} puntos en 3 meses (share of search)`,
            descripcion: `${fPct(prev.share_pct, 1)} → ${fPct(own.share_pct, 1)} (${prevMes} → ${lastMes}).`,
            acciones: ["Identificá qué acciones lo explican y seguí por ahí"],
            datos: { shareDesde: r2(prev.share_pct), shareHasta: r2(own.share_pct) },
          });
        }
      }
    }

    // ── 5. Visibilidad en LLMs (GEO) ──
    const ll = (data.llmo ?? []).filter((l) => l.categoria === cat).sort((a, b2) => b2.share_pct - a.share_pct);
    if (ll.length) {
      const own = ll.find((l) => l.own);
      const leader = ll.find((l) => !l.own);
      const ownSos = sh.find((s) => s.mes === lastMes && s.own)?.share_pct ?? null;
      if (!own || own.menciones === 0) S({
        key: k("llm_absent"), tipo: "alerta", prioridad: "alta",
        titulo: `${pre}tu marca no aparece en las respuestas de los asistentes de IA${leader ? ` (lidera ${leader.marca} con ${fPct(leader.share_pct, 0)})` : ""}`,
        descripcion: `Sobre ${ll[0]?.prompts ?? 0} preguntas de compra de la categoría que le hicimos a la IA (prompts). Cada vez más gente pregunta en ChatGPT o Gemini en vez de buscar en Google.`,
        acciones: ["Publicar comparativas y guías de compra con datos concretos (medidas, consumo, preguntas frecuentes) que un asistente de IA pueda citar", "Aparecer en las reseñas y medios que los asistentes de IA (ChatGPT, Gemini) usan como fuente", "Pedirle al desarrollador que marque las fichas de producto para que Google y la IA las lean bien (datos estructurados o schema de Producto y Preguntas frecuentes)"],
        datos: { ranking: ll.slice(0, 5).map((l) => ({ marca: l.marca, share: r2(l.share_pct), menciones: l.menciones })) },
      });
      else if (leader && leader.share_pct - own.share_pct >= 15) S({
        key: k("llm_gap"), tipo: "alerta", prioridad: "media",
        titulo: `${pre}los asistentes de IA te nombran en el ${fPct(own.share_pct, 0)} de las respuestas; a ${leader.marca}, en el ${fPct(leader.share_pct, 0)} (visibilidad en IA)`,
        descripcion: `${own.menciones} menciones sobre ${own.prompts} preguntas${own.rank_prom ? `; cuando te nombran, aparecés en promedio en el lugar ${own.rank_prom.toFixed(1)}` : ""}.`,
        acciones: ["Publicá contenido que la IA pueda citar (comparativas, especificaciones, guías de compra) y buscá aparecer en sitios de reseñas"],
        datos: { propio: r2(own.share_pct), lider: { marca: leader.marca, share: r2(leader.share_pct) } },
      });
      if (own && own.menciones > 0 && ownSos != null && ownSos > 0 && own.share_pct < ownSos * 0.6) S({
        key: k("llm_vs_search"), metrica: "visibilidad_ia", tipo: "oportunidad", prioridad: "media",
        titulo: `${pre}la IA te nombra mucho menos de lo que te buscan: ${fPct(own.share_pct, 0)} de las respuestas de IA contra ${fPct(ownSos, 0)} de las búsquedas en Google (share of search)`,
        descripcion: "La gente busca la marca, pero los asistentes de IA no la recomiendan en la misma proporción (a mejorar esto se lo llama GEO: optimización para motores de IA).",
        acciones: ["Ver qué sitios citan los asistentes de IA (ChatGPT, Gemini) cuando alguien pregunta por la categoría, y buscar aparecer en esos sitios", "Publicar preguntas frecuentes y comparativas con datos verificables"],
        datos: { shareIa: r2(own.share_pct), shareSearch: r2(ownSos) },
      });
    }

    // ── 6. Demanda genérica: último mes vs promedio de los 3 previos ──
    const dem = (data.demanda ?? []).filter((d) => d.categoria === cat).sort((a, b2) => a.mes.localeCompare(b2.mes));
    if (dem.length >= 4) {
      const last = dem[dem.length - 1]!, base = dem.slice(-4, -1);
      const d = deltaPct(last.search_volume, avg(base.map((x) => x.search_volume)));
      if (d != null && Math.abs(d) >= 20) S({
        key: k("demand_change"), tipo: d > 0 ? "oportunidad" : "info", prioridad: "baja",
        titulo: `${pre}las búsquedas sin marca del rubro ${d > 0 ? "subieron" : "bajaron"} ${fDelta(d)} (${last.mes}: ${fNum(last.search_volume)} búsquedas — demanda genérica)`,
        descripcion: `Promedio de los 3 meses anteriores: ${fNum(avg(base.map((x) => x.search_volume)))}. ${d > 0 ? "Es un buen momento para aparecer en Google (avisos en el buscador y SEO)." : "Ojo: parte de la caída de visitas puede ser porque el mercado busca menos, no por algo que se hizo mal."}`,
        acciones: d > 0 ? ["Pedile a la agencia que suba el presupuesto de avisos en Google para búsquedas sin marca mientras dure el pico"] : ["Ajustá las metas de visitas a lo que está buscando el mercado"],
        datos: { mes: last.mes, volumen: last.search_volume, promedio3m: Math.round(avg(base.map((x) => x.search_volume))), deltaPct: r2(d) },
      });
    }

    // ── 7. Brecha regional: provincias con mucho interés genérico y poco interés en la marca ──
    const reg = (data.regions ?? []).filter((r) => r.categoria === cat);
    const gen = new Map(reg.filter((r) => r.marca === "Genérico").map((r) => [r.provincia, r.interes]));
    const ownR = new Map(reg.filter((r) => ownMarca && r.marca === ownMarca).map((r) => [r.provincia, r.interes]));
    if (gen.size >= 5 && ownR.size >= 5) {
      const rows = [...gen.entries()].filter(([pv, g]) => g >= 50 && ownR.has(pv)).map(([pv, g]) => ({ provincia: pv, generico: g, marca: ownR.get(pv)!, idx: ownR.get(pv)! / g }));
      const medIdx = avg(rows.map((r) => r.idx));
      const gaps = rows.filter((r) => r.idx <= medIdx * 0.6).sort((a, b2) => b2.generico - a.generico).slice(0, 3);
      if (gaps.length) S({
        key: k("region_gap"), tipo: "oportunidad", prioridad: "baja",
        titulo: `${pre}${gaps.map((g) => g.provincia).join(", ")}: se busca mucho la categoría pero poco tu marca`,
        descripcion: gaps.map((g) => `${g.provincia}: interés en el producto ${g.generico}, en tu marca ${g.marca}`).join(" · ") + " (índice de Google Trends, de 0 a 100).",
        acciones: ["Pedile a la agencia avisos dirigidos a esas provincias", "Revisá con Comercial la distribución y las cadenas en esas zonas"],
        datos: { provincias: gaps },
      });
    }
  }

  return sortSignals(out);
}
