import "server-only";
import { getDreanSerie } from "@/lib/salud-marca-queries";
import { computeDreanConsolidado, KANTAR_LAVADO, KANTAR_REFRI, KANTAR_COCCION, SM_WAVES, type KVals } from "@/lib/salud-marca-model";
import { rd } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Salud de Marca (/salud-marca, Kantar). Consolidado de Drean por categoría y ola
// (nov-26 = proyección share→equity del modelo del dash) + comparativo por marca.
// ============================================================================

const KANTAR: Record<string, Record<string, Record<string, KVals>>> = { Lavado: KANTAR_LAVADO, Refrigeración: KANTAR_REFRI, Cocción: KANTAR_COCCION };
const r1 = (v: number | null | undefined) => rd(v ?? null, 1);

export const saludMarcaTools: ChatTool[] = [
  {
    name: "get_salud_de_marca",
    description:
      "Salud de Marca de Drean (Kantar) por categoría (Lavado/Refrigeración/Cocción) y ola (nov-23, nov-24, nov-25 reales; nov-26 = proyección del modelo share GfK → equity): Top of Mind, Share of Mind, Intención de compra, Poder de Marca y puntaje SM (0.25×Σ) + consolidado ponderado por categoría. Con competencia=true agrega esas métricas por marca competidora (olas reales).",
    parameters: {
      type: "object",
      properties: {
        competencia: { type: "boolean", description: "Incluir comparativo por marca (default false)" },
        categoria: { type: "string", enum: ["Lavado", "Refrigeración", "Cocción"], description: "para el comparativo (omitir = las 3)" },
      },
    },
    run: async (args) => {
      const [lav, ref, coc] = await Promise.all([
        getDreanSerie("Lavado", "MAT", "DREAN"),
        getDreanSerie("Refrigeración", "MAT", "DREAN"),
        getDreanSerie("Cocción", "MAT", "DREAN"),
      ]);
      const rows = computeDreanConsolidado({ lav, ref, coc });
      const cat = (c: (typeof rows)[number]["lav"]) => ({ tom: r1(c.tom.v), som: r1(c.som.v), intencion: r1(c.int.v), poder: r1(c.poder.v), sm: r1(c.sm.v), estado: c.sm.s });
      const out: Record<string, unknown> = {
        nota: "estado: real = medición Kantar; proj = proyección del modelo share→equity; carry = se arrastra la última ola.",
        drean: rows.map((r) => ({ ola: r.w, lavado: cat(r.lav), refrigeracion: cat(r.ref), coccion: cat(r.coc), pesos: r.wt, sm_consolidado: r1(r.comp) })),
      };
      if (args.competencia === true) {
        const cats = typeof args.categoria === "string" && KANTAR[args.categoria] ? [args.categoria] : Object.keys(KANTAR);
        const olas = SM_WAVES.filter((w) => w !== "nov-26");
        out.competencia = cats.map((c) => ({
          categoria: c,
          marcas: Object.entries(KANTAR[c]!).map(([marca, byWave]) => ({
            marca,
            olas: olas.filter((w) => byWave[w]).map((w) => {
              const k = byWave[w]!;
              const sm = k.tom != null && k.som != null && k.int != null && k.poder != null ? 0.25 * (k.tom + k.som + k.int + k.poder) : null;
              return { ola: w, tom: r1(k.tom), som: r1(k.som), intencion: r1(k.int), poder: r1(k.poder), sm: r1(sm) };
            }),
          })),
        }));
      }
      return out;
    },
  },
];
