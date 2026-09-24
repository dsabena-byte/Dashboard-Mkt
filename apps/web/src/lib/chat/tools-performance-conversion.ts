import "server-only";
import { getConversionDaily, getConversionItems } from "@/lib/pauta-conversion-queries";
import { periodo, enPeriodo, ymKey, keyLabel, div, rd, oneOf, topN } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Performance → Conversión (/performance-conversion): pauta ecommerce (campañas
// inhouse_*, Google Ads/PMax) → web (GA4). Antes devolvía la tabla DIARIA cruda por
// campaña; ahora agrega por mes/semana/campaña con CPA, ROAS, CPC y conversion rate.
// ============================================================================

type Acc = { ses: number; tx: number; ing: number; costo: number; clics: number; impr: number };
const empty = (): Acc => ({ ses: 0, tx: 0, ing: 0, costo: 0, clics: 0, impr: 0 });
const met = (a: Acc) => ({
  sesiones: a.ses,
  transacciones: a.tx,
  ingresos: Math.round(a.ing),
  inversion: Math.round(a.costo),
  clics: a.clics,
  impresiones: a.impr,
  conv_rate_pct: div(a.tx, a.ses, 100),
  cpa: div(a.costo, a.tx),
  roas: div(a.ing, a.costo),
  cpc: div(a.costo, a.clics),
  ctr_pct: div(a.clics, a.impr, 100),
});
const PER = { desde: { type: "string", description: "YYYY-MM (default año en curso)" }, hasta: { type: "string" } };

export const performanceConversionTools: ChatTool[] = [
  {
    name: "get_conversion_diaria",
    description:
      "Pauta de conversión (ecommerce, campañas inhouse_* de Google Ads) → web GA4, AGREGADA por 'nivel': mensual | semanal | campania. Devuelve sesiones, transacciones, ingresos, inversión, clics, impresiones y los ratios CPA/CAC, ROAS, CPC, CTR y conversion rate. Moneda ARS.",
    parameters: {
      type: "object",
      properties: {
        ...PER,
        nivel: { type: "string", enum: ["mensual", "semanal", "campania"], description: "default mensual" },
        campania: { type: "string", description: "filtrar por texto de campaña (opcional)" },
        top: { type: "number", description: "campañas (default 15, máx 30)" },
      },
    },
    run: async (args) => {
      const p = periodo(args);
      const nivel = oneOf(args.nivel, ["mensual", "semanal", "campania"] as const, "mensual");
      const f = typeof args.campania === "string" ? args.campania.toLowerCase() : "";
      const rows = (await getConversionDaily()).filter((r) => enPeriodo(ymKey(r.fecha), p) && (!f || r.campaign.toLowerCase().includes(f)));
      const g = new Map<string, Acc>();
      const tot = empty();
      for (const r of rows) {
        let key: string;
        if (nivel === "mensual") key = r.fecha.slice(0, 7);
        else if (nivel === "campania") key = r.campaign;
        else {
          const d = new Date(`${r.fecha}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
          key = d.toISOString().slice(0, 10);
        }
        const a = g.get(key) ?? empty();
        for (const t of [a, tot]) { t.ses += r.sesiones; t.tx += r.transacciones; t.ing += r.ingresos; t.costo += r.costo; t.clics += r.ad_clicks; t.impr += r.ad_impresiones; }
        g.set(key, a);
      }
      let filas = [...g.entries()].map(([k, a]) => ({ [nivel === "mensual" ? "mes" : nivel === "semanal" ? "semana" : "campania"]: nivel === "mensual" ? keyLabel(ymKey(k)!) : k, _k: k, ...met(a) }));
      if (nivel === "campania") filas = filas.sort((a, b) => b.inversion - a.inversion).slice(0, topN(args.top, 15, 30));
      else filas.sort((a, b) => a._k.localeCompare(b._k));
      return { periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`, moneda: "ARS", total: met(tot), filas: filas.map(({ _k, ...x }) => x) };
    },
  },
  {
    name: "get_conversion_productos",
    description: "Productos comprados atribuidos a la pauta de conversión: ranking por ingresos (unidades, ingresos, ticket medio). Período YYYY-MM.",
    parameters: { type: "object", properties: { ...PER, top: { type: "number", description: "default 15, máx 30" } } },
    run: async (args) => {
      const p = periodo(args);
      const g = new Map<string, { u: number; ing: number }>();
      for (const r of await getConversionItems()) {
        if (!enPeriodo(ymKey(r.fecha), p)) continue;
        const e = g.get(r.item_name) ?? { u: 0, ing: 0 };
        e.u += r.items_purchased; e.ing += r.item_revenue;
        g.set(r.item_name, e);
      }
      const tot = [...g.values()].reduce((a, e) => a + e.ing, 0);
      return {
        periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`,
        productos: [...g.entries()].sort((a, b) => b[1].ing - a[1].ing).slice(0, topN(args.top, 15, 30)).map(([producto, e]) => ({ producto, unidades: e.u, ingresos: Math.round(e.ing), ticket: div(e.ing, e.u), share_ingresos_pct: tot ? rd((e.ing / tot) * 100, 1) : null })),
      };
    },
  },
];
