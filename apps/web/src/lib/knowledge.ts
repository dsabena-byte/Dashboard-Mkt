// ============================================================================
// Capa de Conocimiento del Proceso Estratégico (capa micro y meso) — portada a Drean (sep-2026).
//   Claves de DASH_KNOW = slug de la ruta de Drean (/overview → "overview", /funnel → "funnel", …).
//   · DASH_KNOW: cómo leer cada TABLERO + etapa del ciclo + módulos del Método recomendados.
//   · KPI_KNOW: guía por KPI en 4 capas (cómo leer · mejor práctica · oportunidad · marco)
//     + fórmula, referencia orientativa, etapa del funnel y palancas (con link a módulos).
// El detalle profundo (capa macro) vive en lib/guia/* y se ve en /guia.
// Registro: español rioplatense, claro y práctico. Client-safe (sin server-only).
//
// `kpiKnowFor(title)` resuelve el título de una card por clave/alias EXACTO (normalizado),
// con unos pocos patrones anclados para títulos con marca ("Búsquedas <marca> / mes").
// ============================================================================
import type { Etapa, Funnel } from "@/lib/guia/types";
import { metricaPorNombre } from "@/lib/metricas";
import { FUNC_KNOW, FUNC_ALIASES } from "@/lib/knowledge-funciones";

export interface KpiPalanca { accion: string; modulo?: string }
export interface KpiKnow {
  name: string;
  comoLeer: string;
  mejorPractica: string;
  oportunidad: string;
  marco: string;
  formula?: string;
  /** Referencia orientativa: se contrasta con tu propia historia (p75 propio). */
  benchmark?: string;
  funnel?: Funnel;
  palancas?: KpiPalanca[];
  /** "funcion" = lectura/herramienta del dashboard (no una métrica del catálogo). Default: métrica. */
  tipo?: "metrica" | "funcion";
}
export interface DashKnow {
  title: string;
  intro: string;
  bullets: string[];
  practicas?: { nombre: string; detalle: string }[];
  etapa?: Etapa;
  funnel?: Funnel[];
  /** ids de módulos del Proceso Estratégico (lib/guia) para profundizar. */
  modulos?: string[];
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// ── Cómo leer cada TABLERO (por slug de ruta) ──────────────────────────────
export const DASH_KNOW: Record<string, DashKnow> = {
  overview: {
    etapa: "aprender",
    funnel: ["transversal"],
    modulos: ["ciclo-aprender", "modelo-objetivos-kpis", "plan-de-accion", "reporte-mensual"],
    title: "Cómo diseñar y gestionar tu estrategia por objetivos",
    intro: "Tener una estrategia no asegura alcanzar los resultados. Este es el tablero donde la estrategia deja de ser una declaración y se vuelve <b>gestión</b>: cada objetivo del negocio se descompone en KPIs con metas, y se observa —de forma continua— si las acciones acercan o alejan el resultado. Es el punto de partida del ciclo de decisión (medir → diagnosticar → intervenir → recalibrar): lo que se lee aquí define dónde y con qué prioridad intervenir.",
    bullets: [
      "<b>Diseño de la estrategia:</b> interpretar el tablero como un sistema causa-efecto, no como una lista de números. Cada indicador en rojo es una brecha entre lo planificado y lo real; el color señala pérdida de cumplimiento del objetivo, no el valor absoluto más bajo. Un objetivo bien formulado es específico, medible y temporal, y se expresa como un resultado de negocio —no como una actividad.",
      "<b>Despliegue y ejecución:</b> concentrar el esfuerzo en los KPIs de mayor peso que están en rojo. Cerrar esas brechas moviliza el objetivo más rápido que optimizar indicadores que ya cumplen (principio de gestión por excepción: la atención va a la desviación relevante).",
      "<b>Impacto en el negocio:</b> todo KPI existe para mover un objetivo. La pregunta que ordena la gestión no es 'si la métrica mejoró', sino 'si mejoró el objetivo, y a qué costo de recursos' —eficacia y eficiencia leídas juntas.",
    ],
    practicas: [
      { nombre: "Priorizá por peso × brecha", detalle: "el hero-card de cada objetivo muestra su cumplimiento y el peso de cada KPI. La palanca de mayor impacto no es el KPI más rojo, sino el de <b>mayor peso</b> que está lejos de su meta: ahí conviene actuar primero." },
      { nombre: "Mirá la cobertura antes que el %", detalle: "si un objetivo tiene baja cobertura (pocos KPIs con dato cargado), su porcentaje de cumplimiento es poco confiable. Primero completá metas y fuentes, después interpretá el semáforo." },
      { nombre: "Subí del KPI al objetivo", detalle: "el scorecard lista los KPIs, pero la lectura estratégica es el objetivo que alimentan. La pregunta no es 'mejoró el número', sino 'se movió el objetivo y a qué costo'." },
    ],
  },
  performance: {
    etapa: "optimizar",
    funnel: ["awareness", "consideracion", "conversion"],
    modulos: ["plan-de-medios", "benchmarks-medios", "alcance-frecuencia", "reasignacion-inversion", "medios-offline", "meta-ads-estructura", "meli-mercado-ads", "mercado-libre-para-marcas"],
    title: "Cómo diseñar y desplegar tu estrategia de medios",
    intro: "La inversión en medios es la principal palanca de ejecución de la estrategia: convierte presupuesto en atención, y atención en resultado. Este tablero permite decidir con evidencia cómo se distribuye esa inversión entre medios y objetivos del embudo (notoriedad → consideración → conversión), para <b>maximizar el impacto de negocio por unidad invertida</b> y no solo el volumen comprado.",
    bullets: [
      "<b>Diseño de la estrategia:</b> ningún indicador de medios vale por sí mismo; cada uno se lee contra el objetivo que persigue y contra su costo. El alcance construye notoriedad; la frecuencia, memoria —hasta el punto de saturación—; el VTR y el CTR, calidad de atención; el CPM y el CPA, eficiencia.",
      "<b>Despliegue y ejecución:</b> reasignar la inversión desde los medios y creativos de menor eficiencia marginal hacia los de mayor impacto. Optimizar no es gastar menos, es comprar más resultado con el mismo presupuesto.",
      "<b>Impacto en el negocio:</b> el plan de medios existe para mover demanda y ventas; su éxito se mide por el resultado que habilita, no por las impresiones que compra. Priorizar alcance incremental sobre repetir a quien ya fue impactado.",
    ],
    practicas: [
      { nombre: "No juzgues la marca solo por clicks", detalle: "el tablero separa objetivos de awareness, consideración y conversión. Sostené inversión en <b>Alcance</b> y <b>VTR</b> (construyen marca a futuro), no solo en clicks: optimizar todo al resultado inmediato agota el crecimiento (balance ~60/40 marca/activación)." },
      { nombre: "Leé Alcance junto a Frecuencia", detalle: "si la <b>Frecuencia</b> sube pero el <b>Alcance único</b> no crece, estás repitiendo sobre las mismas personas. Conviene ampliar alcance útil y controlar la frecuencia para no saturar ni desperdiciar inversión." },
      { nombre: "VTR y CTR se leen juntos", detalle: "un <b>VTR≥50%</b> alto con <b>CTR</b> bajo dice que el mensaje se ve pero no moviliza; uno bajo, que ni siquiera se retiene. El cruce te dice si el problema es el creativo o la oferta." },
      { nombre: "Reasigná por eficiencia, medio por medio", detalle: "la tabla por medio muestra el costo por resultado (CPM/CPC). Mové presupuesto del medio y creativo más caro por resultado al más eficiente, en vez de repartir parejo." },
      { nombre: "Medio con API manda", detalle: "Meta, YouTube/Programmatic (DV360) y Google Search/Demand Gen salen de la <b>API</b>; el reporte de OMD solo aporta los medios sin API (TikTok, Mercado Ads, Geo Mobile) y los tradicionales (TV Cable, OOH, DOOH). Performance Max no está acá: va en <b>Performance Conversión</b>." },
      { nombre: "Alcance = suma por medio", detalle: "el <b>Alcance único</b> suma el alcance de cada medio (no está deduplicado entre medios): leelo como presión y comparalo mes contra mes, no como personas únicas." },
      { nombre: "Mercado Ads: acá ves la inversión, no las ventas", detalle: "<b>Mercado Ads</b> entra por el reporte de OMD (inversión, impresiones y clics). Las ventas atribuidas, el ROAS y el ACOS se miran en el panel de Mercado Ads. Antes de subirle presupuesto, revisá que las publicaciones estén bien armadas: la publicidad no arregla una mala publicación (ver <b>Mercado Ads: Product Ads, Brand Ads y Display</b> en Profundizá)." },
    ],
  },
  redes: {
    etapa: "aprender",
    funnel: ["consideracion", "fidelizacion"],
    modulos: ["contenido-organico", "lectura-redes", "creatividades", "influencers-ugc"],
    title: "Cómo diseñar y ejecutar tu estrategia en redes sociales",
    intro: "Las redes construyen la relación de la marca con su audiencia <b>antes</b> de la venta: son un activo de notoriedad y consideración, no un canal de respuesta directa. Este tablero permite entender qué contenido genera vínculo real y traducir esa resonancia en una estrategia de contenidos deliberada —planificada por pilares y ritmo— en lugar de reactiva.",
    bullets: [
      "<b>Diseño de la estrategia:</b> priorizar la resonancia (engagement e interacciones de valor: guardados, compartidos) por sobre el tamaño de la audiencia. La interacción se interpreta por pilar de contenido (Producto/Branding/Promoción): revela qué mensaje conecta y con qué formato.",
      "<b>Despliegue y ejecución:</b> ampliar las líneas de contenido que resuenan por encima del promedio y ajustar la frecuencia al punto donde se sostiene presencia sin fatigar a la audiencia. Reforzar los <i>distinctive brand assets</i> (códigos visuales propios) en cada pieza para construir memoria.",
      "<b>Impacto en el negocio:</b> una comunidad activa es <i>media propia</i>: reduce la dependencia de la pauta paga, baja el costo de adquisición y alimenta la consideración de marca aguas abajo del embudo.",
    ],
    practicas: [
      { nombre: "Interacción de valor > vanity metrics", detalle: "priorizá <b>guardados</b> y <b>compartidos</b> por sobre los likes: son señal de utilidad y de alcance futuro. El tablero los expone por posteo para que identifiques qué contenido realmente conecta." },
      { nombre: "Leé el engagement por pilar", detalle: "la interacción se muestra por pilar (Producto/Branding/Promoción): revela qué <b>mensaje</b> conecta, no solo qué posteo. Reforzá el pilar que rinde por encima del promedio." },
      { nombre: "Alcance y evolución, no el total acumulado", detalle: "seguidores es un stock; <b>Alcance</b> y <b>Engagement rate</b> son el flujo que construye marca. Mirá la serie mensual real vs meta, no el número acumulado del año." },
      { nombre: "Sentimiento como alerta temprana", detalle: "el sentimiento de los comentarios anticipa problemas de percepción de producto o servicio antes de que impacten en las ventas: es la señal cualitativa del tablero." },
      { nombre: "El objetivo se mide con Instagram", detalle: "el tablero muestra IG y FB, pero la meta del plan Redes usa <b>solo Instagram</b>: el alcance orgánico de Facebook dejó de ser confiable cuando Meta deprecó la métrica (jun-2026) y no separa pago de orgánico." },
    ],
  },
  web: {
    etapa: "optimizar",
    funnel: ["conversion"],
    modulos: ["web-cro", "ga4-configuracion", "utm-nomenclatura", "medicion-atribucion"],
    title: "Cómo diseñar y optimizar tu estrategia digital",
    intro: "El sitio es donde la intención se convierte —o no— en negocio: el punto de mayor apalancamiento de toda la inversión previa en atraer audiencia. Este tablero permite diagnosticar dónde se gana y dónde se <b>fuga</b> valor a lo largo del recorrido del usuario, para decidir qué canal escalar y qué fricción de la experiencia corregir.",
    bullets: [
      "<b>Diseño de la estrategia:</b> el volumen de tráfico es condición necesaria pero no suficiente. La segmentación por fuente y por categoría revela dónde la eficiencia se gana o se pierde: un canal con mucho tráfico y baja conversión puede estar atrayendo audiencia poco calificada.",
      "<b>Despliegue y ejecución:</b> el embudo localiza la etapa de abandono; actuar sobre ese punto rinde más que sumar tráfico indiscriminado. Cada etapa tiene su micro-conversión, y la más débil es la que gobierna el resultado (teoría de restricciones).",
      "<b>Impacto en el negocio:</b> subir la tasa de conversión multiplica el retorno de toda la inversión que trajo a esa audiencia; es la palanca de mayor efecto compuesto del ecosistema digital.",
    ],
    practicas: [
      { nombre: "Conversión antes que tráfico", detalle: "subir la <b>tasa de conversión</b> rinde más que sumar usuarios, porque multiplica el retorno de todo el tráfico que ya pagaste por atraer. Es la palanca de mayor efecto del tablero." },
      { nombre: "Desagregá por fuente", detalle: "un canal con mucho tráfico y baja conversión trae audiencia poco calificada. Mirá la conversión y el ROAS <b>por fuente/canal</b>, no el total, para saber qué escalar y qué recortar." },
      { nombre: "El cuello del embudo manda", detalle: "la etapa más débil (usuarios → transacciones) gobierna el resultado. Actuá sobre ese punto de fuga antes de invertir en traer más tráfico." },
      { nombre: "Ingresos y ROAS contra la inversión", detalle: "leé <b>Transacciones</b>, <b>Ingresos</b> y <b>ROAS</b> junto a la inversión que trajo ese tráfico: ahí se ve qué canal realmente devuelve negocio." },
    ],
  },
  "seo-search": {
    etapa: "aprender",
    funnel: ["consideracion", "conversion"],
    modulos: ["seo-share-of-search", "search-console", "investigacion-competencia"],
    title: "Cómo diseñar tu estrategia de posicionamiento (SEO)",
    intro: "La búsqueda antecede a la compra: es la señal más temprana y honesta de intención del mercado. Este tablero permite anticipar el share de mercado y diseñar una estrategia de presencia orgánica que <b>capture demanda de forma sostenida y a menor costo futuro</b>, construyendo un activo que no se apaga cuando se detiene la pauta.",
    bullets: [
      "<b>Diseño de la estrategia:</b> el Share of Search (participación de la marca en las búsquedas de la categoría) anticipa el share de ventas; la brecha entre ambos señala demanda latente aún no capturada o riesgo competitivo por delante.",
      "<b>Despliegue y ejecución:</b> priorizar las keywords de alto volumen donde la marca está débil o ausente (mayor potencial de captura) y reforzar consideración donde un competidor acelera su demanda de búsqueda.",
      "<b>Impacto en el negocio:</b> el posicionamiento orgánico es un activo de capitalización compuesta —cada posición ganada reduce el costo de adquisición futuro—, a diferencia de la pauta, que deja de rendir apenas se corta.",
    ],
    practicas: [
      { nombre: "El Share of Search adelanta tus ventas", detalle: "tu participación en las búsquedas de la categoría anticipa tu share de mercado. Si el <b>Share of Search</b> del tablero cae, es una alerta temprana aunque las ventas todavía no lo muestren." },
      { nombre: "Atacá donde sos débil y hay volumen", detalle: "priorizá las keywords de <b>alto volumen</b> donde tu marca está floja o ausente (mayor potencial de captura), no las que ya liderás. La matriz del tablero las separa." },
      { nombre: "La demanda genérica es el tamaño del juego", detalle: "mirá la evolución de la <b>demanda genérica</b>: si crece y tu share no sube, un competidor te está capturando ese crecimiento." },
    ],
  },
  "mapa-estrategico": {
    etapa: "construir",
    funnel: ["transversal"],
    modulos: ["proceso-estrategico", "objetivos-negocio-marketing", "modelo-objetivos-kpis", "mapa-estrategico"],
    title: "Cómo diseñar tu estrategia en el Mapa",
    intro: "Es la tesis que ordena todo el sistema: vincula cada KPI con los objetivos del negocio mediante <b>pesos</b>, de modo que el cumplimiento ponderado de los indicadores determina el de la estrategia. Diseñar bien este mapa es diseñar bien la estrategia: define qué se prioriza, cómo se mide y cómo la ejecución diaria se traduce en avance estratégico.",
    bullets: [
      "<b>Diseño de la estrategia:</b> los pesos expresan prioridades. Definir qué objetivo y qué KPI pesa más es una decisión estratégica, no un dato: declara dónde el negocio elige ganar y qué está dispuesto a resignar.",
      "<b>Despliegue y ejecución:</b> el mix desagrega la meta por categoría/segmento, permitiendo que la misma estrategia se ejecute con foco distinto según dónde se juega el crecimiento.",
      "<b>Impacto en el negocio:</b> si el modelo está bien construido, cumplir los KPIs según su peso equivale a cumplir los objetivos, y con ellos el resultado. El mapa convierte la ejecución diaria en avance estratégico medible.",
    ],
    practicas: [
      { nombre: "El peso es una decisión, no un dato", detalle: "asignar el peso de cada KPI en un objetivo te obliga a priorizar: si 'todo pesa igual', no priorizaste. El peso declara dónde el negocio elige ganar." },
      { nombre: "Cerrá los pesos al 100% por objetivo", detalle: "el editor capa en 100% la suma de pesos de los KPIs de cada objetivo, para que el cumplimiento sea comparable y consistente entre objetivos." },
      { nombre: "Trazabilidad KPI → objetivo", detalle: "si un KPI no se vincula a ningún objetivo, sobra; si un objetivo no tiene KPIs, no es medible. El mapa fuerza esa coherencia: es lo que hace que el Seguimiento tenga sentido." },
    ],
  },
  // ── Tableros exclusivos de Drean (no existen en BIP) ──
  "cuadros-basicos": {
    etapa: "optimizar",
    funnel: ["conversion"],
    modulos: ["trade-marketing", "tableros-planilla", "plan-de-accion"],
    title: "Cómo leer el cumplimiento del Cuadro Básico",
    intro: "El Cuadro Básico es el surtido que cada tienda se comprometió a exhibir. Este tablero mide, semana a semana y tienda por tienda, cuánto de ese surtido está efectivamente en el piso: es la condición física de la venta. Sin el producto exhibido, toda la demanda construida arriba del embudo <b>se pierde en el último metro</b>.",
    bullets: [
      "<b>Diseño de la estrategia:</b> el objetivo es un cumplimiento del <b>80%</b>. Se lee en tres capas: cuadro básico total, <b>Infaltables</b> (lo que no puede faltar nunca) y <b>Estratégicos</b> (lo que se empuja por decisión comercial).",
      "<b>Despliegue y ejecución:</b> el foco va a las tiendas y divisiones con quiebres recurrentes en productos de alta rotación. Las <b>sugerencias de tiendas</b> señalan dónde conviene sumar relevamiento a partir del reporte de existencias.",
      "<b>Impacto en el negocio:</b> el cumplimiento de CB es un KPI del Mapa Estratégico (general, sin mix por categoría) y alimenta la Intención de compra: no se compra lo que no se ve.",
    ],
    practicas: [
      { nombre: "Infaltables antes que el total", detalle: "un 85% de CB con Infaltables en falta es peor que un 78% con Infaltables completos: priorizá la reposición de lo que no puede faltar." },
      { nombre: "Leé sobre tiendas relevadas", detalle: "el % se calcula sobre las tiendas medidas en el período (baseline de las últimas semanas). Una caída puede ser un cambio en el set de tiendas, no en la ejecución." },
      { nombre: "Tendencia semanal, no la foto", detalle: "una semana mala es ruido; tres semanas de caída en la misma división son un problema de abastecimiento o de negociación." },
    ],
  },
  "floor-share": {
    etapa: "optimizar",
    funnel: ["conversion"],
    modulos: ["trade-marketing", "investigacion-competencia", "salud-de-marca"],
    title: "Cómo leer el Floor Share (share de góndola)",
    intro: "El Floor Share es la participación de Drean en el espacio de exhibición de cada categoría frente a la competencia. Es el share que se juega en la tienda: <b>la presencia física es disponibilidad mental en el momento de compra</b>, y se lee contra el share de ventas para detectar oportunidades de negociación.",
    bullets: [
      "<b>Diseño de la estrategia:</b> objetivos por categoría: <b>Lavado 32% · Refrigeración 25% · Cocción 23%</b>. Cada categoría compite con marcas distintas: el ranking de marcas muestra contra quién se gana o se pierde espacio.",
      "<b>Despliegue y ejecución:</b> priorizá la negociación de exhibición donde el share de ventas (GfK) supera al de góndola: ahí el retorno por punto de espacio ganado es mayor.",
      "<b>Impacto en el negocio:</b> la regla del share justo dice que el floor share debería ser al menos igual al share de ventas; por debajo, la marca subexpone lo que el mercado ya elige.",
    ],
    practicas: [
      { nombre: "Contra el share GfK", detalle: "abrí <b>Resultados Comerciales</b> en paralelo: si tu share de ventas en una categoría es mayor que tu floor share, hay espacio para pedir más exhibición con argumento." },
      { nombre: "Mirá quién gana el espacio", detalle: "el ranking de marcas y la evolución mensual dicen si el espacio que perdés lo toma un competidor directo o se reparte." },
      { nombre: "Cruzalo con Mkt Canal", detalle: "las acciones digitales en retailers (Mkt Canal Comercial) son moneda de negociación: se leen junto al espacio conseguido en ese cliente." },
    ],
  },
  funnel: {
    etapa: "construir",
    funnel: ["transversal"],
    modulos: ["presupuesto-marketing", "reasignacion-inversion", "tableros-planilla"],
    title: "Cómo gobernar y desplegar tu inversión de marketing",
    intro: "La inversión es el recurso con el que se ejecuta la estrategia, y debe gobernarse como una <b>inversión, no como un gasto</b>: cada peso se asigna esperando un retorno. Este tablero contrasta lo ejecutado contra el presupuesto vigente (BGT y sus reforecasts) y su proporción respecto de la facturación, para reasignar con evidencia donde el desvío —o el retorno— lo justifica.",
    bullets: [
      "<b>Diseño de la estrategia:</b> la <b>Ejecución del Presupuesto</b> compara cada cuatrimestre contra su versión vigente (T1 vs BGT, T2 vs 4+8, T3 vs 8+4). El desvío señala dónde la ejecución se aparta de la estrategia y obliga a decidir si se corrige la ejecución o se recalibra el plan.",
      "<b>Despliegue y ejecución:</b> el <b>comparador libre A vs B</b> permite contrastar versiones, períodos, cuentas y monedas para encontrar de dónde viene el desvío (concepto por concepto).",
      "<b>Impacto en el negocio:</b> el ratio Inversión/Facturación mantiene el esfuerzo en proporción sana al resultado; crecer en volumen no debería costar rentabilidad.",
    ],
    practicas: [
      { nombre: "Desvío menor al 5%", detalle: "el criterio del tablero es un desvío real vs presupuesto por debajo del <b>5%</b> por cuatrimestre. Si se pasa, explicá el porqué antes del cierre, no después." },
      { nombre: "Inversión/Facturación ≤ 1,3%", detalle: "el ratio <b>Inversión/Facturación</b> es el techo de eficiencia del plan: si crecés en inversión y la facturación no acompaña, el ratio lo muestra primero." },
      { nombre: "Reasigná por retorno, no por inercia", detalle: "usá el árbol por concepto para mover presupuesto hacia donde la evidencia (Plan de Medios, Web, Trade) muestra mayor retorno." },
    ],
  },
  mercado: {
    etapa: "acelerar",
    funnel: ["transversal"],
    modulos: ["ciclo-acelerar", "investigacion-competencia", "salud-de-marca", "mercado-libre-para-marcas"],
    title: "Cómo leer el mercado (GfK) y recalibrar la estrategia",
    intro: "Es el destino de toda la estrategia: el <b>share de mercado</b> que el resto de las acciones busca movilizar, medido con ventas reales (GfK). Este tablero muestra el share en valor y en unidades y el índice de precio de Drean frente a la competencia, por categoría y segmento, para verificar si el plan se traduce en negocio y a qué ritmo respecto del mercado.",
    bullets: [
      "<b>Diseño de la estrategia:</b> <b>share en valor</b> y <b>share en unidades</b> se leen juntos: si el valor crece más que las unidades, la marca vende más caro (mix o precio); si es al revés, está comprando volumen con precio. El <b>índice de precio</b> lo confirma.",
      "<b>Despliegue y ejecución:</b> el share por segmento (High / Mid / Low) indica dónde la marca gana o pierde terreno y dónde reasignar foco competitivo. Mensual para la dinámica, MAT (12 meses móviles) para la tendencia de fondo.",
      "<b>Impacto en el negocio:</b> cierra el ciclo de aprendizaje —datos → decisiones → resultados— y alimenta la recalibración del Mapa: si los KPIs se cumplieron y el share no se movió, el modelo necesita ajuste.",
    ],
    practicas: [
      { nombre: "Valor y unidades, siempre juntos", detalle: "ganar share en unidades perdiendo en valor es crecer regalando margen. Contrastá con el <b>índice de precio</b> antes de celebrar." },
      { nombre: "MAT para decidir, mensual para alertar", detalle: "el mensual es ruidoso (promociones, stock); el <b>MAT</b> muestra la tendencia estructural. Las decisiones grandes se toman sobre MAT." },
      { nombre: "El share adelantado está en Search", detalle: "el <b>Share of Search</b> (Optimización SEO) anticipa este share: si cae varios meses, el share GfK probablemente lo siga." },
    ],
  },
  "salud-marca": {
    etapa: "acelerar",
    funnel: ["awareness", "consideracion", "fidelizacion"],
    modulos: ["salud-de-marca", "modelo-objetivos-kpis", "ciclo-acelerar"],
    title: "Cómo leer la Salud de Marca (Kantar)",
    intro: "La Salud de Marca mide el activo que el marketing construye: cuánto espacio ocupa Drean en la mente del consumidor. Son los <b>cuatro objetivos del Mapa Estratégico</b> —Top of Mind, Share of Mind, Intención de compra y Poder de marca— medidos por Kantar por ola, por categoría y consolidados en un puntaje de marca.",
    bullets: [
      "<b>Diseño de la estrategia:</b> <b>TOM</b> y <b>SOM</b> son saliencia (ser recordada, y primero); <b>Intención</b> es el puente a la compra; <b>Poder</b> es diferenciación y capacidad de sostener precio. Cada uno responde a palancas distintas.",
      "<b>Despliegue y ejecución:</b> entre olas, la brújula son las señales vivas: Share of Search, alcance y VTR de la pauta, engagement, Floor Share y share GfK. La proyección de la próxima ola se estima desde esos drivers de mercado de cada marca.",
      "<b>Impacto en el negocio:</b> una marca fuerte vende más a igual inversión y sostiene precio: el equity es la razón por la que el share de mañana no depende solo de la pauta de hoy.",
    ],
    practicas: [
      { nombre: "Proyección ≠ medición", detalle: "la ola proyectada (nov-26) es una estimación desde los drivers de mercado: leela como dirección, no como dato de Kantar." },
      { nombre: "TOM contra SOM", detalle: "SOM alto con TOM bajo = te conocen pero no sos la primera opción: falta saliencia (alcance, frecuencia efectiva, activos distintivos)." },
      { nombre: "Intención contra share", detalle: "intención alta con share bajo indica una fuga en el punto de venta: revisá Cuadros Básicos, Floor Share y precio." },
    ],
  },
  influencia: {
    etapa: "optimizar",
    funnel: ["consideracion"],
    modulos: ["influencers-ugc", "creatividades", "lectura-video"],
    title: "Cómo leer el marketing de influencia y el UGC",
    intro: "El contenido de creadores (UGC) aporta lo que la marca no puede decir de sí misma: <b>credibilidad de un par</b>. Este tablero cruza la ejecución paga del UGC (inversión vs plan, alcance, impresiones, CTR, CPM, video views) con un análisis cualitativo por pieza que mide si el contenido genera credibilidad, intención y buena percepción.",
    bullets: [
      "<b>Diseño de la estrategia:</b> el UGC se evalúa por su rol (consideración), no por su volumen: una pieza con menos alcance pero más guardados y compartidos vale más que una que solo acumula impresiones.",
      "<b>Despliegue y ejecución:</b> escalá los creadores y formatos cuyas señales de interacción (guardados, compartidos, VTR) están por encima del promedio del universo UGC; pausá los que consumen presupuesto sin resonancia.",
      "<b>Impacto en el negocio:</b> la credibilidad y la intención que genera el UGC alimentan el objetivo de Intención de compra del Mapa.",
    ],
    practicas: [
      { nombre: "Cualitativo calibrado con datos", detalle: "credibilidad, intención y percepción de cada pieza no salen solo del texto de los comentarios: se calibran con las tasas reales de guardados, compartidos y VTR de la pauta frente al promedio UGC." },
      { nombre: "Pocos comentarios no es rechazo", detalle: "una pieza con pocos comentarios pero guardados y VTR sobre el promedio está funcionando; no la cortes por falta de conversación." },
      { nombre: "Costo por atención, no por impresión", detalle: "compará creadores por CPM y por costo de vista al 50%, dentro del mismo formato." },
    ],
  },
  "mkt-canal": {
    etapa: "optimizar",
    funnel: ["conversion"],
    modulos: ["trade-marketing", "reasignacion-inversion", "benchmarks-medios"],
    title: "Cómo leer el marketing en el canal comercial",
    intro: "Las acciones digitales en retailers (pauta en las plataformas online de los clientes) son la pauta más cercana a la venta: se ejecutan <b>donde el comprador ya está decidiendo</b>. Este tablero muestra cada acción por cliente, plataforma y mes con impresiones, clics, conversiones, ingresos e inversión.",
    bullets: [
      "<b>Diseño de la estrategia:</b> cada acción se evalúa por eficiencia (CTR, CPC, CPM) y por retorno (<b>ROAS</b> = ingresos ÷ inversión), comparando dentro del mismo cliente y tipo de acción.",
      "<b>Despliegue y ejecución:</b> concentrá la inversión en los clientes y formatos con mejor ROAS y usá las acciones como moneda de negociación de exhibición (Floor Share) y surtido (Cuadros Básicos).",
      "<b>Impacto en el negocio:</b> es la conexión directa entre inversión de trade marketing y venta en el canal.",
    ],
    practicas: [
      { nombre: "ROAS por cliente y acción", detalle: "no promedies todo el canal: una acción con ROAS alto en un cliente puede esconder otra que no rinde en otro." },
      { nombre: "Ingresos reportados por el retailer", detalle: "los ingresos y conversiones los informa cada plataforma de retail con su propia atribución: comparalos dentro de la misma plataforma, no entre plataformas." },
    ],
  },
  "performance-conversion": {
    etapa: "optimizar",
    funnel: ["conversion"],
    modulos: ["web-cro", "google-pmax", "medicion-atribucion", "meta-pixel-capi"],
    title: "Cómo leer la pauta de conversión (ecommerce)",
    intro: "Es la pauta que busca venta directa en el ecommerce (Performance Max, shopping, campañas de conversión), separada del plan de marca a propósito. Este tablero cruza la inversión con lo que pasa en el sitio (GA4): sesiones, transacciones, ingresos y tasa de conversión, y deriva <b>CPA/CAC, CPC y ROAS</b>.",
    bullets: [
      "<b>Diseño de la estrategia:</b> el ROAS se lee contra el ROAS de equilibrio (≈ 1 ÷ margen). Por debajo, cada venta pierde plata; muy por encima con poca inversión, hay espacio para escalar.",
      "<b>Despliegue y ejecución:</b> si el CPA sube con la tasa de conversión estable, el problema es de compra de medios; si la conversión cae, el problema está en el sitio (precio, stock, checkout).",
      "<b>Impacto en el negocio:</b> mide la última milla; no captura el valor de marca que habilitó esa venta, por eso no se mezcla con Plan de Medios.",
    ],
    practicas: [
      { nombre: "PMax: incremental o capturado", detalle: "Performance Max tiende a capturar demanda que ya existía (búsquedas de marca). Contrastá su ROAS con la evolución de las ventas totales del sitio." },
      { nombre: "Ratios sobre la data diaria", detalle: "CPA, CPC y ROAS se calculan sobre el mismo período y la misma fuente; no mezcles ingresos de GA4 con conversiones de la plataforma." },
    ],
  },
  contenido: {
    etapa: "optimizar",
    funnel: ["consideracion", "fidelizacion"],
    modulos: ["contenido-organico", "creatividades", "influencers-ugc", "brief-campana"],
    title: "Cómo usar el Generador de Contenido",
    intro: "El Generador de Contenido lleva el aprendizaje de Redes a la ejecución: las piezas se generan, se diseñan, se guardan en la biblioteca y se <b>distribuyen</b> con fecha, hora y redes en un calendario mensual. Las aprobadas se publican solas en Instagram y Facebook cuando llega su horario.",
    bullets: [
      "<b>Diseño de la estrategia:</b> planificá por pilares (Producto, Branding, Promoción) con el ritmo que el tablero de Redes mostró que sostiene la resonancia sin fatigar.",
      "<b>Despliegue y ejecución:</b> reutilizá lo que funciona: la biblioteca UGC y la adaptación de piezas (1:1, 4:5, 9:16, 16:9) llevan una pieza ganadora a todos los formatos de pauta.",
      "<b>Impacto en el negocio:</b> un calendario deliberado convierte la comunidad en un activo propio y reduce la dependencia de la pauta paga.",
    ],
    practicas: [
      { nombre: "Solo se publica lo aprobado", detalle: "la publicación automática toma únicamente piezas en estado aprobado con fecha y hora cumplidas; revisá el calendario antes del fin de semana." },
      { nombre: "Cerrá el loop con Redes", detalle: "después de publicar, mirá guardados, compartidos y engagement por pilar en <b>Redes</b> para decidir qué repetir el mes siguiente." },
    ],
  },
  monitoreo: {
    etapa: "construir",
    funnel: ["transversal"],
    modulos: ["conectar-fuentes", "ciclo-construir"],
    title: "Cómo leer el estado de las fuentes de datos",
    intro: "Antes de interpretar un número hay que saber si está al día. Este tablero muestra cada proceso que alimenta los dashboards (fuente, tipo de conexión, periodicidad esperada y última actualización real) con un <b>semáforo por antigüedad</b>.",
    bullets: [
      "<b>Diseño de la estrategia:</b> un objetivo con baja cobertura en el Seguimiento casi siempre es una fuente atrasada o una meta sin cargar, no un problema de marketing.",
      "<b>Despliegue y ejecución:</b> los procesos automáticos se re-disparan; las cargas manuales (reportes OMD, GfK, Kantar) dependen del equipo y se anotan como pendientes.",
      "<b>Impacto en el negocio:</b> decidir sobre datos viejos es decidir a ciegas: este tablero es la condición previa de todo el ciclo.",
    ],
  },
};

// ── Guía por KPI. Clave interna estable; el matcheo por título es por alias exacto. ──
const KPI_BASE: Record<string, KpiKnow> = {
  // ── Demanda y búsqueda ──
  sos: {
    name: "Share of Search",
    comoLeer: "Qué parte de las búsquedas de marcas del rubro en Google son de tu marca (tus búsquedas ÷ las de todas las marcas comparadas). Suele <b>anticipar lo que después pasa con las ventas</b> (share de mercado): la gente busca antes de comprar.",
    mejorPractica: "Comparalo con tu <b>parte real de las ventas</b> (share de mercado): si te buscan más de lo que vendés, hay interés que todavía no convertís en ventas; si te buscan menos, tus ventas están en riesgo. Seguilo todos los meses contra los mismos 3-5 competidores.",
    oportunidad: "Si a un competidor lo buscan cada vez más varios meses seguidos y a vos no, es una alerta temprana: reforzá los avisos para que te conozcan y trabajá las búsquedas donde perdés terreno.",
    marco: "<b>Demanda → Búsqueda → Intención → Compra.</b> El Share of Search conecta el awareness (arriba del embudo) con la conversión (abajo).",
    formula: "Búsquedas de tu marca ÷ Σ búsquedas de las marcas del set",
    benchmark: "Sin umbral fijo: la referencia es tu share de mercado. SoS > share anticipa crecimiento (Les Binet, IPA).",
    funnel: "consideracion",
    palancas: [
      { accion: "Sostener inversión en awareness (el SoS es su eco)", modulo: "plan-de-medios" },
      { accion: "Atacar keywords débiles de alto volumen", modulo: "seo-share-of-search" },
      { accion: "Leerlo contra la competencia", modulo: "investigacion-competencia" },
    ],
  },
  indice: {
    name: "Índice de posición SEO",
    comoLeer: "En qué lugar aparecés en promedio en Google para las búsquedas del rubro, dando más peso a las más buscadas. <b>Más bajo es mejor</b> (3,4 ≈ entre el 3.º y el 4.º lugar).",
    mejorPractica: "No te quedes con el promedio: separá las búsquedas donde estás <b>entre los 3 primeros</b> (a cuidar), las que estás <b>entre el 8.º y el 20.º</b> (mejora rápida) y las que <b>no aparecés</b>.",
    oportunidad: "Las búsquedas muy buscadas donde estás entre el 8.º y el 20.º lugar son lo que más rinde: mejorando la página podés pasar de la segunda a la primera página de Google.",
    marco: "El SEO es un activo de <b>capitalización compuesta</b>: cada posición ganada abarata la adquisición futura; la pauta, en cambio, deja de rendir cuando se corta.",
    formula: "Σ (posición × volumen) ÷ Σ volumen",
    funnel: "consideracion",
    palancas: [
      { accion: "Mejorar contenido de páginas en posición 8-20", modulo: "seo-share-of-search" },
      { accion: "Corregir indexación y velocidad", modulo: "search-console" },
    ],
  },
  busquedas: {
    name: "Búsquedas de marca / mes",
    comoLeer: "Volumen mensual de búsquedas de <b>tu marca</b>. Mide el tamaño de la demanda de marca, no la de la categoría.",
    mejorPractica: "Leelo junto a las búsquedas del producto sin marca: si el rubro crece y tu marca no, estás perdiendo lugar en un mercado que se agranda.",
    oportunidad: "Un pico por temporada (Hot Sale, CyberMonday) es el momento de aparecer cuando la gente está por comprar: subí la presencia <b>antes</b> del pico, no durante.",
    marco: "La búsqueda de marca es el <b>eco de la inversión en awareness</b>: si crece después de una campaña, la campaña construyó marca.",
    funnel: "awareness",
    palancas: [
      { accion: "Anticipar la presión a los eventos comerciales", modulo: "campanas-estacionales" },
      { accion: "Proteger la marca en búsqueda paga", modulo: "google-search" },
    ],
  },
  demanda: {
    name: "Demanda genérica",
    comoLeer: "Búsquedas del producto sin marca (por ejemplo, 'lavarropas'). Es el <b>tamaño total de las ganas de comprar</b> del mercado (demanda genérica).",
    mejorPractica: "Usala como denominador: te dice el techo disponible y si el mercado crece o se achica.",
    oportunidad: "Mucha gente buscando el producto y poca buscando tu marca = <b>mercado grande donde tenés poca participación</b>: hay espacio para crecer con avisos para que te conozcan y con posicionamiento en Google (SEO).",
    marco: "Marca el momento del ciclo: una demanda en expansión favorece invertir en captura.",
    funnel: "consideracion",
    palancas: [{ accion: "Ganar posiciones en keywords de categoría", modulo: "seo-share-of-search" }],
  },

  // ── Medios pagos ──
  inversion: {
    name: "Inversión",
    comoLeer: "Plata invertida en avisos en el período. Solo tiene sentido leída <b>contra lo que consigue</b>: gente alcanzada, videos vistos, clics, ventas.",
    mejorPractica: "Mirá <b>cuánto cuesta cada resultado</b> por medio y objetivo: mostrar el aviso mil veces (CPM), un video visto completo (CPCV), un clic (CPC), una venta (CPA). Barato no es eficiente si no mueve el objetivo.",
    oportunidad: "Un medio con mucha plata y poco resultado → pasá plata a otro (<b>reasignación</b>); un medio que rinde bien con poca plata → dale más.",
    marco: "La inversión es un <b>insumo</b>: el objetivo no es gastar menos sino comprar más resultado por peso.",
    funnel: "transversal",
    palancas: [
      { accion: "Reasignar por costo por resultado", modulo: "reasignacion-inversion" },
      { accion: "Controlar ritmo de gasto vs plan", modulo: "benchmarks-medios" },
      { accion: "Balancear marca y activación", modulo: "presupuesto-marketing" },
    ],
  },
  alcance: {
    name: "Alcance",
    comoLeer: "Cuántas personas <b>distintas</b> vieron el aviso o la publicación. Mide a cuánta gente llegás, no cuántas veces.",
    mejorPractica: "Leelo junto a cuántas veces lo vio cada persona (frecuencia): llegar a mucha gente una sola vez no deja recuerdo; llegar a poca gente muchas veces cansa.",
    oportunidad: "Si la inversión sube pero no llegás a más gente, le estás mostrando el aviso a los mismos: pedile a la agencia <b>públicos nuevos</b> o sumá otro medio.",
    marco: "El alcance es la base del embudo: el crecimiento de una marca viene sobre todo de sumar compradores, y eso empieza por llegar a más personas.",
    formula: "Personas únicas alcanzadas (dato de la plataforma; no se suma entre medios sin deduplicar)",
    benchmark: "≥ 80% del alcance planificado (criterio de alertas de la plataforma).",
    funnel: "awareness",
    palancas: [
      { accion: "Ampliar audiencias y ubicaciones", modulo: "meta-ads-audiencias" },
      { accion: "Poner tope de frecuencia", modulo: "alcance-frecuencia" },
      { accion: "Sumar un medio complementario", modulo: "plan-de-medios" },
    ],
  },
  frecuencia: {
    name: "Frecuencia",
    comoLeer: "Cuántas veces vio el aviso cada persona, en promedio, en el período (veces mostrado ÷ personas alcanzadas).",
    mejorPractica: "En campañas para que te conozcan, <b>entre 2 y 4 veces</b> por mes está bien. Menos no deja recuerdo; bastante más cansa y desperdicia plata.",
    oportunidad: "Si cada persona lo vio más de 6 veces, no sumás gente nueva y bajan los clics o los videos vistos → <b>pasá plata a llegar a gente nueva</b> o cambiá las piezas.",
    marco: "La frecuencia tiene rendimientos decrecientes: cada exposición extra aporta menos y, pasado un umbral, erosiona la percepción.",
    formula: "Impresiones ÷ Alcance",
    benchmark: "2-4 sano · > 4 alerta · > 6 exceso (mensual por campaña de awareness).",
    funnel: "awareness",
    palancas: [
      { accion: "Tope de frecuencia en campañas de alcance", modulo: "meta-ads-audiencias" },
      { accion: "Rotar creatividades cada 2-4 semanas", modulo: "creatividades" },
    ],
  },
  impresiones: {
    name: "Impresiones",
    comoLeer: "Cuántas veces se mostró el aviso (contando repeticiones). Mide <b>cuánta exposición</b> se compró, no cuántas personas.",
    mejorPractica: "No lo confundas con alcance (personas distintas). Para saber a cuánta gente llegás mirá el alcance; para saber si compraste barato, el costo por mil impresiones (CPM).",
    oportunidad: "Muchas impresiones y poca gente alcanzada = cada persona lo vio muchas veces: revisá si estás cansando al mismo público.",
    marco: "Es la unidad de compra de la pauta (CPM), pero es un medio, no un fin.",
    funnel: "awareness",
    palancas: [{ accion: "Leer impresiones junto a alcance y frecuencia", modulo: "alcance-frecuencia" }],
  },
  grps: {
    name: "GRPs",
    comoLeer: "Cuánta presión hubo en TV y radio: 1 punto de rating (GRP) = el 1% del público de referencia vio el aviso una vez. <b>GRPs = % de gente alcanzada × veces que lo vio</b>. Si se mide sobre el público comprado, se llaman TRPs.",
    mejorPractica: "Leelos junto a cuánta gente distinta llegás (alcance): sumar puntos sin sumar gente es repetirle el aviso a los mismos.",
    oportunidad: "Espacios con muchos puntos pero que casi no suman gente nueva → candidatos a recortar para pasar la plata a otro canal u horario.",
    marco: "Es la unidad de compra de la TV y la radio, como la impresión en digital. No se suma con impresiones digitales.",
    formula: "Σ ratings de cada salida (o alcance % × frecuencia)",
    funnel: "awareness",
    palancas: [
      { accion: "Cargar y leer medios offline", modulo: "medios-offline" },
      { accion: "Planificar alcance y frecuencia efectiva", modulo: "alcance-frecuencia" },
    ],
  },
  cpp: {
    name: "Costo por GRP",
    comoLeer: "Cuánto cuesta cada punto de rating en TV o radio (CPP o CPR). Es el equivalente del costo por mil impresiones (CPM) de lo digital.",
    mejorPractica: "Comparalo <b>dentro del mismo medio, público y horario</b>: el horario central y los programas de mucho rating son más caros por punto y valen la pena solo si llegan a gente que el resto no.",
    oportunidad: "Un espacio que cuesta mucho más por punto que el resto del medio y no suma gente nueva es el primero a renegociar o recortar.",
    marco: "El precio de la presión en medios masivos; lo que importa es cuánto alcance efectivo (3+) compra.",
    formula: "Inversión ÷ GRPs",
    benchmark: "Relativo: vs la mediana de tus soportes del mismo medio (señal a partir de 1,5×).",
    funnel: "awareness",
    palancas: [
      { accion: "Renegociar o mover a franjas más eficientes", modulo: "medios-offline" },
      { accion: "Reasignar con evidencia", modulo: "reasignacion-inversion" },
    ],
  },
  contactos: {
    name: "Contactos offline",
    comoLeer: "Cuántas veces la gente tuvo la oportunidad de ver el aviso según informa la agencia o el medio (vía pública, pantallas, cine, gráfica, acciones en punto de venta, TV y radio). Es el volumen de los medios offline.",
    mejorPractica: "No los sumes con las impresiones digitales salvo que se midan igual: ver un cartel no es lo mismo que ver un aviso en el celular.",
    oportunidad: "El <b>costo por mil contactos</b> (inversión ÷ contactos × 1.000) muestra qué espacio es caro dentro de su medio; contra lo digital, sirve solo como orden de magnitud.",
    marco: "En las señales, TV, OOH y DOOH se tratan como offline: sus contactos van aparte y el CPM mensual se calcula solo con medios que informan impresiones.",
    formula: "Contactos informados; CPM de contactos = Inversión ÷ Contactos × 1.000",
    funnel: "awareness",
    palancas: [{ accion: "Leer medios offline y sin API", modulo: "medios-offline" }],
  },
  cpm: {
    name: "CPM",
    comoLeer: "Cuánto cuesta mostrar el aviso mil veces (costo por mil impresiones o CPM). Mide cuánto cuesta comprar atención en un medio.",
    mejorPractica: "Comparalo <b>solo dentro del mismo medio y formato</b>: cambia muchísimo entre plataformas. Barato no sirve si casi nadie ve el video (VTR) ni hace clic (CTR).",
    oportunidad: "Si en la misma campaña sube semana a semana, suele ser que el público ya se cansó o que la pieza se gastó: pedile a la agencia públicos o piezas nuevas.",
    marco: "El CPM es el precio de la atención; lo que importa es cuánto de esa atención se convierte en recuerdo o acción (CPCV, CPC, CPA).",
    formula: "Inversión ÷ Impresiones × 1.000",
    benchmark: "Relativo por medio: en campañas reales analizadas, TikTok ≈ 0,4× y YouTube ≈ 1,7× el CPM de Meta. Alerta si supera tu mediana del medio.",
    funnel: "awareness",
    palancas: [
      { accion: "Ampliar audiencia y ubicaciones", modulo: "meta-ads-audiencias" },
      { accion: "Rotar creatividades fatigadas", modulo: "creatividades" },
      { accion: "Evaluar por formato y medio", modulo: "benchmarks-medios" },
    ],
  },
  vtr: {
    name: "VTR (≥50%)",
    comoLeer: "De cada 100 veces que se mostró un video, cuántas llegaron al menos a la mitad (VTR). Mide <b>si la gente presta atención</b>, no cuánto se mostró.",
    mejorPractica: "Compará solo videos del mismo formato (un video de 6 segundos y uno de 30 no se miden igual). Para decidir mirá también <b>cuánto cuesta cada video visto completo</b> (CPCV): un VTR alto puede salir caro.",
    oportunidad: "Los videos que casi nadie ve hasta la mitad gastan plata sin resultado: <b>pausalos o reeditá los primeros segundos</b>.",
    marco: "El VTR es un proxy de <b>relevancia</b>: si la audiencia no llega a la mitad, el mensaje no conectó.",
    formula: "Reproducciones al 50% ÷ Impresiones de video",
    benchmark: "Sin umbral universal: compará contra el p75 de tus piezas del mismo formato y medio.",
    funnel: "consideracion",
    palancas: [
      { accion: "Mejorar el hook de los primeros 3 segundos", modulo: "creatividades" },
      { accion: "Decidir por CPCV y curva de retención", modulo: "lectura-video" },
    ],
  },
  vtr_completo: {
    name: "VTR al 100% (completación)",
    comoLeer: "De cada 100 veces que se mostró o empezó un video, cuántas se vieron completas.",
    mejorPractica: "Depende del formato: en los que <b>no se pueden saltear</b> (bumper) tiene que ser muy alto; en los que se pueden saltear es menor por naturaleza y lo que importa es cuánto cuesta cada video completo.",
    oportunidad: "Un video que no se puede saltear y casi nadie completa es una <b>alerta seria</b>: formato mal configurado, espacios de mala calidad o visitas falsas (tráfico inválido). Pedile a la agencia que lo revise.",
    marco: "Completar el mensaje es lo que construye memoria; por eso la métrica madre del video es el costo por vista completa.",
    formula: "Reproducciones al 100% ÷ Impresiones (o inicios) de video",
    benchmark: "Forzado: ≥ 90%, crítico < 85%. Saltable: comparar contra tu p75 del formato.",
    funnel: "consideracion",
    palancas: [
      { accion: "Revisar configuración de formatos forzados", modulo: "google-demand-gen-youtube" },
      { accion: "Leer la curva de retención", modulo: "lectura-video" },
    ],
  },
  thruplay: {
    name: "ThruPlay (Meta)",
    comoLeer: "Reproducciones de al menos 15 segundos (o completas, si el video dura menos). Es la forma en que Meta mide que alguien miró un video (ThruPlay).",
    mejorPractica: "Mirá qué % de las veces que se mostró terminó en ThruPlay y <b>cuánto cuesta cada uno</b>, comparando videos del mismo tipo.",
    oportunidad: "Los videos con muy pocos ThruPlay están pagando apariciones que nadie mira: reemplazalos por otros que enganchen desde el primer segundo.",
    marco: "En Meta, ThruPlay es la medida más estable de atención de video; los cuartiles pueden venir incompletos.",
    formula: "ThruPlays ÷ Impresiones",
    benchmark: "≥ 15% objetivo · < 8% alerta · < 3% crítico (referencia sobre campañas reales).",
    funnel: "consideracion",
    palancas: [
      { accion: "Rediseñar los primeros segundos", modulo: "creatividades" },
      { accion: "Optimizar la campaña por ThruPlay", modulo: "meta-ads-estructura" },
    ],
  },
  cpcv: {
    name: "CPCV (costo por vista completa)",
    comoLeer: "Cuánto pagaste por cada persona que vio el video completo (CPCV). Es <b>la medida principal del video</b>: traduce atención en plata.",
    mejorPractica: "Comparalo dentro del mismo <b>formato, medio y mes</b>. Ordená los videos de más caro a más barato: los más caros son los primeros para pausar.",
    oportunidad: "Un video que cuesta 3 veces más que el típico de su grupo merece revisión; 8 veces más, pausalo.",
    marco: "Un VTR alto no garantiza eficiencia si el CPM es muy caro: el CPCV integra las dos cosas.",
    formula: "Inversión ÷ Vistas completas",
    benchmark: "Alerta > 3× la mediana del bucket (formato + medio + mes) · crítico > 8×.",
    funnel: "consideracion",
    palancas: [
      { accion: "Reasignar a formatos y medios con mejor CPCV", modulo: "reasignacion-inversion" },
      { accion: "Leer la curva de retención", modulo: "lectura-video" },
    ],
  },
  clicks: {
    name: "Clicks",
    comoLeer: "Veces que alguien hizo clic para ir al destino (la web, la tienda). Miden <b>interés que se convierte en acción</b>, un paso más que ver el aviso.",
    mejorPractica: "Para comparar piezas usá el % de clics (CTR), y seguí el recorrido en Google Analytics hasta ver si esas visitas compran o consultan.",
    oportunidad: "Muchos clics pero pocas ventas = la <b>página de llegada</b> no cumple lo que prometía el aviso.",
    marco: "El click expresa intención: une la exposición con la conversión.",
    funnel: "consideracion",
    palancas: [
      { accion: "Alinear anuncio y landing", modulo: "web-cro" },
      { accion: "Optimizar por visitas a la página de destino", modulo: "meta-ads-estructura" },
    ],
  },
  ctr: {
    name: "CTR",
    comoLeer: "De cada 100 veces que se mostró el aviso, cuántas veces alguien hizo clic (CTR). Mide cuánto moviliza la pieza.",
    mejorPractica: "Comparalo <b>solo dentro del mismo medio</b>: en Google (búsqueda) y en redes se comporta muy distinto. En avisos para que te conozcan, un % de clics bajo es normal.",
    oportunidad: "Si en la misma pieza baja el % de clics mientras cada persona la ve más veces, <b>la gente se cansó de la pieza</b> (fatiga creativa): cambiala.",
    marco: "El CTR mide relevancia del anuncio para quien lo ve; lo que pasa después del click lo mide la conversión.",
    formula: "Clicks ÷ Impresiones",
    benchmark: "Búsqueda ≈ 3-6% · tráfico en redes ≥ 1% (alerta < 0,6%) · awareness 0,1-0,4% normal.",
    funnel: "consideracion",
    palancas: [
      { accion: "Testear hooks y llamados a la acción", modulo: "creatividades" },
      { accion: "Mejorar anuncios adaptables en búsqueda", modulo: "google-search" },
    ],
  },
  cpc: {
    name: "CPC",
    comoLeer: "Cuánto cuesta cada clic (CPC). Mide qué tan barato traés visitas.",
    mejorPractica: "Miralo solo en campañas que buscan visitas o ventas, y junto con lo que hacen esas visitas en Google Analytics: un clic barato de gente que se va enseguida sale caro.",
    oportunidad: "Si el clic cuesta 1,5 veces más que lo normal en ese medio, pedile a la agencia que revise a quién le muestra el aviso, la pieza y, en Google, las palabras de búsqueda (y las que hay que excluir).",
    marco: "El CPC se decide en la subasta: relevancia y calidad del anuncio bajan el costo tanto como la puja.",
    formula: "Inversión ÷ Clicks",
    benchmark: "Alerta > 1,5× la mediana del medio en el mes.",
    funnel: "consideracion",
    palancas: [
      { accion: "Palabras negativas y estructura por tema", modulo: "google-search" },
      { accion: "Reasignar entre medios de tráfico", modulo: "reasignacion-inversion" },
    ],
  },
  cpa: {
    name: "CPA",
    comoLeer: "Cuánto cuesta conseguir cada resultado: una venta, un contacto o la acción definida (CPA).",
    mejorPractica: "Definí un <b>costo máximo por venta</b> según tu margen y lo que vale un cliente, y compará campañas con el mismo objetivo. No sumes ventas de distintas plataformas: cada una se adjudica las suyas.",
    oportunidad: "Si cuesta 1,5 veces más que el promedio, antes de cortar revisá la medición, el público, la oferta y la página de llegada.",
    marco: "El CPA mide la última milla. Si solo optimizás por CPA, a mediano plazo sube porque se agota la demanda que construye la marca.",
    formula: "Inversión ÷ Conversiones",
    benchmark: "Alerta > 1,5× el promedio de la cuenta para ese objetivo.",
    funnel: "conversion",
    palancas: [
      { accion: "Medir bien con píxel y API de Conversiones", modulo: "meta-pixel-capi" },
      { accion: "Corregir el embudo del sitio", modulo: "web-cro" },
      { accion: "Evaluar Performance Max honestamente", modulo: "google-pmax" },
    ],
  },
  roas: {
    name: "ROAS",
    comoLeer: "Cuánto se vendió por cada peso invertido en avisos (ROAS = ventas ÷ inversión).",
    mejorPractica: "Comparalo por campaña y objetivo; en avisos para que te conozcan es normal que sea bajo. Para no perder plata tiene que ser por lo menos <b>1 ÷ margen</b> (con 25% de margen, 4: $4 de venta por cada $1).",
    oportunidad: "Campañas que devuelven mucho con poca plata → <b>dales más, de a poco</b>; las que devuelven poco mes tras mes → revisalas o pausalas.",
    marco: "Mide la eficiencia de la <b>última milla</b>; no captura el valor de marca que habilitó esa venta.",
    formula: "Ingresos atribuidos ÷ Inversión",
    benchmark: "Umbral propio: ROAS de equilibrio ≈ 1 ÷ margen bruto.",
    funnel: "conversion",
    palancas: [
      { accion: "Escalar campañas ganadoras por tramos", modulo: "ciclo-acelerar" },
      { accion: "Separar incremental de capturado", modulo: "medicion-atribucion" },
      { accion: "ROAS y ACOS en Mercado Ads", modulo: "meli-mercado-ads" },
    ],
  },

  // ── Redes ──
  engagement: {
    name: "Engagement rate",
    comoLeer: "De cada 100 personas que ven la publicación, cuántas interactúan (me gusta, comentario, guardado, compartido). Es la tasa de interacción o engagement rate (ER): mide <b>si la gente responde</b>, no el tamaño de la audiencia.",
    mejorPractica: "Leelo como % y <b>por tema y por publicación</b>, no como total del mes. Separá las publicaciones con pauta: su alcance incluye lo pagado.",
    oportunidad: "Un tema donde la gente interactúa más que el promedio y que casi no publicás es una <b>línea de contenido para hacer crecer</b>.",
    marco: "El engagement es una señal de <b>afinidad</b>: el contenido que resuena construye marca sin costo de medios.",
    formula: "Interacciones ÷ Alcance",
    benchmark: "IG, cuentas de marca: ≈ 2-5% sobre alcance (orientativo; compará con tu p75).",
    funnel: "consideracion",
    palancas: [
      { accion: "Ajustar el mix de pilares", modulo: "contenido-organico" },
      { accion: "Priorizar guardados y compartidos", modulo: "lectura-redes" },
    ],
  },
  guardados: {
    name: "Guardados",
    comoLeer: "Veces que alguien guardó la publicación para volver a verla. Señal de <b>utilidad</b>.",
    mejorPractica: "Leelos sobre alcance y por formato: los carruseles de utilidad (guías, comparativas, pasos) suelen liderar.",
    oportunidad: "Los temas con más guardados son candidatos a contenido que no pasa de moda, a páginas para aparecer en Google (SEO) y a avisos para gente que está evaluando comprar.",
    marco: "Un guardado vale más que un like: indica intención de volver, típica de la etapa de consideración.",
    formula: "Guardados ÷ Alcance",
    funnel: "consideracion",
    palancas: [{ accion: "Más contenido de utilidad en carrusel", modulo: "contenido-organico" }],
  },
  compartidos: {
    name: "Compartidos",
    comoLeer: "Veces que la publicación se envió o reposteó. Alguien consideró que vale para otra persona.",
    mejorPractica: "Es de las señales que más pesan para que la plataforma muestre el contenido a no seguidores: leelo sobre alcance.",
    oportunidad: "Piezas con muchos compartidos son las mejores candidatas a pautar (ya probaron que la gente las pasa).",
    marco: "Compartir es recomendación: la forma más creíble de alcance.",
    formula: "Compartidos ÷ Alcance",
    funnel: "awareness",
    palancas: [
      { accion: "Pautar las piezas más compartidas", modulo: "creatividades" },
      { accion: "Leer interacciones de valor", modulo: "lectura-redes" },
    ],
  },
  comentarios: {
    name: "Comentarios",
    comoLeer: "Conversación que genera la pieza. Su valor depende de <b>qué dicen</b>, no de cuántos son.",
    mejorPractica: "Clasificalos: preguntas de compra ('¿dónde lo consigo?'), consultas de servicio, elogios, quejas. Cada tipo pide una acción distinta.",
    oportunidad: "Muchas preguntas de precio o de dónde comprar = gente con ganas de comprar: respondé rápido y considerá avisos de venta para ese público.",
    marco: "Los comentarios son la voz directa del consumidor dentro de tus canales.",
    funnel: "consideracion",
    palancas: [{ accion: "Clasificar por tema y sentimiento", modulo: "lectura-redes" }],
  },
  sentimiento: {
    name: "Sentimiento",
    comoLeer: "Proporción de comentarios positivos, neutros y negativos. Es la <b>señal cualitativa</b> de redes.",
    mejorPractica: "Leé los negativos <b>por tema</b> (servicio técnico, precio, calidad, entregas) y pasalos al área que corresponde. No juzgues una publicación como negativa por pocos comentarios si la gente la mira entera y la guarda.",
    oportunidad: "Un aumento transversal del negativo anticipa problemas de percepción antes de que lleguen a las ventas.",
    marco: "Alimenta Intención y Poder de marca: la afinidad se construye (o se pierde) en la conversación.",
    formula: "Comentarios negativos ÷ comentarios clasificados",
    funnel: "fidelizacion",
    palancas: [
      { accion: "Gestionar temas de servicio con el área dueña", modulo: "lectura-redes" },
      { accion: "Seguirlo en la brújula de marca", modulo: "salud-de-marca" },
    ],
  },
  seguidores: {
    name: "Seguidores",
    comoLeer: "Tamaño de la comunidad. Es un stock: vale si interactúa.",
    mejorPractica: "Mirá <b>cuántos se suman netos</b> por mes y si interactúan (engagement), no el número total.",
    oportunidad: "Un salto de seguidores después de una pieza indica qué contenido construye comunidad: replicalo.",
    marco: "Los seguidores son medios propios: reducen la dependencia de la pauta para llegar a tu audiencia.",
    funnel: "fidelizacion",
    palancas: [{ accion: "Replicar el contenido que suma comunidad", modulo: "contenido-organico" }],
  },
  sov: {
    name: "Share of Voice",
    comoLeer: "Qué parte de la presencia publicitaria o de la conversación del rubro es tuya (inversión, apariciones, interacciones o menciones, según la fuente): share of voice.",
    mejorPractica: "Comparalo con tu parte de las ventas: con más voz que ventas (<b>ESOV positivo</b>) la marca tiende a crecer; con menos, a achicarse.",
    oportunidad: "Un competidor que sube fuerte su share of voice está invirtiendo para crecer: decidí si defendés o te diferenciás.",
    marco: "Referencia IPA/Nielsen: cada 10 puntos de ESOV se asocian a ~0,5 puntos de crecimiento de share por año (orientativo).",
    formula: "Tu presencia ÷ presencia total del set competitivo",
    benchmark: "ESOV = SOV − share de mercado. Positivo → crecimiento probable.",
    funnel: "awareness",
    palancas: [
      { accion: "Leer a la competencia con datos públicos", modulo: "investigacion-competencia" },
      { accion: "Decidir el presupuesto con el ESOV", modulo: "presupuesto-marketing" },
    ],
  },

  // ── Web / Ecommerce ──
  trafico: {
    name: "Tráfico web",
    comoLeer: "Personas que entraron a la web en el período (usuarios). Es el <b>volumen</b> de la parte de arriba del recorrido digital.",
    mejorPractica: "Separalo por <b>de dónde llegan</b> (Google sin pagar, avisos, redes, mail, directo): cada vía trae gente con distinto interés.",
    oportunidad: "Una vía que trae cada vez más gente que no compra ni consulta pide revisar esa entrada: la página de llegada y si dice lo mismo que el aviso.",
    marco: "El tráfico es condición necesaria pero no suficiente: sin conversión es costo sin retorno.",
    funnel: "consideracion",
    palancas: [
      { accion: "UTMs consistentes para leer por fuente", modulo: "utm-nomenclatura" },
      { accion: "Mejorar la conversión del tráfico existente", modulo: "web-cro" },
    ],
  },
  sesiones: {
    name: "Sesiones",
    comoLeer: "Visitas a la web (una persona puede hacer varias visitas). Es la base del % de visitas que terminan en compra (tasa de conversión).",
    mejorPractica: "Mirá las <b>visitas con interacción</b> (más de 10 segundos, 2 o más páginas o una acción de negocio): separan las visitas reales de las que se van enseguida (rebote).",
    oportunidad: "Si las visitas crecen mucho más que las personas, la gente vuelve: buen momento para mails a clientes y recompra (CRM).",
    marco: "Ingresos = sesiones × conversión × ticket: las sesiones son la primera de tres palancas.",
    formula: "Visitas al sitio (GA4)",
    funnel: "consideracion",
    palancas: [{ accion: "Separar volumen de calidad del tráfico", modulo: "web-cro" }],
  },
  usuarios_nuevos: {
    name: "Usuarios nuevos",
    comoLeer: "Personas que entran a la web por primera vez en el período (según Google Analytics).",
    mejorPractica: "Leelo por fuente: te dice qué canales <b>traen gente nueva</b> y cuáles reciclan a los mismos visitantes.",
    oportunidad: "Si sube la inversión en avisos para que te conozcan pero no llegan personas nuevas a la web, la pieza no genera visitas (o los links no están marcados con etiquetas UTM y esas visitas no se ven).",
    marco: "El crecimiento viene de sumar compradores; en digital, eso empieza por sumar visitantes nuevos calificados.",
    funnel: "awareness",
    palancas: [{ accion: "Revisar el rol de cada canal", modulo: "funnel-360" }],
  },
  rebote: {
    name: "Tasa de rebote",
    comoLeer: "En Google Analytics, % de visitas <b>sin interacción</b>: menos de 10 segundos, una sola página y ninguna acción. Es lo contrario de la tasa de interacción.",
    mejorPractica: "Leelo por canal y por página de llegada: si una campaña tiene mucho rebote, la página no cumple lo que prometía el aviso.",
    oportunidad: "Las páginas de llegada de los avisos con mucho más rebote que el resto de la web son la mejora más rápida para vender más (optimización de conversión o CRO).",
    marco: "El rebote mide la primera impresión del sitio: es la puerta de todo el embudo de conversión.",
    formula: "1 − (sesiones con interacción ÷ sesiones)",
    benchmark: "Tasa de interacción ≈ 50-70% (rebote 30-50%), orientativo por tipo de sitio.",
    funnel: "consideracion",
    palancas: [
      { accion: "Alinear anuncio y landing", modulo: "web-cro" },
      { accion: "Velocidad de carga mobile", modulo: "search-console" },
    ],
  },
  paginas_sesion: {
    name: "Páginas por sesión",
    comoLeer: "Cuántas páginas mira, en promedio, cada visita. Da una idea de cuánto explora la gente.",
    mejorPractica: "No siempre más es mejor: en un ecommerce eficiente, alguien que encuentra rápido lo que busca ve pocas páginas y compra.",
    oportunidad: "Muchas páginas por sesión sin conversión puede indicar navegación confusa o falta de información en la ficha de producto.",
    marco: "Se lee junto con conversión y duración, nunca solo.",
    formula: "Vistas de página ÷ Sesiones",
    funnel: "consideracion",
    palancas: [{ accion: "Diagnosticar el embudo por etapas", modulo: "web-cro" }],
  },
  frecuencia_sesion: {
    name: "Duración media de sesión",
    comoLeer: "Cuánto tiempo se queda, en promedio, cada visita. Da una idea del <b>interés</b> de la gente que llega.",
    mejorPractica: "Leela por canal: visitas cortas y que se van enseguida (rebote alto) indican que la página no cumple lo que prometía el canal.",
    oportunidad: "Las fuentes con sesiones largas traen mejor audiencia: priorizalas en la asignación.",
    marco: "El tiempo es atención, el recurso escaso que el sitio tiene que ganarse.",
    formula: "Tiempo de interacción ÷ Sesiones",
    funnel: "consideracion",
    palancas: [
      { accion: "Priorizar las fuentes de mejor calidad", modulo: "reasignacion-inversion" },
      { accion: "Mejorar contenido de landings", modulo: "web-cro" },
    ],
  },
  conversion: {
    name: "Tasa de conversión",
    comoLeer: "% de visitas que terminan en compra (o en una acción de negocio, si no hay tienda online): tasa de conversión. Mide <b>qué tan bien convierte la web</b>, no el volumen.",
    mejorPractica: "Separala por canal, dispositivo (celular o computadora) y categoría: el promedio esconde dónde se traba la gente.",
    oportunidad: "Un canal que trae muchas visitas pero convierte poco suele ser la mayor mejora posible: revisá la página de llegada y que diga lo mismo que el aviso.",
    marco: "La conversión es el multiplicador del embudo: subirla un punto rinde más que sumar tráfico.",
    formula: "Transacciones (o eventos clave) ÷ Sesiones",
    benchmark: "Ecommerce ≈ 0,5-3% según categoría y ticket (orientativo; compará con tu historia).",
    funnel: "conversion",
    palancas: [
      { accion: "Atacar la etapa cuello del embudo", modulo: "web-cro" },
      { accion: "Configurar bien los eventos clave", modulo: "ga4-configuracion" },
      { accion: "Recuperar carritos con CRM", modulo: "crm-email" },
    ],
  },
  transacciones: {
    name: "Transacciones",
    comoLeer: "Compras concretadas en el sitio. Es el <b>resultado</b> del ecommerce.",
    mejorPractica: "Separalas por canal para saber qué canal <b>vende</b>, no solo cuál trae visitas.",
    oportunidad: "Si suben las visitas y no las compras, el freno está en que la gente compre (conversión), no en traer más gente.",
    marco: "Traduce marketing a negocio: todo el embudo existe para mover este número.",
    funnel: "conversion",
    palancas: [
      { accion: "Mejorar el checkout", modulo: "web-cro" },
      { accion: "Planificar los eventos comerciales", modulo: "campanas-estacionales" },
    ],
  },
  ingresos: {
    name: "Ingresos",
    comoLeer: "Facturación del canal digital. Resultado expresado en valor.",
    mejorPractica: "Leelos junto al <b>valor promedio de cada compra</b> (ticket): más ventas en pesos pueden venir de más compras o de compras más grandes.",
    oportunidad: "Ventas en pesos estables con más compras = cada compra es más chica: revisá qué productos se venden y los descuentos.",
    marco: "Ingresos = Transacciones × Ticket promedio: dos palancas, no una.",
    formula: "Σ valor de las compras (GA4)",
    funnel: "conversion",
    palancas: [
      { accion: "Subir conversión y ticket", modulo: "web-cro" },
      { accion: "Contrastar con la inversión (ROAS)", modulo: "medicion-atribucion" },
    ],
  },
  aov: {
    name: "Valor medio de compra",
    comoLeer: "Cuánto gasta en promedio cada compra (ticket promedio = ventas ÷ compras).",
    mejorPractica: "Seguilo por categoría y por fuente; los eventos de descuento suelen bajarlo y subir el volumen.",
    oportunidad: "Productos complementarios, combos, envío gratis desde un monto y cuotas bien comunicadas suben el ticket sin más tráfico.",
    marco: "Es la tercera palanca de ingresos junto con tráfico y conversión, y la más olvidada.",
    formula: "Ingresos ÷ Transacciones",
    funnel: "conversion",
    palancas: [
      { accion: "Venta cruzada en ficha y checkout", modulo: "web-cro" },
      { accion: "Recompra y post-venta", modulo: "crm-email" },
    ],
  },

  // ── Trade ──
  floor_share: {
    name: "Floor Share",
    comoLeer: "Qué parte de los equipos exhibidos en el local son de tu marca (espacio en góndola o Floor Share).",
    mejorPractica: "Comparalo con tu <b>parte de las ventas</b> en esa tienda o cadena: si no coinciden, hay que negociar exhibición o reponer.",
    oportunidad: "Tiendas que venden mucho pero donde tenés poco espacio en góndola son <b>oportunidad inmediata</b> de exhibición.",
    marco: "La góndola es el último momento de decisión: la presencia física es disponibilidad mental en el punto de compra.",
    formula: "Espacio de tu marca ÷ espacio total de la categoría",
    benchmark: "Regla del share justo: floor share ≥ share de ventas en esa tienda.",
    funnel: "conversion",
    palancas: [{ accion: "Negociar donde hay más venta y menos presencia", modulo: "trade-marketing" }],
  },
  cb: {
    name: "Cuadro Básico",
    comoLeer: "Si en cada tienda están los modelos que acordaste que tienen que estar exhibidos (surtido obligatorio o Cuadro Básico).",
    mejorPractica: "Cada modelo que falta es una venta perdida que no se ve: priorizá que estén los modelos principales y los que más se venden.",
    oportunidad: "Las tiendas donde faltan seguido los modelos que más se venden son el foco de reposición.",
    marco: "No se vende lo que no está: la distribución es la base de todo el sistema.",
    formula: "SKUs del cuadro básico presentes ÷ SKUs exigidos",
    funnel: "conversion",
    palancas: [{ accion: "Reponer primero lo de alta rotación", modulo: "trade-marketing" }],
  },

  // ── Marca ──
  tom: {
    name: "TOM (Top of Mind)",
    comoLeer: "% de personas que nombra tu marca <b>primero</b>, sin ayuda, cuando piensa en el producto (Top of Mind o TOM).",
    mejorPractica: "Entre una medición de Kantar y la siguiente, seguilo con señales que se miden todos los meses: cuánto te buscan en Google (share of search), a cuánta gente llegás con avisos, búsquedas de la marca.",
    oportunidad: "Si varios meses seguidos te buscan menos en Google, probablemente también baje el Top of Mind: corregí antes de la próxima medición.",
    marco: "Saliencia pura: ser la primera marca que viene a la cabeza en el momento de compra.",
    funnel: "awareness",
    palancas: [
      { accion: "Alcance y frecuencia efectiva", modulo: "alcance-frecuencia" },
      { accion: "Activos distintivos en cada pieza", modulo: "creatividades" },
      { accion: "Brújula entre olas", modulo: "salud-de-marca" },
    ],
  },
  som: {
    name: "SOM (Share of Mind)",
    comoLeer: "Qué parte de todas las marcas que la gente nombra sin ayuda es la tuya (Share of Mind o SOM).",
    mejorPractica: "Leelo contra el Top of Mind: mucho Share of Mind y poco Top of Mind = te conocen pero no sos la primera opción.",
    oportunidad: "Si crece más que el de la competencia, anticipa que más gente te va a considerar al comprar.",
    marco: "Mide cuánto espacio mental ocupás en la categoría, no solo si liderás.",
    funnel: "awareness",
    palancas: [
      { accion: "Share of voice vs share de mercado", modulo: "investigacion-competencia" },
      { accion: "Brújula entre olas", modulo: "salud-de-marca" },
    ],
  },
  intencion: {
    name: "Intención de compra",
    comoLeer: "% de personas que piensa comprar tu marca la próxima vez que compre el producto (intención de compra).",
    mejorPractica: "Entre mediciones, seguila con señales que se ven todos los meses: qué dicen los comentarios, búsquedas con intención de compra, precio contra la competencia y espacio en góndola.",
    oportunidad: "Muchas ganas de comprar pero pocas ventas = la venta se pierde en el local (no hay stock, está caro o mal exhibido).",
    marco: "Es el puente entre la mente y la góndola.",
    funnel: "consideracion",
    palancas: [
      { accion: "Contenido de consideración e influencers", modulo: "influencers-ugc" },
      { accion: "Disponibilidad en el punto de venta", modulo: "trade-marketing" },
    ],
  },
  poder_marca: {
    name: "Poder de marca",
    comoLeer: "Índice que resume cuánto significa la marca para la gente, cuánto se diferencia y cuánto se la tiene presente (Poder de Marca). Anticipa si podés cobrar más caro y si vas a ganar ventas.",
    mejorPractica: "Es lo más difícil de anticipar entre mediciones: tomalo con cuidado y apoyate en lo que dicen los comentarios y en qué tan distinta se ve la marca.",
    oportunidad: "Sostener un precio premium sin perder share es la mejor evidencia viva de poder de marca.",
    marco: "Se construye en años y se pierde rápido si la marca compite solo por precio.",
    funnel: "fidelizacion",
    palancas: [
      { accion: "Balance marca / activación", modulo: "presupuesto-marketing" },
      { accion: "Posicionamiento y diferenciación", modulo: "salud-de-marca" },
    ],
  },

  // ── Negocio ──
  inv_facturacion: {
    name: "Inversión / Facturación",
    comoLeer: "Proporción de la facturación que se invierte en marketing.",
    mejorPractica: "No hay un número universal: seguí tu serie y compará con la categoría. Leelo junto al share.",
    oportunidad: "Si sube el % mientras tu parte de las ventas se mantiene o baja = la inversión rinde menos: revisá la mezcla de medios y cuánto cuesta cada resultado.",
    marco: "Mantiene el esfuerzo en proporción al resultado: crecer en volumen no debería costar rentabilidad.",
    formula: "Inversión de marketing ÷ Facturación",
    funnel: "transversal",
    palancas: [{ accion: "Gobernar el presupuesto", modulo: "presupuesto-marketing" }],
  },
  ejecucion_presupuesto: {
    name: "Ejecución del presupuesto",
    comoLeer: "Diferencia entre lo que se gastó y lo que estaba presupuestado en el período.",
    mejorPractica: "Un desvío relevante se decide: <b>se corrige la ejecución o se recalibra el plan</b>. No es solo control contable.",
    oportunidad: "Si en un medio se gasta sistemáticamente menos de lo planeado, suele ser que las campañas no encuentran suficiente público, pagan poco por aparecer (puja) o tienen avisos sin aprobar.",
    marco: "Señala dónde la ejecución se aparta de la estrategia definida.",
    formula: "(Real − Presupuesto) ÷ Presupuesto",
    benchmark: "±5% mensual tolerable; sub-ejecución < 70% del plan en mes cerrado requiere decisión.",
    funnel: "transversal",
    palancas: [
      { accion: "Controlar ritmo de gasto", modulo: "benchmarks-medios" },
      { accion: "Reasignar lo que no se ejecuta", modulo: "reasignacion-inversion" },
    ],
  },
  share_mercado: {
    name: "Share de mercado",
    comoLeer: "Qué parte de las ventas del rubro es tuya (en pesos o en unidades): share de mercado.",
    mejorPractica: "Leelo siempre junto a la facturación: vender más mientras perdés participación es una alerta que el número total esconde.",
    oportunidad: "Si ganás participación en un rango de precio y perdés en otro, ahí está dónde poner el foco.",
    marco: "El crecimiento sano viene sobre todo de ganar penetración (más compradores), no de exprimir a los actuales.",
    formula: "Tus ventas ÷ ventas de la categoría",
    funnel: "transversal",
    palancas: [
      { accion: "Share of Search como indicador adelantado", modulo: "seo-share-of-search" },
      { accion: "Cerrar el trimestre contra el negocio", modulo: "ciclo-acelerar" },
    ],
  },

  // ── Drean: mercado GfK, salud de marca consolidada y UGC cualitativo ──
  share_valor: {
    name: "Share de mercado en valor",
    comoLeer: "Qué parte de <b>la plata que se vende</b> en el rubro es de Drean (pesos vendidos por Drean ÷ pesos vendidos por todas las marcas), según GfK: share en valor.",
    mejorPractica: "Leelo junto a la participación <b>en unidades</b> y al <b>índice de precio</b>: si en pesos crece más que en unidades, estás vendiendo más caro o modelos de mayor valor.",
    oportunidad: "Un rango de precio donde bajás en pesos pero te mantenés en unidades indica que estás bajando precios o vendiendo modelos más baratos: revisá promociones y modelos.",
    marco: "Es la medida de share que mejor refleja el negocio: incluye volumen y precio.",
    formula: "Ventas en $ de la marca ÷ ventas en $ de la categoría",
    benchmark: "Sin umbral fijo: la vara es tu propia serie (MAT) y la de los competidores directos.",
    funnel: "transversal",
    palancas: [
      { accion: "Share of Search como indicador adelantado", modulo: "seo-share-of-search" },
      { accion: "Leer el mercado y la competencia", modulo: "investigacion-competencia" },
    ],
  },
  share_unidades: {
    name: "Share de mercado en unidades",
    comoLeer: "Qué parte de <b>los equipos</b> vendidos en el rubro son de Drean, según GfK: share en unidades.",
    mejorPractica: "Comparalo con la participación en pesos: ganar unidades perdiendo pesos es crecer bajando precio (y resignando margen).",
    oportunidad: "Si crecés en unidades en el rango de precio bajo (Low) con pesos estables, puede ser una decisión de volumen; si pasa en el rango alto (High), estás perdiendo posicionamiento.",
    marco: "El crecimiento sano viene de ganar compradores (penetración), no solo de vender más barato.",
    formula: "Unidades de la marca ÷ unidades de la categoría",
    funnel: "transversal",
    palancas: [
      { accion: "Disponibilidad y exhibición en el punto de venta", modulo: "trade-marketing" },
      { accion: "Ganar la góndola digital de Mercado Libre", modulo: "mercado-libre-para-marcas" },
      { accion: "Cerrar el trimestre contra el negocio", modulo: "ciclo-acelerar" },
    ],
  },
  indice_precio: {
    name: "Índice de precio",
    comoLeer: "Qué tan caro está Drean contra el promedio del rubro (100 = igual que el mercado; más de 100 = más caro).",
    mejorPractica: "Leelo con tu participación en las ventas: mantener un índice mayor a 100 sin perder ventas es la mejor prueba de <b>fuerza de marca</b>.",
    oportunidad: "Si el índice baja y las ventas se mantienen = la marca está comprando volumen con precio: revisá la estrategia de promociones.",
    marco: "El precio relativo es la traducción comercial del equity: las marcas fuertes cobran más sin perder compradores.",
    formula: "Precio promedio de la marca ÷ precio promedio de la categoría × 100",
    funnel: "transversal",
    palancas: [
      { accion: "Posicionamiento y diferenciación", modulo: "salud-de-marca" },
      { accion: "Balance marca / activación", modulo: "presupuesto-marketing" },
      { accion: "Precio, cuotas y promociones en Mercado Libre", modulo: "meli-precio-promociones" },
    ],
  },
  salud_marca: {
    name: "Salud de Marca (puntaje consolidado)",
    comoLeer: "Puntaje que resume los cuatro objetivos de marca que mide Kantar: que piensen primero en Drean (TOM), que la recuerden (SOM), que tengan ganas de comprarla (Intención) y su fuerza frente a otras (Poder), ponderados por categoría.",
    mejorPractica: "No lo leas solo: abrí cuál de los cuatro lo mueve y en qué categoría. Entre mediciones, seguí las señales que se ven todos los meses (búsquedas en Google, gente alcanzada, interacción en redes, espacio en góndola).",
    oportunidad: "Si los indicadores del Mapa se cumplen y el puntaje no se mueve, los pesos del modelo no están bien puestos: ajustalos al cierre del trimestre.",
    marco: "Es el resultado del Mapa Estratégico: si los KPIs cumplen su meta según su peso, se cumplen los objetivos de marca.",
    funnel: "transversal",
    palancas: [
      { accion: "Recalibrar pesos y metas", modulo: "ciclo-acelerar" },
      { accion: "El modelo objetivos → KPIs → pesos", modulo: "modelo-objetivos-kpis" },
    ],
  },
  ugc_credibilidad: {
    name: "Credibilidad (UGC)",
    comoLeer: "Cuánto le cree la gente a la pieza del creador de contenido (UGC): se evalúa con los comentarios y se ajusta con lo que la gente hizo de verdad en la pauta (guardados, compartidos, % que vio el video) contra el promedio de las piezas UGC.",
    mejorPractica: "Comparala entre piezas del mismo formato. La credibilidad es el activo propio del UGC: si una pieza parece aviso, pierde lo que la justifica.",
    oportunidad: "Los creadores con credibilidad alta sostenida son candidatos a contenido recurrente y a que la marca pautee desde su cuenta (whitelisting).",
    marco: "El UGC funciona porque es la voz de un par, no la de la marca.",
    funnel: "consideracion",
    palancas: [
      { accion: "Elegir y briefear creadores", modulo: "influencers-ugc" },
      { accion: "Creatividad nativa del formato", modulo: "creatividades" },
    ],
  },
  ugc_intencion: {
    name: "Intención generada (UGC)",
    comoLeer: "Señales de intención de compra en la conversación de la pieza (preguntas por precio, dónde comprar, modelo), calibradas con guardados y compartidos.",
    mejorPractica: "Es la variable más cercana al objetivo de Intención de compra del Mapa: priorizá las piezas y creadores que la generan.",
    oportunidad: "Piezas que generan ganas de comprar y reciben poca plata → dales más presupuesto; si generan ganas pero pocas visitas → revisá el link y la página de llegada.",
    marco: "El UGC mueve consideración: su valor está en acercar a la compra a quien todavía no decidió.",
    funnel: "consideracion",
    palancas: [
      { accion: "Contenido de consideración e influencers", modulo: "influencers-ugc" },
      { accion: "Corregir el embudo del sitio", modulo: "web-cro" },
    ],
  },
  ugc_percepcion: {
    name: "Percepción (UGC)",
    comoLeer: "Cómo queda la marca en la conversación de la pieza (positiva, neutra o negativa). No se marca negativa por pocos comentarios si la gente la guarda, la comparte y mira el video más que el promedio.",
    mejorPractica: "Leela junto a cuánta conversación hay: pocos comentarios no son rechazo. Una imagen negativa con poca respuesta de la gente sí es señal para sacar la pieza.",
    oportunidad: "Temas de producto que se repiten en comentarios negativos son insumo para el equipo de producto y para el próximo brief.",
    marco: "La percepción es la señal temprana de Poder de marca en el contenido de terceros.",
    funnel: "consideracion",
    palancas: [
      { accion: "Leer sentimiento y conversación", modulo: "lectura-redes" },
      { accion: "El brief de campaña", modulo: "brief-campana" },
    ],
  },
};

// Base de KPIs + guías de las funcionalidades nuevas (lib/knowledge-funciones.ts).
export const KPI_KNOW: Record<string, KpiKnow> = { ...KPI_BASE, ...FUNC_KNOW };

// ── Resolución título → clave (exacta por alias normalizado) ────────────────
// canon: minúsculas, sin tildes, "≥" → ">=", todo lo que no sea [a-z0-9%>=] → espacio.
function canon(s: string): string {
  return norm(s.replace(/≥/g, ">=")).replace(/[^a-z0-9%>=]+/g, " ").trim();
}

const ALIASES: Record<string, string[]> = {
  sos: ["share of search", "sos"],
  indice: ["indice de posicion", "indice de posicion seo", "keywords faltantes", "keywords debiles", "keywords fuertes"],
  busquedas: ["busquedas de marca", "busquedas de marca mes", "busquedas propias mes", "busquedas mes"],
  demanda: ["demanda generica", "demanda total", "demanda total marcas"],
  inversion: ["inversion", "inversion pauta", "inversion en medios", "gasto"],
  alcance: ["alcance", "alcance unico", "alcance organico", "reach"],
  frecuencia: ["frecuencia"],
  impresiones: ["impresiones"],
  cpm: ["cpm", "costo por mil"],
  grps: ["grps", "grp", "trps", "trp", "puntos de rating"],
  cpp: ["costo por grp", "costo grp", "cpp", "cpr", "costo por punto de rating"],
  contactos: ["contactos", "contactos offline", "impactos", "cpm contactos", "cpm de contactos"],
  vtr: ["vtr", "vtr >=50%", "vtr 50%", "vieron >=50%"],
  vtr_completo: ["vtr 100%", "vtr real 100%", "vtr al 100%", "completacion", "vistas completas"],
  thruplay: ["thruplay", "thruplays", "tasa de thruplay", "costo por thruplay"],
  cpcv: ["cpcv", "costo por vista completa"],
  clicks: ["clicks", "clics", "click", "clic"],
  ctr: ["ctr"],
  cpc: ["cpc", "costo por click", "costo por clic"],
  cpa: ["cpa", "cpa cac", "cac", "costo por adquisicion", "costo por conversion", "costo por lead"],
  roas: ["roas", "roas ecommerce", "retorno de la inversion publicitaria"],
  engagement: ["engagement", "engagement rate", "tasa de engagement", "interacciones"],
  guardados: ["guardados"],
  compartidos: ["compartidos", "envios"],
  comentarios: ["comentarios"],
  sentimiento: ["sentimiento", "sentimiento de comentarios"],
  seguidores: ["seguidores"],
  sov: ["share of voice", "sov", "share of engagement"],
  trafico: ["trafico", "trafico web", "usuarios"],
  sesiones: ["sesiones", "sesiones con interaccion"],
  usuarios_nuevos: ["usuarios nuevos", "nuevos usuarios"],
  rebote: ["rebote", "tasa de rebote", "bounce rate", "tasa de interaccion"],
  paginas_sesion: ["paginas por sesion", "paginas sesion", "vistas por sesion"],
  frecuencia_sesion: ["duracion media de sesion", "duracion de sesion", "duracion sesion", "duracion", "tiempo en sitio", "avg session"],
  conversion: ["tasa de conversion", "conversion", "tasa de conversion eventos clave", "cr"],
  transacciones: ["transacciones", "compras"],
  ingresos: ["ingresos", "ingresos ecommerce", "revenue"],
  aov: ["valor medio de compra", "ticket promedio", "aov"],
  floor_share: ["floor share", "fs", "share de exhibicion", "share de gondola", "floor share lavado", "floor share refrigeracion", "floor share coccion"],
  cb: ["cuadro basico", "cuadros basicos", "cumplimiento cb", "cumplimiento de cuadro basico", "% cb", "cb", "surtido", "infaltables", "estrategicos"],
  tom: ["tom", "top of mind"],
  som: ["som", "share of mind"],
  intencion: ["intencion de compra", "intencion"],
  poder_marca: ["poder de marca", "poder"],
  inv_facturacion: ["inversion facturacion", "inversion sobre facturacion"],
  ejecucion_presupuesto: ["ejecucion del presupuesto", "real vs presupuesto", "desvio de presupuesto"],
  share_mercado: ["share de mercado", "share", "market share"],
  share_valor: ["value share", "share valor", "share en valor", "share de mercado valor", "participacion en valor"],
  share_unidades: ["unit share", "share unidades", "share en unidades", "share de mercado unidades", "participacion en unidades"],
  indice_precio: ["indice de precio", "indice precio", "price index", "precio relativo"],
  salud_marca: ["salud de marca", "puntaje sm", "sm", "indice de salud de marca"],
  ugc_credibilidad: ["credibilidad", "credibilidad ugc"],
  ugc_intencion: ["intencion ugc", "intencion de compra ugc", "intencion generada"],
  ugc_percepcion: ["percepcion", "percepcion ugc", "percepcion de marca ugc"],
};

const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, list] of [...Object.entries(ALIASES), ...Object.entries(FUNC_ALIASES)]) for (const a of list) m.set(canon(a), key);
  return m;
})();

// Patrones ANCLADOS para títulos que traen marca o sufijos variables (no substrings sueltos).
const PATTERNS: [RegExp, string][] = [
  [/^share of search( |$)/, "sos"],
  [/^indice de posicion( |$)/, "indice"],
  [/^busquedas .*mes$/, "busquedas"],
  [/^tasa de conversion( |$)/, "conversion"],
  [/^vtr (real )?(al )?100%/, "vtr_completo"],
  [/^vtr (>=)?50%/, "vtr"],
  [/^engagement rate( |$)/, "engagement"],
  [/^alcance (unico|organico)( |$)/, "alcance"],
  [/^floor share( |$)/, "floor_share"],
  [/^(value share|share valor)( |$)/, "share_valor"],
  [/^(unit share|share unidades)( |$)/, "share_unidades"],
];

/** Resuelve el título de una card a su guía de KPI. Nombre y firma estables (usado por LearnButton). */
export function kpiKnowFor(title: string | undefined | null): { key: string; know: KpiKnow } | null {
  if (!title) return null;
  // Candidatos: título completo y el tramo antes de " · " (ej. "Share of Search · Marca").
  const cands = [title, title.split("·")[0] ?? ""].map(canon).filter(Boolean);
  for (const c of cands) {
    const key = ALIAS_INDEX.get(c);
    if (key && KPI_KNOW[key]) return { key, know: KPI_KNOW[key] };
  }
  for (const c of cands) {
    for (const [re, key] of PATTERNS) if (re.test(c) && KPI_KNOW[key]) return { key, know: KPI_KNOW[key] };
  }
  // Respaldo: catálogo de métricas único (lib/metricas, nombres exactos del Seguimiento + sinónimos).
  const m = metricaPorNombre(title);
  if (m?.know && KPI_KNOW[m.know]) return { key: m.know, know: KPI_KNOW[m.know]! };
  return null;
}

export const LAYER_LABEL: Record<string, string> = { comoLeer: "Cómo leer", mejorPractica: "Mejor práctica", oportunidad: "Oportunidad", marco: "Marco" };
