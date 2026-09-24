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
    modulos: ["plan-de-medios", "benchmarks-medios", "alcance-frecuencia", "reasignacion-inversion", "medios-offline", "meta-ads-estructura"],
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
    modulos: ["ciclo-acelerar", "investigacion-competencia", "salud-de-marca"],
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
export const KPI_KNOW: Record<string, KpiKnow> = {
  // ── Demanda y búsqueda ──
  sos: {
    name: "Share of Search",
    comoLeer: "Participación de tu marca en las búsquedas de su categoría (tus búsquedas ÷ búsquedas de todas las marcas del set). Es un <b>indicador adelantado del share de mercado</b>: la búsqueda antecede a la compra.",
    mejorPractica: "Contrastalo con tu <b>share de mercado real</b>: si el Share of Search es mayor, hay demanda que todavía no capturás; si es menor, tu share está en riesgo. Seguilo todos los meses frente a 3-5 competidores fijos.",
    oportunidad: "Si un competidor <b>acelera su demanda de búsqueda</b> varios meses seguidos y vos te quedás estable, es una alerta temprana: reforzá consideración y las keywords donde cedés terreno.",
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
    comoLeer: "Posición promedio en Google ponderada por volumen de búsqueda, sobre el universo de keywords de la categoría. <b>Menor es mejor</b> (3,4 ≈ posición media entre 3.º y 4.º).",
    mejorPractica: "No te quedes con el promedio: separá keywords <b>fuertes</b> (top 3, a defender), <b>débiles</b> (posición 8-20, mejora rápida) y <b>faltantes</b> (no aparecés).",
    oportunidad: "Las keywords <b>débiles de alto volumen</b> son el mayor retorno: una mejora de contenido puede pasarlas de segunda a primera página.",
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
    mejorPractica: "Leelo junto a la demanda genérica: si la categoría crece y tu marca no, perdés participación en un mercado que se expande.",
    oportunidad: "Un pico estacional (Hot Sale, CyberMonday) es la ventana para capturar intención: subí presencia <b>antes</b> del pico, no durante.",
    marco: "La búsqueda de marca es el <b>eco de la inversión en awareness</b>: si crece después de una campaña, la campaña construyó marca.",
    funnel: "awareness",
    palancas: [
      { accion: "Anticipar la presión a los eventos comerciales", modulo: "campanas-estacionales" },
      { accion: "Proteger la marca en búsqueda paga", modulo: "google-search" },
    ],
  },
  demanda: {
    name: "Demanda genérica",
    comoLeer: "Búsquedas del término de categoría sin marca (por ejemplo, 'lavarropas'). Es el <b>tamaño total de la intención</b> del mercado.",
    mejorPractica: "Usala como denominador: te dice el techo disponible y si el mercado crece o se achica.",
    oportunidad: "Mucha demanda genérica con bajo share propio = <b>mercado grande con poca participación</b>: hay recorrido vía awareness y SEO de categoría.",
    marco: "Marca el momento del ciclo: una demanda en expansión favorece invertir en captura.",
    funnel: "consideracion",
    palancas: [{ accion: "Ganar posiciones en keywords de categoría", modulo: "seo-share-of-search" }],
  },

  // ── Medios pagos ──
  inversion: {
    name: "Inversión",
    comoLeer: "Monto invertido en pauta en el período. Solo tiene sentido leída <b>contra el resultado</b> que compra (alcance, vistas, clicks, conversiones).",
    mejorPractica: "Analizá su <b>costo por resultado</b> (CPM, CPCV, CPC, CPA) por medio y objetivo. Un costo bajo no es eficiencia si no mueve el objetivo.",
    oportunidad: "Medio con mucha inversión y bajo resultado → candidato a <b>reasignación</b>; medio eficiente con poca inversión → candidato a escalar.",
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
    comoLeer: "Personas <b>únicas</b> expuestas a la pauta o al contenido. Mide cobertura, no repetición.",
    mejorPractica: "Leelo junto a la frecuencia: mucho alcance con frecuencia muy baja no fija recuerdo; poco alcance con frecuencia alta satura.",
    oportunidad: "Si el alcance se estanca mientras sube la inversión, estás re-impactando a la misma gente: sumá <b>audiencias nuevas</b> o un medio distinto.",
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
    comoLeer: "Veces promedio que una persona vio la pieza en el período (impresiones ÷ alcance).",
    mejorPractica: "En campañas de awareness, <b>2 a 4</b> por mes es un rango sano. Menos no fija; bastante más satura y desperdicia inversión.",
    oportunidad: "Frecuencia arriba de 6 con alcance estancado y CTR/VTR en caída → <b>reasigná hacia alcance nuevo</b> o rotá creatividades.",
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
    comoLeer: "Veces que se mostró la pieza (con repetición). Mide <b>volumen de exposición</b>, no personas.",
    mejorPractica: "No la confundas con alcance. Para cobertura mirá alcance; para eficiencia de compra, el CPM.",
    oportunidad: "Muchas impresiones con poco alcance = frecuencia alta: revisá si estás saturando a la misma audiencia.",
    marco: "Es la unidad de compra de la pauta (CPM), pero es un medio, no un fin.",
    funnel: "awareness",
    palancas: [{ accion: "Leer impresiones junto a alcance y frecuencia", modulo: "alcance-frecuencia" }],
  },
  grps: {
    name: "GRPs",
    comoLeer: "Presión bruta en TV y radio: 1 GRP = 1% de la población de referencia expuesta una vez. <b>GRPs = alcance % × frecuencia</b>. Si es sobre el target comprado, se llaman TRPs.",
    mejorPractica: "Leelos junto al <b>alcance</b>: subir GRPs sin que crezca el alcance es comprar frecuencia sobre las mismas personas (la curva de alcance se aplanó).",
    oportunidad: "Soportes con muchos GRPs y poco alcance incremental → candidatos a recortar a favor de otro canal o franja que sume gente nueva.",
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
    comoLeer: "Cuánto cuesta cada punto de rating (CPP o CPR). Es el \"CPM\" de la TV y la radio.",
    mejorPractica: "Comparalo <b>dentro del mismo medio, target y franja</b>: el prime time y los programas de alto rating son más caros por punto y se justifican si suman alcance que el resto no da.",
    oportunidad: "Un soporte con costo por GRP muy arriba de la mediana del medio y sin alcance incremental es el primero a renegociar o recortar.",
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
    comoLeer: "Impactos u oportunidades de ver que informa la agencia o el medio (vía pública, DOOH, cine, gráfica, BTL, TV y radio). Es el volumen de los medios offline.",
    mejorPractica: "No los sumes con las impresiones digitales salvo que el criterio de medición sea comparable: una impresión digital y un contacto offline no miden lo mismo.",
    oportunidad: "El <b>CPM de contactos</b> (inversión ÷ contactos × 1.000) marca qué soporte es caro dentro de su medio; contra el CPM digital, solo como orden de magnitud.",
    marco: "En las señales, TV, OOH y DOOH se tratan como offline: sus contactos van aparte y el CPM mensual se calcula solo con medios que informan impresiones.",
    formula: "Contactos informados; CPM de contactos = Inversión ÷ Contactos × 1.000",
    funnel: "awareness",
    palancas: [{ accion: "Leer medios offline y sin API", modulo: "medios-offline" }],
  },
  cpm: {
    name: "CPM",
    comoLeer: "Costo por mil impresiones. Mide cuánto cuesta comprar atención en un medio.",
    mejorPractica: "Comparalo <b>solo dentro del mismo medio y formato</b>: los CPM varían mucho entre plataformas. Un CPM bajo con VTR o CTR muy bajo no es eficiente.",
    oportunidad: "Un CPM que sube semana a semana en la misma campaña suele indicar audiencia saturada o creatividad fatigada.",
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
    comoLeer: "Porcentaje de impresiones de video que llegaron al menos a la mitad. Mide <b>calidad de atención</b>, no volumen.",
    mejorPractica: "Compará solo dentro del mismo formato (un bumper y un video de 30 s no se miden igual). Para decidir, mirá además el <b>CPCV</b>: un VTR alto con CPM muy alto puede salir caro.",
    oportunidad: "Piezas con VTR muy por debajo de su formato consumen presupuesto sin retorno: <b>pausalas o reeditá los primeros segundos</b>.",
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
    comoLeer: "Porcentaje de impresiones o inicios de video que se vieron completos.",
    mejorPractica: "La lectura depende del formato: en <b>forzados</b> (bumper, no saltable) tiene que ser muy alta; en saltables es menor por diseño y lo que manda es el costo por vista completa.",
    oportunidad: "Un formato forzado con completación baja es una <b>señal crítica</b>: formato mal configurado, inventario de baja calidad o tráfico inválido.",
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
    comoLeer: "Reproducciones de al menos 15 segundos, o completas si el video dura menos. Es el evento de atención de video de Meta.",
    mejorPractica: "Leé la <b>tasa de ThruPlay</b> (ThruPlays ÷ impresiones) y el <b>costo por ThruPlay</b>, comparando piezas del mismo tipo.",
    oportunidad: "Piezas con tasa de ThruPlay muy baja están comprando impresiones que nadie mira: reemplazalas por otras con mejor hook.",
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
    comoLeer: "Cuánto pagaste por cada vista completa del video. Es la <b>métrica madre del video</b>: traduce atención en plata.",
    mejorPractica: "Comparalo dentro del mismo <b>formato, medio y mes</b>. Ordená las piezas por CPCV: las más caras son las primeras candidatas a pausa.",
    oportunidad: "Una pieza con CPCV 3 veces mayor que la mediana de su grupo merece revisión; 8 veces mayor, pausa.",
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
    comoLeer: "Interacciones que llevan al destino. Miden <b>interés accionado</b>, un paso más abajo que la impresión.",
    mejorPractica: "Leelos como CTR para comparar creativos y seguí el recorrido hasta la conversión en GA4 (sesiones con interacción).",
    oportunidad: "Muchos clicks con baja conversión = problema de <b>landing o de coherencia</b> entre anuncio y destino.",
    marco: "El click expresa intención: une la exposición con la conversión.",
    funnel: "consideracion",
    palancas: [
      { accion: "Alinear anuncio y landing", modulo: "web-cro" },
      { accion: "Optimizar por visitas a la página de destino", modulo: "meta-ads-estructura" },
    ],
  },
  ctr: {
    name: "CTR",
    comoLeer: "Porcentaje de impresiones que generaron un click. Mide cuánto moviliza la pieza.",
    mejorPractica: "Comparalo <b>solo dentro del mismo medio</b>: búsqueda y redes no se parecen en nada. En awareness un CTR bajo es normal y no es un problema.",
    oportunidad: "Un CTR que cae en la misma pieza mientras la frecuencia sube indica <b>fatiga creativa</b>.",
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
    comoLeer: "Costo por click. Mide la eficiencia de comprar tráfico.",
    mejorPractica: "Evaluálo solo en campañas de tráfico o conversión, y junto con la calidad del tráfico en GA4: un CPC barato con sesiones sin interacción es caro.",
    oportunidad: "CPC 1,5 veces por encima de la mediana del medio: revisá segmentación, creatividad y, en búsqueda, keywords y negativas.",
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
    comoLeer: "Costo por adquisición (compra, lead o el evento clave definido).",
    mejorPractica: "Fijá un <b>CPA máximo</b> según tu margen y el valor del cliente, y compará campañas del mismo objetivo. No sumes conversiones de distintas plataformas: cada una se atribuye a sí misma.",
    oportunidad: "CPA 1,5 veces sobre el promedio: revisá medición, audiencia, oferta y landing antes de cortar.",
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
    comoLeer: "Ingresos ÷ inversión en pauta: cuánto se vendió por cada peso invertido.",
    mejorPractica: "Comparalo por campaña y objetivo; un ROAS bajo en awareness es esperable. Tu punto de equilibrio es aproximadamente <b>1 ÷ margen</b> (con 25% de margen, ROAS 4).",
    oportunidad: "Campañas con ROAS alto y poca inversión → <b>escalar de a poco</b>; ROAS bajo persistente → revisar o pausar.",
    marco: "Mide la eficiencia de la <b>última milla</b>; no captura el valor de marca que habilitó esa venta.",
    formula: "Ingresos atribuidos ÷ Inversión",
    benchmark: "Umbral propio: ROAS de equilibrio ≈ 1 ÷ margen bruto.",
    funnel: "conversion",
    palancas: [
      { accion: "Escalar campañas ganadoras por tramos", modulo: "ciclo-acelerar" },
      { accion: "Separar incremental de capturado", modulo: "medicion-atribucion" },
    ],
  },

  // ── Redes ──
  engagement: {
    name: "Engagement rate",
    comoLeer: "Interacciones (me gusta, comentarios, guardados, compartidos) sobre el alcance. Mide <b>resonancia</b>, no tamaño de audiencia.",
    mejorPractica: "Leelo como tasa y <b>por pilar y por pieza</b>, no como total del mes. Separá los posteos pautados: su alcance incluye el pago.",
    oportunidad: "El pilar con engagement sobre el promedio y poco volumen publicado es una <b>línea de contenido a ampliar</b>.",
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
    oportunidad: "Los temas con más guardados son candidatos a contenido evergreen, a SEO y a pauta de consideración.",
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
    oportunidad: "Muchas preguntas de precio o disponibilidad = intención alta: respondé rápido y considerá pauta de conversión sobre esa audiencia.",
    marco: "Los comentarios son la voz directa del consumidor dentro de tus canales.",
    funnel: "consideracion",
    palancas: [{ accion: "Clasificar por tema y sentimiento", modulo: "lectura-redes" }],
  },
  sentimiento: {
    name: "Sentimiento",
    comoLeer: "Proporción de comentarios positivos, neutros y negativos. Es la <b>señal cualitativa</b> de redes.",
    mejorPractica: "Leé el negativo <b>por tema</b> (postventa, precio, calidad, entregas) y derivalo al área dueña. No juzgues una pieza negativa por pocos comentarios si su retención y guardados son buenos.",
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
    mejorPractica: "Mirá el <b>crecimiento neto</b> mensual y la calidad (engagement), no el número absoluto.",
    oportunidad: "Un salto de seguidores después de una pieza indica qué contenido construye comunidad: replicalo.",
    marco: "Los seguidores son medios propios: reducen la dependencia de la pauta para llegar a tu audiencia.",
    funnel: "fidelizacion",
    palancas: [{ accion: "Replicar el contenido que suma comunidad", modulo: "contenido-organico" }],
  },
  sov: {
    name: "Share of Voice",
    comoLeer: "Tu participación en la presencia publicitaria o conversacional de la categoría (inversión, impresiones, interacciones o menciones, según la fuente).",
    mejorPractica: "Comparalo con tu share de mercado: con más voz que share (<b>ESOV positivo</b>) la marca tiende a crecer; con menos, a perder.",
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
    comoLeer: "Usuarios que entraron al sitio en el período. Es el <b>volumen</b> de la parte alta del embudo digital.",
    mejorPractica: "Segmentalo por <b>fuente</b> (orgánico, pago, social, email, directo): cada una trae distinta calidad e intención.",
    oportunidad: "Una fuente que crece sin convertir pide revisar la <b>experiencia</b> de esa vía de entrada (landing, coherencia con el anuncio).",
    marco: "El tráfico es condición necesaria pero no suficiente: sin conversión es costo sin retorno.",
    funnel: "consideracion",
    palancas: [
      { accion: "UTMs consistentes para leer por fuente", modulo: "utm-nomenclatura" },
      { accion: "Mejorar la conversión del tráfico existente", modulo: "web-cro" },
    ],
  },
  sesiones: {
    name: "Sesiones",
    comoLeer: "Visitas al sitio (un usuario puede tener varias sesiones). Base de la tasa de conversión.",
    mejorPractica: "Mirá las <b>sesiones con interacción</b> (más de 10 segundos, 2 o más páginas o un evento clave): separan el tráfico real del rebote.",
    oportunidad: "Sesiones que crecen mucho más que los usuarios indican recurrencia: buen momento para CRM y recompra.",
    marco: "Ingresos = sesiones × conversión × ticket: las sesiones son la primera de tres palancas.",
    formula: "Visitas al sitio (GA4)",
    funnel: "consideracion",
    palancas: [{ accion: "Separar volumen de calidad del tráfico", modulo: "web-cro" }],
  },
  usuarios_nuevos: {
    name: "Usuarios nuevos",
    comoLeer: "Personas que visitan el sitio por primera vez en el período (según GA4).",
    mejorPractica: "Leelo por fuente: te dice qué canales <b>traen gente nueva</b> y cuáles reciclan a los mismos visitantes.",
    oportunidad: "Si la pauta de awareness sube pero los usuarios nuevos no, la pieza no está generando visita (o no lleva UTMs y se pierde).",
    marco: "El crecimiento viene de sumar compradores; en digital, eso empieza por sumar visitantes nuevos calificados.",
    funnel: "awareness",
    palancas: [{ accion: "Revisar el rol de cada canal", modulo: "funnel-360" }],
  },
  rebote: {
    name: "Tasa de rebote",
    comoLeer: "En GA4, porcentaje de sesiones <b>sin interacción</b> (menos de 10 segundos, una sola página y sin evento clave). Es el complemento de la tasa de interacción.",
    mejorPractica: "Leelo por fuente y por landing: un rebote alto en una campaña indica que la promesa del anuncio no coincide con la página.",
    oportunidad: "Landings de pauta con rebote muy superior al promedio del sitio son la corrección más rápida de CRO.",
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
    comoLeer: "Promedio de páginas vistas en cada visita. Proxy de exploración.",
    mejorPractica: "No siempre más es mejor: en un ecommerce eficiente, alguien que encuentra rápido lo que busca ve pocas páginas y compra.",
    oportunidad: "Muchas páginas por sesión sin conversión puede indicar navegación confusa o falta de información en la ficha de producto.",
    marco: "Se lee junto con conversión y duración, nunca solo.",
    formula: "Vistas de página ÷ Sesiones",
    funnel: "consideracion",
    palancas: [{ accion: "Diagnosticar el embudo por etapas", modulo: "web-cro" }],
  },
  frecuencia_sesion: {
    name: "Duración media de sesión",
    comoLeer: "Tiempo promedio de permanencia por visita. Proxy del <b>interés y la calidad</b> del tráfico.",
    mejorPractica: "Leela por fuente: poca duración con rebote alto indica que el contenido no cumple lo que la fuente prometió.",
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
    comoLeer: "Porcentaje de sesiones que terminan en compra (o en un evento clave si no hay ecommerce). Mide <b>eficiencia</b>, no volumen.",
    mejorPractica: "Segmentala por canal, dispositivo y categoría: el promedio esconde los cuellos de botella.",
    oportunidad: "Un canal con mucho tráfico y baja conversión suele concentrar la mayor mejora posible (landing o coherencia con el anuncio).",
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
    mejorPractica: "Desagregalas por fuente para saber qué canal <b>vende</b>, no solo cuál trae tráfico.",
    oportunidad: "Si suben las sesiones y no las transacciones, el límite está en la conversión, no en el tráfico.",
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
    mejorPractica: "Leelos junto al <b>valor medio de compra</b>: más ingreso puede venir de más ventas o de tickets más altos.",
    oportunidad: "Ingresos estables con más transacciones = ticket en caída: revisá mix de productos y descuentos.",
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
    comoLeer: "Ticket promedio: ingresos ÷ transacciones.",
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
    comoLeer: "Participación de tu marca en el espacio de exhibición de la categoría en el punto de venta.",
    mejorPractica: "Contrastalo con tu <b>share de ventas</b> en esa tienda o cadena: el desajuste es acción de negociación o reposición.",
    oportunidad: "Tiendas con ventas altas y floor share bajo tienen <b>potencial inmediato</b> de exhibición.",
    marco: "La góndola es el último momento de decisión: la presencia física es disponibilidad mental en el punto de compra.",
    formula: "Espacio de tu marca ÷ espacio total de la categoría",
    benchmark: "Regla del share justo: floor share ≥ share de ventas en esa tienda.",
    funnel: "conversion",
    palancas: [{ accion: "Negociar donde hay más venta y menos presencia", modulo: "trade-marketing" }],
  },
  cb: {
    name: "Cuadro Básico",
    comoLeer: "Presencia del surtido clave acordado en cada tienda: qué productos están donde tienen que estar.",
    mejorPractica: "Un faltante es venta perdida invisible: priorizá la cobertura del surtido central y de alta rotación.",
    oportunidad: "Tiendas con quiebres recurrentes en productos de alta rotación concentran el foco de reposición.",
    marco: "No se vende lo que no está: la distribución es la base de todo el sistema.",
    formula: "SKUs del cuadro básico presentes ÷ SKUs exigidos",
    funnel: "conversion",
    palancas: [{ accion: "Reponer primero lo de alta rotación", modulo: "trade-marketing" }],
  },

  // ── Marca ──
  tom: {
    name: "TOM (Top of Mind)",
    comoLeer: "Porcentaje de personas que nombra tu marca <b>primero</b>, espontáneamente, al pensar en la categoría.",
    mejorPractica: "Seguilo entre olas con señales de atención relativas: Share of Search, share de alcance, búsquedas de marca.",
    oportunidad: "Si el Share of Search cae varios meses, el TOM probablemente también: corregí antes de que llegue la próxima ola.",
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
    comoLeer: "Participación de tu marca en el total de menciones espontáneas de la categoría.",
    mejorPractica: "Leelo contra el TOM: SOM alto con TOM bajo indica que te conocen pero no sos la primera opción.",
    oportunidad: "Un SOM que crece más que el de la competencia anticipa ganancia de consideración.",
    marco: "Mide cuánto espacio mental ocupás en la categoría, no solo si liderás.",
    funnel: "awareness",
    palancas: [
      { accion: "Share of voice vs share de mercado", modulo: "investigacion-competencia" },
      { accion: "Brújula entre olas", modulo: "salud-de-marca" },
    ],
  },
  intencion: {
    name: "Intención de compra",
    comoLeer: "Porcentaje que considera comprar tu marca en la próxima compra de la categoría.",
    mejorPractica: "Sus señales vivas: sentimiento, búsqueda transaccional, precio relativo y presencia en góndola.",
    oportunidad: "Intención alta con share bajo indica una fuga en el punto de venta (disponibilidad, precio, exhibición).",
    marco: "Es el puente entre la mente y la góndola.",
    funnel: "consideracion",
    palancas: [
      { accion: "Contenido de consideración e influencers", modulo: "influencers-ugc" },
      { accion: "Disponibilidad en el punto de venta", modulo: "trade-marketing" },
    ],
  },
  poder_marca: {
    name: "Poder de marca",
    comoLeer: "Índice compuesto de cuán significativa, diferente y saliente es la marca. Predice precio premium y share futuro.",
    mejorPractica: "Es la variable más difícil de proyectar entre olas: tratala con cautela y apoyala en sentimiento y diferenciación.",
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
    oportunidad: "Ratio en alza con share estable o en baja = la inversión rinde menos: revisá el mix y la eficiencia.",
    marco: "Mantiene el esfuerzo en proporción al resultado: crecer en volumen no debería costar rentabilidad.",
    formula: "Inversión de marketing ÷ Facturación",
    funnel: "transversal",
    palancas: [{ accion: "Gobernar el presupuesto", modulo: "presupuesto-marketing" }],
  },
  ejecucion_presupuesto: {
    name: "Ejecución del presupuesto",
    comoLeer: "Desvío entre lo invertido y lo presupuestado en el período.",
    mejorPractica: "Un desvío relevante se decide: <b>se corrige la ejecución o se recalibra el plan</b>. No es solo control contable.",
    oportunidad: "Sub-ejecución sistemática en un medio suele indicar campañas limitadas por audiencia, puja o aprobaciones.",
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
    comoLeer: "Tu participación en las ventas de la categoría (en valor o en unidades).",
    mejorPractica: "Leelo siempre junto a la facturación: vender más mientras perdés share es una alerta que el número absoluto esconde.",
    oportunidad: "Share que crece en un segmento y cae en otro indica dónde reasignar foco competitivo.",
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
    comoLeer: "Tu participación en la <b>facturación</b> de la categoría (pesos vendidos por Drean ÷ pesos vendidos por todas las marcas), según GfK.",
    mejorPractica: "Leelo junto al <b>share en unidades</b> y al <b>índice de precio</b>: valor que crece más que unidades = vendés más caro o un mix más alto.",
    oportunidad: "Un segmento donde el share en valor cae mientras las unidades se sostienen indica presión de precio o de mix: revisá promociones y portfolio.",
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
    comoLeer: "Tu participación en las <b>unidades</b> vendidas de la categoría, según GfK.",
    mejorPractica: "Contrastalo con el share en valor: ganar unidades perdiendo valor es crecer con precio (y resignar margen).",
    oportunidad: "Unidades que crecen en el segmento Low con valor estable pueden ser una decisión de volumen; en High, una pérdida de posicionamiento.",
    marco: "El crecimiento sano viene de ganar compradores (penetración), no solo de vender más barato.",
    formula: "Unidades de la marca ÷ unidades de la categoría",
    funnel: "transversal",
    palancas: [
      { accion: "Disponibilidad y exhibición en el punto de venta", modulo: "trade-marketing" },
      { accion: "Cerrar el trimestre contra el negocio", modulo: "ciclo-acelerar" },
    ],
  },
  indice_precio: {
    name: "Índice de precio",
    comoLeer: "Precio promedio de la marca relativo al promedio de la categoría (100 = en línea con el mercado; >100 = más caro).",
    mejorPractica: "Leelo con el share: sostener un índice >100 sin perder share es la mejor evidencia viva de <b>poder de marca</b>.",
    oportunidad: "Índice que baja con share estable = la marca está comprando volumen con precio: revisá la estrategia promocional.",
    marco: "El precio relativo es la traducción comercial del equity: las marcas fuertes cobran más sin perder compradores.",
    formula: "Precio promedio de la marca ÷ precio promedio de la categoría × 100",
    funnel: "transversal",
    palancas: [
      { accion: "Posicionamiento y diferenciación", modulo: "salud-de-marca" },
      { accion: "Balance marca / activación", modulo: "presupuesto-marketing" },
    ],
  },
  salud_marca: {
    name: "Salud de Marca (puntaje consolidado)",
    comoLeer: "Puntaje que resume los cuatro objetivos de marca (TOM, SOM, Intención y Poder) medidos por Kantar, ponderados por categoría.",
    mejorPractica: "No lo leas solo: abrí cuál de los cuatro componentes lo mueve y en qué categoría. Entre olas, seguí sus señales vivas (Share of Search, alcance, engagement, Floor Share).",
    oportunidad: "Si los KPIs del Mapa se cumplen y el puntaje no se mueve, los pesos del modelo están mal calibrados: recalibrá en el cierre del trimestre.",
    marco: "Es el resultado del Mapa Estratégico: si los KPIs cumplen su meta según su peso, se cumplen los objetivos de marca.",
    funnel: "transversal",
    palancas: [
      { accion: "Recalibrar pesos y metas", modulo: "ciclo-acelerar" },
      { accion: "El modelo objetivos → KPIs → pesos", modulo: "modelo-objetivos-kpis" },
    ],
  },
  ugc_credibilidad: {
    name: "Credibilidad (UGC)",
    comoLeer: "Cuánto le cree la audiencia a la pieza de creador: se evalúa con los comentarios y se calibra con las señales de interacción reales de la pauta (guardados, compartidos, VTR) frente al promedio UGC.",
    mejorPractica: "Comparala entre piezas del mismo formato. La credibilidad es el activo propio del UGC: si una pieza parece aviso, pierde lo que la justifica.",
    oportunidad: "Creadores con credibilidad alta sostenida son candidatos a contenido recurrente y a whitelisting en la pauta.",
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
    oportunidad: "Piezas con intención alta y poca inversión → sumarles presupuesto; con intención alta y tráfico bajo → revisá el link y la landing.",
    marco: "El UGC mueve consideración: su valor está en acercar a la compra a quien todavía no decidió.",
    funnel: "consideracion",
    palancas: [
      { accion: "Contenido de consideración e influencers", modulo: "influencers-ugc" },
      { accion: "Corregir el embudo del sitio", modulo: "web-cro" },
    ],
  },
  ugc_percepcion: {
    name: "Percepción (UGC)",
    comoLeer: "Cómo queda la marca en la conversación de la pieza (positiva, neutra o negativa). No se marca negativa por pocos comentarios si la resonancia (guardados, compartidos, VTR) está sobre el promedio.",
    mejorPractica: "Leela junto al volumen de conversación: pocos comentarios no son rechazo. Una percepción negativa con resonancia baja sí es una señal para cortar la pieza.",
    oportunidad: "Temas de producto que se repiten en comentarios negativos son insumo para el equipo de producto y para el próximo brief.",
    marco: "La percepción es la señal temprana de Poder de marca en el contenido de terceros.",
    funnel: "consideracion",
    palancas: [
      { accion: "Leer sentimiento y conversación", modulo: "lectura-redes" },
      { accion: "El brief de campaña", modulo: "brief-campana" },
    ],
  },
};

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
  for (const [key, list] of Object.entries(ALIASES)) for (const a of list) m.set(canon(a), key);
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
  return null;
}

export const LAYER_LABEL: Record<string, string> = { comoLeer: "Cómo leer", mejorPractica: "Mejor práctica", oportunidad: "Oportunidad", marco: "Marco" };
