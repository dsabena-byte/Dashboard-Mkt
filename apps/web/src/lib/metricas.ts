// ============================================================================
// CATÁLOGO DE MÉTRICAS ÚNICO (capa semántica liviana; portado de BIP sep-2026 y adaptado a Drean).
// Client-safe (sin server-only). UNA definición por métrica que consumen:
//   · lib/knowledge.ts   → `kpiKnowFor` usa los alias de acá como respaldo (nombre + sinónimos → KPI_KNOW).
//   · lib/recomendacion  → qué KPI mueve cada recomendación y cómo se mide el antes/después.
// Nombres = los EXACTOS del Seguimiento/Mapa de Drean (lib/objetivos-kpis.ts): "Tráfico web
// (usuarios)", "Avg Sesión (segundos)", "% Cumplimiento CB", "Floor Share (exhibición)"…; los nombres
// genéricos quedan como sinónimos. `plan` = plan del Seguimiento (Pauta Mkt / Web / Ecommerce /
// Instagram / Cuadros Básicos / Floor Share / Mercado y competencia).
// Test de integridad: scripts/metricas.test.ts
//
// Campos:
//  · id: clave estable (snake_case). `know` = clave de KPI_KNOW (guía de lectura) si existe.
//  · tipo: "sum" = volumen (YTD suma) | "rate" = tasa (YTD promedio).
//  · rol: "marca" (construye demanda futura) | "activacion" (captura demanda hoy) | "ambos".
//  · horizonte: "adelantado" (anticipa el resultado) | "rezagado" (es el resultado).
// ============================================================================

export type MetricaUnidad = "" | "%" | "$" | "x" | "s" | "pts" | "pp";
export type MetricaDireccion = "up" | "down";
export type MetricaTipo = "sum" | "rate";
export type MetricaRol = "marca" | "activacion" | "ambos";
export type MetricaHorizonte = "adelantado" | "rezagado";
export type MetricaGranularidad = "diaria" | "mensual" | "foto" | "ola";

export interface Metrica {
  id: string;
  nombre: string;
  /** Otras formas de nombrarla (títulos de cards, copiloto). Se comparan normalizadas y EXACTAS. */
  sinonimos: string[];
  formula: string;
  unidad: MetricaUnidad;
  direccion: MetricaDireccion;
  tipo: MetricaTipo;
  fuente: string;
  granularidad: MetricaGranularidad;
  rol: MetricaRol;
  horizonte: MetricaHorizonte;
  descripcion: string;
  /** Clave de KPI_KNOW (lib/knowledge.ts). */
  know?: string;
  /** Plan del Mapa/Seguimiento (nombre = KPI del Seguimiento). */
  plan?: string;
  /** Clave en la tabla de metas si difiere del nombre. */
  metaKey?: string;
  /** Etiqueta corta de la card de metas (si difiere del nombre). */
  etiqueta?: string;
  /** "Medida" que muestra el configurador de metas. */
  medida?: string;
  /** Términos para reconocer la métrica dentro de un texto libre (no son alias de título). */
  claves?: string[];
}

const PM = "Pauta Mkt";
const RS = "Instagram";
const WE = "Web / Ecommerce";
const MC = "Mercado y competencia";

export const METRICAS: Metrica[] = [
  // ── Demanda, búsqueda y mercado ──────────────────────────────────────────
  { id: "sos", nombre: "Share of Search", sinonimos: ["sos", "share of search"], know: "sos", plan: MC,
    formula: "Búsquedas de tu marca ÷ Σ búsquedas de las marcas del set", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Volumen de búsqueda (Google, DataForSEO)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    medida: "búsquedas de tu marca ÷ las del set competitivo",
    descripcion: "Participación de tu marca en las búsquedas de la categoría; anticipa el share de mercado." },
  { id: "indice_posicion", nombre: "Índice de posición SEO", know: "indice", plan: MC,
    sinonimos: ["indice de posicion", "indice de posicion seo", "keywords faltantes", "keywords debiles", "keywords fuertes"],
    formula: "Σ (posición × volumen) ÷ Σ volumen (100 = no rankea)", unidad: "pts", direccion: "down", tipo: "rate",
    fuente: "SERP de Google (DataForSEO)", granularidad: "foto", rol: "ambos", horizonte: "adelantado",
    medida: "posición promedio en Google ponderada por volumen (menor es mejor)",
    descripcion: "Posición promedio en Google ponderada por volumen de búsqueda. Menor es mejor." },
  { id: "visibilidad_ia", nombre: "Visibilidad en IA", sinonimos: ["visibilidad ia", "share de ia", "menciones en ia", "llmo"], plan: MC,
    formula: "Menciones de tu marca en respuestas de IA ÷ total de menciones del set", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Respuestas de asistentes de IA (DataForSEO LLM)", granularidad: "foto", rol: "marca", horizonte: "adelantado",
    medida: "menciones de tu marca en respuestas de IA ÷ total de menciones",
    descripcion: "Qué parte de las menciones de marcas en respuestas de ChatGPT/Gemini/etc. se lleva tu marca." },
  { id: "busquedas", nombre: "Búsquedas de marca / mes", know: "busquedas",
    sinonimos: ["busquedas de marca", "busquedas de marca mes", "busquedas propias mes", "busquedas mes"],
    formula: "Volumen mensual de búsquedas de tu marca", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Volumen de búsqueda (Google, DataForSEO)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Tamaño de la demanda de tu marca (eco de la inversión en awareness)." },
  { id: "demanda", nombre: "Demanda genérica", know: "demanda", sinonimos: ["demanda generica", "demanda total", "demanda total marcas"],
    claves: ["busquedas de la categoria", "busquedas extra"],
    formula: "Búsquedas del término de categoría sin marca", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Volumen de búsqueda / Google Trends", granularidad: "mensual", rol: "ambos", horizonte: "adelantado",
    descripcion: "Tamaño total de la intención de compra de la categoría (contexto de mercado)." },
  { id: "share_mercado", nombre: "Share de mercado", know: "share_mercado", sinonimos: ["share", "market share"],
    formula: "Tus ventas ÷ ventas de la categoría", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "GfK (carga mensual en mercado_share)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Tu participación en las ventas de la categoría (valor o unidades)." },


  { id: "share_valor", nombre: "Share en valor", know: "share_valor", sinonimos: ["value share", "share valor", "share de mercado valor", "participacion en valor"],
    formula: "Ventas en $ de Drean ÷ ventas en $ de la categoría (GfK)", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "GfK (mercado_share)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Participación de Drean en la facturación de la categoría (valor)." },
  { id: "share_unidades", nombre: "Share en unidades", know: "share_unidades", sinonimos: ["unit share", "share unidades", "share de mercado unidades", "participacion en unidades"],
    formula: "Unidades vendidas de Drean ÷ unidades de la categoría (GfK)", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "GfK (mercado_share)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Participación de Drean en las unidades vendidas de la categoría." },
  { id: "indice_precio", nombre: "Índice de precio", know: "indice_precio", sinonimos: ["indice precio", "price index", "precio relativo"],
    formula: "Precio medio de Drean ÷ precio medio de la categoría × 100 (GfK)", unidad: "", direccion: "up", tipo: "rate",
    fuente: "GfK (mercado_share)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "100 = precio promedio de la categoría; arriba de 100 Drean vende más caro que el promedio." },

  // ── Medios pagos ─────────────────────────────────────────────────────────
  { id: "inversion", nombre: "Inversión", know: "inversion", plan: PM, sinonimos: ["inversion pauta", "inversion en medios", "gasto"],
    formula: "Σ gasto del período (online + offline)", unidad: "$", direccion: "up", tipo: "sum",
    fuente: "Meta Ads + DV360 + Google Ads (API) + OMD (medios sin API y offline)", granularidad: "diaria", rol: "ambos", horizonte: "adelantado",
    medida: "gasto del mes (online + offline)",
    descripcion: "Monto invertido en pauta; se lee siempre contra el resultado que compra." },
  { id: "alcance_unico", nombre: "Alcance único", know: "alcance", plan: PM, sinonimos: ["alcance", "reach"],
    formula: "Personas únicas alcanzadas (dato de la plataforma; no se suma entre medios sin deduplicar)", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Meta Ads + DV360 + OMD (suma por medio, no deduplicada)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    medida: "personas alcanzadas", claves: ["alcance perdido", "alcance adicional"],
    descripcion: "Personas distintas expuestas a la pauta: mide cobertura, no repetición." },
  { id: "frecuencia", nombre: "Frecuencia", know: "frecuencia", plan: PM, sinonimos: [],
    formula: "Impresiones ÷ Alcance", unidad: "x", direccion: "up", tipo: "rate",
    fuente: "Meta Ads", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    medida: "impresiones ÷ alcance",
    descripcion: "Veces promedio que cada persona vio la pauta (2-4/mes sano en awareness)." },
  { id: "impresiones", nombre: "Impresiones", know: "impresiones", plan: PM, sinonimos: [],
    formula: "Veces que se mostró la pieza (con repetición)", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Meta Ads + DV360 + Google Ads (API) + OMD (medios sin API)", granularidad: "diaria", rol: "marca", horizonte: "adelantado",
    medida: "impresiones digitales del mes",
    descripcion: "Volumen de exposición comprado; para cobertura mirá el alcance." },
  { id: "grps", nombre: "GRPs", know: "grps", sinonimos: ["grp", "trps", "trp", "puntos de rating"],
    formula: "Σ ratings de cada salida (o alcance % × frecuencia)", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Planilla de medios offline", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Presión publicitaria de TV/radio: alcance % × frecuencia." },
  { id: "cpp", nombre: "Costo por GRP", know: "cpp", sinonimos: ["costo grp", "cpp", "cpr", "costo por punto de rating"],
    formula: "Inversión ÷ GRPs", unidad: "$", direccion: "down", tipo: "rate",
    fuente: "Planilla de medios offline", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Eficiencia de compra de medios tradicionales." },
  { id: "contactos", nombre: "Contactos offline", know: "contactos", sinonimos: ["contactos", "impactos", "cpm contactos", "cpm de contactos"],
    formula: "Contactos informados; CPM de contactos = Inversión ÷ Contactos × 1.000", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Planilla de medios offline", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Contactos de medios offline (no se suman al alcance digital)." },
  { id: "cpm", nombre: "CPM", know: "cpm", sinonimos: ["costo por mil"],
    formula: "Inversión ÷ Impresiones × 1.000", unidad: "$", direccion: "down", tipo: "rate",
    fuente: "Meta Ads + Google Ads", granularidad: "diaria", rol: "marca", horizonte: "adelantado",
    descripcion: "Costo de mil impresiones: eficiencia de compra de atención." },
  { id: "vtr", nombre: "VTR (≥50%)", etiqueta: "VTR ≥50%", know: "vtr", plan: PM, sinonimos: ["vtr", "vtr 50%", "vieron >=50%"],
    formula: "Reproducciones al 50% ÷ Impresiones de video", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Meta Ads + Google Ads (video)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    medida: "video al 50% ÷ impresiones de video",
    descripcion: "Qué parte de las impresiones de video llegó a la mitad: calidad de atención del creativo." },
  { id: "vtr_completo", nombre: "VTR al 100% (completación)", know: "vtr_completo",
    sinonimos: ["vtr 100%", "vtr real 100%", "vtr al 100%", "completacion", "vistas completas"],
    formula: "Reproducciones al 100% ÷ Impresiones (o inicios) de video", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Meta Ads + Google Ads (video)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Vistas completas sobre impresiones de video." },
  { id: "thruplay", nombre: "ThruPlay (Meta)", know: "thruplay", sinonimos: ["thruplay", "thruplays", "tasa de thruplay", "costo por thruplay"],
    formula: "ThruPlays ÷ Impresiones", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Meta Ads", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Reproducciones de 15 s (o completas si dura menos) sobre impresiones." },
  { id: "cpcv", nombre: "CPCV (costo por vista completa)", know: "cpcv", sinonimos: ["cpcv", "costo por vista completa"],
    formula: "Inversión ÷ Vistas completas", unidad: "$", direccion: "down", tipo: "rate",
    fuente: "Meta Ads + Google Ads (video)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Costo de cada vista completa: métrica madre de eficiencia del video." },
  { id: "clicks", nombre: "Clicks", know: "clicks", plan: PM, sinonimos: ["clics", "click", "clic"],
    formula: "Clics en la pauta del período", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Meta Ads + Google Ads", granularidad: "diaria", rol: "activacion", horizonte: "adelantado",
    medida: "clics del mes",
    descripcion: "Clics que generó la pauta: intención de ir más allá del anuncio." },
  { id: "ctr", nombre: "CTR", know: "ctr", sinonimos: [],
    formula: "Clicks ÷ Impresiones", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Meta Ads + Google Ads", granularidad: "diaria", rol: "activacion", horizonte: "adelantado",
    descripcion: "Qué parte de las impresiones terminó en clic: relevancia del mensaje y la oferta." },
  { id: "cpc", nombre: "CPC", know: "cpc", sinonimos: ["costo por click", "costo por clic"],
    formula: "Inversión ÷ Clicks", unidad: "$", direccion: "down", tipo: "rate",
    fuente: "Meta Ads + Google Ads", granularidad: "diaria", rol: "activacion", horizonte: "adelantado",
    descripcion: "Costo de cada clic (comparar solo dentro del mismo objetivo)." },
  { id: "cpa", nombre: "CPA", know: "cpa", sinonimos: ["costo por adquisicion", "costo por conversion", "costo por lead"],
    formula: "Inversión ÷ Conversiones", unidad: "$", direccion: "down", tipo: "rate",
    fuente: "Meta Ads + Google Ads + GA4", granularidad: "diaria", rol: "activacion", horizonte: "rezagado",
    descripcion: "Costo por conversión (compra, lead)." },
  { id: "conversiones", nombre: "Conversiones", sinonimos: ["leads", "conversiones de la plataforma"],
    formula: "Conversiones que informa la plataforma (Google Ads) o compras / eventos clave (GA4)", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Google Ads + GA4", granularidad: "diaria", rol: "activacion", horizonte: "rezagado",
    descripcion: "Cantidad de conversiones (compras, leads). Base del CPA; vacío = la plataforma no lo informa (no es 0)." },
  { id: "roas", nombre: "ROAS", know: "roas", sinonimos: [],
    formula: "Ingresos atribuidos ÷ Inversión", unidad: "x", direccion: "up", tipo: "rate",
    fuente: "Meta Ads + Google Ads + GA4 ecommerce", granularidad: "diaria", rol: "activacion", horizonte: "rezagado",
    descripcion: "Ingresos atribuidos por cada peso invertido." },

  // ── Redes ────────────────────────────────────────────────────────────────
  { id: "alcance_organico", nombre: "Alcance orgánico", know: "alcance", plan: RS, sinonimos: [],
    formula: "Σ alcance de los posts orgánicos del mes (Instagram)", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Instagram (Meta Graph API)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    medida: "personas alcanzadas / mes",
    descripcion: "Personas alcanzadas por el contenido orgánico." },
  { id: "engagement", nombre: "Engagement rate", know: "engagement", plan: RS,
    sinonimos: ["engagement", "tasa de engagement", "interacciones"], claves: ["interacciones perdidas", "interacciones adicionales"],
    formula: "Interacciones ÷ Alcance", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Instagram (Meta Graph API)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    medida: "interacciones ÷ alcance",
    descripcion: "Qué parte de las personas alcanzadas interactuó (likes, comentarios, guardados, compartidos)." },
  { id: "guardados", nombre: "Guardados", know: "guardados", sinonimos: [],
    formula: "Guardados ÷ Alcance", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Instagram (Meta Graph API)", granularidad: "diaria", rol: "marca", horizonte: "adelantado",
    descripcion: "Señal de contenido útil: la gente lo quiere volver a ver." },
  { id: "compartidos", nombre: "Compartidos", know: "compartidos", sinonimos: ["envios"],
    formula: "Compartidos ÷ Alcance", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Instagram / Facebook (Meta Graph API)", granularidad: "diaria", rol: "marca", horizonte: "adelantado",
    descripcion: "Contenido que la audiencia distribuye por vos (alcance ganado)." },
  { id: "comentarios", nombre: "Comentarios", know: "comentarios", sinonimos: [],
    formula: "Comentarios recibidos", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Instagram / Facebook (Meta Graph API)", granularidad: "diaria", rol: "marca", horizonte: "adelantado",
    descripcion: "Conversación que genera el contenido." },
  { id: "sentimiento", nombre: "Sentimiento", know: "sentimiento", sinonimos: ["sentimiento de comentarios"],
    formula: "Comentarios negativos ÷ comentarios clasificados", unidad: "%", direccion: "down", tipo: "rate",
    fuente: "Comentarios de IG/FB clasificados por IA", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Proporción de comentarios negativos (menor es mejor)." },
  { id: "seguidores", nombre: "Seguidores", know: "seguidores", sinonimos: [],
    formula: "Seguidores de la cuenta al cierre del período", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Instagram / Facebook (Meta Graph API)", granularidad: "foto", rol: "marca", horizonte: "rezagado",
    descripcion: "Tamaño de la comunidad propia." },
  { id: "share_of_engagement", nombre: "Share of engagement", know: "sov", plan: MC, sinonimos: [],
    formula: "Interacciones de tus posts ÷ interacciones del set competitivo (ventana común)", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Redes propias + competencia (scraping de posts públicos)", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    medida: "interacciones de tus posts ÷ las del set competitivo", claves: ["brecha share of engagement"],
    descripcion: "Qué parte de la conversación en redes del set competitivo se lleva tu marca." },
  { id: "sov", nombre: "Share of Voice", know: "sov", sinonimos: ["sov"],
    formula: "Tu presencia ÷ presencia total del set competitivo", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Redes / pauta de la competencia", granularidad: "mensual", rol: "marca", horizonte: "adelantado",
    descripcion: "Tu presencia (posts, avisos, menciones) sobre la del set competitivo." },

  // ── Web / Ecommerce ──────────────────────────────────────────────────────
  { id: "trafico", nombre: "Tráfico web (usuarios)", know: "trafico", plan: WE, sinonimos: ["trafico", "trafico web", "usuarios"],
    claves: ["visitas mensuales", "visitas/mes"],
    formula: "Usuarios activos del mes (GA4)", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Google Analytics 4", granularidad: "diaria", rol: "ambos", horizonte: "adelantado",
    medida: "usuarios del mes",
    descripcion: "Personas que visitaron el sitio en el período." },
  { id: "sesiones", nombre: "Sesiones", know: "sesiones", sinonimos: ["sesiones con interaccion"],
    formula: "Visitas al sitio (GA4)", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Google Analytics 4", granularidad: "diaria", rol: "ambos", horizonte: "adelantado",
    descripcion: "Visitas al sitio (una persona puede tener varias)." },
  { id: "usuarios_nuevos", nombre: "Usuarios nuevos", know: "usuarios_nuevos", sinonimos: ["nuevos usuarios"],
    formula: "Usuarios que visitan el sitio por primera vez", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Google Analytics 4", granularidad: "diaria", rol: "marca", horizonte: "adelantado",
    descripcion: "Audiencia nueva que llega al sitio." },
  { id: "rebote", nombre: "Tasa de rebote", know: "rebote", sinonimos: ["rebote", "bounce rate", "tasa de interaccion"],
    formula: "1 − (sesiones con interacción ÷ sesiones)", unidad: "%", direccion: "down", tipo: "rate",
    fuente: "Google Analytics 4", granularidad: "diaria", rol: "activacion", horizonte: "adelantado",
    descripcion: "Sesiones sin interacción (menor es mejor)." },
  { id: "paginas_sesion", nombre: "Páginas por sesión", know: "paginas_sesion", sinonimos: ["paginas sesion", "vistas por sesion"],
    formula: "Vistas de página ÷ Sesiones", unidad: "", direccion: "up", tipo: "rate",
    fuente: "Google Analytics 4", granularidad: "diaria", rol: "activacion", horizonte: "adelantado",
    descripcion: "Profundidad de navegación." },
  { id: "duracion_sesion", nombre: "Avg Sesión (segundos)", know: "frecuencia_sesion", plan: WE,
    sinonimos: ["duracion media de sesion", "duracion de sesion", "duracion sesion", "duracion", "tiempo en sitio", "avg session"],
    formula: "Tiempo de interacción ÷ Sesiones", unidad: "s", direccion: "up", tipo: "rate",
    fuente: "Google Analytics 4", granularidad: "diaria", rol: "activacion", horizonte: "adelantado",
    medida: "segundos por sesión",
    descripcion: "Tiempo promedio de interacción por visita." },
  { id: "conversion", nombre: "Tasa de conversión", know: "conversion", plan: WE,
    sinonimos: ["conversion", "tasa de conversion eventos clave", "cr"], claves: ["eventos clave"],
    formula: "Conversiones (eventos clave de GA4) ÷ Sesiones", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Google Analytics 4", granularidad: "diaria", rol: "activacion", horizonte: "rezagado",
    medida: "transacciones ÷ sesiones",
    descripcion: "Qué parte de las visitas termina en compra o evento clave." },
  { id: "transacciones", nombre: "Transacciones", know: "transacciones", sinonimos: ["compras"],
    formula: "Compras registradas en el sitio", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Google Analytics 4 (ecommerce)", granularidad: "diaria", rol: "activacion", horizonte: "rezagado",
    medida: "compras del mes (GA4)",
    descripcion: "Compras concretadas en el ecommerce." },
  { id: "ingresos", nombre: "Ingresos", know: "ingresos", sinonimos: ["ingresos ecommerce", "revenue", "total ingresos"],
    formula: "Σ valor de las compras (GA4)", unidad: "$", direccion: "up", tipo: "sum",
    fuente: "Google Analytics 4 (ecommerce)", granularidad: "diaria", rol: "activacion", horizonte: "rezagado",
    medida: "ingresos ecommerce (GA4)",
    descripcion: "Facturación del ecommerce." },
  { id: "aov", nombre: "Valor medio de compra", know: "aov", sinonimos: ["ticket promedio", "aov"],
    formula: "Ingresos ÷ Transacciones", unidad: "$", direccion: "up", tipo: "rate",
    fuente: "Google Analytics 4 (ecommerce)", granularidad: "diaria", rol: "activacion", horizonte: "rezagado",
    medida: "ingresos ÷ transacciones",
    descripcion: "Ticket promedio de cada compra." },
  { id: "clicks_organicos", nombre: "Clicks orgánicos", sinonimos: ["clicks de search console", "clics organicos"],
    formula: "Clics desde la búsqueda orgánica de Google", unidad: "", direccion: "up", tipo: "sum",
    fuente: "Google Search Console", granularidad: "mensual", rol: "ambos", horizonte: "adelantado",
    descripcion: "Visitas que te trae Google sin pagar." },

  // ── Trade ────────────────────────────────────────────────────────────────
  { id: "floor_share", nombre: "Floor Share (exhibición)", know: "floor_share", plan: "Floor Share", sinonimos: ["floor share", "share de exhibicion", "share de gondola"],
    formula: "Espacio de tu marca ÷ espacio total de la categoría", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Relevamiento de góndola (Drive → Supabase CB, precalculado en trade_monthly)", granularidad: "mensual", rol: "activacion", horizonte: "adelantado",
    descripcion: "Participación de Drean en la exhibición del punto de venta (Σ categoría × peso)." },
  { id: "cb", nombre: "% Cumplimiento CB", know: "cb", plan: "Cuadros Básicos", sinonimos: ["cuadro basico", "cuadros basicos", "cumplimiento cb", "surtido"],
    formula: "SKUs del cuadro básico presentes ÷ SKUs exigidos", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Cuadro Básico semanal (Drive → Supabase CB, precalculado en trade_monthly)", granularidad: "mensual", rol: "activacion", horizonte: "adelantado",
    descripcion: "Cumplimiento del surtido mínimo en tiendas." },

  // ── Marca (research) ─────────────────────────────────────────────────────
  { id: "tom", nombre: "TOM (Top of Mind)", know: "tom", sinonimos: ["tom", "top of mind"],
    formula: "% que menciona tu marca primero, sin ayuda", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Estudio de marca (research)", granularidad: "ola", rol: "marca", horizonte: "rezagado",
    descripcion: "Primera marca que viene a la mente en la categoría." },
  { id: "som", nombre: "SOM (Share of Mind)", know: "som", sinonimos: ["som", "share of mind"],
    formula: "% de menciones espontáneas de tu marca", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Estudio de marca (research)", granularidad: "ola", rol: "marca", horizonte: "rezagado",
    descripcion: "Presencia de tu marca en la mente (menciones totales)." },
  { id: "intencion", nombre: "Intención de compra", know: "intencion", sinonimos: ["intencion"],
    formula: "% que compraría tu marca", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Estudio de marca (research)", granularidad: "ola", rol: "marca", horizonte: "rezagado",
    descripcion: "Predisposición declarada a comprar tu marca." },
  { id: "poder_marca", nombre: "Poder de marca", know: "poder_marca", sinonimos: ["poder"],
    formula: "Índice de preferencia/fortaleza del estudio de marca", unidad: "pts", direccion: "up", tipo: "rate",
    fuente: "Estudio de marca (research)", granularidad: "ola", rol: "marca", horizonte: "rezagado",
    descripcion: "Fortaleza relativa de la marca frente a la competencia." },
  { id: "salud_marca", nombre: "Salud de Marca (cumplimiento)", sinonimos: ["salud de marca", "puntos de salud de marca", "cumplimiento de objetivos"],
    formula: "Σ peso estratégico × cumplimiento de cada objetivo", unidad: "pts", direccion: "up", tipo: "rate",
    fuente: "Seguimiento Objetivos (Mapa Estratégico + metas)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Índice de ejecución de la estrategia: si los KPIs cumplen su meta, llega a 100." },

  // ── Negocio / presupuesto ───────────────────────────────────────────────
  { id: "facturacion", nombre: "Facturación", sinonimos: ["ventas", "facturacion"],
    formula: "Σ ventas del período", unidad: "$", direccion: "up", tipo: "sum",
    fuente: "Resultados Comerciales (planilla)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Ventas del negocio en el período." },
  { id: "inv_facturacion", nombre: "Inversión / Facturación", know: "inv_facturacion", sinonimos: ["inversion facturacion", "inversion sobre facturacion"],
    formula: "Inversión de marketing ÷ Facturación", unidad: "%", direccion: "down", tipo: "rate",
    fuente: "Inversión de Marketing + Resultados Comerciales (planillas)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Qué parte de las ventas se reinvierte en marketing." },
  { id: "ejecucion_presupuesto", nombre: "Ejecución del presupuesto", know: "ejecucion_presupuesto",
    sinonimos: ["ejecucion del presupuesto", "real vs presupuesto", "desvio de presupuesto"],
    formula: "(Real − Presupuesto) ÷ Presupuesto", unidad: "%", direccion: "down", tipo: "rate",
    fuente: "Inversión de Marketing (planilla)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Desvío entre lo invertido y lo presupuestado (más cerca de 0 es mejor)." },
  { id: "prob_meta", nombre: "Probabilidad de llegar a la meta", sinonimos: ["probabilidad de meta", "probabilidad de cumplir la meta"],
    formula: "Escenarios simulados (2.000, con los errores de tu historia) que alcanzan la meta ÷ escenarios", unidad: "%", direccion: "up", tipo: "rate",
    fuente: "Seguimiento Objetivos (pronóstico sobre la historia de cada KPI)", granularidad: "mensual", rol: "ambos", horizonte: "adelantado",
    descripcion: "Chance de cerrar el año en meta al ritmo actual, con su rango." },
  { id: "pesos_constantes", nombre: "Pesos constantes", sinonimos: ["moneda constante", "monto en pesos constantes"],
    formula: "Monto × IPC(mes base) ÷ IPC(mes)", unidad: "$", direccion: "up", tipo: "sum",
    fuente: "IPC INDEC + dólar oficial BCRA (se actualizan solos)", granularidad: "mensual", rol: "ambos", horizonte: "rezagado",
    descripcion: "Montos llevados al poder de compra de un mes base, para comparar meses sin inflación." },
];

// ── Normalización (misma que usa lib/knowledge para títulos) ──────────────────
/** minúsculas, sin tildes, "≥" → ">=", todo lo que no sea [a-z0-9%>=] → espacio. */
export function canonMetrica(s: string): string {
  return s.replace(/≥/g, ">=").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
    .replace(/[^a-z0-9%>=]+/g, " ").trim();
}

const BY_ID = new Map(METRICAS.map((m) => [m.id, m]));
export function getMetrica(id: string | null | undefined): Metrica | undefined {
  return id ? BY_ID.get(id) : undefined;
}

// Índice de nombre/sinónimo/metaKey → métrica. Si un alias apunta a dos métricas, gana la primera
// (el test de integridad exige que no haya ambigüedad entre métricas con distinto `know`).
const NAME_INDEX: Map<string, Metrica> = (() => {
  const m = new Map<string, Metrica>();
  for (const x of METRICAS) {
    for (const a of [x.nombre, x.etiqueta, x.metaKey, ...x.sinonimos]) {
      if (!a) continue;
      const k = canonMetrica(a);
      if (k && !m.has(k)) m.set(k, x);
    }
  }
  return m;
})();

/** Resuelve un nombre de KPI (título de card, clave de meta, nombre del Mapa) a su métrica. Exacto. */
export function metricaPorNombre(nombre: string | null | undefined): Metrica | undefined {
  if (!nombre) return undefined;
  const c = canonMetrica(nombre);
  return NAME_INDEX.get(c) ?? NAME_INDEX.get(canonMetrica(nombre.split("·")[0] ?? ""));
}

/** Pares alias → clave de KPI_KNOW (los consume lib/knowledge para `kpiKnowFor`). */
export function aliasesKnow(): [string, string][] {
  const out: [string, string][] = [];
  for (const x of METRICAS) {
    if (!x.know) continue;
    for (const a of [x.nombre, ...x.sinonimos]) out.push([a, x.know]);
  }
  return out;
}

// Reconoce una métrica DENTRO de un texto libre (p. ej. "Clicks orgánicos adicionales estimados"):
// gana el término más largo que aparece como palabra(s) completa(s).
// Palabras sueltas demasiado genéricas para buscarlas dentro de un texto ("para poder escalar").
const STOP_TEXTO = new Set(["poder", "share", "duracion", "gasto", "intencion", "envios", "click", "clic", "ventas", "esos", "fatiga", "friccion"]);
const TEXT_TERMS: { term: string; m: Metrica }[] = (() => {
  const out: { term: string; m: Metrica }[] = [];
  for (const x of METRICAS) {
    for (const a of [x.nombre, x.etiqueta, ...x.sinonimos, ...(x.claves ?? [])]) {
      if (!a) continue;
      const t = canonMetrica(a);
      if (t.length >= 3 && !STOP_TEXTO.has(t)) out.push({ term: t, m: x });
    }
  }
  return out.sort((a, b) => b.term.length - a.term.length);
})();
export function metricaEnTexto(texto: string | null | undefined): Metrica | undefined {
  if (!texto) return undefined;
  const c = ` ${canonMetrica(texto)} `;
  for (const { term, m } of TEXT_TERMS) if (c.includes(` ${term} `)) return m;
  return undefined;
}

/** KPIs de un plan del Mapa/Seguimiento, en el orden del catálogo. */
export function metricasDePlan(plan: string): Metrica[] {
  return METRICAS.filter((m) => m.plan === plan);
}

// Spec de metas (shape de DashKpiSpec de lib/metas-dash) armado desde el catálogo: una sola
// definición de label/medida/unidad/dirección. Umbrales por defecto 100/90 (el tenant los cambia).
export interface MetaSpecCatalogo {
  key: string; label: string; medida: string; unidad: "%" | "s" | "$" | "x" | ""; direccion: MetricaDireccion; umbralVerde: number; umbralAmarillo: number;
}
export function metaSpecDe(nombre: string): MetaSpecCatalogo {
  const m = metricaPorNombre(nombre);
  const u = m?.unidad;
  const unidad: MetaSpecCatalogo["unidad"] = u === "%" || u === "s" || u === "$" || u === "x" ? u : "";
  return {
    key: nombre,
    label: m?.etiqueta ?? m?.nombre ?? nombre,
    medida: m?.medida ?? m?.formula ?? "",
    unidad,
    direccion: m?.direccion ?? "up",
    umbralVerde: 100,
    umbralAmarillo: 90,
  };
}

/** Ficha compacta para el copiloto (tool get_metrica). */
export function fichaMetrica(m: Metrica) {
  return {
    id: m.id, nombre: m.nombre, sinonimos: m.sinonimos, formula: m.formula, unidad: m.unidad || "número",
    direccion: m.direccion === "down" ? "menor es mejor" : "mayor es mejor",
    tipo: m.tipo === "sum" ? "volumen (el acumulado suma)" : "tasa (el acumulado promedia)",
    fuente: m.fuente, granularidad: m.granularidad,
    rol: m.rol === "marca" ? "construcción de marca" : m.rol === "activacion" ? "activación" : "marca y activación",
    horizonte: m.horizonte === "adelantado" ? "indicador adelantado" : "indicador rezagado (resultado)",
    plan_del_mapa: m.plan ?? null, descripcion: m.descripcion,
  };
}
