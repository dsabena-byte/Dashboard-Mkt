import "server-only";
import {
  getShareOfSearch,
  getTrendsInterest,
  getDemandaGenerica,
  getSeoCompetitivo,
  getDreanRankings,
  getKeywordGap,
  getSearchRegion,
  getSeoIndexHistory,
  getLlmo,
} from "@/lib/competitive-queries";
import { periodo, enPeriodo, ymKey, keyLabel, rd, oneOf, topN } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Optimización SEO / Share of Search (/seo-search). Antes las tools devolvían las
// tablas crudas completas; ahora agregan por categoría/marca/mes (compacto).
// Categorías de búsqueda: lavarropas (=Lavado), heladeras (=Refrigeración), cocinas (=Cocción).
// ============================================================================

const OWN = "drean";
const CAT_BUSQ: Record<string, string> = { lavado: "lavarropas", refrigeración: "heladeras", refrigeracion: "heladeras", cocción: "cocinas", coccion: "cocinas" };
const catBusq = (v: unknown): string | undefined => {
  if (typeof v !== "string" || !v) return undefined;
  const k = v.toLowerCase();
  return CAT_BUSQ[k] ?? k;
};
const CAT_PROP = { categoria: { type: "string", description: "lavarropas | heladeras | cocinas (o Lavado/Refrigeración/Cocción)" } };

export const seoSearchTools: ChatTool[] = [
  {
    name: "get_share_of_search",
    description:
      "Share of Search (volumen de búsqueda de cada marca / total de marcas, Google, por categoría: lavarropas, heladeras, cocinas). nivel=resumen: ranking de marcas del período por categoría (volumen sumado); nivel=mensual: serie mensual del share de Drean (y del líder) por categoría. Es el proxy de participación de mercado en demanda (ESOV: comparar vs share de inversión).",
    parameters: {
      type: "object",
      properties: {
        ...CAT_PROP,
        nivel: { type: "string", enum: ["resumen", "mensual"], description: "default resumen" },
        desde: { type: "string", description: "YYYY-MM (default: últimos 3 meses en resumen, 12 en mensual)" },
        hasta: { type: "string" },
      },
    },
    run: async (args) => {
      const nivel = oneOf(args.nivel, ["resumen", "mensual"] as const, "resumen");
      const p = periodo(args, nivel === "resumen" ? 3 : 12);
      const cat = catBusq(args.categoria);
      const rows = (await getShareOfSearch()).filter((r) => enPeriodo(ymKey(r.mes), p) && (!cat || r.categoria === cat));
      if (nivel === "resumen") {
        const byCat = new Map<string, Map<string, number>>();
        for (const r of rows) {
          const m = byCat.get(r.categoria) ?? new Map<string, number>();
          m.set(r.marca, (m.get(r.marca) ?? 0) + r.vol);
          byCat.set(r.categoria, m);
        }
        return {
          periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`,
          categorias: [...byCat.entries()].map(([c, m]) => {
            const tot = [...m.values()].reduce((a, b) => a + b, 0);
            const rank = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([marca, vol], i) => ({ pos: i + 1, marca, vol, share_pct: tot ? rd((vol / tot) * 100, 1) : null }));
            return { categoria: c, volumen_total_marcas: tot, drean: rank.find((x) => x.marca.toLowerCase() === OWN) ?? null, ranking: rank.slice(0, 8) };
          }),
        };
      }
      const g = new Map<string, { k: number; categoria: string; drean: number | null; lider: string; lider_pct: number }>();
      for (const r of rows) {
        const k = ymKey(r.mes)!;
        const key = `${r.categoria}|${k}`;
        const e = g.get(key) ?? { k, categoria: r.categoria, drean: null, lider: "", lider_pct: -1 };
        if (r.marca.toLowerCase() === OWN) e.drean = r.share_pct;
        if (r.share_pct > e.lider_pct) { e.lider_pct = r.share_pct; e.lider = r.marca; }
        g.set(key, e);
      }
      return {
        periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`,
        serie: [...g.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.k - b.k).map((e) => ({ categoria: e.categoria, mes: keyLabel(e.k), drean_pct: rd(e.drean, 1), lider: e.lider, lider_pct: rd(e.lider_pct, 1) })),
      };
    },
  },
  {
    name: "get_demanda_y_trends",
    description:
      "Demanda de la categoría (volumen mensual de búsqueda del término genérico: lavarropas/heladeras/cocinas — sirve para estacionalidad y timing de inversión) + interés de Google Trends (0-100, promedio mensual) por marca y categoría.",
    parameters: { type: "object", properties: { ...CAT_PROP, desde: { type: "string", description: "YYYY-MM (default últimos 12 meses)" }, hasta: { type: "string" } } },
    run: async (args) => {
      const p = periodo(args, 12);
      const cat = catBusq(args.categoria);
      const [dem, tr] = await Promise.all([getDemandaGenerica(), getTrendsInterest()]);
      const demanda = dem
        .filter((r) => enPeriodo(ymKey(r.mes), p) && (!cat || r.categoria === cat))
        .map((r) => ({ categoria: r.categoria, mes: keyLabel(ymKey(r.mes)!), volumen: r.search_volume }));
      const g = new Map<string, { s: number; n: number; k: number; categoria: string; marca: string }>();
      for (const r of tr) {
        const k = ymKey(r.fecha);
        if (!enPeriodo(k, p) || (cat && r.categoria !== cat)) continue;
        const key = `${r.categoria}|${r.marca}|${k}`;
        const e = g.get(key) ?? { s: 0, n: 0, k: k!, categoria: r.categoria, marca: r.marca };
        e.s += r.interes; e.n += 1;
        g.set(key, e);
      }
      const trends = [...g.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.marca.localeCompare(b.marca) || a.k - b.k).map((e) => ({ categoria: e.categoria, marca: e.marca, mes: keyLabel(e.k), interes: rd(e.s / e.n, 1) }));
      return { periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`, demanda_generica: demanda, trends_mensual: trends.slice(0, 300) };
    },
  },
  {
    name: "get_seo_competitivo",
    description:
      "SEO por 'nivel': posiciones (por marca: posición promedio, keywords en top 3 / top 10, volumen captado) | keywords_drean (keywords de drean.com.ar con posición y volumen) | gap (keywords donde rankea la competencia y Drean no) | ia (visibilidad de la marca en respuestas de modelos de IA: share y ranking promedio) | regiones (interés de búsqueda por provincia) | indice (histórico mensual del índice de posición por marca).",
    parameters: {
      type: "object",
      properties: { nivel: { type: "string", enum: ["posiciones", "keywords_drean", "gap", "ia", "regiones", "indice"], description: "default posiciones" }, ...CAT_PROP, top: { type: "number", description: "filas (default 15, máx 40)" } },
    },
    run: async (args) => {
      const nivel = oneOf(args.nivel, ["posiciones", "keywords_drean", "gap", "ia", "regiones", "indice"] as const, "posiciones");
      const cat = catBusq(args.categoria);
      const n = topN(args.top, 15, 40);
      const okCat = (c: string | null) => !cat || c === cat;
      if (nivel === "posiciones") {
        const rows = (await getSeoCompetitivo()).filter((r) => okCat(r.categoria) && r.posicion != null);
        const g = new Map<string, { n: number; s: number; t3: number; t10: number; vol: number }>();
        for (const r of rows) {
          const e = g.get(r.marca) ?? { n: 0, s: 0, t3: 0, t10: 0, vol: 0 };
          e.n++; e.s += r.posicion!; if (r.posicion! <= 3) e.t3++; if (r.posicion! <= 10) { e.t10++; e.vol += r.search_volume ?? 0; }
          g.set(r.marca, e);
        }
        return { marcas: [...g.entries()].map(([marca, e]) => ({ marca, keywords: e.n, posicion_prom: rd(e.s / e.n, 1), top3: e.t3, top10: e.t10, volumen_en_top10: e.vol })).sort((a, b) => b.volumen_en_top10 - a.volumen_en_top10).slice(0, n) };
      }
      if (nivel === "keywords_drean") return { keywords: (await getDreanRankings()).filter((r) => okCat(r.categoria)).slice(0, n).map((r) => ({ keyword: r.keyword, categoria: r.categoria, posicion: r.posicion, volumen: r.search_volume })) };
      if (nivel === "gap") return { gap: (await getKeywordGap()).filter((r) => okCat(r.categoria)).slice(0, n) };
      if (nivel === "ia") {
        const rows = (await getLlmo()).filter((r) => okCat(r.categoria));
        const ult = rows.reduce((a, r) => (r.mes > a ? r.mes : a), "");
        const conDato = rows.filter((r) => r.prompts > 0);
        const ultConDato = conDato.reduce((a, r) => (r.mes > a ? r.mes : a), "");
        return {
          ultimo_mes_cargado: ult || null,
          ultimo_mes_con_prompts: ultConDato || null,
          nota: ult && ult !== ultConDato ? "El último mes cargado no tiene prompts corridos; se muestra el último con dato." : undefined,
          marcas: conDato.filter((r) => r.mes === ultConDato).map((r) => ({ categoria: r.categoria, marca: r.marca, share_pct: rd(r.share_pct, 1), menciones: r.menciones, prompts: r.prompts, rank_prom: rd(r.rank_prom, 1) })),
        };
      }
      if (nivel === "regiones") {
        const rows = (await getSearchRegion()).filter((r) => okCat(r.categoria));
        const byProv = new Map<string, Record<string, number | null>>();
        for (const r of rows) {
          const e = byProv.get(`${r.categoria}|${r.provincia}`) ?? { };
          e[r.marca] = r.interes;
          byProv.set(`${r.categoria}|${r.provincia}`, e);
        }
        return { nota: "Interés relativo 0-100 por provincia (Genérico = demanda de la categoría).", provincias: [...byProv.entries()].map(([k, v]) => ({ categoria: k.split("|")[0], provincia: k.split("|")[1], ...v })).slice(0, 80) };
      }
      const rows = (await getSeoIndexHistory()).filter((r) => okCat(r.categoria));
      const meses = [...new Set(rows.map((r) => r.mes))].sort().slice(-12);
      return { serie: rows.filter((r) => meses.includes(r.mes)).map((r) => ({ categoria: r.categoria, marca: r.marca, mes: keyLabel(ymKey(r.mes)!), indice: rd(r.indice, 1) })) };
    },
  },
];
