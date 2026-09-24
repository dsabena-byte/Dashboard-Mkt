import "server-only";
import { getBgtData, hasVersion } from "@/lib/bgt-queries";
import { getFacturacionMensual, sumFacturacion } from "@/lib/facturacion-queries";
import { computeCuatris, clasifDe, MAX_DESVIO, MAX_INV_FACT, MESES_UP } from "@/lib/bgt-dashboard";
import { MES, rd, hoyAR, oneOf } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Inversión de Marketing (/funnel): presupuesto BGT vs Real (tabla bgt_marketing) +
// facturación. Mismo cálculo que el dash (computeCuatris: T1·BGT, T2·4+8, T3·8+4;
// desvío <5%, Inversión/Facturación ≤1,3%).
// ============================================================================

export const inversionTools: ChatTool[] = [
  {
    name: "get_inversion_mkt",
    description:
      "Inversión de Marketing (presupuesto corporativo, USD o ARS): ejecución por cuatrimestre (Real vs BGT vigente, desvío %, Inversión/Facturación %, semáforo vs límites 5% y 1,3%) + detalle por 'nivel': mensual (Real y BGT por mes) | clasificacion (EQUITY, VISIBILITY, INTEGRALES, PDV, TRADE…) | cuenta. Versiones: BGT, 4+8, 8+4, REAL.",
    parameters: {
      type: "object",
      properties: {
        nivel: { type: "string", enum: ["cuatrimestres", "mensual", "clasificacion", "cuenta"], description: "default cuatrimestres" },
        moneda: { type: "string", enum: ["usd", "ars"], description: "default usd" },
        version_comparacion: { type: "string", description: "Versión B para mensual/clasificación/cuenta (default 'BGT <año>')" },
      },
    },
    run: async (args) => {
      const year = Number(hoyAR().slice(0, 4));
      const curMonth = Number(hoyAR().slice(5, 7));
      const [{ rows, syncedAt }, fact] = await Promise.all([getBgtData(), getFacturacionMensual()]);
      const nivel = oneOf(args.nivel, ["cuatrimestres", "mensual", "clasificacion", "cuenta"] as const, "cuatrimestres");
      const cuatris = computeCuatris(rows, year, year, curMonth, (v) => hasVersion(rows, v), (m) => sumFacturacion(fact, m));
      const base = {
        anio: year,
        sincronizado: syncedAt,
        limites: { desvio_max_pct: MAX_DESVIO, inv_fact_max_pct: MAX_INV_FACT },
        cuatrimestres: cuatris.map((c) => ({
          cuatrimestre: `${c.id} ${c.label}`,
          version_bgt: c.bgtVersion,
          estado: c.estado,
          cobertura: c.coverage,
          bgt_cargado: c.bgtAvailable,
          real_usd: Math.round(c.realVal),
          bgt_usd: Math.round(c.bgtVal),
          desvio_pct: rd(c.desvio, 1),
          facturacion_usd: c.fact,
          inv_fact_pct: rd(c.invFact, 2),
          desvio_ok: c.desvioOk,
          inv_fact_ok: c.invFactOk,
        })),
      };
      if (nivel === "cuatrimestres") return base;
      const field = args.moneda === "ars" ? "ars" : "usd";
      const REAL = `REAL ${year}`;
      const B = typeof args.version_comparacion === "string" && args.version_comparacion ? args.version_comparacion : `BGT ${year}`;
      const del = (v: string) => rows.filter((r) => r.presupuesto === v && Number(r.anio) === year);
      const agg = (xs: typeof rows, key: (r: (typeof rows)[number]) => string) => {
        const m = new Map<string, number>();
        for (const r of xs) m.set(key(r), (m.get(key(r)) ?? 0) + r[field]);
        return m;
      };
      const key = nivel === "mensual" ? (r: (typeof rows)[number]) => r.mes : nivel === "clasificacion" ? (r: (typeof rows)[number]) => clasifDe(r.cuenta) : (r: (typeof rows)[number]) => r.cuenta;
      const a = agg(del(REAL), key), b = agg(del(B), key);
      const keys = [...new Set([...a.keys(), ...b.keys()])];
      if (nivel === "mensual") keys.sort((x, y) => MESES_UP.indexOf(x) - MESES_UP.indexOf(y));
      else keys.sort((x, y) => (a.get(y) ?? 0) - (a.get(x) ?? 0));
      return {
        ...base,
        moneda: field.toUpperCase(),
        comparacion: `${REAL} vs ${B}`,
        filas: keys.slice(0, 30).map((k) => {
          const ra = a.get(k) ?? 0, rb = b.get(k) ?? 0;
          return { [nivel]: nivel === "mensual" ? MES[MESES_UP.indexOf(k)] ?? k : k, real: Math.round(ra), comparacion: Math.round(rb), desvio_pct: rb ? rd(((ra - rb) / rb) * 100, 1) : null };
        }),
      };
    },
  },
];
