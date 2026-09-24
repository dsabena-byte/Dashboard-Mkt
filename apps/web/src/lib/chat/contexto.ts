// ============================================================================
// Contexto de dashboard del copiloto (CLIENT-SAFE: lo usan la UI y el motor).
// pathname → qué dashboard mira el usuario, en qué enfocarse, qué preguntas sugerir
// y qué set de tools va PRIMERO (el copiloto igual puede usar todos los sets
// permitidos para cruzar datos).
// ============================================================================

export interface DashContexto {
  key: string; // clave del set de tools (lib/chat/registry.ts) y de la ruta
  path: string; // ruta del dashboard (para dashboard_access)
  label: string;
  foco: string; // guía para el modelo
  sugerencias: string[];
}

const CTX: DashContexto[] = [
  {
    key: "overview", path: "/overview", label: "Seguimiento Objetivos",
    foco: "Cumplimiento de objetivos estratégicos (TOM, SOM, Intención, Poder) y de los KPIs vs metas (get_seguimiento); qué brecha pesa más, qué KPI mueve más la aguja y qué palanca la cierra. Trade (CB y Floor Share) también se mide acá.",
    sugerencias: [
      "¿Cómo vengo contra los objetivos y qué KPI mueve más la aguja?",
      "¿Qué KPI no llega a la meta anual al ritmo actual? Proyectá el cierre",
      "¿Qué categoría (Lavado, Refri, Cocción) está más lejos de sus objetivos y por qué?",
      "¿El cumplimiento de Floor Share y CB acompaña a la inversión en medios?",
    ],
  },
  {
    key: "mapa-estrategico", path: "/mapa-estrategico", label: "Mapa Estratégico",
    foco: "Estructura objetivos → KPIs (pesos inbound) → metas; coherencia de pesos, KPIs sin dato o sin meta, y qué KPI tiene más peso en cada objetivo.",
    sugerencias: [
      "¿Qué KPI tiene más peso en cada objetivo y cómo viene cada uno?",
      "¿Qué objetivo está menos cubierto por KPIs con dato?",
      "Si subo 10% el alcance de pauta, ¿qué objetivos se mueven?",
    ],
  },
  {
    key: "performance", path: "/performance", label: "Plan de Medios",
    foco: "Inversión y eficiencia por medio, categoría y rol (Meta/YouTube/Programmatic/Google por API; TikTok, Mercado Ads, Geo, TV, OOH, DOOH por OMD): CPM, CTR, CPC, VTR≥50%, frecuencia; plan vs real; qué medio o pieza escalar, qué cortar y cuánto reasignar.",
    sugerencias: [
      "¿Qué medio es más eficiente en CPM y VTR y cuánto gano si reasigno presupuesto?",
      "¿La inversión en pauta se traduce en más tráfico web? Medí la correlación",
      "¿Estoy invirtiendo en los meses de mayor demanda de la categoría?",
      "¿Qué creativos de Meta rinden mejor y qué tienen en común?",
      "¿Mi share of search acompaña lo que invierto por categoría?",
    ],
  },
  {
    key: "performance-conversion", path: "/performance-conversion", label: "Performance → Conversión",
    foco: "Pauta ecommerce (Google Ads inhouse/PMax) → web: CPA, ROAS, CPC, conversion rate por mes y campaña; productos vendidos.",
    sugerencias: [
      "¿Cuál es el ROAS y el CPA por mes y qué campaña conviene escalar?",
      "¿Qué productos venden más con la pauta y a qué ticket?",
      "¿El ROAS cae cuando sube la inversión? Medí la elasticidad",
    ],
  },
  {
    key: "redes", path: "/redes", label: "Redes Sociales",
    foco: "Orgánico IG (objetivo estratégico) y FB: alcance, interacciones, formatos y posts top; benchmark competitivo (share of engagement, frecuencia, sentimiento).",
    sugerencias: [
      "¿Qué formato de contenido rinde más en IG y cómo lo capitalizo en pauta?",
      "Mostrame los 5 posts con mejor engagement de los últimos 30 días",
      "¿Qué share of engagement tengo vs la competencia y con qué frecuencia posteamos?",
      "¿El alcance orgánico de IG se mueve con la pauta de Meta?",
    ],
  },
  {
    key: "influencia", path: "/influencia", label: "Mkt de Influencia",
    foco: "Influencers/UGC: inversión vs plan, CPM, CTR, VTR, guardados/compartidos y análisis cualitativo de comentarios (credibilidad, intención, percepción).",
    sugerencias: [
      "¿Qué piezas UGC generan más intención de compra y cuánto cuestan?",
      "¿El CPM de UGC es mejor o peor que el resto de Meta?",
      "Mostrame las piezas UGC con mejor resonancia",
    ],
  },
  {
    key: "mkt-canal", path: "/mkt-canal", label: "Mkt Canal Comercial",
    foco: "Acciones en retailers: impresiones, clics, CTR, conversiones, ROAS por cliente, acción y plataforma; cruzar con Floor Share/CB de esas cadenas.",
    sugerencias: [
      "¿Qué retailer y acción rindió mejor en CTR y ROAS?",
      "¿Las cadenas donde hacemos más acciones tienen mejor Floor Share?",
      "Graficá impresiones por cliente",
    ],
  },
  {
    key: "web", path: "/web", label: "Web / Ecommerce",
    foco: "Tráfico, conversión y canales (GA4) mes a mes; categorías y productos; relación con pauta, redes y SEO.",
    sugerencias: [
      "¿Qué canal de la web convierte mejor y cuánto invierto ahí?",
      "¿La pauta explica las variaciones de tráfico mes a mes?",
      "¿Qué productos se ven mucho pero convierten poco?",
      "¿Cómo viene este mes contra el anterior y por qué?",
    ],
  },
  {
    key: "seo-search", path: "/seo-search", label: "Optimización SEO",
    foco: "Share of search por categoría vs competencia, demanda genérica (estacionalidad), posiciones SEO, keyword gap, visibilidad en IA y regiones.",
    sugerencias: [
      "¿Dónde pierdo share of search frente a la competencia?",
      "¿Qué keywords de alto volumen debería atacar primero?",
      "¿El share of search de Drean acompaña la inversión en medios?",
      "¿En qué meses pica la demanda de cada categoría?",
    ],
  },
  {
    key: "cuadros-basicos", path: "/cuadros-basicos", label: "Cuadros Básicos",
    foco: "Cumplimiento de CB (objetivo 80%) por semana, división, cadena y tienda; tiendas a sumar al programa.",
    sugerencias: [
      "¿Cuál es el % de cumplimiento CB y qué cadenas lo tiran abajo?",
      "¿Qué tiendas convendría sumar al programa?",
      "¿El CB acompaña al Floor Share mes a mes?",
    ],
  },
  {
    key: "floor-share", path: "/floor-share", label: "Floor Share",
    foco: "Exhibición de Drean en góndola por categoría (objetivos 32/25/23%), marca, cadena y tienda.",
    sugerencias: [
      "¿Cumplimos el objetivo de Floor Share por categoría?",
      "¿En qué cadenas perdemos exhibición contra la competencia?",
      "¿El Floor Share se relaciona con el share de mercado GfK?",
    ],
  },
  {
    key: "salud-marca", path: "/salud-marca", label: "Salud de Marca",
    foco: "Kantar: TOM, SOM, Intención y Poder de marca por categoría y ola; proyección nov-26 del modelo share→equity; comparativo con la competencia.",
    sugerencias: [
      "¿Cómo viene la Salud de Marca por categoría y qué la mueve?",
      "¿Dónde estamos peor vs la competencia en intención de compra?",
      "¿El share of search anticipa la evolución de Top of Mind?",
    ],
  },
  {
    key: "mercado", path: "/mercado", label: "Resultados Comerciales",
    foco: "GfK: value share, unit share e índice de precio por categoría y segmento, Drean vs competencia; facturación.",
    sugerencias: [
      "¿Cómo viene el value share de Drean por categoría vs el año pasado?",
      "¿El share de mercado acompaña al share of search y a la inversión?",
      "¿En qué segmento de precio estamos perdiendo participación?",
    ],
  },
  {
    key: "funnel", path: "/funnel", label: "Inversión de Marketing",
    foco: "Presupuesto corporativo: Real vs BGT por cuatrimestre, desvío (<5%), Inversión/Facturación (≤1,3%), por clasificación y cuenta.",
    sugerencias: [
      "¿Cómo viene la ejecución del presupuesto vs BGT por cuatrimestre?",
      "¿Qué cuentas explican el desvío?",
      "¿La inversión en medios acompaña a la facturación mes a mes?",
    ],
  },
];

export const GENERAL: DashContexto = {
  key: "overview", path: "/overview", label: "Dashboard",
  foco: "Visión general: arrancá por el seguimiento de objetivos y conectá con la disciplina que más pesa.",
  sugerencias: CTX[0]!.sugerencias,
};

/** Contexto por ruta. null = ruta sin copiloto (login, contenido, monitoreo…). */
export function contextoDe(pathname: string | null | undefined): DashContexto | null {
  const p = pathname ?? "";
  if (p === "/" || p === "") return GENERAL;
  for (const c of CTX) if (p === c.path || p.startsWith(`${c.path}/`)) return c;
  return null;
}
export const DASH_KEYS = CTX.map((c) => c.key);
export const dashPath = (key: string) => CTX.find((c) => c.key === key)?.path ?? `/${key}`;

// Nombres humanos de las tools (para "Consultando…").
export const TOOL_LABELS: Record<string, string> = {
  get_seguimiento: "Seguimiento de objetivos",
  get_mapa_estrategico: "Mapa Estratégico",
  get_cumplimiento_cb: "Cuadro Básico mensual",
  get_cumplimiento_floor_share: "Floor Share mensual",
  get_facturacion_mensual: "Facturación",
  get_salud_de_marca: "Salud de Marca (Kantar)",
  get_cb_cumplimiento: "Cuadros Básicos",
  get_cb_baseline: "Baseline CB",
  get_cb_sugerencias: "Tiendas sugeridas CB",
  get_floor_share: "Floor Share",
  get_web_kpis: "Web / GA4",
  get_web_mensual: "Web mensual",
  get_web_detalle: "Web: detalle",
  get_share_of_search: "Share of Search",
  get_demanda_y_trends: "Demanda y Trends",
  get_seo_competitivo: "SEO competitivo",
  get_pauta_performance: "Plan de Medios",
  get_inversion_medios: "Planning de medios",
  get_pauta_creativos: "Creativos de pauta",
  get_conversion_diaria: "Pauta → conversión",
  get_conversion_productos: "Productos vendidos",
  get_influencia_performance: "Influencia / UGC",
  get_ugc_piezas: "Piezas UGC",
  get_mercado: "Mercado GfK",
  get_mkt_canal: "Mkt Canal",
  get_inversion_mkt: "Presupuesto de Mkt",
  get_fb_organic: "Facebook orgánico",
  get_ig_organic: "Instagram orgánico",
  get_engagement_semanal: "Engagement semanal",
  get_top_posts: "Posts top",
  get_redes_competencia: "Redes: competencia",
  get_cruce_mensual: "Cruce mensual",
  get_senales: "Alertas y oportunidades",
  calc: "Cálculo",
  render_chart: "Armando gráfico",
  render_table: "Armando tabla",
  render_posts: "Armando tarjetas",
};
export const toolLabel = (name: string) => TOOL_LABELS[name] ?? name;
