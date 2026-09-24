import "server-only";
import { getSeguimientoCompleto } from "@/lib/objetivos-por-categoria";
import { getMapaConfig } from "@/lib/mapa-server";
import { getTradeMonthly } from "@/lib/trade-monthly";
import { FS_OBJ_PCT } from "@/lib/floor-share-queries";
import { getFacturacionMensual } from "@/lib/facturacion-queries";
import { MES, rd, hoyAR, periodo, enPeriodo, ymKey, keyLabel } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Seguimiento Objetivos (/overview) + Mapa Estratégico. Todo sale de fuentes rápidas:
// getSeguimientoCompleto (mismo cálculo del dash, CB/FS por trade_monthly) y
// trade_monthly (precalculada por el cron trade-agg) — NUNCA se pagina CB/FS acá.
// ============================================================================

const CB_OBJ = 80;
const serie = (xs: (number | null)[], d = 2) => xs.map((v) => rd(v, d));
const anioActual = () => Number(hoyAR().slice(0, 4));
// trade_monthly mapea semanas ISO al año en curso: las semanas de fin del año anterior
// caen en "Dic" del año actual → se ignoran los meses futuros.
const mesActualIdx = () => Number(hoyAR().slice(5, 7)) - 1;

function cumplKpi(real: (number | null)[], meta: (number | null)[], tipo: "sum" | "rate", dir: "up" | "down") {
  let ref = -1;
  for (let i = 11; i >= 0; i--) if (real[i] != null) { ref = i; break; }
  if (ref < 0) return { mes_ref: null, real_mes: null, meta_mes: null, cumpl_mes_pct: null, real_ytd: null, meta_ytd: null, cumpl_ytd_pct: null };
  const c = (r: number | null, m: number | null) => (r == null || m == null || m === 0 ? null : rd(dir === "down" ? (m / r) * 100 : (r / m) * 100, 1));
  const upto = real.slice(0, ref + 1), metas = meta.slice(0, ref + 1);
  const nn = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
  const rY = tipo === "sum" ? nn(upto).reduce((a, b) => a + b, 0) : nn(upto).length ? nn(upto).reduce((a, b) => a + b, 0) / nn(upto).length : null;
  const mY = nn(metas).length ? (tipo === "sum" ? nn(metas).reduce((a, b) => a + b, 0) : nn(metas).reduce((a, b) => a + b, 0) / nn(metas).length) : null;
  return {
    mes_ref: MES[ref],
    real_mes: rd(real[ref], 2),
    meta_mes: rd(meta[ref] ?? null, 2),
    cumpl_mes_pct: c(real[ref] ?? null, meta[ref] ?? null),
    real_ytd: rd(rY, 2),
    meta_ytd: rd(mY, 2),
    cumpl_ytd_pct: c(rY, mY),
  };
}

export const overviewTools: ChatTool[] = [
  {
    name: "get_seguimiento",
    description:
      "Seguimiento de Objetivos (Mapa Estratégico → KPIs → metas): cumplimiento de cada objetivo estratégico (TOM, SOM, Intención, Poder de marca) y de Salud de Marca (mes de referencia y YTD, cobertura, aporte de cada KPI con su peso) + scorecard de KPIs con real vs meta mensual (12 meses Ene..Dic), cumplimiento mes/YTD, unidad, tipo (sum/rate) y dirección. Vista general o por categoría. Usala para '¿cómo vengo vs objetivos?', '¿qué KPI mueve más la aguja?', proyecciones a cierre (pasá realM/metaM a calc proyeccion_cierre).",
    parameters: {
      type: "object",
      properties: {
        vista: { type: "string", enum: ["general", "Lavado", "Refrigeración", "Cocción"], description: "default general" },
        kpi: { type: "string", description: "Filtrar un KPI por nombre (opcional)" },
        series: { type: "boolean", description: "Incluir series mensuales realM/metaM de cada KPI (default true)" },
      },
    },
    run: async (args) => {
      const anio = anioActual();
      const s = await getSeguimientoCompleto(anio);
      if (!s.disponible) return { disponible: false, motivo: "No hay Mapa Estratégico guardado en la base." };
      const key = typeof args.vista === "string" && args.vista !== "general" ? args.vista : "general";
      const v = s.vistas.find((x) => x.key === key) ?? s.vistas[0]!;
      const filtro = typeof args.kpi === "string" ? args.kpi.toLowerCase() : "";
      const conSeries = args.series !== false;
      return {
        anio,
        vista: v.label,
        mes_referencia: s.refMes,
        regla: "cumpl(KPI)=min(real/meta,100); cumpl(objetivo)=Σ peso×cumpl(KPI) sobre KPIs con dato (cobertura); Salud de Marca = Σ peso estratégico × cumpl(objetivo).",
        salud_de_marca: { cumpl_mes_pct: rd(v.seg.saludMarca.cumplMes, 1), cumpl_ytd_pct: rd(v.seg.saludMarca.cumplYtd, 1), serie_cumpl: serie(v.seg.saludMarca.cumplSerie, 1) },
        objetivos: v.seg.objetivos.map((o) => ({
          objetivo: o.nombre,
          peso_estrategico_pct: rd(o.pesoEstrategico, 1),
          cumpl_mes_pct: rd(o.cumplMes, 1),
          cumpl_ytd_pct: rd(o.cumplYtd, 1),
          cobertura_pct: rd(o.cobertura, 0),
          aportes: o.aportes.map((a) => ({ kpi: a.kpi, peso_pct: rd(a.peso, 1), cumpl_pct: rd(a.cumpl, 1) })),
        })),
        kpis: v.kpis
          .filter((k) => !filtro || k.kpi.toLowerCase().includes(filtro) || k.plan.toLowerCase().includes(filtro))
          .map((k) => ({
            plan: k.plan,
            kpi: k.kpi,
            unidad: k.unit,
            tipo: k.tipo,
            direccion: k.direccion,
            ...cumplKpi(k.realM, k.metaM, k.tipo, k.direccion),
            ...(conSeries ? { realM: serie(k.realM), metaM: serie(k.metaM) } : {}),
          })),
      };
    },
  },
  {
    name: "get_mapa_estrategico",
    description:
      "Estructura del Mapa Estratégico: objetivos con su peso estratégico y, por plan (disciplina), los KPIs con su peso inbound hacia cada objetivo y el mix por categoría (Brand/Lavado/Refrigeración/Cocción). Útil para saber qué KPI pesa más en qué objetivo o detectar KPIs sin vínculo.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const m = await getMapaConfig();
      if (!m) return { disponible: false, motivo: "No hay Mapa guardado." };
      const totPeso = m.objetivos.reduce((a, o) => a + (o.peso || 0), 0) || 1;
      const nombre = new Map(m.objetivos.map((o) => [o.id, o.nombre]));
      return {
        objetivos: m.objetivos.map((o) => ({ objetivo: o.nombre, peso_pct: rd((o.peso / totPeso) * 100, 1) })),
        planes: m.planes.map((p) => ({
          plan: p.nombre,
          kpis: p.kpis.map((k) => ({
            kpi: k.nombre,
            vinculos: Object.fromEntries(Object.entries(k.vinculos ?? {}).filter(([, w]) => w > 0).map(([id, w]) => [nombre.get(id) ?? id, w])),
            ...(k.mix ? { mix: k.mix } : {}),
          })),
        })),
      };
    },
  },
  {
    name: "get_cumplimiento_cb",
    description:
      "Cumplimiento de Cuadro Básico (Trade) por mes del año en curso (% CB total, objetivo 80%): serie mensual, último mes, promedio últimos 3 meses. Fuente: trade_monthly (precalculada del relevamiento CB).",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const t = await getTradeMonthly(anioActual());
      const hasta = mesActualIdx();
      const vals = t.cb.map((v, i) => ({ mes: MES[i], cb_pct: i <= hasta ? rd(v, 1) : null })).filter((x) => x.cb_pct != null);
      const u3 = vals.slice(-3);
      return {
        objetivo_pct: CB_OBJ,
        serie: vals,
        ultimo: vals[vals.length - 1] ?? null,
        promedio_u3m: u3.length ? rd(u3.reduce((a, b) => a + (b.cb_pct ?? 0), 0) / u3.length, 1) : null,
        cumple_u3m: u3.length ? u3.reduce((a, b) => a + (b.cb_pct ?? 0), 0) / u3.length >= CB_OBJ : null,
      };
    },
  },
  {
    name: "get_cumplimiento_floor_share",
    description:
      "Floor Share de Drean por mes del año en curso, general (ponderado) y por categoría (Lavado/Refrigeración/Cocción) con sus objetivos (32/25/23%): serie mensual, último mes y promedio últimos 4 meses. Fuente: trade_monthly.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const t = await getTradeMonthly(anioActual());
      const hasta = mesActualIdx();
      const obj: Record<string, number> = { Lavado: FS_OBJ_PCT.lavado, Refrigeración: FS_OBJ_PCT.refri, Cocción: FS_OBJ_PCT.coccion };
      const cat = (nombre: string, xs: (number | null)[]) => {
        const vals = xs.map((v, i) => ({ mes: MES[i], share_pct: i <= hasta ? rd(v, 1) : null })).filter((x) => x.share_pct != null);
        const u4 = vals.slice(-4);
        const prom = u4.length ? u4.reduce((a, b) => a + (b.share_pct ?? 0), 0) / u4.length : null;
        return { categoria: nombre, objetivo_pct: obj[nombre] ?? null, serie: vals, ultimo: vals[vals.length - 1] ?? null, promedio_u4m: rd(prom, 1), cumple_u4m: prom != null && obj[nombre] != null ? prom >= obj[nombre]! : null };
      };
      return {
        general: cat("General", t.fsGeneral),
        categorias: Object.entries(t.fsCat).map(([k, v]) => cat(k, v)),
      };
    },
  },
  {
    name: "get_facturacion_mensual",
    description: "Facturación mensual de Drean (USD) por mes. Filtrable por período (YYYY-MM). Sirve para cruzar inversión/actividad de marketing vs ventas.",
    parameters: {
      type: "object",
      properties: { desde: { type: "string", description: "YYYY-MM" }, hasta: { type: "string", description: "YYYY-MM" } },
    },
    run: async (args) => {
      const p = periodo(args, 24);
      const rows = (await getFacturacionMensual()).filter((r) => enPeriodo(ymKey(r.mes), p));
      return { moneda: rows[0]?.moneda ?? "USD", meses: rows.map((r) => ({ mes: keyLabel(ymKey(r.mes)!), facturacion: r.facturacion })) };
    },
  },
];
