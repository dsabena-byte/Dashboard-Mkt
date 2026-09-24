import "server-only";
import { getServerSupabase } from "@/lib/supabase-server";
import { getWebMonthlyKpis, getAllMonthlyUsers } from "@/lib/web-queries";
import { getShareOfSearch, getDemandaGenerica } from "@/lib/competitive-queries";
import { getTradeMonthly } from "@/lib/trade-monthly";
import { getFacturacionMensual } from "@/lib/facturacion-queries";
import { getMercadoRows } from "@/lib/mercado-queries";
import { getConversionDaily } from "@/lib/pauta-conversion-queries";
import { getPautaModelo } from "./pauta-model";
import { periodo, ymKey, hoyAR, keyLabel, keyIso, keyIsoFin, keyAnio, keyMes, rd, mismaCategoria, strArr } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// CRUCE MENSUAL cross-dashboard: series alineadas por mes (mismos meses en todas,
// null donde falta) listas para calc (correlación/elasticidad/proyección) y render_chart.
// Todas las fuentes son baratas: pauta (modelo del dash), web MENSUAL, meta_posts IG,
// share of search / demanda (mensuales), trade_monthly, facturación, GfK, ecommerce.
// ============================================================================

const SERIES = [
  "pauta_inversion", "pauta_impresiones", "pauta_alcance", "pauta_clics",
  "web_usuarios", "web_sesiones", "web_conversiones",
  "ig_alcance", "ig_interacciones", "ig_posts",
  "sos_drean_pct", "demanda_generica",
  "cb_pct", "fs_drean_pct",
  "facturacion_usd", "gfk_value_share_drean", "gfk_unit_share_drean",
  "ecom_inversion", "ecom_ingresos", "ecom_transacciones",
] as const;
type Serie = (typeof SERIES)[number];
const CAT_BUSQ: Record<string, string> = { Lavado: "lavarropas", Refrigeración: "heladeras", Cocción: "cocinas" };

export const crucesTools: ChatTool[] = [
  {
    name: "get_cruce_mensual",
    description:
      "Series MENSUALES alineadas de varias fuentes (cross-dashboard) para cruzar datos: pauta (inversión ARS, impresiones, alcance, clics — misma fuente de verdad del dash), web (usuarios, sesiones, conversiones), Instagram orgánico (alcance, interacciones, posts), share of search de Drean (%) y demanda genérica de la categoría, trade (CB %, Floor Share Drean %; solo año en curso), facturación (USD), GfK (value/unit share Drean, mensual) y ecommerce (inversión, ingresos, transacciones). Devuelve 'meses' + un array por serie (null donde no hay dato), directo para calc (correlacion/elasticidad con lag) y render_chart. Pedí 2-6 series.",
    parameters: {
      type: "object",
      required: ["series"],
      properties: {
        series: { type: "array", items: { type: "string", enum: [...SERIES] }, description: "Series a traer" },
        desde: { type: "string", description: "YYYY-MM (default: últimos 12 meses)" },
        hasta: { type: "string", description: "YYYY-MM (default: mes en curso)" },
        categoria: { type: "string", enum: ["Lavado", "Refrigeración", "Cocción"], description: "Filtra pauta, share of search, demanda, Floor Share y GfK por categoría (omitir = total)" },
      },
    },
    run: async (args) => {
      const pedidas = strArr(args.series).filter((s): s is Serie => (SERIES as readonly string[]).includes(s));
      if (!pedidas.length) return { error: `Pedí al menos una serie de: ${SERIES.join(", ")}` };
      const p = periodo(args, 12);
      if (p.hasta - p.desde > 35) p.desde = p.hasta - 35;
      const cat = typeof args.categoria === "string" ? args.categoria : undefined;
      const keys = Array.from({ length: p.hasta - p.desde + 1 }, (_, i) => p.desde + i);
      const idx = new Map(keys.map((k, i) => [k, i]));
      const out: Partial<Record<Serie, (number | null)[]>> = {};
      const notas: string[] = [];
      const blank = () => keys.map(() => null as number | null);
      const put = (s: Serie, k: number | null, v: number | null | undefined, sum = true) => {
        if (k == null || v == null || !Number.isFinite(v)) return;
        const i = idx.get(k);
        if (i == null) return;
        const arr = (out[s] ??= blank());
        arr[i] = sum && arr[i] != null ? arr[i]! + v : v;
      };
      const want = (...s: Serie[]) => s.some((x) => pedidas.includes(x));
      const tareas: Promise<void>[] = [];

      if (want("pauta_inversion", "pauta_impresiones", "pauta_alcance", "pauta_clics")) {
        tareas.push(getPautaModelo().then((m) => {
          for (const f of m.filas) {
            if (!mismaCategoria(f.categoria, cat)) continue;
            put("pauta_inversion", f.k, f.inversion); put("pauta_impresiones", f.k, f.impresiones); put("pauta_alcance", f.k, f.alcance); put("pauta_clics", f.k, f.clics);
          }
          notas.push(`Pauta: OMD solo meses cerrados; ${keyLabel(m.mesEnCurso)} parcial (solo API). Meta por API.`);
        }));
      }
      if (want("web_usuarios", "web_sesiones", "web_conversiones")) {
        if (cat) notas.push("Web: serie total (conversiones por categoría no existen).");
        tareas.push(Promise.all([getWebMonthlyKpis({ from: keyIso(p.desde), to: keyIsoFin(p.hasta) }), getAllMonthlyUsers()]).then(([kp, us]) => {
          for (const r of kp) { put("web_sesiones", ymKey(r.fecha), r.sesiones, false); put("web_conversiones", ymKey(r.fecha), r.conversiones, false); }
          for (const u of us) put("web_usuarios", ymKey(u.mes), u.total_users, false);
        }));
      }
      if (want("ig_alcance", "ig_interacciones", "ig_posts")) {
        tareas.push((async () => {
          const { data } = await getServerSupabase()
            .from("meta_posts")
            .select("fecha_post, reach, engagement")
            .eq("platform", "instagram")
            .gte("fecha_post", `${keyIso(p.desde)}T00:00:00Z`)
            .lte("fecha_post", `${keyIsoFin(p.hasta)}T23:59:59Z`)
            .limit(10000)
            .returns<Array<{ fecha_post: string; reach: number | null; engagement: number | null }>>();
          for (const r of data ?? []) {
            const k = ymKey(r.fecha_post);
            put("ig_alcance", k, r.reach ?? 0); put("ig_interacciones", k, r.engagement ?? 0); put("ig_posts", k, 1);
          }
          notas.push("IG: suma de alcance por post (incluye stories), no alcance único de la cuenta.");
        })());
      }
      if (want("sos_drean_pct")) {
        tareas.push(getShareOfSearch().then((rows) => {
          const c = cat ? CAT_BUSQ[cat] : undefined;
          const tot = new Map<number, { d: number; t: number }>();
          for (const r of rows) {
            if (c && r.categoria !== c) continue;
            const k = ymKey(r.mes)!;
            const e = tot.get(k) ?? { d: 0, t: 0 };
            e.t += r.vol; if (r.marca.toLowerCase() === "drean") e.d += r.vol;
            tot.set(k, e);
          }
          for (const [k, e] of tot) put("sos_drean_pct", k, e.t ? rd((e.d / e.t) * 100, 2) : null, false);
        }));
      }
      if (want("demanda_generica")) {
        tareas.push(getDemandaGenerica().then((rows) => {
          const c = cat ? CAT_BUSQ[cat] : undefined;
          for (const r of rows) if (!c || r.categoria === c) put("demanda_generica", ymKey(r.mes), r.search_volume);
        }));
      }
      if (want("cb_pct", "fs_drean_pct")) {
        const anios = [...new Set(keys.map(keyAnio))];
        tareas.push(Promise.all(anios.map((a) => getTradeMonthly(a).then((t) => ({ a, t })))).then((ts) => {
          const hoyK = ymKey(hoyAR())!;
          for (const { a, t } of ts) for (let m = 0; m < 12; m++) {
            const k = a * 12 + m;
            if (k > hoyK) continue; // trade_monthly: semanas de fin del año anterior caen en "Dic" del actual
            put("cb_pct", k, rd(t.cb[m] ?? null, 1), false);
            put("fs_drean_pct", k, rd((cat ? t.fsCat[cat]?.[m] : t.fsGeneral[m]) ?? null, 1), false);
          }
        }));
      }
      if (want("facturacion_usd")) {
        if (cat) notas.push("Facturación: total empresa (no hay apertura por categoría).");
        tareas.push(getFacturacionMensual().then((rows) => { for (const r of rows) put("facturacion_usd", ymKey(r.mes), r.facturacion, false); }));
      }
      if (want("gfk_value_share_drean", "gfk_unit_share_drean")) {
        tareas.push(getMercadoRows("mensual").then((rows) => {
          const acc = new Map<number, { v: number[]; u: number[] }>();
          for (const r of rows) {
            if (r.marca.toUpperCase() !== "DREAN" || r.segmento !== "Total" || !mismaCategoria(r.categoria, cat) || (ymKey(r.mes) ?? 0) > ymKey(hoyAR())!) continue;
            const k = ymKey(r.mes)!;
            const e = acc.get(k) ?? { v: [], u: [] };
            if (r.value_share != null) e.v.push(r.value_share);
            if (r.unit_share != null) e.u.push(r.unit_share);
            acc.set(k, e);
          }
          const avg = (xs: number[]) => (xs.length ? rd(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null);
          for (const [k, e] of acc) { put("gfk_value_share_drean", k, avg(e.v), false); put("gfk_unit_share_drean", k, avg(e.u), false); }
          if (!cat) notas.push("GfK sin categoría = promedio simple de las 3 categorías (segmento Total).");
        }));
      }
      if (want("ecom_inversion", "ecom_ingresos", "ecom_transacciones")) {
        tareas.push(getConversionDaily().then((rows) => {
          for (const r of rows) { const k = ymKey(r.fecha); put("ecom_inversion", k, r.costo); put("ecom_ingresos", k, r.ingresos); put("ecom_transacciones", k, r.transacciones); }
        }));
      }
      const fallas = (await Promise.allSettled(tareas)).filter((x) => x.status === "rejected").length;
      if (fallas) notas.push(`${fallas} fuente(s) no respondieron; sus series quedan en null.`);
      const series = Object.fromEntries(pedidas.map((s) => [s, (out[s] ?? blank()).map((v) => (v == null ? null : rd(v, 2)))]));
      return {
        meses: keys.map(keyLabel),
        mes_en_curso_parcial: idx.has(ymKey(hoyAR())!) ? keyLabel(ymKey(hoyAR())!) : null,
        series,
        filas: keys.map((k, i) => ({ mes: keyLabel(k), ...Object.fromEntries(pedidas.map((s) => [s, series[s]![i] ?? null])) })),
        notas,
        pista: `Para correlación pasá dos series a calc (operacion correlacion, lag 0-2 si la causa precede al efecto). Mes índice 0 = ${keyLabel(keys[0]!)} (${keyMes(keys[0]!) + 1}/${keyAnio(keys[0]!)}).`,
      };
    },
  },
];
