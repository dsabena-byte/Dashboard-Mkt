// ============================================================================
// Set de evaluación del copiloto de Drean (set dorado v1, versionado en git; portado de BIP sep-2026 y
// reescrito con las tools de Drean). Puro: lo corre scripts/copiloto-eval.test.ts SIN llamar a OpenAI.
// Cada caso = pregunta real en español rioplatense + tablero desde donde se pregunta + tools que
// DEBERÍA consultar primero (alguna de `tools`) + argumentos de ejemplo que tienen que pasar el schema.
//
// Qué valida: que las tools existan, que sus definiciones (nombre + descripción + parámetros) tengan el
// vocabulario para que la pregunta se rutee a la tool correcta (buscador léxico BM25 sobre las
// definiciones, top-3) y que los argumentos de ejemplo sean válidos. Al cambiar una descripción/tool o
// sumar una tool nueva, sumá casos acá (el test exige que el set cubra TODAS las tools).
// ============================================================================

export interface EvalCase {
  id: string;
  q: string;
  dash: string;
  /** La primera consulta correcta es ALGUNA de estas tools. */
  tools: string[];
  /** Argumentos de ejemplo para tools[0] (deben pasar validateArgs sin errores). */
  args?: Record<string, unknown>;
}

export const EVAL_SET: EvalCase[] = [
  // ── Seguimiento / objetivos / Mapa ──
  { id: "seg-1", q: "¿Cómo vengo contra mis objetivos estratégicos este año?", dash: "/overview", tools: ["get_seguimiento"], args: { vista: "general" } },
  { id: "seg-2", q: "¿Cómo viene el cumplimiento de Lavado en el seguimiento de objetivos?", dash: "/overview", tools: ["get_seguimiento"], args: { vista: "Lavado", series: false } },
  { id: "seg-3", q: "¿Qué peso tiene cada KPI en el Mapa Estratégico?", dash: "/mapa-estrategico", tools: ["get_mapa_estrategico"] },
  { id: "seg-4", q: "¿Cuánto facturamos por mes este año?", dash: "/mercado", tools: ["get_facturacion_mensual"], args: { desde: "2026-01", hasta: "2026-08" } },
  { id: "seg-5", q: "¿Cómo viene la salud de marca de Drean en Kantar?", dash: "/salud-marca", tools: ["get_salud_de_marca"], args: { categoria: "Lavado" } },
  // ── Trade ──
  { id: "trade-1", q: "¿Cuál es el cumplimiento de cuadro básico por mes?", dash: "/overview", tools: ["get_cumplimiento_cb", "get_cb_cumplimiento"] },
  { id: "trade-2", q: "¿Cómo viene el floor share mensual por categoría contra el objetivo?", dash: "/overview", tools: ["get_cumplimiento_floor_share", "get_floor_share"] },
  { id: "trade-3", q: "¿Qué cadenas tienen peor cumplimiento de cuadro básico?", dash: "/cuadros-basicos", tools: ["get_cb_cumplimiento"], args: { nivel: "cliente", orden: "peores", top: 10 } },
  { id: "trade-4", q: "¿Cuál es el baseline de tiendas medidas en las últimas semanas?", dash: "/cuadros-basicos", tools: ["get_cb_baseline"] },
  { id: "trade-5", q: "¿Qué tiendas no medidas conviene sumar al programa de cuadro básico?", dash: "/cuadros-basicos", tools: ["get_cb_sugerencias"], args: { top: 10 } },
  { id: "trade-6", q: "¿Qué marcas tienen más exhibición en góndola?", dash: "/floor-share", tools: ["get_floor_share"], args: { nivel: "marcas" } },
  // ── Plan de Medios ──
  { id: "pauta-1", q: "¿Cuánto invertimos en pauta por medio este año y con qué CPM?", dash: "/performance", tools: ["get_pauta_performance"], args: { nivel: "medio", desde: "2026-01" } },
  { id: "pauta-2", q: "¿Cómo viene la inversión mensual de pauta y el alcance?", dash: "/performance", tools: ["get_pauta_performance", "get_cruce_mensual"], args: { nivel: "mensual" } },
  { id: "pauta-3", q: "¿Qué dice el planning de medios del plan de inversión por formato?", dash: "/performance", tools: ["get_inversion_medios"], args: { nivel: "formato" } },
  { id: "pauta-4", q: "¿Cuáles son las piezas creativas con mejor CTR?", dash: "/performance", tools: ["get_pauta_creativos"], args: { orden: "ctr", top: 10 } },
  // ── Performance → conversión ──
  { id: "conv-1", q: "¿Cuántas transacciones trajo la pauta de conversión por mes?", dash: "/performance-conversion", tools: ["get_conversion_diaria"], args: { nivel: "mensual" } },
  { id: "conv-2", q: "¿Qué productos se compraron atribuidos a la pauta de conversión?", dash: "/performance-conversion", tools: ["get_conversion_productos"], args: { top: 10 } },
  // ── Redes ──
  { id: "redes-1", q: "¿Cómo viene el alcance orgánico de Instagram este año?", dash: "/redes", tools: ["get_ig_organic"], args: { from: "2026-01-01", to: "2026-09-27" } },
  { id: "redes-2", q: "¿Qué pasó con el engagement de la página de Facebook?", dash: "/redes", tools: ["get_fb_organic", "get_engagement_semanal"] },
  { id: "redes-3", q: "¿Cómo evolucionó el engagement semana a semana en Instagram?", dash: "/redes", tools: ["get_engagement_semanal"], args: { from: "2026-07-01", to: "2026-09-27", plataforma: "instagram" } },
  { id: "redes-4", q: "¿Cuáles fueron los mejores y peores posts del último mes?", dash: "/redes", tools: ["get_top_posts"], args: { dias: 30, cantidad: 5 } },
  { id: "redes-5", q: "¿Cómo estamos contra la competencia en redes, qué marca tiene más engagement?", dash: "/redes", tools: ["get_redes_competencia"], args: { red: "INSTAGRAM" } },
  // ── Influencia / UGC ──
  { id: "ugc-1", q: "¿Cuánto invertimos en influencers y cuánto alcance trajeron?", dash: "/influencia", tools: ["get_influencia_performance"] },
  { id: "ugc-2", q: "¿Qué piezas UGC funcionaron mejor y qué dicen los comentarios?", dash: "/influencia", tools: ["get_ugc_piezas"], args: { top: 8 } },
  // ── Mkt Canal ──
  { id: "canal-1", q: "¿Qué acciones de marketing en retailers como Frávega o Mercado Libre rindieron más?", dash: "/mkt-canal", tools: ["get_mkt_canal"], args: { nivel: "cliente" } },
  // ── Web ──
  { id: "web-1", q: "¿Cuántas sesiones y conversiones tuvo la web en agosto?", dash: "/web", tools: ["get_web_kpis", "get_web_mensual"], args: { from: "2026-08-01", to: "2026-08-31" } },
  { id: "web-2", q: "¿Cómo vienen los usuarios de la web mes a mes?", dash: "/web", tools: ["get_web_mensual"], args: { desde: "2026-01" } },
  { id: "web-3", q: "¿Qué categoría de producto trae más sesiones a la web?", dash: "/web", tools: ["get_web_detalle"], args: { nivel: "categoria" } },
  { id: "web-4", q: "¿Qué landings tienen más rebote?", dash: "/web", tools: ["get_web_detalle"], args: { nivel: "landings", top: 10 } },
  // ── SEO / búsqueda / mercado ──
  { id: "seo-1", q: "¿Cuál es el share of search de Drean en lavarropas?", dash: "/seo-search", tools: ["get_share_of_search"], args: { categoria: "lavarropas" } },
  { id: "seo-2", q: "¿Cuándo es el pico de demanda de heladeras en el año (estacionalidad)?", dash: "/seo-search", tools: ["get_demanda_y_trends"], args: { categoria: "heladeras" } },
  { id: "seo-3", q: "¿En qué posición de Google aparecemos vs la competencia en SEO?", dash: "/seo-search", tools: ["get_seo_competitivo"], args: { nivel: "posiciones" } },
  { id: "seo-4", q: "¿Qué keywords de drean.com.ar tenemos en el top 10?", dash: "/seo-search", tools: ["get_seo_competitivo"], args: { nivel: "keywords_drean", top: 15 } },
  { id: "merc-1", q: "¿Cuál es nuestro share de mercado GfK en refrigeración?", dash: "/mercado", tools: ["get_mercado"], args: { categoria: "Refrigeración", segmento: "Total" } },
  // ── Inversión de marketing ──
  { id: "inv-1", q: "¿Cómo viene la ejecución del presupuesto de marketing vs el BGT por cuatrimestre?", dash: "/funnel", tools: ["get_inversion_mkt"], args: { nivel: "cuatrimestres", moneda: "usd" } },
  // ── Mis tableros ──
  { id: "tab-1", q: "¿Qué planillas tenemos cargadas en Mis tableros?", dash: "/tableros", tools: ["list_tableros_datasets"] },
  { id: "tab-2", q: "Consultá la planilla de ventas y sumá por canal", dash: "/tableros", tools: ["query_dataset", "list_tableros_datasets"], args: { dataset_id: "00000000-0000-0000-0000-000000000000", agrupar_por: "Canal", sumar: ["Ventas"] } },
  // ── Cruces / señales / método ──
  { id: "cruce-1", q: "¿La inversión en pauta se correlaciona con los usuarios de la web por mes?", dash: "/overview", tools: ["get_cruce_mensual", "calc"], args: { series: ["pauta_inversion", "web_usuarios"] } },
  { id: "cruce-2", q: "Cruzá la inversión con el share of search y la demanda genérica mes a mes", dash: "/seo-search", tools: ["get_cruce_mensual"], args: { series: ["pauta_inversion", "sos_drean_pct", "demanda_generica"] } },
  { id: "sen-1", q: "¿Qué alertas y oportunidades hay en el Plan de Medios?", dash: "/performance", tools: ["get_senales"], args: { dash: "performance" } },
  { id: "sen-2", q: "¿Qué debería mejorar primero, qué está mal?", dash: "/overview", tools: ["get_senales", "get_seguimiento"] },
  { id: "guia-1", q: "¿Cómo se lee la frecuencia y el alcance en el proceso estratégico?", dash: "/performance", tools: ["get_guia"], args: { buscar: "frecuencia" } },
  { id: "calc-1", q: "Calculá la variación porcentual entre julio y agosto", dash: "/overview", tools: ["calc"], args: { operacion: "variacion", actual: 120, anterior: 100 } },
  { id: "calc-2", q: "¿Llego a la meta anual al ritmo actual? proyección al cierre de diciembre", dash: "/web", tools: ["calc", "get_seguimiento"], args: { operacion: "proyeccion_cierre", serie: [10, 12, 11, 13], meta: 160 } },
];
