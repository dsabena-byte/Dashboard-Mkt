import "server-only";
import { getCbRowsFast } from "@/lib/cb-mirror";
import {
  computeTotals,
  computeWeeklyEvolution,
  computeByDivision,
  computeByDim,
  computeByTienda,
  getCbBaselineMedidas,
  getCbSuggestions,
  aggregateSuggestionsByCadena,
  isoWeekToMes,
} from "@/lib/cb-queries";
import { rd, topN, oneOf, strArr } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Cuadros Básicos (/cuadros-basicos). Lee el MIRROR del proyecto principal
// (cb_semanal_mirror, getCbRowsFast — lo llena el cron cb-mirror) igual que el dash.
// Antes paginaba el proyecto CB (lento) en cada pregunta.
// ============================================================================

const r1 = (v: number | null | undefined) => rd(v ?? null, 1);

export const cuadrosBasicosTools: ChatTool[] = [
  {
    name: "get_cb_cumplimiento",
    description:
      "Cumplimiento de Cuadro Básico (objetivo 80%): totales (% CB, Infaltables, Estratégicos, tiendas) + el desglose pedido en 'nivel': semanal | division | cliente (cadena, con delta vs período) | tienda (peores/mejores). Filtros opcionales: semanas ISO, meses ('Ene'..'Dic'), divisiones, clientes.",
    parameters: {
      type: "object",
      properties: {
        nivel: { type: "string", enum: ["resumen", "semanal", "division", "cliente", "tienda"], description: "default resumen (totales + semanal + división)" },
        semanas: { type: "array", items: { type: "number" }, description: "números de semana ISO (opcional)" },
        meses: { type: "array", items: { type: "string" }, description: "meses 'Ene'..'Dic' (opcional)" },
        divisiones: { type: "array", items: { type: "string" } },
        clientes: { type: "array", items: { type: "string" }, description: "cadenas (opcional)" },
        orden: { type: "string", enum: ["peores", "mejores"], description: "para nivel tienda/cliente (default peores)" },
        top: { type: "number", description: "filas (default 15, máx 40)" },
      },
    },
    run: async (args) => {
      const semanas = Array.isArray(args.semanas) ? (args.semanas as unknown[]).map(Number).filter(Number.isFinite) : [];
      const meses = strArr(args.meses);
      const divs = strArr(args.divisiones).map((d) => d.toLowerCase());
      const clientes = strArr(args.clientes).map((d) => d.toLowerCase());
      const all = await getCbRowsFast();
      const rows = all.filter(
        (r) =>
          (!semanas.length || semanas.includes(r.semana)) &&
          (!meses.length || meses.includes(isoWeekToMes(r.semana))) &&
          (!divs.length || divs.some((d) => (r.division ?? "").toLowerCase().includes(d))) &&
          (!clientes.length || clientes.some((c) => (r.cliente ?? "").toLowerCase().includes(c))),
      );
      const nivel = oneOf(args.nivel, ["resumen", "semanal", "division", "cliente", "tienda"] as const, "resumen");
      const n = topN(args.top, 15, 40);
      const peores = args.orden !== "mejores";
      const t = computeTotals(rows);
      const totales = { cb_pct: r1(t.cb_pct), infalt_pct: r1(t.infalt_pct), estrat_pct: r1(t.estrat_pct), tiendas: t.tiendas, objetivo_cb_pct: 80 };
      const semanal = () => computeWeeklyEvolution(rows).map((w) => ({ semana: w.semana, mes: isoWeekToMes(w.semana), cb_pct: r1(w.cb_pct), infalt_pct: r1(w.infalt_pct), estrat_pct: r1(w.estrat_pct) }));
      const division = () => computeByDivision(rows).map((d) => ({ division: d.division, cb_pct: r1(d.cb_pct), infalt_pct: r1(d.infalt_pct), estrat_pct: r1(d.estrat_pct) }));
      if (nivel === "resumen") return { totales, evolucion_semanal: semanal(), por_division: division() };
      if (nivel === "semanal") return { totales, evolucion_semanal: semanal() };
      if (nivel === "division") return { totales, por_division: division() };
      if (nivel === "cliente") {
        const xs = computeByDim(rows, "cliente").sort((a, b) => (peores ? a.cb_pct - b.cb_pct : b.cb_pct - a.cb_pct));
        return { totales, por_cliente: xs.slice(0, n).map((c) => ({ cliente: c.key, cb_pct: r1(c.cb_pct), cb_delta: r1(c.cb_delta), infalt_pct: r1(c.infalt_pct), estrat_pct: r1(c.estrat_pct) })), total_clientes: xs.length };
      }
      const ts = computeByTienda(rows);
      const score = (x: (typeof ts)[number]) => {
        const v = [x.cb_lavado, x.cb_refri, x.cb_coccion].filter((y): y is number => y != null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      const ord = ts.filter((x) => score(x) != null).sort((a, b) => (peores ? score(a)! - score(b)! : score(b)! - score(a)!));
      return { totales, por_tienda: ord.slice(0, n).map((x) => ({ cliente: x.cliente, tienda: x.tienda, cb_lavado: r1(x.cb_lavado), cb_refri: r1(x.cb_refri), cb_coccion: r1(x.cb_coccion) })), total_tiendas: ord.length };
    },
  },
  {
    name: "get_cb_baseline",
    description: "Baseline de tiendas medidas (últimas 3 semanas): % CB e Infaltable promedio y cantidad de tiendas medidas.",
    parameters: { type: "object", properties: {} },
    run: async () => getCbBaselineMedidas(),
  },
  {
    name: "get_cb_sugerencias",
    description:
      "Tiendas NO medidas hoy pero candidatas a sumar al programa CB (del Reporte de Existencias), con su % CB calculado: resumen por cadena + top N tiendas (por % CB).",
    parameters: { type: "object", properties: { top: { type: "number", description: "tiendas (default 20, máx 40)" }, cadena: { type: "string" } } },
    run: async (args) => {
      const all = await getCbSuggestions();
      const cad = typeof args.cadena === "string" ? args.cadena.toLowerCase() : "";
      const xs = cad ? all.filter((s) => s.cadena.toLowerCase().includes(cad)) : all;
      return {
        total_tiendas: xs.length,
        por_cadena: aggregateSuggestionsByCadena(xs).slice(0, 15).map((c) => ({ ...c, cb_pct_promedio: r1(c.cb_pct_promedio) })),
        tiendas: xs
          .slice()
          .sort((a, b) => (b.cb_pct ?? 0) - (a.cb_pct ?? 0))
          .slice(0, topN(args.top, 20, 40))
          .map((s) => ({ tienda: s.tienda, cadena: s.cadena, cb_pct: r1(s.cb_pct), infalt_pct: r1(s.infalt_pct), estrat_pct: r1(s.estrat_pct) })),
      };
    },
  },
];
