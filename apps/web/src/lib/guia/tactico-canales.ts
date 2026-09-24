import type { Modulo } from "./types";

// Nivel 2 — Táctico: canales propios, web, CRM, trade y gestión.
export const TACTICO_CANALES: Modulo[] = [
  {
    id: "contenido-organico",
    titulo: "Estrategia de contenido orgánico",
    resumen: "Pilares de contenido, formatos, frecuencia y calendario: cómo pasar de publicar por publicar a una estrategia que construye consideración.",
    nivel: "tactico",
    etapa: "construir",
    funnel: ["awareness", "consideracion", "fidelizacion"],
    canal: ["Instagram", "Facebook", "TikTok"],
    dashSlugs: ["redes", "contenido"],
    kpiKeys: ["alcance", "engagement", "guardados", "compartidos", "seguidores"],
    secciones: [
      {
        titulo: "Para qué sirve el orgánico hoy",
        cuerpo: `El alcance orgánico de una marca es una fracción del que era hace años: las plataformas priorizan el contenido de creadores y el pago. El orgánico no es un canal de alcance masivo, es un **activo de consideración y comunidad**: donde la audiencia que ya te encontró decide si vale la pena, y donde probás qué mensajes y formatos resuenan antes de pautarlos.

Su valor se mide en **resonancia** (interacciones de valor sobre alcance), no en volumen de publicaciones ni en seguidores.`,
      },
      {
        titulo: "Pilares de contenido",
        cuerpo: `Un pilar es una línea temática estable, con un propósito en el embudo. Tres a cinco pilares alcanzan. Ejemplo para una marca de electrodomésticos:

- **Producto:** diferenciales, demostraciones, comparativas. Mueve consideración.
- **Uso y experiencia:** trucos, recetas, cuidado, "cómo se usa". Genera guardados y utilidad.
- **Marca:** valores, detrás de escena, propósito. Construye afinidad.
- **Promoción:** ofertas y eventos comerciales. Activa, pero en exceso desgasta la comunidad.
- **Comunidad:** contenido de usuarios, respuestas, colaboraciones.

Definí un mix objetivo (por ejemplo, 35% producto, 30% uso, 15% marca, 20% promoción) y medilo: el rendimiento por pilar dice qué mensaje conecta.`,
      },
      {
        titulo: "Formatos y frecuencia",
        cuerpo: `- **Reels y video vertical:** el formato con más alcance a no seguidores en Instagram y Facebook. Base de la estrategia de descubrimiento.
- **Carruseles:** alto nivel de guardados; ideales para contenido de utilidad (guías, comparativas, pasos).
- **Stories:** relación con la comunidad existente; encuestas, preguntas y detrás de escena.
- **Frecuencia:** mejor constante que alta. Como referencia, 3 a 5 publicaciones de feed por semana más stories diarias para una marca grande. Si la calidad baja al subir la frecuencia, bajá la frecuencia.`,
      },
      {
        titulo: "Calendario",
        cuerpo: `1. **Mensual, con base en el calendario comercial** (eventos, lanzamientos) y los pilares.
2. **Con huecos para lo reactivo:** tendencias y conversación del momento, dentro de lo que la marca puede decir con credibilidad.
3. **Con objetivos por pieza:** ¿esta pieza busca alcance, guardados o tráfico?
4. **Con revisión:** cada mes se mira qué pilar y qué formato rindió sobre el promedio y se ajusta el mix del mes siguiente.`,
      },
    ],
    checklist: [
      "Hay 3-5 pilares definidos con un propósito en el embudo.",
      "Cada pieza está etiquetada con su pilar.",
      "El mix de pilares se revisa con datos todos los meses.",
      "Reels y carruseles son la base; stories sostienen la relación.",
      "La promoción no supera un cuarto del contenido.",
    ],
    enBip: "En **Redes** se ven alcance orgánico y engagement rate contra meta, el rendimiento por pilar y por posteo (incluidos guardados y compartidos) y el sentimiento de los comentarios.",
    relacionados: ["lectura-redes", "creatividades", "influencers-ugc", "salud-de-marca"],
  },
  {
    id: "lectura-redes",
    titulo: "Leer redes: engagement de valor, sentimiento y competencia",
    resumen: "Qué métricas de redes importan de verdad, cómo calcular el engagement rate, por qué guardados y compartidos pesan más que los likes y cómo usar el sentimiento.",
    nivel: "tactico",
    etapa: "aprender",
    funnel: ["consideracion", "fidelizacion"],
    canal: ["Instagram", "Facebook", "TikTok"],
    dashSlugs: ["redes"],
    kpiKeys: ["engagement", "guardados", "compartidos", "comentarios", "sentimiento", "seguidores", "sov"],
    secciones: [
      {
        titulo: "Jerarquía de interacciones",
        cuerpo: `No todas las interacciones valen lo mismo:

1. **Compartidos (envíos por mensaje y reposteos):** alguien consideró que tu contenido vale para otra persona. Es de las señales que más pesan para que las plataformas muestren el contenido a no seguidores.
2. **Guardados:** utilidad. La persona piensa volver a verlo.
3. **Comentarios:** conversación. Su valor depende del contenido del comentario (intención, preguntas, sentimiento).
4. **Likes o reacciones:** aprobación de bajo costo.

Por eso, dos posteos con el mismo engagement total pueden valer muy distinto.`,
      },
      {
        titulo: "Engagement rate: cómo calcularlo",
        cuerpo: `- **Sobre alcance** (interacciones ÷ personas alcanzadas): mide resonancia del contenido. Es el que usa BIP.
- **Sobre seguidores:** útil para comparar con competidores (no se conoce su alcance), pero castiga a las cuentas grandes.
- **Por pieza y por pilar**, no solo total del mes: el total se infla por volumen de publicaciones.

Cuidado con los posteos pautados: si una pieza se promocionó, su alcance incluye el pago y su tasa baja artificialmente. En Facebook, la plataforma excluye del orgánico los posteos pautados (alcance fuera de escala con engagement casi nulo).`,
      },
      {
        titulo: "Sentimiento",
        cuerpo: `El sentimiento de los comentarios (positivo, neutro, negativo) es la señal cualitativa del tablero: anticipa problemas de producto, de servicio o de percepción antes de que aparezcan en las ventas.

- Leé el **negativo por tema**: postventa, precio, calidad, entregas. Cada tema tiene un dueño distinto en la empresa.
- Un pico de negativo en una sola pieza suele ser un tema de esa pieza; un aumento transversal es un tema de marca.
- No marques negativa una pieza por pocos comentarios si sus guardados, compartidos y retención están sobre el promedio.`,
      },
      {
        titulo: "Contra la competencia",
        cuerpo: `El **share of engagement** (tus interacciones sobre el total del set competitivo) es la versión social del share of voice. Mirá también qué temas y formatos del competidor generan interacción de valor: son territorios disputados o disponibles.`,
      },
    ],
    benchmarks: [
      { metrica: "Engagement rate sobre alcance (IG, cuentas de marca)", valor: "≈ 2-5%", nota: "Orientativo: varía por categoría y formato. Compará contra tu p75 de los últimos 6 meses." },
      { metrica: "Engagement rate sobre seguidores", valor: "≈ 0,5-1,5%", nota: "Solo para comparar con competidores; baja a medida que crece la cuenta." },
    ],
    checklist: [
      "Leés engagement sobre alcance, por pieza y por pilar.",
      "Separás los posteos pautados del análisis orgánico.",
      "Priorizás guardados y compartidos sobre likes.",
      "Clasificás el sentimiento negativo por tema y lo derivás al área que corresponde.",
    ],
    enBip: "En **Redes**: cards de alcance orgánico y engagement rate contra meta, posteos con guardados y compartidos, sentimiento de comentarios y la comparación con competidores. El objetivo se mide con Instagram: el alcance orgánico de Facebook dejó de ser confiable cuando Meta deprecó la métrica (jun-2026).",
    relacionados: ["contenido-organico", "investigacion-competencia", "influencers-ugc", "salud-de-marca"],
  },
  {
    id: "seo-share-of-search",
    titulo: "SEO y Share of Search",
    resumen: "Cómo usar la búsqueda como termómetro de demanda y como canal: share of search, keywords fuertes/débiles/faltantes, contenido y bases técnicas.",
    nivel: "tactico",
    etapa: "aprender",
    funnel: ["consideracion", "conversion"],
    canal: ["Google"],
    plataforma: "search-console",
    dashSlugs: ["seo-search", "web"],
    kpiKeys: ["sos", "indice", "busquedas", "demanda", "trafico"],
    secciones: [
      {
        titulo: "La búsqueda como termómetro",
        cuerpo: `La búsqueda es la señal más temprana y honesta de intención. El **Share of Search** (búsquedas de tu marca ÷ búsquedas de todas las marcas del set) tiende a anticipar el share de mercado. Por eso sirve para dos cosas:

- **Alerta temprana:** si tu share of search cae, es probable que el share de mercado lo siga.
- **Medición de marca:** si una campaña de awareness funcionó, las búsquedas de marca suben en las semanas siguientes.

Leelo siempre junto con la **demanda genérica** (búsquedas de la categoría sin marca): si la categoría crece y tu marca no, estás perdiendo participación en un mercado en expansión.`,
      },
      {
        titulo: "SEO como canal",
        cuerpo: `El posicionamiento orgánico es un activo de capitalización compuesta: cada posición ganada reduce el costo de adquisición futuro, y no se apaga cuando se corta la pauta.

Clasificá tus keywords en tres grupos:

- **Fuertes (top 3):** defender. Mantené el contenido actualizado.
- **Débiles (posición 8-20):** la mayor oportunidad. Mejoras de contenido pueden llevarlas a primera página.
- **Faltantes:** keywords de la categoría donde no aparecés. Evaluá si tenés o podés crear una página que responda esa búsqueda.

Priorizá por **volumen × distancia al top**: una keyword débil de alto volumen vale más que diez faltantes de volumen mínimo.`,
      },
      {
        titulo: "Qué mejora el posicionamiento",
        cuerpo: `- **Contenido que responde la intención** de la búsqueda mejor que los resultados actuales: completo, actualizado, con información propia (especificaciones, comparativas, guías de uso).
- **Páginas de categoría y producto bien armadas:** título y meta descripción con la keyword principal, encabezados claros, texto único (no copiado del fabricante), preguntas frecuentes.
- **Bases técnicas:** indexación correcta, velocidad de carga y buenas Core Web Vitals, versión mobile, datos estructurados de producto, sin contenido duplicado.
- **Autoridad:** enlaces desde sitios relevantes (prensa, retailers, blogs de la categoría).

El SEO tarda: los cambios se ven en semanas o meses. Planificalo por trimestre.`,
      },
    ],
    checklist: [
      "Seguís share of search contra 3-5 competidores cada mes.",
      "Leés la búsqueda de marca junto con la demanda genérica.",
      "Tenés la lista de keywords débiles de alto volumen priorizada.",
      "Search Console está verificado y sin errores de indexación relevantes.",
      "Cada página clave tiene título, descripción y contenido únicos.",
    ],
    enBip: "En **Optimización SEO**: Share of Search por marca, búsquedas de marca y demanda genérica, índice de posición y la matriz de keywords fuertes, débiles y faltantes frente a la competencia. El tráfico orgánico resultante se ve en **Web / Ecommerce**.",
    relacionados: ["search-console", "investigacion-competencia", "salud-de-marca", "google-search"],
  },
  {
    id: "web-cro",
    titulo: "Web, CRO y embudo de conversión",
    resumen: "Cómo encontrar dónde se fuga valor en el sitio y subir la tasa de conversión: embudo por etapas, segmentación por fuente y prioridades de optimización.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["conversion"],
    canal: ["Web", "Ecommerce"],
    plataforma: "ga4",
    dashSlugs: ["web", "performance-conversion"],
    kpiKeys: ["conversion", "trafico", "sesiones", "rebote", "paginas_sesion", "frecuencia_sesion", "transacciones", "ingresos", "aov", "roas"],
    secciones: [
      {
        titulo: "La palanca de mayor efecto compuesto",
        cuerpo: `La tasa de conversión multiplica todo lo que vino antes: si pasás de 1% a 1,3%, obtenés 30% más ventas con el mismo tráfico que ya pagaste por atraer. Por eso, **antes de sumar tráfico, revisá dónde se pierde el que ya tenés**.

**Ingresos = sesiones × tasa de conversión × ticket promedio.** Son tres palancas distintas, con acciones distintas.`,
      },
      {
        titulo: "El embudo",
        cuerpo: `Para un ecommerce, las etapas típicas son: sesión → vista de producto → agregar al carrito → inicio de checkout → compra. Para un sitio de consultas: sesión → vista de página de servicio → inicio de formulario → envío.

Calculá la tasa de paso entre cada etapa. **La etapa con peor tasa, comparada contra su referencia, es la que gobierna el resultado.** Mejorar otra etapa rinde poco mientras esa siga siendo el cuello.

- Caída entre sesión y producto: problema de relevancia del tráfico o de la navegación.
- Caída entre producto y carrito: precio, información insuficiente, falta de stock, fotos o reseñas pobres.
- Caída entre checkout y compra: costos de envío sorpresa, medios de pago, formularios largos, errores técnicos.`,
      },
      {
        titulo: "Segmentar siempre",
        cuerpo: `El promedio esconde el problema. Mirá la conversión:

- **Por fuente:** orgánico, búsqueda paga, social pago, email, directo. Un canal con mucho tráfico y baja conversión trae audiencia poco calificada o llega a una landing que no corresponde con el anuncio.
- **Por dispositivo:** si mobile convierte mucho menos que desktop, el problema suele ser la experiencia mobile.
- **Por categoría de producto.**
- **Nuevos vs recurrentes.**`,
      },
      {
        titulo: "Priorizar mejoras",
        cuerpo: `Priorizá con tres criterios: **impacto** (cuánto tráfico pasa por esa página y cuánta caída hay), **confianza** (evidencia de que el cambio va a funcionar) y **esfuerzo**. Las mejoras que suelen rendir primero:

- Velocidad de carga en mobile.
- Coherencia entre el anuncio y la landing (mismo producto, mismo precio, misma promesa).
- Información clave visible: precio final, cuotas, costo y plazo de envío, stock.
- Checkout más corto y con los medios de pago que usa tu público (en Argentina, cuotas y billeteras virtuales pesan mucho).
- Reseñas y pruebas sociales en la ficha de producto.

Cuando el volumen lo permite, validá con test A/B antes de aplicar a todo el sitio.`,
      },
    ],
    benchmarks: [
      { metrica: "Tasa de conversión ecommerce", valor: "≈ 0,5-3%", nota: "Muy variable por categoría y ticket: durables y alto ticket en la parte baja. Compará contra tu historia y por fuente." },
      { metrica: "Tasa de interacción GA4", valor: "≈ 50-70%", nota: "Sesiones con interacción ÷ sesiones. Por debajo de 40% en una fuente, revisá la calidad del tráfico o la landing." },
    ],
    checklist: [
      "Tenés el embudo por etapas medido en GA4.",
      "Identificaste la etapa cuello contra su referencia.",
      "Leés la conversión por fuente, dispositivo y categoría.",
      "La landing de cada campaña coincide con el anuncio.",
      "Las mejoras están priorizadas por impacto, confianza y esfuerzo.",
    ],
    enBip: "En **Web / Ecommerce**: tráfico, duración media de sesión y tasa de conversión contra meta; transacciones, ingresos y valor medio de compra si hay ecommerce (si no, conversión sobre eventos clave); desglose por fuente y embudo.",
    relacionados: ["ga4-configuracion", "utm-nomenclatura", "medicion-atribucion", "crm-email"],
  },
  {
    id: "crm-email",
    titulo: "CRM, email y ciclo de vida del cliente",
    resumen: "Cómo usar la base propia para convertir y fidelizar: secuencias automáticas, segmentación, WhatsApp, métricas de referencia y conexión con la pauta.",
    nivel: "tactico",
    etapa: "acelerar",
    funnel: ["conversion", "fidelizacion"],
    canal: ["Email", "WhatsApp", "CRM"],
    dashSlugs: ["web"],
    kpiKeys: ["conversion", "transacciones", "aov", "usuarios_nuevos"],
    secciones: [
      {
        titulo: "El canal más rentable es el que ya pagaste",
        cuerpo: `Cada cliente o lead en tu base costó inversión de medios conseguirlo. El CRM es la forma de capitalizar esa inversión: comunicación de bajo costo marginal, con datos propios (no dependés de cookies ni de algoritmos) y con impacto directo en recompra y recomendación.`,
      },
      {
        titulo: "Secuencias que conviene tener",
        cuerpo: `- **Bienvenida:** al registrarse. Presenta la marca, fija expectativas y lleva a una primera acción. Suele tener las tasas de apertura más altas de todo el programa.
- **Carrito abandonado:** 1 a 3 mensajes en las primeras 24-72 horas. De las automatizaciones con mejor retorno.
- **Post-compra:** confirmación, uso y cuidado del producto, pedido de reseña, garantía. Reduce consultas y genera prueba social.
- **Nutrición de leads:** para productos de decisión larga, contenido que acompaña la comparación.
- **Reactivación:** a quienes no abren ni compran hace meses. Si no responden, sacalos de la lista (protege la entregabilidad).`,
      },
      {
        titulo: "Segmentación y frecuencia",
        cuerpo: `- Segmentá por **etapa** (lead, primer comprador, recurrente, inactivo), **categoría de interés** y **valor**.
- Un envío masivo igual para toda la base es el principal motivo de bajas.
- En Argentina, **WhatsApp** es un canal clave para consultas y postventa. Usalo con consentimiento y para mensajes de valor (estado de pedido, turnos, respuestas), no como otro canal de promociones masivas.`,
      },
      {
        titulo: "Conexión con la pauta",
        cuerpo: `La base propia sirve también en medios: audiencias de clientes para excluir de campañas de adquisición, para crear audiencias similares y para retargeting en eventos. Todo con el consentimiento correspondiente y respetando la Ley de Protección de Datos Personales.`,
      },
    ],
    benchmarks: [
      { metrica: "Apertura email (promocional)", valor: "≈ 15-30%", nota: "Referencia general. Las aperturas se inflan por la privacidad de Apple Mail: preferí clicks como indicador." },
      { metrica: "CTR email", valor: "≈ 2-5%", nota: "Clicks únicos ÷ entregados." },
      { metrica: "Bajas por envío", valor: "< 0,5%", nota: "Por encima, revisá frecuencia y segmentación." },
      { metrica: "Secuencia de bienvenida", valor: "apertura ≈ 50-70%", nota: "Referencia de secuencias automáticas de onboarding." },
    ],
    checklist: [
      "Tenés activas bienvenida, carrito abandonado y post-compra.",
      "La base está segmentada por etapa y categoría.",
      "Medís clicks y conversión, no solo aperturas.",
      "Las campañas de email llevan UTMs consistentes.",
      "Limpiás inactivos al menos dos veces por año.",
    ],
    enBip: "El tráfico, la conversión y los ingresos que genera el CRM se leen en **Web / Ecommerce** por fuente (email, WhatsApp), siempre que los links lleven UTMs con la convención. Si el CRM es un objetivo del Mapa (Fidelización), sus KPIs se vinculan ahí.",
    relacionados: ["utm-nomenclatura", "web-cro", "campanas-estacionales", "funnel-360"],
  },
  {
    id: "trade-marketing",
    titulo: "Trade marketing y punto de venta",
    resumen: "Floor share, cuadro básico y quiebres: cómo convertir la demanda construida en venta en la góndola y dónde negociar exhibición primero.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["conversion"],
    canal: ["Retail", "Punto de venta"],
    dashSlugs: ["cuadros-basicos", "floor-share", "mkt-canal", "resultados"],
    kpiKeys: ["floor_share", "cb", "share_mercado"],
    secciones: [
      {
        titulo: "El último metro",
        cuerpo: `Toda la inversión en construir demanda se juega en el punto de venta: si el producto no está, no se ve o está peor exhibido que el de la competencia, la demanda se transfiere. **Disponibilidad física es la otra cara de la disponibilidad mental**: sin las dos, no hay venta.

Dos indicadores ordenan la gestión:

- **Floor share (share de exhibición):** qué parte del espacio de la categoría ocupa tu marca en la góndola o el piso de venta.
- **Cuadro básico:** si el surtido clave acordado está presente en cada tienda.`,
      },
      {
        titulo: "La regla del share justo",
        cuerpo: `Como referencia, tu share de exhibición debería ser **al menos igual a tu share de ventas** en esa tienda o cadena. Si vendés 25% de la categoría pero ocupás 15% del espacio, estás perdiendo ventas que la exhibición podría capturar, y es el argumento más concreto para negociar con el retailer (el espacio adicional le rinde a él también).

Al revés, si tu exhibición supera ampliamente tu venta, revisá si ese espacio está bien usado (surtido, precio, material de punto de venta) antes de pedir más.`,
      },
      {
        titulo: "Prioridades",
        cuerpo: `1. **Reponer primero.** Un quiebre en un producto clave es venta perdida que no aparece en ningún reporte. Los productos de alta rotación con quiebres recurrentes son la prioridad uno.
2. **Negociar exhibición donde hay más venta y menos presencia.** Ahí el retorno por punto de share ganado es el mayor.
3. **Ejecutar la exhibición acordada.** Controlá que lo negociado se cumpla (auditorías, fotos, relevamientos).
4. **Coordinar con la pauta:** las campañas de awareness y los eventos comerciales necesitan stock y exhibición reforzados en las tiendas de mayor venta.`,
      },
    ],
    checklist: [
      "Tenés relevamiento periódico de floor share por tienda o cadena.",
      "Comparás floor share contra share de ventas.",
      "El cuadro básico está definido por tipo de tienda.",
      "Los quiebres de productos clave se reportan y se reponen primero.",
      "Las campañas grandes se coordinan con stock y exhibición.",
    ],
    enBip: "En **Cuadros Básicos** (cumplimiento del surtido por tienda, objetivo 80%, con sugerencias de tiendas a sumar) y **Floor Share** (share de góndola por categoría y ranking de marcas; objetivos Lavado 32% · Refrigeración 25% · Cocción 23%), a partir del relevamiento semanal. El contraste con la venta se hace en **Resultados Comerciales** (GfK) y con las acciones en retailers en **Mkt Canal Comercial**.",
    relacionados: ["bip-tableros-planilla", "salud-de-marca", "funnel-360", "campanas-estacionales"],
  },
  {
    id: "plan-de-accion",
    titulo: "De los insights al plan de acción",
    resumen: "Cómo transformar un diagnóstico en un plan ejecutable: priorizar por impacto en el objetivo, escribir acciones verificables y cerrar el ciclo al mes siguiente.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["transversal"],
    dashSlugs: ["overview", "performance", "redes", "web"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "Un insight no es un dato",
        cuerpo: `Un **dato** es "el CTR de Meta fue 0,4%". Un **hallazgo** es "el CTR de Meta está 40% debajo de su meta por tres meses seguidos, concentrado en las piezas de producto". Un **insight** agrega el por qué y el qué hacer: "las piezas de producto usan el mismo formato estático que en febrero; las de uso en video rinden el doble. Hay fatiga del formato y una alternativa probada."

La cadena que exige BIP para cada hallazgo es: **Objetivo → KPI → Meta → Evidencia → Causa → Acción**.`,
      },
      {
        titulo: "Priorizar",
        cuerpo: `No todas las acciones valen lo mismo. Priorizá por:

1. **Impacto en el objetivo:** peso del KPI en el objetivo × tamaño de la brecha que cierra.
2. **Confianza:** qué tan sólida es la evidencia de que la acción va a funcionar.
3. **Esfuerzo y plazo:** qué tan rápido y barato se puede ejecutar.

Tres acciones bien ejecutadas por mes rinden más que quince a medias. Si todo es prioridad alta, nada lo es.`,
      },
      {
        titulo: "Cómo se escribe una acción",
        cuerpo: `Cada acción del plan tiene:

- **Qué:** verbo y objeto concreto ("pausar las 4 piezas estáticas de producto en Meta y reemplazarlas por 3 videos de uso").
- **Por qué:** el dato que la justifica.
- **Impacto esperado:** qué KPI y cuánto ("CTR de 0,4% a 0,7%; +20% de clicks con la misma inversión").
- **Dueño y fecha.**
- **Cuándo se revisa.**

Al mes siguiente, la primera parte de la revisión es verificar el plan anterior: ¿se ejecutó? ¿Se logró el impacto esperado? Así el equipo aprende qué palancas funcionan en su marca.`,
      },
    ],
    checklist: [
      "Cada acción está vinculada a un objetivo y a un KPI del Mapa.",
      "Cada acción tiene evidencia numérica, dueño y fecha.",
      "El plan del mes tiene 3 a 5 acciones priorizadas.",
      "La revisión mensual empieza verificando el plan anterior.",
    ],
    enBip: "El **Diagnóstico IA** (al pie de cada tablero) genera el diagnóstico (evolución, cumplimiento de metas, correlaciones, qué funcionó y qué no) y un **plan de acción priorizado** con porqué e impacto esperado, siempre con los números reales. Las versiones quedan guardadas para comparar mes a mes.",
    relacionados: ["ciclo-aprender", "ciclo-optimizar", "bip-insights-chat", "reporte-mensual"],
  },
  {
    id: "reporte-mensual",
    titulo: "La revisión mensual: agenda y ritual",
    resumen: "Cómo organizar la reunión mensual de marketing para que termine en decisiones: agenda de 60 minutos, qué mirar en qué orden y qué documentar.",
    nivel: "tactico",
    etapa: "aprender",
    funnel: ["transversal"],
    dashSlugs: ["overview", "performance", "redes", "web", "inversion"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "De reporte a decisión",
        cuerpo: `Una revisión mensual típica pasa 50 minutos mirando gráficos y 10 decidiendo. El Método BIP lo invierte: **los números ya están en la plataforma, la reunión es para decidir**. Cada participante llega habiendo mirado su tablero.`,
      },
      {
        titulo: "Agenda de 60 minutos",
        cuerpo: `1. **Plan anterior (10 min).** ¿Se ejecutaron las acciones? ¿Tuvieron el impacto esperado? Qué aprendimos.
2. **Objetivos (10 min).** Seguimiento Objetivos: qué objetivo está en riesgo, mes y acumulado del año.
3. **Brechas que más pesan (20 min).** Los 2 o 3 KPIs con mayor peso × brecha. Para cada uno, causa con evidencia.
4. **Lo que funciona (5 min).** Qué rinde sobre lo esperado y todavía no se escaló.
5. **Plan del mes (15 min).** 3 a 5 acciones con dueño, impacto esperado y fecha de revisión.`,
      },
      {
        titulo: "Cadencias complementarias",
        cuerpo: `- **Semanal (15 min, equipo de medios):** ritmo de gasto, piezas anómalas, fatiga creativa.
- **Mensual (60 min):** la agenda de arriba.
- **Trimestral (medio día):** cierre del ciclo, recalibración de pesos y metas, plan del trimestre siguiente.`,
      },
    ],
    checklist: [
      "La reunión empieza por el plan anterior.",
      "Se miran objetivos antes que métricas.",
      "Se discuten solo las brechas de mayor peso.",
      "Sale con 3-5 acciones con dueño y fecha.",
      "Queda registrado para la próxima revisión.",
    ],
    enBip: "La reunión se proyecta desde **Seguimiento Objetivos** y baja a cada tablero. El **Diagnóstico IA** sirve como documento de base (y su historial de versiones como registro); el copiloto («Preguntale a tus datos») responde preguntas puntuales en la reunión.",
    relacionados: ["ciclo-aprender", "plan-de-accion", "bip-insights-chat", "metodo-bip"],
  },
];
