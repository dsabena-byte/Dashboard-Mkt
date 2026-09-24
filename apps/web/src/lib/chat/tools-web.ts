import "server-only";
import {
  getWebDailyKpis,
  aggregateDaily,
  getWebBySource,
  aggregateBySource,
  getAllMonthlyUsers,
  getWebMonthlyKpis,
  getWebMonthlyByChannel,
  getWebByCategory,
  aggregateByCategory,
  getWebTopProducts,
  getWebTopLandingPages,
} from "@/lib/web-queries";
import { periodo, enPeriodo, ymKey, keyLabel, keyIso, keyIsoFin, rd, div, oneOf, topN, hoyAR } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Web / Ecommerce (/web, GA4). Reglas de perf del dash: histórico = vistas MENSUALES
// (vw_drean_web_monthly*, ga4_monthly_users); categoría = tabla precalculada
// web_daily_by_category; NUNCA 24 meses de datos diarios de las vistas web_landing_daily.
// Rangos diarios (get_web_kpis) solo hasta ~3 meses.
// ============================================================================

const MAX_DIAS_DIARIO = 93;
const dias = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000 + 1;

async function mensual(p: { desde: number; hasta: number }) {
  const [kpis, users, canal] = await Promise.all([
    getWebMonthlyKpis({ from: keyIso(p.desde), to: keyIsoFin(p.hasta) }),
    getAllMonthlyUsers(),
    getWebMonthlyByChannel(36),
  ]);
  const u = new Map(users.map((r) => [ymKey(r.mes), r]));
  const pv = new Map<number, number>();
  for (const c of canal) { const k = ymKey(c.mes); if (k != null) pv.set(k, (pv.get(k) ?? 0) + (c.pageviews ?? 0)); }
  return kpis
    .map((r) => ({ k: ymKey(r.fecha)!, r }))
    .filter((x) => enPeriodo(x.k, p))
    .sort((a, b) => a.k - b.k)
    .map(({ k, r }) => ({
      mes: keyLabel(k),
      usuarios: u.get(k)?.total_users ?? null,
      usuarios_nuevos: u.get(k)?.new_users ?? null,
      sesiones: r.sesiones,
      pageviews: pv.get(k) ?? u.get(k)?.pageviews ?? null,
      conversiones: r.conversiones,
      conv_rate_pct: div(r.conversiones, r.sesiones, 100),
      duracion_media_seg: rd(r.avg_session_duration, 0),
    }));
}

export const webTools: ChatTool[] = [
  {
    name: "get_web_kpis",
    description:
      "KPIs de la web (GA4) para un rango de fechas: sesiones, usuarios, conversiones, conversion rate, pageviews, bounce rate y duración media; más el desglose por canal. Rangos de hasta ~3 meses usan data diaria; rangos más largos se resuelven con los agregados mensuales (más rápidos).",
    parameters: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string", description: "Fecha desde YYYY-MM-DD" },
        to: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
      },
    },
    run: async (args) => {
      const from = String(args.from ?? ""), to = String(args.to ?? hoyAR());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "from/to en formato YYYY-MM-DD" };
      if (dias(from, to) > MAX_DIAS_DIARIO) {
        const p = { desde: ymKey(from)!, hasta: ymKey(to)! };
        const meses = await mensual(p);
        const sum = (k: "sesiones" | "conversiones" | "usuarios") => meses.reduce((a, m) => a + (Number(m[k]) || 0), 0);
        return {
          rango: `${from} a ${to} (agregado mensual)`,
          totales: { sesiones: sum("sesiones"), usuarios_suma_mensual: sum("usuarios"), conversiones: sum("conversiones"), conv_rate_pct: div(sum("conversiones"), sum("sesiones"), 100) },
          nota: "Rango largo: se usan meses completos; usuarios = suma de usuarios mensuales (no únicos del período).",
          por_mes: meses,
        };
      }
      const range = { from, to };
      const [daily, bySource] = await Promise.all([getWebDailyKpis(range), getWebBySource(range)]);
      return { rango: `${from} a ${to}`, totales: aggregateDaily(daily), por_canal: aggregateBySource(bySource).slice(0, 12) };
    },
  },
  {
    name: "get_web_mensual",
    description:
      "Serie MENSUAL de la web (GA4): usuarios, usuarios nuevos, sesiones, pageviews, conversiones, conversion rate y duración media por mes. Ideal para cruzar con pauta, redes, SEO o ventas (alinear por mes). Período YYYY-MM (default últimos 12 meses).",
    parameters: { type: "object", properties: { desde: { type: "string" }, hasta: { type: "string" } } },
    run: async (args) => {
      const p = periodo(args, 12);
      return { periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`, meses: await mensual(p) };
    },
  },
  {
    name: "get_web_detalle",
    description:
      "Detalle de la web por 'nivel': categoria (sesiones/usuarios/pageviews/rebote por categoría de producto: Lavado, Refrigeración, Cocinas…; conversiones por categoría no existen) | canal_mensual (sesiones y conversiones por canal y mes) | productos (top productos por sesiones y conversión, máx 2 meses) | landings (top landing pages). Período YYYY-MM.",
    parameters: {
      type: "object",
      required: ["nivel"],
      properties: {
        nivel: { type: "string", enum: ["categoria", "canal_mensual", "productos", "landings"] },
        desde: { type: "string", description: "YYYY-MM (default: mes en curso; canal_mensual: últimos 6 meses)" },
        hasta: { type: "string", description: "YYYY-MM" },
        top: { type: "number", description: "filas (default 10, máx 25)" },
      },
    },
    run: async (args) => {
      const nivel = oneOf(args.nivel, ["categoria", "canal_mensual", "productos", "landings"] as const, "categoria");
      const n = topN(args.top, 10, 25);
      if (nivel === "canal_mensual") {
        const p = periodo(args, 6);
        const rows = (await getWebMonthlyByChannel(36)).filter((r) => enPeriodo(ymKey(r.mes), p));
        return {
          periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`,
          filas: rows.map((r) => ({ mes: keyLabel(ymKey(r.mes)!), canal: r.canal, sesiones: r.sesiones, conversiones: r.conversiones, conv_rate_pct: div(r.conversiones, r.sesiones, 100) })),
        };
      }
      const p = periodo(args, 1);
      const range = { from: keyIso(p.desde), to: keyIsoFin(p.hasta) < hoyAR() ? keyIsoFin(p.hasta) : hoyAR() };
      const rango = `${range.from} a ${range.to}`;
      if (nivel === "categoria") {
        const cats = aggregateByCategory(await getWebByCategory(range));
        return { rango, categorias: cats.slice(0, n) };
      }
      if (p.hasta - p.desde > 1) return { error: "Para productos/landings pedí como máximo 2 meses (desde/hasta)." };
      if (nivel === "productos") {
        const xs = await getWebTopProducts(range, n);
        return { rango, productos: xs.map((x) => ({ producto: x.producto_slug ?? x.landing_page, sku: x.sku, categoria: x.categoria, sesiones: x.sesiones, conversiones: x.conversiones, conv_rate_pct: div(x.conversiones, x.sesiones, 100) })) };
      }
      const xs = await getWebTopLandingPages(range, n);
      return { rango, landings: xs.map((x) => ({ landing: x.landing_page, sesiones: x.sesiones, conversiones: x.conversiones, conv_rate_pct: rd(x.conversion_rate != null ? x.conversion_rate * (x.conversion_rate <= 1 ? 100 : 1) : null, 2), rebote: rd(x.bounce_rate, 3) })) };
    },
  },
];
