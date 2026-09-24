import "server-only";
import { MODULOS, textoBusqueda, getModulo } from "@/lib/guia";
import { KPI_KNOW } from "@/lib/knowledge";
import type { ChatTool } from "./types";

// Método BIP (capa de aprendizaje, portada de BIP): el copiloto busca módulos por tema/KPI/tablero
// o trae uno por id, para recomendar CÓMO ejecutar una acción y citarlo con su link (/guia/<id>).
// Contenido estático (lib/guia): sin DB, disponible en todos los dashboards y para todo usuario.
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const guiaTools: ChatTool[] = [
  {
    name: "get_guia",
    description:
      "Método BIP (base de conocimiento): módulos de estrategia, táctica y paso a paso operativo (plan de medios, alcance/frecuencia, creatividades, Meta Ads, Google Search/PMax/Demand Gen/YouTube, TikTok, GA4, UTM, SEO/Share of Search, redes, UGC/influencers, trade marketing (CB y Floor Share), salud de marca, presupuesto, medición) conectados al ciclo Construir/Aprender/Optimizar/Acelerar. Buscá por tema, KPI o tablero para recomendar CÓMO ejecutar una acción y citá el módulo con su link [Título](/guia/<id>). Con `id` devuelve el contenido completo. También devuelve la guía del KPI (cómo leerlo, fórmula, referencia) si pasás `kpi`.",
    parameters: {
      type: "object",
      properties: {
        buscar: { type: "string", description: "Tema o palabras clave (ej. 'frecuencia meta', 'performance max', 'metas mensuales', 'floor share')" },
        kpi: { type: "string", description: "Clave o nombre del KPI (ej. 'cpm', 'vtr', 'floor_share', 'share_valor')" },
        dash: { type: "string", description: "Slug del tablero (ej. 'performance', 'redes', 'cuadros-basicos', 'mercado')" },
        id: { type: "string", description: "Id de módulo para traer el detalle" },
      },
    },
    run: async (args) => {
      if (typeof args.id === "string" && args.id) {
        const m = getModulo(args.id);
        if (!m) return { disponible: false, motivo: "Módulo inexistente" };
        return {
          id: m.id,
          titulo: m.titulo,
          link: `/guia/${m.id}`,
          nivel: m.nivel,
          etapa: m.etapa,
          resumen: m.resumen,
          secciones: m.secciones.map((s) => ({ titulo: s.titulo, cuerpo: s.cuerpo.slice(0, 1200) })),
          pasos: m.pasos,
          checklist: m.checklist,
          benchmarks: m.benchmarks,
          en_la_plataforma: m.enBip,
        };
      }
      const q = norm(String(args.buscar ?? "")).split(/\s+/).filter((w) => w.length > 2);
      const kpiRaw = typeof args.kpi === "string" ? norm(args.kpi).trim() : "";
      const dash = typeof args.dash === "string" ? args.dash.replace(/^\//, "") : "";
      const kpiKey = kpiRaw
        ? Object.keys(KPI_KNOW).find((k) => k === kpiRaw.replace(/\s+/g, "_") || norm(KPI_KNOW[k]!.name) === kpiRaw)
        : undefined;
      const scored = MODULOS.map((m) => {
        const t = norm(textoBusqueda(m));
        let sc = q.reduce((a, w) => a + (t.includes(w) ? 1 : 0), 0);
        if (kpiRaw && m.kpiKeys.some((k) => k === kpiKey || k.includes(kpiRaw))) sc += 2;
        if (dash && m.dashSlugs.includes(dash)) sc += 1;
        return { m, sc };
      })
        .filter((x) => x.sc > 0)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 5);
      const k = kpiKey ? KPI_KNOW[kpiKey] : undefined;
      return {
        modulos: scored.map(({ m }) => ({ id: m.id, titulo: m.titulo, link: `/guia/${m.id}`, nivel: m.nivel, etapa: m.etapa, resumen: m.resumen })),
        ...(k
          ? {
              kpi: {
                nombre: k.name,
                formula: k.formula,
                referencia: k.benchmark,
                como_leer: k.comoLeer.replace(/<[^>]+>/g, ""),
                mejor_practica: k.mejorPractica.replace(/<[^>]+>/g, ""),
              },
            }
          : {}),
      };
    },
  },
];
