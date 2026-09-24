import "server-only";
import { getPlanningMedia, classifyMedio } from "@/lib/planning-media-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
import { getDv360Creatives } from "@/lib/dv360-queries";
import { getGoogleAdsCreatives } from "@/lib/google-ads-creatives-queries";
import { getPautaModelo, type PautaFila } from "./pauta-model";
import { periodo, enPeriodo, keyLabel, labelKey, ymKey, rd, div, oneOf, topN, clip, fmtN, mismaCategoria, strArr } from "./util";
import { registrarCard } from "./cards";
import type { ChatTool, ToolCtx, PostCard } from "./types";

// ============================================================================
// Pauta Mkt (/performance). Tools PARAMETRIZADAS (período, medio, categoría, nivel)
// que devuelven agregados compactos — antes devolvían la tabla cruda completa.
// Fuente de verdad por medio = mismo criterio que el dash (ver pauta-model.ts).
// ============================================================================

const PERIODO_PROPS = {
  desde: { type: "string", description: "Mes desde YYYY-MM (default: enero del año en curso)" },
  hasta: { type: "string", description: "Mes hasta YYYY-MM (default: mes en curso)" },
};

type Acc = { inv: number; impr: number; alc: number; clics: number; vimpr: number; v50: number };
const empty = (): Acc => ({ inv: 0, impr: 0, alc: 0, clics: 0, vimpr: 0, v50: 0 });
function add(a: Acc, f: PautaFila) {
  a.inv += f.inversion; a.impr += f.impresiones; a.alc += f.alcance; a.clics += f.clics; a.vimpr += f.vimpr; a.v50 += f.v50;
}
function metricas(a: Acc) {
  return {
    inversion: Math.round(a.inv),
    impresiones: Math.round(a.impr),
    alcance: Math.round(a.alc),
    clics: Math.round(a.clics),
    cpm: div(a.inv, a.impr, 1000),
    ctr_pct: div(a.clics, a.impr, 100),
    cpc: div(a.inv, a.clics),
    frecuencia: div(a.impr, a.alc),
    vtr50_pct: a.vimpr > 0 ? rd((a.v50 / a.vimpr) * 100, 1) : null,
  };
}

export function performanceTools(ctx: ToolCtx): ChatTool[] {
  return [
    {
      name: "get_pauta_performance",
      description:
        "Pauta de medios (Pauta Mkt / Plan de Medios): inversión (ARS), impresiones, alcance (suma por medio), clics, CPM, CTR, CPC, frecuencia y VTR≥50%, con la fuente de verdad por medio (Meta/YouTube/Programmatic/Google por API; TikTok, Mercado Ads, Geo, TV, OOH, DOOH por carga OMD). Agrupá por 'nivel': mensual | medio | categoria | rol | medio_mes. Incluye el plan (inversión/impresiones plan) cuando nivel=mensual o medio. Filtros: medio, categoría, período.",
      parameters: {
        type: "object",
        properties: {
          ...PERIODO_PROPS,
          nivel: { type: "string", enum: ["mensual", "medio", "categoria", "rol", "medio_mes"], description: "Agrupación (default mensual)" },
          medio: { type: "array", items: { type: "string" }, description: "Filtrar medios (ej. Meta, YouTube, Programmatic, TikTok, OOH, TV Cable)" },
          categoria: { type: "string", description: "Lavado | Refrigeración | Cocción | Brand | UGC | Promoción" },
        },
      },
      run: async (args) => {
        const p = periodo(args);
        const nivel = oneOf(args.nivel, ["mensual", "medio", "categoria", "rol", "medio_mes"] as const, "mensual");
        const medios = strArr(args.medio).map((m) => m.toLowerCase());
        const cat = typeof args.categoria === "string" ? args.categoria : undefined;
        const m = await getPautaModelo();
        const ok = (medio: string, categoria: string, k: number) =>
          enPeriodo(k, p) && (!medios.length || medios.includes(medio.toLowerCase())) && mismaCategoria(categoria, cat);
        const filas = m.filas.filter((f) => ok(f.medio, f.categoria, f.k));
        const keyOf = (f: { k: number; medio: string; categoria: string; rol: string }) =>
          nivel === "mensual" ? keyLabel(f.k) : nivel === "medio" ? f.medio : nivel === "categoria" ? f.categoria : nivel === "rol" ? f.rol : `${keyLabel(f.k)} · ${f.medio}`;
        const g = new Map<string, { acc: Acc; k: number; fuentes: Set<string> }>();
        for (const f of filas) {
          const key = keyOf(f);
          let e = g.get(key);
          if (!e) g.set(key, (e = { acc: empty(), k: f.k, fuentes: new Set() }));
          add(e.acc, f);
          e.fuentes.add(f.fuente);
        }
        const planG = new Map<string, { inv: number; impr: number }>();
        if (nivel === "mensual" || nivel === "medio") {
          for (const r of m.plan) {
            if (!ok(r.medio, r.categoria, r.k)) continue;
            const key = keyOf(r);
            const e = planG.get(key) ?? { inv: 0, impr: 0 };
            e.inv += r.inversion_plan; e.impr += r.impresiones_plan;
            planG.set(key, e);
          }
        }
        const keys = new Set([...g.keys(), ...planG.keys()]);
        const rows = [...keys].map((key) => {
          const e = g.get(key);
          const pl = planG.get(key);
          return {
            [nivel === "medio_mes" ? "mes_medio" : nivel]: key,
            ...(e ? metricas(e.acc) : { inversion: null }),
            ...(e ? { fuente: [...e.fuentes].join("+") } : {}),
            ...(pl ? { inversion_plan: Math.round(pl.inv), impresiones_plan: Math.round(pl.impr) } : {}),
            _k: e?.k ?? 0,
          };
        });
        if (nivel === "mensual" || nivel === "medio_mes") rows.sort((a, b) => a._k - b._k);
        else rows.sort((a, b) => (Number(b.inversion) || 0) - (Number(a.inversion) || 0));
        const tot = empty();
        for (const f of filas) add(tot, f);
        return {
          periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`,
          moneda: "ARS",
          total: metricas(tot),
          filas: rows.map(({ _k, ...r }) => r),
          notas: [
            "Meta sale SIEMPRE de la API (OMD la subcontaba). OMD solo para medios sin API.",
            `El real OMD se toma de meses cerrados; ${keyLabel(m.mesEnCurso)} es parcial (solo API).`,
            "Alcance = suma por medio (no deduplicado cross-media). VTR≥50% solo Meta+DV360 video.",
          ],
        };
      },
    },
    {
      name: "get_inversion_medios",
      description:
        "Planning de medios (plan de inversión por línea) agregado: por mes, medio (Digital/TV Cable/OOH/Costos), sistema, formato, rol o campaña. Sirve para el mix planificado y para comparar plan vs ejecución.",
      parameters: {
        type: "object",
        properties: {
          ...PERIODO_PROPS,
          nivel: { type: "string", enum: ["mes", "medio", "sistema", "formato", "rol", "campania"], description: "Agrupación (default medio)" },
        },
      },
      run: async (args) => {
        const p = periodo(args);
        const nivel = oneOf(args.nivel, ["mes", "medio", "sistema", "formato", "rol", "campania"] as const, "medio");
        const rows = (await getPlanningMedia({})).filter((r) => enPeriodo(ymKey(r.fecha), p));
        const g = new Map<string, number>();
        for (const r of rows) {
          const key =
            nivel === "mes" ? r.fecha.slice(0, 7) : nivel === "medio" ? classifyMedio(r) : nivel === "sistema" ? r.sistema ?? "—" : nivel === "formato" ? r.formato ?? "—" : nivel === "rol" ? r.rol ?? "—" : r.campania;
          g.set(key, (g.get(key) ?? 0) + (r.inversion ?? 0));
        }
        const total = [...g.values()].reduce((a, b) => a + b, 0);
        const filas = [...g.entries()]
          .map(([k, v]) => ({ [nivel]: k, inversion: Math.round(v), pct: total ? rd((v / total) * 100, 1) : null }))
          .sort((a, b) => (nivel === "mes" ? String(a[nivel]).localeCompare(String(b[nivel])) : b.inversion - a.inversion))
          .slice(0, 40);
        return { periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`, total: Math.round(total), filas };
      },
    },
    {
      name: "get_pauta_creativos",
      description:
        "Piezas/creativos de pauta (Meta Ads por API, DV360 YouTube/Programmatic, Google Ads) con inversión, impresiones, clics, CTR, CPM y VTR. Ordená por inversion | ctr | vtr | cpm | impresiones. Devuelve un `ref` por pieza para mostrarlas con render_posts (solo Meta/Google traen miniatura).",
      parameters: {
        type: "object",
        properties: {
          ...PERIODO_PROPS,
          plataforma: { type: "string", enum: ["meta", "dv360", "google", "todas"], description: "default todas" },
          categoria: { type: "string" },
          orden: { type: "string", enum: ["inversion", "ctr", "vtr", "cpm", "impresiones"], description: "default inversion" },
          asc: { type: "boolean", description: "true = peores primero (ej. CTR más bajo)" },
          top: { type: "number", description: "Cantidad (default 8, máx 20)" },
        },
      },
      run: async (args) => {
        const p = periodo(args, 3);
        const plat = oneOf(args.plataforma, ["meta", "dv360", "google", "todas"] as const, "todas");
        const orden = oneOf(args.orden, ["inversion", "ctr", "vtr", "cpm", "impresiones"] as const, "inversion");
        const cat = typeof args.categoria === "string" ? args.categoria : undefined;
        const n = topN(args.top, 8, 20);
        type Pieza = { card: Omit<PostCard, "ref" | "metricas">; inv: number; impr: number; clics: number; vtr: number | null; moneda: string; campania: string | null };
        const piezas: Pieza[] = [];
        const [meta, dv, g] = await Promise.all([
          plat === "todas" || plat === "meta" ? getMetaPaidCreatives(true).catch(() => []) : Promise.resolve([]),
          plat === "todas" || plat === "dv360" ? getDv360Creatives().catch(() => []) : Promise.resolve([]),
          plat === "todas" || plat === "google" ? getGoogleAdsCreatives().catch(() => []) : Promise.resolve([]),
        ]);
        for (const r of meta) {
          if (!enPeriodo(labelKey(r.mes), p) || !mismaCategoria(r.categoria, cat) || r.plataforma !== "meta") continue;
          const quart = (r.video_p50 ?? 0) > 0;
          piezas.push({
            card: { red: "Meta Ads", titulo: clip(r.ad_name || r.body || r.campaign_name, 90), fecha: r.mes, formato: r.categoria, thumbnail: r.thumbnail_url || r.image_url, url: r.instagram_permalink_url || r.permalink_url, badge: r.activa ? "Activa" : null },
            inv: r.spend ?? 0, impr: r.impresiones ?? 0, clics: r.clicks ?? 0, vtr: quart && r.impresiones ? ((r.video_p50 ?? 0) / r.impresiones) * 100 : null, moneda: "ARS", campania: r.campaign_name,
          });
        }
        for (const r of dv) {
          if (!enPeriodo(ymKey(r.mes), p) || !mismaCategoria(r.categoria, cat)) continue;
          piezas.push({
            card: { red: `DV360 ${r.canal}`, titulo: clip(r.creative, 90), fecha: r.mes.slice(0, 7), formato: r.categoria, thumbnail: null, url: null, badge: r.line_item_status === "Active" ? "Activa" : null },
            inv: r.revenue_usd, impr: r.impresiones, clics: r.clicks, vtr: r.starts > 0 && r.impresiones ? (r.q50 / r.impresiones) * 100 : null, moneda: "USD", campania: r.rol,
          });
        }
        for (const r of g) {
          if (!enPeriodo(labelKey(r.mes), p) || (cat && !mismaCategoria(r.account_label, cat)) || r.campaign_type === "PERFORMANCE_MAX") continue;
          piezas.push({
            card: { red: `Google ${r.campaign_type ?? ""}`.trim(), titulo: clip(r.ad_name || r.campaign_name, 90), fecha: r.mes, formato: r.account_label, thumbnail: r.thumbnail_url, url: null, badge: r.activa ? "Activa" : null },
            inv: r.cost, impr: r.impressions, clics: r.clicks, vtr: r.vtr_p50 != null && r.vtr_p50 > 0 ? r.vtr_p50 * 100 : null, moneda: "ARS", campania: r.campaign_name,
          });
        }
        const val = (x: Pieza) =>
          orden === "inversion" ? x.inv : orden === "impresiones" ? x.impr : orden === "ctr" ? (x.impr > 1000 ? x.clics / x.impr : null) : orden === "cpm" ? (x.impr > 1000 ? x.inv / x.impr : null) : x.vtr;
        const sorted = piezas.filter((x) => val(x) != null && x.impr > 0).sort((a, b) => (args.asc ? val(a)! - val(b)! : val(b)! - val(a)!)).slice(0, n);
        return {
          periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`,
          nota: "DV360 viene en USD (resto ARS). Inversión por pieza = mes de la fila.",
          piezas: sorted.map((x) => {
            const ctr = x.impr ? (x.clics / x.impr) * 100 : null;
            const cpm = x.impr ? (x.inv / x.impr) * 1000 : null;
            const ref = registrarCard(ctx, "pz", {
              ...x.card,
              metricas: [
                { label: x.moneda === "USD" ? "US$" : "$", valor: fmtN(x.inv) },
                { label: "impr.", valor: fmtN(x.impr) },
                { label: "CTR", valor: ctr != null ? `${ctr.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%` : "–" },
                ...(x.vtr != null ? [{ label: "VTR50", valor: `${x.vtr.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` }] : []),
              ],
            });
            return { ref, plataforma: x.card.red, pieza: x.card.titulo, mes: x.card.fecha, categoria: x.card.formato, campania: clip(x.campania, 60), inversion: Math.round(x.inv), moneda: x.moneda, impresiones: x.impr, clics: x.clics, ctr_pct: rd(ctr, 2), cpm: rd(cpm, x.moneda === "USD" ? 2 : 0), vtr50_pct: rd(x.vtr, 1) };
          }),
        };
      },
    },
  ];
}
