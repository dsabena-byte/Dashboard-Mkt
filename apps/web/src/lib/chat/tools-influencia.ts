import "server-only";
import { getInfluenciaPerformance } from "@/lib/pauta-queries";
import { getMetaUgcCreatives } from "@/lib/meta-paid-queries";
import { getUgcAnalysis } from "@/lib/ugc-analysis-queries";
import { registrarCard } from "./cards";
import { labelKey, keyLabel, div, rd, clip, fmtN, topN } from "./util";
import type { ChatTool, ToolCtx } from "./types";

// ============================================================================
// Mkt de Influencia / UGC (/influencia). Mensual agregado (OMD plan vs real + Meta API)
// + piezas UGC con análisis cualitativo de comentarios (credibilidad, intención,
// percepción) — las piezas devuelven `ref` para render_posts.
// ============================================================================

export function influenciaTools(ctx: ToolCtx): ChatTool[] {
  return [
    {
      name: "get_influencia_performance",
      description:
        "Influencers/UGC por mes: inversión ejecutada vs plan (OMD), alcance, impresiones, clics, views, CTR y CPM; más la ejecución de las piezas UGC en Meta (API: inversión, impresiones, clics, interacciones, guardados, compartidos).",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const [omd, meta] = await Promise.all([getInfluenciaPerformance(), getMetaUgcCreatives().catch(() => [])]);
        const g = new Map<number, { inv: number; invP: number; alc: number; impr: number; clics: number; views: number }>();
        for (const r of omd) {
          const k = labelKey(r.mes);
          if (k == null) continue;
          const e = g.get(k) ?? { inv: 0, invP: 0, alc: 0, impr: 0, clics: 0, views: 0 };
          e.inv += r.inversion ?? 0; e.invP += r.inversion_plan ?? 0; e.alc += r.alcance ?? 0; e.impr += r.impresiones ?? 0; e.clics += r.clics ?? 0; e.views += r.views ?? 0;
          g.set(k, e);
        }
        const m = new Map<number, { inv: number; impr: number; clics: number; eng: number; saves: number; shares: number }>();
        for (const r of meta) {
          const k = labelKey(r.mes);
          if (k == null) continue;
          const e = m.get(k) ?? { inv: 0, impr: 0, clics: 0, eng: 0, saves: 0, shares: 0 };
          e.inv += r.spend ?? 0; e.impr += r.impresiones ?? 0; e.clics += r.clicks ?? 0; e.eng += r.post_engagement ?? 0; e.saves += r.saves ?? 0; e.shares += r.shares ?? 0;
          m.set(k, e);
        }
        return {
          moneda: "ARS",
          omd_mensual: [...g.entries()].sort((a, b) => a[0] - b[0]).map(([k, e]) => ({ mes: keyLabel(k), inversion: Math.round(e.inv), inversion_plan: Math.round(e.invP), alcance: e.alc, impresiones: e.impr, clics: e.clics, views: e.views, ctr_pct: div(e.clics, e.impr, 100), cpm: div(e.inv, e.impr, 1000) })),
          meta_api_mensual: [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, e]) => ({ mes: keyLabel(k), inversion: Math.round(e.inv), impresiones: e.impr, clics: e.clics, interacciones: e.eng, guardados: e.saves, compartidos: e.shares, cpm: div(e.inv, e.impr, 1000) })),
        };
      },
    },
    {
      name: "get_ugc_piezas",
      description:
        "Piezas UGC pautadas (Meta) con sus métricas (inversión, impresiones, CTR, VTR, guardados, compartidos) y el análisis cualitativo IA de los comentarios (resumen, credibilidad, intención de compra, percepción de marca, mejoras). Cada pieza trae `ref` para render_posts.",
      parameters: { type: "object", properties: { top: { type: "number", description: "piezas (default 6, máx 12)" } } },
      run: async (args) => {
        const [piezas, analisis] = await Promise.all([getMetaUgcCreatives(), getUgcAnalysis().catch(() => [])]);
        const an = new Map(analisis.map((a) => [a.permalink, a]));
        const seen = new Set<string>();
        const out = [];
        for (const r of piezas) {
          const link = r.instagram_permalink_url ?? r.permalink_url ?? r.ad_id;
          if (seen.has(link)) continue;
          seen.add(link);
          const a = an.get(r.instagram_permalink_url ?? "")?.analysis ?? null;
          const vtr = r.impresiones && (r.video_p50 ?? 0) > 0 ? ((r.video_p50 ?? 0) / r.impresiones) * 100 : null;
          const ref = registrarCard(ctx, "u", {
            red: "UGC · Meta Ads",
            titulo: clip(r.ad_name || r.body, 90),
            fecha: r.mes,
            formato: r.categoria,
            thumbnail: r.thumbnail_url || r.image_url,
            url: r.instagram_permalink_url || r.permalink_url,
            metricas: [
              { label: "$", valor: fmtN(r.spend) },
              { label: "impr.", valor: fmtN(r.impresiones) },
              { label: "guardados", valor: fmtN(r.saves) },
              ...(vtr != null ? [{ label: "VTR50", valor: `${rd(vtr, 1)?.toLocaleString("es-AR")}%` }] : []),
            ],
          });
          out.push({
            ref, pieza: clip(r.ad_name, 70), mes: r.mes, inversion: Math.round(r.spend ?? 0), impresiones: r.impresiones, ctr_pct: div(r.clicks, r.impresiones, 100), vtr50_pct: rd(vtr, 1), guardados: r.saves, compartidos: r.shares,
            analisis: a ? { resumen: clip(a.resumen, 220), credibilidad: a.credibilidad?.nivel, intencion_compra: a.intencion_compra?.nivel, percepcion_marca: a.percepcion_marca?.nivel, mejoras: (a.mejoras ?? []).slice(0, 3) } : null,
          });
          if (out.length >= topN(args.top, 6, 12)) break;
        }
        return { piezas: out };
      },
    },
  ];
}
