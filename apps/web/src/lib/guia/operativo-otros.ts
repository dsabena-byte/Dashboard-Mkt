import type { Modulo } from "./types";

// Nivel 3 — Operativo: TikTok, medición (GA4, UTM, Search Console) y el uso de la plataforma (adaptado a Drean).
export const OPERATIVO_OTROS: Modulo[] = [
  {
    id: "tiktok-ads",
    titulo: "TikTok Ads: objetivos, creatividad nativa y Spark Ads",
    resumen: "Cómo armar campañas en TikTok Ads Manager, qué objetivo elegir por etapa, por qué la creatividad nativa manda y cómo usar Spark Ads con contenido orgánico o de creadores.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["awareness", "consideracion", "conversion"],
    canal: ["TikTok"],
    plataforma: "tiktok",
    dashSlugs: ["performance"],
    kpiKeys: ["alcance", "cpm", "vtr", "cpcv", "ctr", "cpa"],
    secciones: [
      {
        titulo: "Estructura y objetivos",
        cuerpo: `TikTok Ads Manager sigue la misma lógica que Meta: **campaña** (objetivo), **grupo de anuncios** (audiencia, ubicación, presupuesto, optimización) y **anuncio** (creatividad).

Objetivos por etapa:

- **Alcance:** awareness al menor CPM, con control de frecuencia.
- **Vistas de video:** consideración; optimiza hacia vistas de 2 o 6 segundos o vistas enfocadas. KPI: costo por vista, retención.
- **Interacción con la comunidad:** seguidores y visitas al perfil.
- **Tráfico:** visitas al sitio o a la app.
- **Generación de clientes potenciales**, **promoción de apps** y **ventas** (conversiones en el sitio, catálogo): conversión. Requieren el píxel de TikTok y, idealmente, la API de eventos del lado del servidor.

TikTok también ofrece campañas automatizadas (Smart+) que reparten audiencia, creatividades y presupuesto; como en Meta, rinden cuando hay señal de conversión y variedad creativa.`,
      },
      {
        titulo: "La creatividad nativa manda",
        cuerpo: `En TikTok la pieza compite contra contenido de creadores, no contra otros avisos. Lo que funciona:

- **Parecer contenido:** grabado vertical, con personas, con el lenguaje y el ritmo de la plataforma. Los avisos "de TV" recortados rinden mal.
- **Hook en el primer segundo**, texto en pantalla y audio que sume (tendencias de sonido cuando tienen sentido para la marca).
- **Duración:** entre 9 y 30 segundos suele ser el rango que mejor retiene; más largo solo si el contenido sostiene.
- **Volumen de variantes:** la fatiga creativa en TikTok es rápida; planificá rotación frecuente.
- Respetá las **zonas seguras** (la interfaz tapa la parte inferior y el lateral derecho).

El Centro Creativo de TikTok muestra anuncios destacados y tendencias por industria y país: usalo como referencia antes de producir.`,
      },
      {
        titulo: "Spark Ads",
        cuerpo: `Los **Spark Ads** pautan una publicación orgánica real, de la cuenta de la marca o de un creador, en lugar de un anuncio creado desde cero. Ventajas: conservan likes, comentarios y la identidad del perfil, se ven más nativos y las interacciones suman a la cuenta.

Para pautar el contenido de un creador, el creador genera un **código de autorización** desde su publicación (configuración de anuncios) y te lo comparte con el plazo acordado. Definí en el contrato el período de uso y las piezas incluidas.`,
      },
    ],
    pasos: [
      { titulo: "Configurá la medición", detalle: "Píxel de TikTok en el sitio con los eventos clave y, si es posible, la API de eventos." },
      { titulo: "Elegí el objetivo", detalle: "Alcance o Vistas de video para marca; Tráfico o Ventas para respuesta." },
      { titulo: "Audiencia", detalle: "Amplia al principio; sumá audiencias personalizadas (visitantes, interactuantes) para retargeting y exclusiones." },
      { titulo: "Creatividades", detalle: "3 a 5 piezas nativas por grupo; si hay contenido orgánico o de creadores que rindió, usalo como Spark Ads." },
      { titulo: "UTMs", detalle: "utm_source=tiktok y utm_medium=paid-social en la URL de destino." },
    ],
    checklist: [
      "El objetivo coincide con el KPI de la línea.",
      "Las piezas se ven nativas y enganchan en el primer segundo.",
      "Hay variantes suficientes para rotar.",
      "Los Spark Ads de creadores tienen autorización y plazo acordados.",
      "Píxel y UTMs configurados.",
    ],
    enBip: "TikTok no tiene API conectada: su inversión y performance entran en **Plan de Medios** desde el reporte mensual de OMD (carga manual por categoría), junto con Meta, DV360 y Google. El tráfico que genera se ve desde ya en **Web / Ecommerce** por fuente, si las UTMs siguen la convención.",
    relacionados: ["creatividades", "influencers-ugc", "lectura-video", "utm-nomenclatura"],
  },
  {
    id: "ga4-configuracion",
    titulo: "GA4: propiedad, eventos clave y ecommerce",
    resumen: "Cómo dejar Google Analytics 4 listo para decidir: propiedad correcta, eventos clave, medición de ecommerce, filtros, retención y vínculo con Google Ads.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["consideracion", "conversion"],
    plataforma: "ga4",
    dashSlugs: ["web"],
    kpiKeys: ["trafico", "sesiones", "usuarios_nuevos", "rebote", "conversion", "transacciones", "ingresos", "aov"],
    secciones: [
      {
        titulo: "La propiedad correcta",
        cuerpo: `Es común que una empresa tenga varias propiedades de GA4: la de producción, una de pruebas, una creada por una agencia anterior, la de un micrositio. Antes de cualquier análisis confirmá **cuál recibe el tráfico real del sitio** (Informes → Tiempo real, mientras navegás el sitio) y usá esa. Mezclar propiedades o leer la equivocada es el origen de la mayoría de los "los números no coinciden".`,
      },
      {
        titulo: "Eventos y eventos clave",
        cuerpo: `GA4 mide todo como eventos. Tres capas:

- **Automáticos y de medición mejorada:** vistas de página, scroll, clicks salientes, búsqueda en el sitio, descargas. Activalos en el flujo de datos.
- **Recomendados:** nombres estándar de Google para acciones comunes (generate_lead, sign_up, y los de ecommerce). Usá estos nombres en lugar de inventar.
- **Eventos clave:** los que importan para el negocio (compra, lead, contacto por WhatsApp). Se marcan como clave en Administrar → Eventos clave. Son la base de la tasa de conversión y lo que se importa a Google Ads.

Menos es más: 1 a 5 eventos clave. Si todo es clave, la tasa de conversión deja de significar algo.`,
      },
      {
        titulo: "Ecommerce",
        cuerpo: `Para medir el embudo y los ingresos, el sitio tiene que enviar la secuencia de eventos de ecommerce con sus parámetros: **view_item**, **add_to_cart**, **begin_checkout**, **add_payment_info**, **purchase** (con transaction_id, value, currency e items). Las plataformas de ecommerce más usadas en la región tienen integraciones que lo hacen; verificá con una compra de prueba en DebugView.

Sin ecommerce (sitios de marca o de consultas), la conversión se mide sobre los eventos clave.`,
      },
      {
        titulo: "Configuración que se olvida",
        cuerpo: `- **Retención de datos:** subila al máximo disponible (por defecto es corta y limita los análisis de exploraciones).
- **Tráfico interno:** definí y filtrá las IP de la empresa y la agencia.
- **Referencias no deseadas:** agregá las pasarelas de pago (por ejemplo Mercado Pago) para que la venta no se atribuya a "referral" desde el medio de pago.
- **Dominios cruzados** si el checkout está en otro dominio.
- **Modo de consentimiento** si trabajás con banner de cookies.
- **Vínculo con Google Ads** (Administrar → Vinculaciones de productos) e **importación de eventos clave** como conversiones.
- **Vínculo con Search Console** para ver consultas orgánicas en GA4.`,
      },
    ],
    pasos: [
      { titulo: "Identificá la propiedad real", detalle: "Tiempo real mientras navegás el sitio; anotá el ID de la propiedad." },
      { titulo: "Revisá el flujo de datos", detalle: "Medición mejorada activa; etiqueta instalada en todas las páginas." },
      { titulo: "Marcá eventos clave", detalle: "Compra y/o lead y contacto; nada más." },
      { titulo: "Validá ecommerce", detalle: "Compra de prueba y revisión en DebugView de los 5 eventos del embudo con sus parámetros." },
      { titulo: "Configuración", detalle: "Retención, tráfico interno, referencias no deseadas, consentimiento." },
      { titulo: "Vinculaciones", detalle: "Google Ads (con importación de conversiones) y Search Console." },
      { titulo: "Verificá el sync", detalle: "El proceso de GA4 lee esa propiedad dos veces por día; su estado se ve en Monitoreo conexiones." },
    ],
    checklist: [
      "La propiedad que lee la plataforma es la que recibe el tráfico real.",
      "1 a 5 eventos clave definidos.",
      "Purchase con transaction_id, value, currency e items.",
      "Pasarelas de pago excluidas como referencias.",
      "Google Ads y Search Console vinculados.",
    ],
    enBip: "**Web / Ecommerce** lee la propiedad de GA4 de Drean (sync automático; estado en **Monitoreo conexiones**): tráfico, duración de sesión y conversión contra meta; transacciones, ingresos y valor medio de compra si hay ecommerce, o conversión por eventos clave si no. Si la propiedad es incorrecta, todo el tablero lo es: verificalo primero.",
    relacionados: ["utm-nomenclatura", "web-cro", "meta-pixel-capi", "bip-conectar-fuentes", "search-console"],
  },
  {
    id: "utm-nomenclatura",
    titulo: "UTM y nomenclatura de campañas",
    resumen: "La convención de UTMs y nombres que hace que la inversión, el tráfico y las ventas se puedan cruzar por canal y campaña sin limpieza manual.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["transversal"],
    plataforma: "ga4",
    dashSlugs: ["web", "performance"],
    kpiKeys: ["trafico", "conversion"],
    secciones: [
      {
        titulo: "Por qué importa",
        cuerpo: `Las UTMs son etiquetas en la URL que le dicen a GA4 de dónde vino cada visita. Si cada persona del equipo o cada agencia las escribe distinto ("Facebook", "facebook", "fb", "meta"), el mismo canal aparece partido en cinco filas y **no se puede cruzar la inversión de un canal con las ventas que generó**. Una convención escrita y respetada es la condición para cualquier análisis por canal.`,
      },
      {
        titulo: "Reglas",
        cuerpo: `1. **Siempre en minúsculas.**
2. **Palabras separadas por guion medio:** \`hot-sale\`, no \`Hot Sale\` ni \`hot_sale\`.
3. **Sin tildes ni caracteres especiales.**
4. **Obligatorios:** utm_source, utm_medium, utm_campaign. **Recomendados:** utm_content (variante creativa) y utm_term (keyword o audiencia).`,
      },
      {
        titulo: "Diccionario",
        cuerpo: `**utm_source** (dónde se hizo el click): google, facebook, instagram, tiktok, youtube, linkedin, email, whatsapp, newsletter.

**utm_medium** (tipo de medio): cpc (búsqueda paga), paid-social (redes pagas), social (redes orgánicas), display, video, email, influencer, affiliate, referral.

**utm_campaign** (qué campaña): \`periodo-objetivo\` o \`producto-accion\`. Ejemplos: \`2026-q2-awareness\`, \`hot-sale-2026\`, \`lanzamiento-heladera-x\`.

**utm_content** (qué pieza): \`video-15s\`, \`carrusel-a\`, \`creador-nombre\`.

Ejemplo completo: \`?utm_source=instagram&utm_medium=paid-social&utm_campaign=hot-sale-2026&utm_content=reel-15s\``,
      },
      {
        titulo: "Por plataforma",
        cuerpo: `- **Google Ads:** con el autoetiquetado activo y GA4 vinculado, no hace falta UTM manual (GA4 usa el identificador de click). Si necesitás UTMs manuales, usá una plantilla de seguimiento a nivel cuenta.
- **Meta Ads:** cargalas en "Parámetros de URL" del anuncio; podés usar parámetros dinámicos para el nombre de campaña y de anuncio.
- **TikTok Ads:** en la URL de destino o con los parámetros dinámicos que ofrece la plataforma.
- **Email y WhatsApp:** en cada link, con utm_medium=email o utm_source=whatsapp.
- **Influencers:** un link por creador (utm_content con su nombre) o un código propio.

La **nomenclatura de campañas** en las plataformas debería seguir la misma lógica que utm_campaign, para poder unir los datos sin tabla de equivalencias: \`año-trimestre_objetivo_categoria_formato\`.`,
      },
    ],
    checklist: [
      "La convención está escrita y compartida con agencias.",
      "Todo link pago y de email lleva UTMs completas.",
      "Autoetiquetado de Google Ads activo y GA4 vinculado.",
      "Nombres de campaña en plataformas alineados con utm_campaign.",
      "Revisión mensual de fuentes/medios mal escritos en GA4.",
    ],
    enBip: "En **Web / Ecommerce** el tráfico, la conversión y los ingresos se desagregan por fuente: una convención consistente es lo que permite leerlos por canal y cruzarlos con la inversión de **Plan de Medios**. Si ves la misma fuente partida en varias filas, el problema está en las UTMs.",
    relacionados: ["ga4-configuracion", "meta-ads-estructura", "google-search", "medicion-atribucion"],
  },
  {
    id: "search-console",
    titulo: "Search Console: diagnóstico del SEO",
    resumen: "Cómo verificar el sitio, leer el informe de rendimiento, detectar problemas de indexación y usar las consultas para priorizar contenido.",
    nivel: "operativo",
    etapa: "aprender",
    funnel: ["consideracion"],
    canal: ["Google"],
    plataforma: "search-console",
    dashSlugs: ["seo-search", "web"],
    kpiKeys: ["indice", "busquedas", "ctr", "trafico"],
    secciones: [
      {
        titulo: "Qué es y cómo se configura",
        cuerpo: `Google Search Console es la herramienta gratuita de Google para ver cómo aparece tu sitio en la búsqueda orgánica: qué consultas te muestran, en qué posición, cuántos clicks recibís y qué páginas tienen problemas.

Configuración: agregá una **propiedad de dominio** (cubre todas las variantes: con y sin www, http y https, subdominios) y verificala por **registro DNS**. Enviá el **sitemap** del sitio y vinculá Search Console con GA4.`,
      },
      {
        titulo: "Informe de rendimiento",
        cuerpo: `Muestra clicks, impresiones, CTR y posición media por consulta, página, país y dispositivo. Cómo sacarle provecho:

- **Consultas con muchas impresiones y CTR bajo:** aparecés pero no te eligen. Mejorá título y meta descripción de esa página.
- **Consultas en posición 8 a 20:** estás cerca de la primera página. Mejorá el contenido de la página que rankea.
- **Marca vs genéricas:** filtrá tu marca para separar la demanda que ya tenés de la que ganás.
- **Comparación de períodos:** detectá caídas por página después de cambios en el sitio.`,
      },
      {
        titulo: "Indexación y experiencia",
        cuerpo: `- **Indexación de páginas:** qué páginas no están indexadas y por qué (bloqueadas, duplicadas, con error, rastreadas pero no indexadas). Priorizá las páginas de categoría y producto.
- **Core Web Vitals:** velocidad y estabilidad de carga en mobile y desktop. Afectan experiencia y posicionamiento.
- **Inspección de URL:** para ver cómo ve Google una página puntual y pedir su indexación después de un cambio importante.`,
      },
    ],
    pasos: [
      { titulo: "Verificá el dominio", detalle: "Propiedad de dominio verificada por DNS." },
      { titulo: "Enviá el sitemap", detalle: "Sitemaps → URL del sitemap del sitio." },
      { titulo: "Vinculá con GA4", detalle: "Desde GA4, Administrar → Vinculaciones → Search Console." },
      { titulo: "Revisión mensual", detalle: "Rendimiento (consultas y páginas), indexación y Core Web Vitals." },
    ],
    checklist: [
      "Propiedad de dominio verificada.",
      "Sitemap enviado y sin errores.",
      "Páginas clave indexadas.",
      "Lista de consultas con CTR bajo y posición 8-20 priorizada.",
    ],
    enBip: "**Optimización SEO** muestra tu share of search, índice de posición y keywords fuertes, débiles y faltantes contra la competencia; Search Console es la herramienta donde verificás y corregís lo que ese tablero señala a nivel página.",
    relacionados: ["seo-share-of-search", "ga4-configuracion", "web-cro"],
  },
  {
    id: "bip-conectar-fuentes",
    titulo: "Fuentes de datos, monitoreo y carga de metas",
    resumen: "De dónde sale cada dato del dashboard, cómo verificar que las fuentes estén al día en Monitoreo conexiones y cómo cargar las metas mensuales para que todo se lea contra objetivo.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["transversal"],
    plataforma: "bip",
    dashSlugs: ["conexiones", "performance", "redes", "web"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "De dónde sale cada dato",
        cuerpo: `- **Meta (API):** Página de Facebook, Instagram y la cuenta publicitaria. Alimenta **Redes** (orgánico), **Plan de Medios** e **Influencia** (pauta y UGC).
- **Google (API):** **GA4** alimenta **Web / Ecommerce** y **Performance Conversión**; **Google Ads** (Search, Demand Gen y PMax) y **DV360** (YouTube y Programmatic) alimentan **Plan de Medios**.
- **Reportes de OMD (carga manual):** medios sin API (TikTok, Mercado Ads, Geo Mobile) y tradicionales (TV Cable, OOH, DOOH).
- **Presupuesto BGT (sync):** **Inversión de Marketing**.
- **Relevamiento de trade (Drive → base):** **Cuadros Básicos** y **Floor Share**.
- **GfK (carga mensual):** **Resultados Comerciales**. **Kantar (por ola):** **Salud de Marca**.

Todas las conexiones son de **solo lectura** para el análisis. La única excepción es el Generador de Contenido, que publica en Instagram y Facebook las piezas aprobadas.`,
      },
      {
        titulo: "Monitoreo conexiones",
        cuerpo: `Cada proceso tiene una periodicidad esperada (cada 6 o 12 horas, diaria, semanal o mensual). **Monitoreo conexiones** muestra la última actualización real de cada uno con semáforo por antigüedad. Antes de interpretar un mes bajo, mirá ahí: un proceso atrasado deja un KPI subestimado o un objetivo con baja cobertura, y eso no es un problema de marketing.`,
      },
      {
        titulo: "Cargar las metas",
        cuerpo: `Cada tablero con KPIs del Mapa tiene un panel **Metas** (colapsable). Para cada KPI cargás:

- **12 valores mensuales** (con la estacionalidad que corresponda).
- **Dirección:** si mayor es mejor o menor es mejor.
- **Umbrales del semáforo:** por defecto verde desde 100% y amarillo desde 90%.

Al guardar, las cards del tablero (Mes y Acumulado YTD) y el Seguimiento Objetivos se actualizan con la meta nueva.`,
      },
    ],
    pasos: [
      { titulo: "Monitoreo conexiones", detalle: "Entrá desde el menú y verificá que los procesos estén en verde." },
      { titulo: "Validá el último mes cerrado", detalle: "Que los números coincidan razonablemente con la plataforma de origen (Meta, GA4, reporte OMD)." },
      { titulo: "Cargá metas", detalle: "Panel Metas de Plan de Medios, Redes y Web; 12 meses por KPI." },
      { titulo: "Revisá la cobertura", detalle: "En Seguimiento Objetivos, cada objetivo debería tener cobertura alta." },
    ],
    checklist: [
      "Procesos de datos en verde en Monitoreo conexiones.",
      "Números del último mes cerrado validados contra la fuente.",
      "Metas cargadas para todos los KPIs vinculados al Mapa.",
      "Dirección y umbrales revisados en KPIs de costo.",
    ],
    enBip: "El estado de las fuentes se ve en **Monitoreo conexiones** (menú lateral, abajo) y las metas se cargan en el panel **Metas** de cada tablero. Si un proceso está en rojo, avisale al equipo de datos antes de sacar conclusiones.",
    relacionados: ["ciclo-construir", "bip-mapa-estrategico", "metas-mensuales", "ga4-configuracion", "bip-tableros-planilla"],
  },
  {
    id: "bip-mapa-estrategico",
    titulo: "Armar el Mapa Estratégico paso a paso",
    resumen: "Cómo usar el editor del Mapa: objetivos con peso, KPIs vinculados con peso por objetivo, mix por categoría y la composición de cada objetivo.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["transversal"],
    plataforma: "bip",
    dashSlugs: ["mapa-estrategico", "overview"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "El modelo de Drean",
        cuerpo: `El Mapa tiene cuatro objetivos de marca: **TOM, SOM, Intención de compra y Poder de marca** (medidos por Kantar). Cada KPI de los planes de acción se vincula a uno o más objetivos con un peso, y el cumplimiento ponderado de los KPIs define el de cada objetivo y, con ellos, la **Salud de Marca**.

La tesis: **si cumplís el 100% de las metas de los KPIs, cumplís el 100% de los objetivos estratégicos.**`,
      },
      {
        titulo: "Las partes del editor",
        cuerpo: `1. **Objetivos estratégicos.** Nombre, color y peso de cada objetivo. Los pesos se normalizan a 100% entre objetivos.
2. **Qué KPIs explican cada objetivo.** Por cada plan (Plan de Medios, Redes Sociales, Web / Ecommerce, Trade) elegís los KPIs del catálogo y los vinculás a uno o más objetivos con un peso. La suma de pesos por objetivo se capa en 100%.
3. **Mix por categoría.** Para los KPIs de suma (alcance, impresiones, clicks, usuarios, alcance orgánico) definís cómo se reparte la meta entre Brand, Lavado, Refrigeración y Cocción. Brand suma a las tres categorías. Los KPIs de tasa (engagement, conversión, VTR, frecuencia, CB) son generales.
4. **Composición de cada objetivo.** Ves qué KPIs forman cada objetivo y cuánto pesa cada uno.`,
      },
      {
        titulo: "Criterios para ajustar",
        cuerpo: `- **Pesos de objetivos** según etapa de la marca y cuello del embudo (ver "Fijar objetivos de negocio y de marketing").
- **Un KPI puede alimentar dos objetivos**, pero con pesos que reflejen cuánto explica de cada uno.
- **Evitá KPIs redundantes** dentro de un mismo objetivo.
- **La inversión no va en el Mapa:** es un recurso, no un resultado que aporte a un objetivo.
- **El Mapa se guarda en la base**: si lo reeditás, conservá el mix cargado.

Cuando termines, el siguiente paso es revisar las metas de cada KPI en su tablero.`,
      },
    ],
    pasos: [
      { titulo: "Abrí el Mapa Estratégico", detalle: "Desde el menú." },
      { titulo: "Ajustá objetivos y pesos", detalle: "Solo si cambió la estrategia: la estabilidad del modelo permite comparar trimestres." },
      { titulo: "Vinculá KPIs", detalle: "Por plan, con peso por objetivo." },
      { titulo: "Revisá el mix por categoría", detalle: "Brand / Lavado / Refrigeración / Cocción, suma 100." },
      { titulo: "Revisá la composición", detalle: "Que cada objetivo tenga 2 a 5 KPIs y cierre en 100%." },
      { titulo: "Validá en Seguimiento", detalle: "General y por categoría, con la cobertura de cada objetivo." },
    ],
    checklist: [
      "4 objetivos con peso.",
      "Cada objetivo con 2-5 KPIs y pesos que cierran en 100%.",
      "Mix por categoría cargado en los KPIs de suma.",
      "Metas de los KPIs revisadas después de guardar.",
    ],
    enBip: "Todo se hace en **Mapa Estratégico** y se lee en **Seguimiento Objetivos** (General o por categoría). El modelo es la base del Diagnóstico IA y del copiloto.",
    relacionados: ["modelo-objetivos-kpis", "objetivos-negocio-marketing", "bip-conectar-fuentes", "metodo-bip"],
  },
  {
    id: "bip-insights-chat",
    titulo: "Usar el Diagnóstico IA y el copiloto para decidir",
    resumen: "Qué hace el Diagnóstico IA al pie de cada tablero, cómo leer su diagnóstico y plan de acción, y cómo preguntarle al copiloto (\"Preguntale a tus datos\") para llegar a una decisión.",
    nivel: "operativo",
    etapa: "aprender",
    funnel: ["transversal"],
    plataforma: "bip",
    dashSlugs: ["overview", "performance", "redes", "web", "seo-search"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "Diagnóstico IA: el análisis de cada tablero",
        cuerpo: `Al pie de cada tablero hay un bloque **Diagnóstico IA** (arranca cerrado). Cruza los KPIs de esa disciplina con sus metas, el Seguimiento de objetivos y las **señales pre-calculadas** (alertas y oportunidades determinísticas), y devuelve:

1. **Diagnóstico:** qué está pasando, en pocas líneas.
2. **Evolución:** cómo se movieron los KPIs.
3. **Metas:** qué se cumple y qué no, mes y acumulado.
4. **Correlaciones:** qué indicadores se mueven juntos.
5. **Hallazgos**, con el porqué.
6. **Plan de acción** priorizado y oportunidades, con impacto esperado.

Todo con los números reales: si un hallazgo no tiene evidencia numérica, no debería estar. Cada versión queda guardada, así podés comparar el diagnóstico de este mes con el anterior.`,
      },
      {
        titulo: "Cómo leerlo con criterio",
        cuerpo: `- **Verificá la evidencia:** el diagnóstico cita números; si uno te llama la atención, buscalo en el tablero.
- **Priorizá por objetivo:** una acción que mueve un KPI de peso alto va antes que una que mueve uno marginal.
- **Aplicá tu contexto:** el diagnóstico no sabe que hubo un corte de stock o un cambio de precio; vos sí. Usalo como punto de partida del plan, no como el plan final.
- **Cerrá el ciclo:** el mes siguiente, compará la versión nueva con la anterior para ver si las acciones movieron lo esperado.`,
      },
      {
        titulo: "El copiloto de datos",
        cuerpo: `El copiloto ("Preguntale a tus datos", botón flotante) responde preguntas sobre los datos de todos los tableros que tenés habilitados, cruza fuentes, calcula (correlaciones, proyección a cierre, CPA/ROAS) y arma gráficos y tablas. También cita los módulos de este Método cuando recomienda cómo ejecutar una acción. Rinde más con preguntas concretas:

- "¿Qué medio tuvo el mejor costo por mil en los últimos tres meses?"
- "Compará el engagement rate de Instagram por mes contra la meta."
- "¿Cómo se movió el Floor Share de Lavado contra el share GfK?"
- "¿Qué KPI está más lejos de su meta dentro del objetivo Intención de compra?"

Evitá preguntas vagas ("¿cómo vamos?"): pedí comparación, período y métrica.`,
      },
    ],
    checklist: [
      "Regenerás el Diagnóstico IA después del cierre de cada mes.",
      "Verificás en el tablero los números que sostienen cada acción.",
      "Ajustás el plan con el contexto que la plataforma no ve.",
      "Comparás la versión nueva con la anterior.",
    ],
    enBip: "El **Diagnóstico IA** está al pie de Seguimiento Objetivos, Plan de Medios, Redes, Influencia, Web, SEO, Cuadros Básicos, Floor Share, Resultados Comerciales, Salud de Marca e Inversión de Marketing. El copiloto se abre desde el botón flotante en cualquier tablero.",
    relacionados: ["plan-de-accion", "ciclo-aprender", "reporte-mensual", "metodo-bip"],
  },
  {
    id: "bip-tableros-planilla",
    titulo: "Inversión, Resultados y Trade: de dónde sale cada dato",
    resumen: "Cómo se alimentan los tableros que cierran contra el negocio (Inversión de Marketing, Resultados Comerciales, Cuadros Básicos y Floor Share) y qué revisar antes de leerlos.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["transversal"],
    plataforma: "bip",
    dashSlugs: ["inversion", "resultados", "cuadros-basicos", "floor-share"],
    kpiKeys: ["inv_facturacion", "ejecucion_presupuesto", "share_mercado", "floor_share", "cb"],
    secciones: [
      {
        titulo: "Qué no viene por API",
        cuerpo: `Hay información que no vive en una plataforma publicitaria: el presupuesto de marketing, las ventas y el share de mercado, el relevamiento de góndola. En este dashboard entra así:

- **Inversión de Marketing:** presupuesto (BGT y sus reforecasts 4+8 / 8+4) vs real por mes, cuenta y concepto, sincronizado cada 12 horas; la facturación mensual da el ratio Inversión/Facturación.
- **Resultados Comerciales:** share de mercado GfK (valor, unidades e índice de precio) por categoría y segmento, cargado cada mes desde los exports de GfK.
- **Cuadros Básicos y Floor Share:** relevamiento semanal por tienda, sincronizado desde Drive; los tableros leen una copia optimizada que se actualiza una vez por día.`,
      },
      {
        titulo: "Qué revisar antes de leerlos",
        cuerpo: `- **Última actualización:** en **Monitoreo conexiones** (y en el propio tablero). Un mes sin cargar no es un mes en cero.
- **Versión del presupuesto:** cada cuatrimestre se compara contra la versión vigente (BGT, 4+8 u 8+4). Si una versión no está cargada, el tablero lo indica.
- **GfK completo:** cada mes trae los segmentos y el total con sus tres KPIs; si falta uno, esa métrica queda vacía.
- **Tiendas relevadas:** el cumplimiento de CB se lee sobre las tiendas medidas en el período (baseline de las últimas semanas), no sobre el universo.`,
      },
    ],
    pasos: [
      { titulo: "Abrí el tablero", detalle: "Inversión de Marketing, Resultados Comerciales, Cuadros Básicos o Floor Share desde el menú." },
      { titulo: "Verificá la frescura", detalle: "Última actualización en el tablero y en Monitoreo conexiones." },
      { titulo: "Leé contra la meta", detalle: "Desvío vs BGT, share vs período anterior, CB vs 80%, Floor Share vs objetivo por categoría." },
      { titulo: "Cerrá el ciclo", detalle: "Contrastá marketing contra negocio en la revisión trimestral." },
    ],
    checklist: [
      "Fuentes de negocio actualizadas al último período cerrado.",
      "Versión de presupuesto correcta en cada cuatrimestre.",
      "GfK con la matriz completa de segmentos y KPIs.",
      "CB leído sobre tiendas relevadas.",
    ],
    enBip: "Estos tableros cierran el ciclo contra el negocio: **Inversión de Marketing** (ejecución del presupuesto y comparador libre), **Resultados Comerciales** (GfK) y **Trade Mkt** (Cuadros Básicos y Floor Share).",
    relacionados: ["presupuesto-marketing", "trade-marketing", "bip-conectar-fuentes", "ciclo-acelerar"],
  },
];
