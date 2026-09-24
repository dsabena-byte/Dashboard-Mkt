import "server-only";
import { getMercadoRows, type MercadoRow } from "@/lib/mercado-queries";
import { periodo, enPeriodo, ymKey, keyLabel, rd, oneOf, mismaCategoria, hoyAR } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Resultados Comerciales / Mercado (/mercado, GfK). Antes devolvía TODAS las filas
// (miles: marca × categoría × segmento × mes); ahora agrega por nivel.
// ============================================================================

const r2 = (v: number | null | undefined) => rd(v ?? null, 2);

export const mercadoTools: ChatTool[] = [
  {
    name: "get_mercado",
    description:
      "Participación de mercado GfK (ventas reales a consumidor) por categoría (Lavado/Refrigeración/Cocción) y segmento (Total/High/Mid/Low): value share %, unit share % e índice de precio (base 100). nivel=ultimo: ranking de marcas del último mes con dato; nivel=serie: evolución mensual de una marca (default Drean). agregacion MAT (móvil 12 meses, default) o mensual.",
    parameters: {
      type: "object",
      properties: {
        nivel: { type: "string", enum: ["ultimo", "serie"], description: "default ultimo" },
        agregacion: { type: "string", enum: ["MAT", "mensual"] },
        categoria: { type: "string", description: "Lavado | Refrigeración | Cocción (omitir = las 3)" },
        segmento: { type: "string", enum: ["Total", "High", "Mid", "Low"], description: "default Total" },
        marca: { type: "string", description: "para nivel serie (default DREAN)" },
        desde: { type: "string", description: "YYYY-MM (serie; default últimos 12 meses)" },
        hasta: { type: "string" },
      },
    },
    run: async (args) => {
      const agr = args.agregacion === "mensual" ? "mensual" : "MAT";
      const nivel = oneOf(args.nivel, ["ultimo", "serie"] as const, "ultimo");
      const seg = oneOf(args.segmento, ["Total", "High", "Mid", "Low"] as const, "Total");
      const cat = typeof args.categoria === "string" ? args.categoria : undefined;
      // Filas con mes futuro (hay cargas anticipadas, ej. "2026-11") no son dato real → se ignoran.
      const hoyK = ymKey(hoyAR())!;
      const rows = (await getMercadoRows(agr)).filter((r) => r.segmento === seg && mismaCategoria(r.categoria, cat) && (ymKey(r.mes) ?? 0) <= hoyK);
      if (nivel === "ultimo") {
        const byCat = new Map<string, MercadoRow[]>();
        for (const r of rows) (byCat.get(r.categoria) ?? byCat.set(r.categoria, []).get(r.categoria)!).push(r);
        return {
          agregacion: agr,
          segmento: seg,
          categorias: [...byCat.entries()].map(([c, xs]) => {
            const conDato = xs.filter((x) => x.value_share != null || x.unit_share != null);
            const ult = xs.filter((x) => x.value_share != null).reduce((a, x) => (x.mes > a ? x.mes : a), "");
            const prevK = ymKey(ult)! - (agr === "MAT" ? 12 : 1);
            const prev = new Map(conDato.filter((x) => ymKey(x.mes) === prevK).map((x) => [x.marca, x]));
            return {
              categoria: c,
              mes: ult ? keyLabel(ymKey(ult)!) : null,
              marcas: conDato
                .filter((x) => x.mes === ult)
                .sort((a, b) => (b.value_share ?? 0) - (a.value_share ?? 0))
                .slice(0, 10)
                .map((x) => ({ marca: x.marca, value_share: r2(x.value_share), unit_share: r2(x.unit_share), indice_precio: r2(x.index_price), value_share_hace_1_anio: agr === "MAT" ? r2(prev.get(x.marca)?.value_share) : undefined, value_share_mes_ant: agr === "mensual" ? r2(prev.get(x.marca)?.value_share) : undefined })),
            };
          }),
        };
      }
      const marca = (typeof args.marca === "string" ? args.marca : "DREAN").toUpperCase();
      const p = periodo(args, 12);
      return {
        agregacion: agr,
        segmento: seg,
        marca,
        serie: rows
          .filter((r) => r.marca.toUpperCase() === marca && enPeriodo(ymKey(r.mes), p))
          .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.mes.localeCompare(b.mes))
          .map((r) => ({ categoria: r.categoria, mes: keyLabel(ymKey(r.mes)!), value_share: r2(r.value_share), unit_share: r2(r.unit_share), indice_precio: r2(r.index_price) })),
      };
    },
  },
];
