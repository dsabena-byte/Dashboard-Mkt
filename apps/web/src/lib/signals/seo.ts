// Señales de SEO / SEARCH. Por categoría: keywords faltantes de alta demanda, quick wins
// (posición 4-20), keywords fuertes a defender, share of search vs el líder y su tendencia,
// visibilidad en LLMs (GEO) vs la de búsqueda, demanda genérica y brecha regional.
// Mismos buckets que el tablero (SerpSection): faltante = no rankea; débil = 4-20; fuerte = top-3.
// Puro: recibe SeoData ya leído.
import type { SeoData, SerpRow } from "./model";
import { type Signal, sortSignals, sum, avg, deltaPct, fNum, fPct, fDelta, r2 } from "./types";
import { keywordBucketsCore as coreBuckets } from "./model";

// CTR orgánico aproximado por posición (curva de industria; solo para ESTIMAR clicks).
export function ctrPos(p: number | null): number {
  if (p == null) return 0;
  const t = [0, 28, 15, 10, 7, 5, 4, 3, 2.5, 2, 1.8];
  return p <= 10 ? t[Math.max(1, Math.round(p))]! : p <= 20 ? 1 : 0.3;
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
          titulo: `${pre}no rankeás en ${b.faltantes.length} keywords que suman ${fNum(fv)} búsquedas/mes (${fPct(fvPct, 0)} de la demanda relevada)`,
          descripcion: `Las de mayor volumen: ${top.map((f) => `"${f.keyword}" (${fNum(f.vol)}, lidera ${f.lider}${f.posLider ? ` #${f.posLider}` : ""})`).join(" · ")}.`,
          acciones: ["Crear/optimizar una página por intención (categoría, comparativa, guía) para las de mayor volumen", "Analizar la página que rankea del líder (formato, extensión, schema)", "Enlazarlas desde la home y las páginas con autoridad"],
          datos: { volumenFaltante: fv, pctDemanda: r2(fvPct), top: top },
          impacto: { metrica: "Clicks/mes estimados si llegaras al top-5 en las 5 mayores", valor: Math.round(sum(top.map((f) => f.vol * (ctrPos(5) / 100)))), unidad: "clicks/mes" },
        });
      }
      const qw = b.quickWins.slice(0, 6);
      if (qw.length) {
        const gain = sum(qw.map((q) => q.vol * ((ctrPos(3) - ctrPos(q.pos)) / 100)));
        S({
          key: k("keywords_quick_wins"), tipo: "oportunidad", prioridad: gain >= 500 ? "alta" : "media",
          titulo: `${pre}${b.quickWins.length} keywords en posición 4-20: llevarlas al top-3 suma ≈${fNum(gain)} clicks/mes`,
          descripcion: `${qw.map((q) => `"${q.keyword}" #${q.pos} (${fNum(q.vol)}/mes)`).join(" · ")}. Estimación con curva de CTR orgánico de industria.`,
          acciones: ["Mejorar title/H1 y contenido de la página que ya rankea (no crear otra)", "Sumar enlaces internos con el anchor de la keyword", "Agregar FAQ/schema y reforzar la experiencia (velocidad, mobile)"],
          datos: { quickWins: qw },
          impacto: { metrica: "Clicks orgánicos adicionales estimados", valor: Math.round(gain), unidad: "clicks/mes" },
        });
      }
      if (b.fuertes.length) S({
        key: k("keywords_strong"), tipo: "info", prioridad: "baja",
        titulo: `${pre}${b.fuertes.length} keywords en top-3 (${fNum(sum(b.fuertes.map((f) => f.vol)))} búsquedas/mes) — defender`,
        descripcion: b.fuertes.slice(0, 5).map((f) => `"${f.keyword}" #${f.pos}`).join(" · "),
        acciones: ["Mantener actualizadas esas páginas y vigilar a quien está en #4-5"],
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
          titulo: `${pre}share of search ${fPct(own.share_pct, 0)} vs ${fPct(leader.share_pct, 0)} de ${leader.marca} (−${gap.toFixed(0)} pp)`,
          descripcion: `Mes ${lastMes}. El share of search es proxy de la intención de compra futura: la brecha anticipa pérdida de share de mercado si persiste.`,
          acciones: ["Aumentar la notoriedad (pauta de awareness/video) para generar búsquedas de marca", "Capturar la demanda genérica con SEO y Search"],
          datos: { mes: lastMes, propio: r2(own.share_pct), lider: { marca: leader.marca, share: r2(leader.share_pct) }, ranking: cur.slice(0, 6).map((s) => ({ marca: s.marca, share: r2(s.share_pct) })) },
        });
        else if (own.share_pct >= leader.share_pct) S({
          key: k("share_leader"), tipo: "info", prioridad: "baja",
          titulo: `${pre}liderás el share of search (${fPct(own.share_pct, 0)}; 2° ${leader.marca} ${fPct(leader.share_pct, 0)})`,
          descripcion: `Mes ${lastMes}.`,
          acciones: ["Sostener la inversión en notoriedad; vigilar la tendencia del 2°"],
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
            titulo: `${pre}el share of search cayó ${Math.abs(dpp).toFixed(1)} pp en 3 meses (${fPct(prev.share_pct, 1)} → ${fPct(own.share_pct, 1)})`,
            descripcion: `${prevMes} → ${lastMes}.`,
            acciones: ["Revisar si bajó la inversión en awareness o si un competidor lanzó campaña"],
            datos: { desde: prevMes, hasta: lastMes, shareDesde: r2(prev.share_pct), shareHasta: r2(own.share_pct) },
          });
          else if (dpp >= 3) S({
            key: k("share_trend_up"), tipo: "info", prioridad: "baja",
            titulo: `${pre}el share of search subió ${dpp.toFixed(1)} pp en 3 meses`,
            descripcion: `${fPct(prev.share_pct, 1)} → ${fPct(own.share_pct, 1)} (${prevMes} → ${lastMes}).`,
            acciones: ["Identificar qué acciones lo explican y sostenerlas"],
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
        descripcion: `Sobre ${ll[0]?.prompts ?? 0} prompts de compra de la categoría. Cada vez más búsquedas se resuelven en ChatGPT/Gemini sin pasar por Google.`,
        acciones: ["Publicar contenido comparativo y guías de compra citables (datos, specs, FAQs)", "Conseguir presencia en reviews/medios que los LLMs usan como fuente", "Datos estructurados (schema Product/FAQ) en las fichas"],
        datos: { ranking: ll.slice(0, 5).map((l) => ({ marca: l.marca, share: r2(l.share_pct), menciones: l.menciones })) },
      });
      else if (leader && leader.share_pct - own.share_pct >= 15) S({
        key: k("llm_gap"), tipo: "alerta", prioridad: "media",
        titulo: `${pre}visibilidad en IA ${fPct(own.share_pct, 0)} vs ${fPct(leader.share_pct, 0)} de ${leader.marca}`,
        descripcion: `${own.menciones} menciones sobre ${own.prompts} prompts${own.rank_prom ? `, posición promedio ${own.rank_prom.toFixed(1)}` : ""}.`,
        acciones: ["Reforzar contenido citable (comparativas, specs, guías) y presencia en reviews"],
        datos: { propio: r2(own.share_pct), lider: { marca: leader.marca, share: r2(leader.share_pct) } },
      });
      if (own && own.menciones > 0 && ownSos != null && ownSos > 0 && own.share_pct < ownSos * 0.6) S({
        key: k("llm_vs_search"), tipo: "oportunidad", prioridad: "media",
        titulo: `${pre}tu visibilidad en IA (${fPct(own.share_pct, 0)}) está muy por debajo de tu share of search (${fPct(ownSos, 0)})`,
        descripcion: "La marca tiene demanda pero los asistentes no la recomiendan en proporción: brecha de GEO (Generative Engine Optimization).",
        acciones: ["Auditar qué fuentes citan los LLMs para la categoría y ganar presencia ahí", "Publicar FAQs y comparativas con datos verificables"],
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
        titulo: `${pre}la demanda genérica ${d > 0 ? "subió" : "bajó"} ${fDelta(d)} (${last.mes}: ${fNum(last.search_volume)} búsquedas)`,
        descripcion: `Promedio de los 3 meses previos ${fNum(avg(base.map((x) => x.search_volume)))}. ${d > 0 ? "Ventana para capturar demanda con Search/SEO." : "Contexto: parte de la caída de tráfico puede ser de mercado, no de ejecución."}`,
        acciones: d > 0 ? ["Subir presupuesto de Search en las keywords genéricas mientras dure el pico"] : ["Ajustar las metas de tráfico al contexto de demanda"],
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
        titulo: `${pre}${gaps.map((g) => g.provincia).join(", ")}: alta demanda de la categoría y bajo interés en tu marca`,
        descripcion: gaps.map((g) => `${g.provincia}: genérico ${g.generico}, marca ${g.marca}`).join(" · ") + " (índice Google Trends 0-100).",
        acciones: ["Segmentar pauta geográfica en esas provincias", "Revisar distribución/retail en esas zonas"],
        datos: { provincias: gaps },
      });
    }
  }

  return sortSignals(out);
}
