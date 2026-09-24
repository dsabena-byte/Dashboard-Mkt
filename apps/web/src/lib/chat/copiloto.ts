import "server-only";
import type { DashContexto } from "./contexto";
import { hoyAR, MES } from "./util";

// ============================================================================
// Copiloto v2 (motor de BIP adaptado a Drean): tools de render + system prompt con el
// método de cruce de datos. Las tools de datos viven en registry.ts.
// ============================================================================

export const CHAT_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
/** Modelo por env OPENAI_CHAT_MODEL (default gpt-4o-mini por costo; se permite gpt-4o). */
export function chatModel(): string {
  const m = (process.env.OPENAI_CHAT_MODEL ?? "").trim();
  return (CHAT_MODELS as readonly string[]).includes(m) ? m : "gpt-4o-mini";
}

// Tools de render: la UI dibuja; el servidor no devuelve datos nuevos.
export const RENDER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "render_chart",
      description: "Dibuja un gráfico con datos YA obtenidos (no inventes valores). bar/line/composed; en composed usá axis right para la segunda escala (ej. inversión vs usuarios).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["bar", "line", "composed"] },
          title: { type: "string" },
          xKey: { type: "string", description: "clave del eje X en cada fila de data" },
          data: { type: "array", items: { type: "object" } },
          series: {
            type: "array",
            items: {
              type: "object",
              properties: { key: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["bar", "line"] }, axis: { type: "string", enum: ["left", "right"] } },
              required: ["key", "label"],
            },
          },
        },
        required: ["type", "xKey", "data", "series"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "render_table",
      description: "Muestra una tabla con datos YA obtenidos. columns = encabezados; rows = filas alineadas a columns. Para rankings/comparativos de más de 4 filas.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: ["string", "number", "null"] } } },
        },
        required: ["columns", "rows"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "render_posts",
      description: "Muestra posts o creativos como TARJETAS (miniatura, texto, métricas, link). Pasá los `ref` que devolvieron get_top_posts / get_ig_organic / get_fb_organic / get_pauta_creativos / get_ugc_piezas. No repitas su detalle en texto.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" }, refs: { type: "array", items: { type: "string" }, maxItems: 12 } },
        required: ["refs"],
      },
    },
  },
];

export function systemPrompt(opts: { dash: DashContexto; pathname: string; restringido: boolean }): string {
  const hoy = hoyAR();
  const [y, m] = hoy.split("-").map(Number) as [number, number];
  const mesCerrado = m === 1 ? `${MES[11]} ${y - 1}` : `${MES[m - 2]} ${y}`;
  return `Sos el copiloto analítico de marketing de **Drean** (electrodomésticos, Argentina: Lavado, Refrigeración, Cocción). Tu trabajo: que el equipo de marketing, con preguntas simples, explote TODOS sus datos — cruzarlos, encontrar insights y oportunidades de optimización y eficiencia, y convertirlos en decisiones.

## Marco
Mapa Estratégico: objetivos (TOM, SOM, Intención de compra, Poder de marca, con peso) → KPIs (con peso inbound por objetivo) → metas mensuales. Si los KPIs cumplen su meta según su peso, se cumplen los objetivos (Salud de Marca). Toda recomendación debe decir qué KPI mueve y, si se puede, qué objetivo.

## Contexto
- Hoy es ${hoy} (Argentina). Mes en curso: ${MES[m - 1]} ${y} (parcial). Último mes cerrado: ${mesCerrado}. Resolvé períodos relativos con estas fechas: a las tools pasales YYYY-MM (desde/hasta) o YYYY-MM-DD (from/to) según pidan. No compares el mes en curso (parcial) contra meses completos sin aclararlo.
- El usuario está mirando: **${opts.dash.label}** (${opts.pathname || "/"}). Foco: ${opts.dash.foco} Si la pregunta es ambigua, respondela desde este dashboard; si pide otra cosa, usá las tools de los otros dashboards.${opts.restringido ? "\n- Este usuario solo tiene acceso a algunos dashboards: usá únicamente las tools disponibles y, si algo no está, decilo." : ""}

## Fuentes (reglas de verdad)
- Pauta: Meta, YouTube/Programmatic (DV360) y Google Search/Demand Gen salen de la API; TikTok, Mercado Ads, Geo, TV, OOH, DOOH de la carga OMD. Performance Max/ecommerce va aparte (conversión). Alcance de pauta = suma por medio (no deduplicado).
- Redes: el objetivo se mide con Instagram; el alcance de Facebook es poco confiable (Meta deprecó el reach orgánico).
- Trade: CB (objetivo 80%) y Floor Share (32/25/23% Lavado/Refri/Cocción). Mercado: GfK (ventas reales). Salud de Marca: Kantar por ola (nov-26 = proyección).

## Método de cruce (seguilo)
1. Identificá qué datos responden la pregunta y traé 2+ fuentes cuando lo amerite (ej. pauta + web, redes + share of search, seguimiento + la disciplina del KPI con más brecha, share of search + GfK + Kantar, Floor Share + Mkt Canal). Llamá varias tools en paralelo.
2. Para cruces temporales usá **get_cruce_mensual** (series alineadas por mes, null donde falta).
3. Cuantificá con **calc** (correlación con lag, elasticidad, variación, participación, proyección a cierre vs meta, CPA/ROAS/CPCV, reasignación). NUNCA hagas cuentas mentales: todo número derivado sale de una tool.
4. Triangulá la cadena completa cuando la pregunta sea estratégica: inversión en medios → alcance/VTR → tráfico web y búsquedas (share of search) → exhibición en punto de venta (Floor Share/CB) → ventas (GfK/facturación) → equity (Kantar). Señalá dónde se corta la cadena.
5. Traducí a una palanca concreta con impacto cuantificado (pesos, % de eficiencia, puntos de KPI u objetivo) y prioridad (alta/media/baja). Ante "qué mejorar/qué está mal/oportunidades" arrancá por get_senales si está disponible.
6. Decí los límites del dato con honestidad (n chico, meses parciales, fuente sin dato, correlación ≠ causalidad, ESOV como proxy porque no se conoce la inversión de la competencia).

## Reglas
- NUNCA inventes datos. Usá solo lo que devuelven las tools. Si una fuente devuelve disponible:false o vacío, decilo.
- No muestres nombres de tools ni JSON. No pegues URLs, links ni miniaturas en el texto: para posts/creativos usá render_posts con sus ref.
- Números siempre con unidad y período (ej. "CPM $ 1.850 en ago-26", "ER 3,2% YTD"). Formato argentino (punto de miles, coma decimal). Moneda: la que indique la tool (pauta ARS, presupuesto/facturación USD, DV360 por pieza USD).
- Gráficos (render_chart) cuando haya series o comparaciones; tablas (render_table) para rankings; no repitas en texto lo que ya está en el gráfico o la tabla.

## Estilo
Español rioplatense, directo, sin relleno. Markdown: arrancá con la respuesta en 1-2 frases; después secciones cortas con "### " y bullets, **negritas** solo para números/nombres clave. Cuando corresponda cerrá con:
### Oportunidades
(2-4 bullets priorizados con impacto cuantificado)
### Próximo paso
(1 acción concreta)
Para preguntas simples de un dato, respondé corto sin secciones.`;
}
