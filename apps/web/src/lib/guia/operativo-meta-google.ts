import type { Modulo } from "./types";

// Nivel 3 — Operativo: paso a paso en Meta Ads y Google Ads.
export const OPERATIVO_META_GOOGLE: Modulo[] = [
  {
    id: "meta-ads-estructura",
    titulo: "Meta Ads: estructura y objetivo por etapa",
    resumen: "Cómo armar una campaña en el Administrador de anuncios: campaña, conjunto y anuncio; qué objetivo elegir para cada etapa del funnel y cómo nombrar todo.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["awareness", "consideracion", "conversion"],
    canal: ["Facebook", "Instagram"],
    plataforma: "meta",
    dashSlugs: ["performance"],
    kpiKeys: ["alcance", "frecuencia", "cpm", "thruplay", "ctr", "cpc", "cpa", "roas"],
    secciones: [
      {
        titulo: "Los tres niveles",
        cuerpo: `- **Campaña:** define el **objetivo** (qué le pedís al algoritmo que consiga) y, si usás presupuesto a nivel campaña, el presupuesto.
- **Conjunto de anuncios:** define **audiencia, ubicaciones, calendario, optimización y puja**, y el presupuesto si lo manejás por conjunto.
- **Anuncio:** la **creatividad**, el texto, el destino y los parámetros de URL (UTMs).

Regla de estructura: **menos es más**. Pocas campañas y pocos conjuntos con suficiente presupuesto aprenden más rápido que muchos conjuntos chicos que nunca salen de la fase de aprendizaje.`,
      },
      {
        titulo: "Qué objetivo elegir",
        cuerpo: `Meta optimiza exactamente hacia lo que le pedís. El error más caro es elegir un objetivo que no corresponde con el KPI de la línea.

- **Reconocimiento:** para awareness. Optimiza por alcance, impresiones o recordación del anuncio. KPI: alcance único, CPM, frecuencia.
- **Tráfico:** para llevar visitas al sitio. Optimizá por **visitas a la página de destino** (no por clicks en el enlace, que traen más clicks accidentales). KPI: CTR, CPC, sesiones con interacción en GA4.
- **Interacción:** para vistas de video (ThruPlay), interacción con publicaciones o mensajes. KPI: costo por ThruPlay, VTR.
- **Clientes potenciales:** formularios instantáneos, mensajes o conversiones en el sitio. KPI: costo por lead, calidad del lead.
- **Promoción de la app:** instalaciones y eventos dentro de la app.
- **Ventas:** conversiones en el sitio o en la app, catálogo. KPI: CPA, ROAS. Requiere píxel y API de Conversiones bien configurados.

Si querés alcance, no uses Tráfico porque "da más barato el click": el algoritmo buscará a las personas que más clickean, que no son las que tu objetivo de marca necesita.`,
      },
      {
        titulo: "La fase de aprendizaje",
        cuerpo: `Cada conjunto de anuncios necesita acumular eventos de optimización para estabilizarse; Meta toma como referencia alrededor de **50 eventos por semana por conjunto**. Mientras está en aprendizaje, los resultados son volátiles y más caros.

Cosas que reinician el aprendizaje: cambios grandes de presupuesto, cambios de audiencia, de optimización o de creatividades. Por eso: agrupá, esperá a tener datos y hacé cambios de presupuesto graduales.`,
      },
    ],
    pasos: [
      { titulo: "Creá la campaña", detalle: "Administrador de anuncios → Crear → elegí el objetivo según la etapa del funnel de esa línea del plan." },
      { titulo: "Nombrala con la convención", detalle: "Ejemplo: 2026-q2_awareness_lavado_video. Que se pueda filtrar y leer en el dashboard sin abrir la campaña." },
      { titulo: "Definí el presupuesto", detalle: "Presupuesto de campaña (Advantage) si tenés varios conjuntos parecidos; por conjunto si necesitás controlar cuánto recibe cada audiencia." },
      { titulo: "Configurá el conjunto", detalle: "Audiencia (amplia o Advantage+ salvo que haya un motivo para restringir), ubicaciones Advantage+, calendario y optimización coherente con el objetivo." },
      { titulo: "Cargá los anuncios", detalle: "3 a 5 creatividades por conjunto, en las proporciones de cada ubicación, con UTMs en los parámetros de URL." },
      { titulo: "Revisá antes de publicar", detalle: "Píxel activo en el destino, evento de optimización correcto, UTMs, textos sin errores, fechas." },
    ],
    checklist: [
      "El objetivo de la campaña coincide con el KPI de la línea del plan.",
      "Cada conjunto tiene presupuesto suficiente para salir de aprendizaje.",
      "Cada anuncio lleva UTMs con la convención.",
      "Hay 3-5 creatividades por conjunto.",
      "La nomenclatura permite identificar objetivo, categoría y formato.",
    ],
    enBip: "Con la cuenta publicitaria de Meta sincronizada por API, **Plan de Medios** muestra inversión, alcance, frecuencia, impresiones, VTR y clicks por mes contra meta, y las piezas con mayor inversión con sus métricas. Una buena nomenclatura hace que la lectura por campaña sea directa. Meta sale SIEMPRE de la API: la fila de Meta del reporte de OMD se ignora (subcontaba la inversión de video).",
    relacionados: ["meta-ads-audiencias", "meta-pixel-capi", "lectura-video", "utm-nomenclatura", "plan-de-medios"],
  },
  {
    id: "meta-ads-audiencias",
    titulo: "Meta Ads: audiencias, Advantage+, presupuesto y frecuencia",
    resumen: "Segmentación amplia vs definida, audiencias personalizadas y similares, Advantage+, presupuesto por campaña o por conjunto, y control de frecuencia.",
    nivel: "operativo",
    etapa: "optimizar",
    funnel: ["awareness", "consideracion", "conversion"],
    canal: ["Facebook", "Instagram"],
    plataforma: "meta",
    dashSlugs: ["performance"],
    kpiKeys: ["alcance", "frecuencia", "cpm", "cpa"],
    secciones: [
      {
        titulo: "Audiencias: el algoritmo ya segmenta",
        cuerpo: `Con la limitación de datos de terceros, la segmentación detallada por intereses perdió precisión y el algoritmo de Meta aprendió a encontrar a quién mostrar según la creatividad y el evento de optimización. Por eso, en la mayoría de los casos rinde más **empezar amplio** y dejar que el sistema encuentre.

Tipos de audiencia:

- **Amplia / Advantage+ audience:** solo país, edad mínima y, si hace falta, idioma. Podés sumar "sugerencias" que el sistema toma como punto de partida, no como límite.
- **Personalizadas:** visitantes del sitio, compradores, lista de clientes, personas que interactuaron o vieron tus videos. Clave para retargeting y para excluir.
- **Similares (lookalike):** personas parecidas a una audiencia semilla (compradores de valor alto rinden mejor que visitantes).

Excluí siempre a los compradores recientes de las campañas de adquisición, salvo que el objetivo sea recompra.`,
      },
      {
        titulo: "Advantage+",
        cuerpo: `Meta viene agrupando bajo **Advantage+** las funciones automatizadas: audiencia, ubicaciones, presupuesto de campaña y campañas de ventas o de app con mínima configuración manual. Funcionan bien cuando hay **señal suficiente** (conversiones medidas correctamente) y **variedad creativa**. Con poco volumen de conversiones o medición rota, el algoritmo optimiza a ciegas.

Recomendación: usá ubicaciones Advantage+ por defecto (el sistema reparte donde el costo es menor) y excluí ubicaciones solo si hay un motivo de marca o de seguridad.`,
      },
      {
        titulo: "Presupuesto: por campaña o por conjunto",
        cuerpo: `- **Presupuesto de campaña (Advantage, antes CBO):** Meta reparte entre conjuntos según rendimiento. Ideal cuando los conjuntos son comparables (misma etapa, audiencias de tamaño parecido).
- **Presupuesto por conjunto (ABO):** controlás cuánto recibe cada uno. Útil para testear audiencias o creatividades en igualdad de condiciones, o para garantizar inversión en una audiencia chica (retargeting).

Cambios de presupuesto: de a 20-30% y con días de por medio, para no reiniciar el aprendizaje.`,
      },
      {
        titulo: "Frecuencia",
        cuerpo: `En campañas de **Reconocimiento** con optimización por alcance podés fijar un **tope de frecuencia** (por ejemplo, 2 impresiones cada 7 días). En las demás, la frecuencia se controla indirectamente: ampliando audiencia, bajando presupuesto o rotando creatividades.

Vigilá la frecuencia semanal del conjunto: si sube mientras el alcance se estanca y el CTR cae, la audiencia se está saturando.`,
      },
    ],
    checklist: [
      "Las campañas de adquisición excluyen compradores recientes.",
      "Arrancás con audiencia amplia salvo motivo concreto.",
      "Las ubicaciones son Advantage+ salvo exclusión justificada.",
      "Las campañas de alcance tienen tope de frecuencia.",
      "Los cambios de presupuesto son graduales.",
    ],
    enBip: "En **Plan de Medios**, **Alcance único** y **Frecuencia** (ambas de Meta) se leen juntas contra meta; si la frecuencia sube y el alcance no, es la señal para ampliar audiencia o rotar creatividades.",
    relacionados: ["meta-ads-estructura", "alcance-frecuencia", "meta-pixel-capi", "creatividades"],
  },
  {
    id: "meta-pixel-capi",
    titulo: "Meta: píxel y API de Conversiones",
    resumen: "Cómo medir bien las conversiones en Meta: píxel en el sitio, API de Conversiones desde el servidor, deduplicación, calidad de coincidencia y verificación de dominio.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["conversion"],
    plataforma: "meta",
    dashSlugs: ["performance", "web"],
    kpiKeys: ["cpa", "roas", "conversion"],
    secciones: [
      {
        titulo: "Por qué importa",
        cuerpo: `Las campañas de ventas y clientes potenciales optimizan hacia los eventos que Meta recibe. Si el evento de compra llega incompleto o duplicado, el algoritmo aprende mal: optimiza hacia personas que no compran o reporta un CPA irreal. La medición no es un tema técnico aparte: **es la señal con la que se entrena tu inversión**.`,
      },
      {
        titulo: "Píxel + API de Conversiones",
        cuerpo: `- **Píxel de Meta:** código en el navegador que envía eventos (ViewContent, AddToCart, InitiateCheckout, Purchase, Lead). Pierde señal por bloqueadores, navegadores con protección de rastreo y falta de consentimiento.
- **API de Conversiones (CAPI):** envía los mismos eventos desde el servidor. Recupera parte de la señal perdida y es más estable. Las plataformas de ecommerce más usadas (Tiendanube, VTEX, Shopify, WooCommerce) tienen integraciones que la configuran sin desarrollo.
- **Ambos juntos, con deduplicación:** cada evento se envía por las dos vías con el mismo **event_id**; Meta descarta el duplicado.`,
      },
      {
        titulo: "Calidad de la señal",
        cuerpo: `- **Calidad de coincidencia de eventos:** Meta puntúa qué tan bien puede asociar cada evento a una persona. Mejora enviando datos del cliente hasheados (email, teléfono) con consentimiento.
- **Valor y moneda** en los eventos de compra, para poder optimizar y medir ROAS.
- **Verificación del dominio** en el Business Manager.
- **Prioridad de eventos:** configurá como principal el evento que realmente importa (compra o lead calificado).`,
      },
    ],
    pasos: [
      { titulo: "Revisá el píxel", detalle: "Administrador de eventos → tu píxel → comprobá que lleguen los eventos estándar desde el sitio real, con valor y moneda en Purchase." },
      { titulo: "Activá la API de Conversiones", detalle: "Por la integración de tu plataforma de ecommerce o de tu gestor de etiquetas del lado del servidor." },
      { titulo: "Verificá la deduplicación", detalle: "En el Administrador de eventos, los eventos recibidos por navegador y servidor deben mostrarse deduplicados." },
      { titulo: "Mejorá la coincidencia", detalle: "Enviá parámetros de cliente hasheados con consentimiento y revisá la puntuación de calidad." },
      { titulo: "Verificá el dominio", detalle: "Configuración del negocio → Seguridad de la marca → Dominios." },
      { titulo: "Probá con una compra real", detalle: "Usá la herramienta de prueba de eventos antes de lanzar una campaña de ventas." },
    ],
    checklist: [
      "Purchase llega con valor, moneda y event_id.",
      "Píxel y CAPI activos y deduplicados.",
      "Dominio verificado.",
      "Eventos principales priorizados.",
      "Probado con una transacción real antes de pautar.",
    ],
    enBip: "La plataforma no reemplaza la medición de Meta: la usa. Si la señal está rota, el **CPA** y el **ROAS** de **Performance Conversión** y la conversión por fuente de **Web / Ecommerce** no van a coincidir. Contrastá las compras que reporta Meta con las de GA4: una diferencia grande y persistente es síntoma de medición a revisar.",
    relacionados: ["ga4-configuracion", "meta-ads-estructura", "medicion-atribucion", "utm-nomenclatura"],
  },
  {
    id: "lectura-video",
    titulo: "Métricas de video: ThruPlay, VTR y CPCV",
    resumen: "Cómo leer las métricas de video de Meta, YouTube y TikTok, qué significa cada una, por qué el costo por vista completa es la métrica madre y cómo leer la curva de retención.",
    nivel: "operativo",
    etapa: "aprender",
    funnel: ["awareness", "consideracion"],
    canal: ["Meta", "YouTube", "TikTok"],
    dashSlugs: ["performance"],
    kpiKeys: ["vtr", "vtr_completo", "thruplay", "cpcv", "cpm"],
    secciones: [
      {
        titulo: "Qué mide cada métrica",
        cuerpo: `- **Reproducciones / inicios:** cuántas veces empezó el video. En feeds con reproducción automática se cuenta casi todo, por eso no dice mucho.
- **Cuartiles (25%, 50%, 75%, 100%):** cuántas reproducciones llegaron a cada punto. Forman la **curva de retención**.
- **VTR (tasa de visualización):** reproducciones que llegaron a un punto ÷ impresiones. La plataforma usa **VTR ≥50%** (llegaron a la mitad) como indicador de calidad de atención, y el **VTR al 100%** como completación.
- **ThruPlay (Meta):** reproducciones de al menos 15 segundos, o completas si el video dura menos. Es el evento de optimización de video de Meta.
- **Vista (YouTube):** en campañas de vistas se cuenta cuando se mira un tiempo mínimo o se interactúa; es la base del CPV.
- **CPCV (costo por vista completa):** inversión ÷ vistas completas. **La métrica madre**: cuánto pagaste por cada persona que recibió el mensaje entero.`,
      },
      {
        titulo: "Leer la curva",
        cuerpo: `La forma de la curva dice dónde está el problema:

- **Caída fuerte antes del 25%:** el hook no funciona. Cambiá los primeros segundos.
- **Caída pareja y suave:** normal. Mejorá ritmo y duración.
- **Caída abrupta en un punto medio:** algo en ese momento expulsa (un corte, un cambio de tono, un texto largo). Editá esa parte.
- **Completación altísima en formato forzado y baja en saltable:** esperable; compará siempre dentro del mismo formato.`,
      },
      {
        titulo: "Cómo usarlo para decidir",
        cuerpo: `1. Agrupá las piezas por **formato y medio** (bumper con bumper, Reels con Reels).
2. Ordená por **CPCV**: las piezas más caras por vista completa son candidatas a pausa o reedición.
3. Mirá la **curva** de las peores para saber qué editar.
4. Escalá las de mejor CPCV con VTR sano, vigilando la frecuencia.

Una pieza con VTR alto pero CPM muy alto puede tener peor CPCV que una con VTR medio y CPM bajo: por eso se decide por costo por vista completa, no por VTR solo.`,
      },
    ],
    benchmarks: [
      { metrica: "Completación formato forzado", valor: "≥ 90%", nota: "Bumper y no saltable. < 85% indica un problema." },
      { metrica: "ThruPlay rate (Meta)", valor: "≥ 15%", nota: "Referencia BIP. < 8% alerta, < 3% crítico." },
      { metrica: "Caída antes del 25%", valor: "comparar con p10 del bucket", nota: "Si la pieza está debajo del peor 10% de su formato, el hook es débil." },
    ],
    checklist: [
      "Comparás piezas solo dentro del mismo formato y medio.",
      "Decidís por CPCV, no por VTR crudo.",
      "Mirás la curva de retención de las piezas más caras.",
      "Reeditás los primeros segundos de las piezas con caída temprana.",
    ],
    enBip: "En **Plan de Medios**, la card **VTR (≥50%)** se sigue contra meta mes a mes y la tabla de piezas muestra vistas al 50% y completas por creativo. Las reglas de alerta usan CPCV y ThruPlay por formato.",
    relacionados: ["benchmarks-medios", "creatividades", "meta-ads-estructura", "google-demand-gen-youtube"],
  },
  {
    id: "google-search",
    titulo: "Google Ads: campañas de búsqueda",
    resumen: "Estructura de marca y genéricas, tipos de concordancia, anuncios adaptables (RSA), palabras negativas, pujas automáticas y rutina de optimización.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["consideracion", "conversion"],
    canal: ["Google"],
    plataforma: "google",
    dashSlugs: ["performance", "seo-search", "web"],
    kpiKeys: ["ctr", "cpc", "cpa", "roas", "clicks", "busquedas"],
    secciones: [
      {
        titulo: "Estructura",
        cuerpo: `Separá siempre, como mínimo, en campañas distintas:

- **Marca:** búsquedas con tu nombre. CTR alto, CPC bajo, protege tu tráfico de competidores que pujan por tu marca.
- **Genéricas de categoría:** "lavarropas carga frontal", "heladera no frost". Donde se gana demanda nueva; más caras.
- **Competencia** (opcional): búsquedas de marcas competidoras. Suelen tener CTR bajo y costo alto; usalas con objetivo claro.

Dentro de cada campaña, grupos de anuncios por tema (una categoría o necesidad por grupo), para que el anuncio y la landing coincidan con la búsqueda.`,
      },
      {
        titulo: "Concordancias y negativas",
        cuerpo: `- **Amplia:** Google muestra el anuncio en búsquedas relacionadas según el significado. Con pujas automáticas y buena medición de conversiones, es el estándar recomendado por Google; sin ellas, trae mucho tráfico irrelevante.
- **Frase:** búsquedas que incluyen el significado de la frase.
- **Exacta:** búsquedas con el mismo significado. Máximo control, menor volumen.

Las **palabras negativas** son tan importantes como las positivas: evitan pagar por búsquedas que no te sirven ("gratis", "usado", "manual", "reparación" si no ofrecés service). Revisá el **informe de términos de búsqueda** todas las semanas al principio y cargá negativas.`,
      },
      {
        titulo: "Anuncios adaptables (RSA)",
        cuerpo: `Cargás hasta 15 títulos y 4 descripciones; Google combina y aprende qué funciona. Buenas prácticas:

- Títulos variados (beneficio, diferencial, oferta, marca, llamado a la acción), no 15 variaciones de lo mismo.
- Incluí la keyword principal del grupo en algunos títulos.
- Usá los recursos (antes extensiones): enlaces a sitios, textos destacados, fragmentos estructurados, precios, imágenes.
- Apuntá a una "calidad del anuncio" buena o excelente, pero priorizá la relevancia real sobre el indicador.`,
      },
      {
        titulo: "Pujas",
        cuerpo: `- **Maximizar clics:** para arrancar sin datos de conversión.
- **Maximizar conversiones → CPA objetivo:** cuando ya tenés conversiones medidas (como referencia, 30 o más por mes en la campaña).
- **Maximizar valor de conversión → ROAS objetivo:** para ecommerce con valor de compra medido.
- **Cuota de impresiones:** útil en marca para asegurar la primera posición.

Las pujas automáticas dependen de que la conversión esté bien configurada (etiqueta de Google o importada desde GA4, con conversiones mejoradas si es posible).`,
      },
    ],
    pasos: [
      { titulo: "Conversiones primero", detalle: "Configurá la conversión principal (compra o lead) con la etiqueta de Google o importándola desde GA4." },
      { titulo: "Campañas separadas", detalle: "Marca y genéricas en campañas distintas, con presupuestos propios." },
      { titulo: "Grupos por tema", detalle: "Un grupo por categoría o necesidad, con 5-20 keywords afines." },
      { titulo: "RSA + recursos", detalle: "Al menos un RSA completo por grupo y los recursos de enlaces, textos destacados e imágenes." },
      { titulo: "Negativas", detalle: "Lista inicial de negativas a nivel cuenta y revisión semanal de términos de búsqueda." },
      { titulo: "UTMs o autoetiquetado", detalle: "Autoetiquetado activo con GA4 vinculado; si usás UTMs manuales, plantilla de seguimiento con la convención." },
    ],
    checklist: [
      "Marca y genéricas en campañas separadas.",
      "Conversión principal medida y usada en la puja.",
      "Revisión semanal de términos de búsqueda y negativas.",
      "Cada grupo tiene landing coherente con sus keywords.",
      "Recursos del anuncio completos.",
    ],
    benchmarks: [
      { metrica: "CTR búsqueda", valor: "≈ 3-6% genéricas · más alto en marca", nota: "Referencia de industria; en marca propia suele superar ampliamente ese rango." },
      { metrica: "Conversiones para CPA/ROAS objetivo", valor: "≈ 30+/mes por campaña", nota: "Criterio práctico para que la puja automática tenga señal suficiente." },
    ],
    enBip: "Google Ads (Search y Demand Gen) entra por API en **Plan de Medios**: inversión, impresiones y clicks por mes (con filtro por medio). La demanda de búsqueda de la categoría y tu share se ven en **Optimización SEO**; lo que pasa después del click, en **Web / Ecommerce**.",
    relacionados: ["google-pmax", "ga4-configuracion", "seo-share-of-search", "utm-nomenclatura"],
  },
  {
    id: "google-pmax",
    titulo: "Google Ads: Performance Max",
    resumen: "Cómo funciona PMax, cuándo conviene, cómo armar grupos de recursos, señales de audiencia, exclusiones de marca y cómo evaluarla sin engañarte.",
    nivel: "operativo",
    etapa: "optimizar",
    funnel: ["conversion"],
    canal: ["Google", "YouTube", "Display", "Shopping"],
    plataforma: "google",
    dashSlugs: ["performance-conversion", "web"],
    kpiKeys: ["cpa", "roas", "conversion", "ingresos"],
    secciones: [
      {
        titulo: "Qué es",
        cuerpo: `Performance Max es una campaña orientada a conversiones que usa **todo el inventario de Google** (búsqueda, Shopping, YouTube, Display, Discover, Gmail y Maps) desde una sola campaña, con pujas y ubicaciones automáticas. Vos das el objetivo, los recursos creativos, las señales y, para ecommerce, el feed de productos de Merchant Center.

Conviene cuando: tenés conversiones bien medidas con valor, un catálogo de productos (ecommerce) y volumen suficiente. No reemplaza a una campaña de búsqueda de marca bien armada ni a las campañas de awareness.`,
      },
      {
        titulo: "Cómo armarla",
        cuerpo: `- **Grupos de recursos por categoría o tema**, cada uno con sus textos, imágenes (horizontales, cuadradas y verticales), logos y videos propios. Si no cargás video, Google genera uno automático de menor calidad.
- **Señales de audiencia:** tus listas de clientes, visitantes y segmentos personalizados. Son pistas para arrancar, no límites.
- **Temas de búsqueda:** para orientar en qué búsquedas participar.
- **Feed de Merchant Center** limpio: títulos descriptivos, precios y stock actualizados.
- **Exclusiones:** exclusión de marca (para que no se lleve el crédito de tus búsquedas de marca) y palabras negativas donde la cuenta lo permita.
- **Expansión de URL final:** activala solo si todo tu sitio es apto como destino.`,
      },
      {
        titulo: "Cómo evaluarla",
        cuerpo: `PMax tiende a verse muy bien en ROAS porque captura demanda que ya existía (búsquedas de marca, retargeting). Para evaluarla honestamente:

- Excluí la marca y compará contra tu campaña de búsqueda de marca.
- Mirá el **informe de canales** y el de estadísticas de búsqueda para ver dónde gasta.
- Controlá **clientes nuevos vs recurrentes** (se puede configurar el objetivo de adquisición de clientes).
- Dale **4 a 6 semanas** antes de juzgar y evitá cambios grandes en ese período.
- Contrastá sus conversiones con GA4.`,
      },
    ],
    checklist: [
      "Conversiones con valor configuradas y verificadas.",
      "Grupos de recursos por categoría con video propio.",
      "Exclusión de marca aplicada.",
      "Feed de Merchant Center sin errores relevantes.",
      "Evaluación después de 4-6 semanas, contra GA4.",
    ],
    enBip: "En este dashboard **Performance Max se excluye de Plan de Medios** (es inversión de ecommerce): se lee en **Performance Conversión** con sesiones, transacciones, ingresos, CPA y ROAS, y en **Web / Ecommerce** por fuente, donde se ve si trae ventas incrementales o las canibaliza.",
    relacionados: ["google-search", "ga4-configuracion", "medicion-atribucion", "reasignacion-inversion"],
  },
  {
    id: "google-demand-gen-youtube",
    titulo: "Google Ads: Demand Gen y YouTube",
    resumen: "Cuándo usar Demand Gen y cuándo campañas de video de YouTube, qué formato elegir (bumper, saltable, no saltable, Shorts) y cómo medir alcance y vistas.",
    nivel: "operativo",
    etapa: "construir",
    funnel: ["awareness", "consideracion"],
    canal: ["YouTube", "Discover", "Gmail"],
    plataforma: "google",
    dashSlugs: ["performance"],
    kpiKeys: ["alcance", "cpm", "vtr", "vtr_completo", "cpcv", "ctr"],
    secciones: [
      {
        titulo: "Dos herramientas distintas",
        cuerpo: `- **Campañas de video de YouTube** (alcance, vistas, frecuencia objetivo, secuencias): para **awareness y consideración** con video. Se compran por CPM o por vista.
- **Demand Gen:** para **generar demanda y acciones** en YouTube (in-stream, feed y Shorts), Discover y Gmail, con imagen y video, audiencias similares y optimización hacia clicks o conversiones. Es la herramienta de consideración con respuesta.

Regla de uso: si el KPI es alcance y memoria, campaña de video; si el KPI es tráfico o conversión desde audiencias que todavía no te buscan, Demand Gen.`,
      },
      {
        titulo: "Formatos de YouTube",
        cuerpo: `- **Bumper (6 s, no saltable):** frecuencia y recordación a bajo CPM. Un mensaje, marca siempre visible.
- **In-stream saltable:** se puede saltar a los 5 segundos. El mensaje y la marca tienen que estar antes. Rinde en alcance y vistas.
- **In-stream no saltable (hasta 15 s; más en TV conectada):** mensaje completo garantizado, CPM más alto.
- **In-feed:** aparece en resultados y recomendaciones; la persona elige verlo.
- **Shorts:** vertical 9:16, estética nativa.

Las campañas de **alcance eficiente** combinan formatos automáticamente para maximizar alcance único; las de **frecuencia objetivo** apuntan a una cantidad de exposiciones por semana.`,
      },
      {
        titulo: "Qué mirar",
        cuerpo: `- En alcance: **alcance único, frecuencia y CPM**; si la marca lo permite, estudios de brand lift (recordación, consideración).
- En vistas: **tasa de vista, CPV y cuartiles**. La completación se compara por formato: en no saltables es esperable muy alta; en saltables importa el costo por vista completa y la curva.
- En Demand Gen: **CTR, CPC y conversiones**, más la calidad del tráfico en GA4.

Si parte del video corre por programática (DV360), aplicá la misma lectura por formato y controlá que los formatos forzados completen: una completación muy baja en un formato no saltable indica un problema de configuración o de inventario.`,
      },
    ],
    pasos: [
      { titulo: "Elegí el tipo de campaña", detalle: "Video (alcance, vistas o frecuencia objetivo) para awareness; Demand Gen para consideración con respuesta." },
      { titulo: "Prepará los videos", detalle: "Versiones de 6 s, 15 s y 30 s; horizontal 16:9 y vertical 9:16 para Shorts." },
      { titulo: "Audiencias", detalle: "Segmentos personalizados por búsquedas y afinidad; en Demand Gen, audiencias similares a tus clientes." },
      { titulo: "Frecuencia", detalle: "Topes de frecuencia en campañas de alcance." },
      { titulo: "Medición", detalle: "Vinculá con GA4 y, si el presupuesto lo justifica, pedí un estudio de brand lift." },
    ],
    checklist: [
      "El tipo de campaña coincide con el KPI (alcance vs acción).",
      "Marca y mensaje antes del segundo 5 en saltables.",
      "Versiones verticales para Shorts.",
      "Topes de frecuencia en campañas de alcance.",
      "La lectura de completación se hace por formato.",
    ],
    enBip: "En este dashboard YouTube corre por **DV360** (Google Ads no tiene YouTube; Demand Gen sí entra por Google Ads): llega por API a **Plan de Medios**, convertido de USD a ARS con el tipo de cambio del mes. La card **VTR (≥50%)** y la tabla de piezas permiten comparar el rendimiento de video. El estado del proceso de DV360 se ve en **Monitoreo conexiones**.",
    relacionados: ["lectura-video", "creatividades", "alcance-frecuencia", "plan-de-medios"],
  },
];
