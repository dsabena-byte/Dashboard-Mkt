import type { Modulo } from "./types";

// Nivel 1 — Estratégico: qué objetivos, cómo se miden, cuánto se invierte y cómo se atribuye.
export const ESTRATEGICO: Modulo[] = [
  {
    id: "salud-de-marca",
    titulo: "Posicionamiento y salud de marca",
    resumen: "TOM, SOM, Intención de compra y Poder de marca: qué mide cada una, qué las mueve y cómo seguirlas entre olas de estudio con señales vivas.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["awareness", "consideracion"],
    dashSlugs: ["salud-marca", "overview", "seo-search", "redes", "resultados"],
    kpiKeys: ["tom", "som", "intencion", "poder_marca", "sos", "sov", "sentimiento", "share_mercado"],
    secciones: [
      {
        titulo: "Las cuatro variables",
        cuerpo: `Los estudios de marca (Kantar y similares) resumen la salud de una marca en pocas variables. Conviene entenderlas como una cadena:

- **TOM (Top of Mind).** Porcentaje de personas que nombra tu marca **primero**, de forma espontánea, cuando se les menciona la categoría. Es saliencia pura: sos la primera opción que viene a la cabeza.
- **SOM (Share of Mind).** Participación de tu marca en el total de menciones espontáneas de la categoría. Mide cuánto espacio mental ocupás, no solo si sos la primera.
- **Intención de compra.** Porcentaje que considera comprarte en la próxima compra de la categoría. Es el puente entre la mente y la góndola.
- **Poder de marca.** Índice compuesto de cuán significativa (satisface necesidades y genera afinidad), diferente (se percibe distinta) y saliente es la marca. Es el que mejor predice precio premium y share futuro, y el más difícil de mover en el corto plazo.

La lógica es de embudo: sin saliencia (TOM/SOM) no hay consideración; sin consideración no hay intención; sin diferenciación la intención se pierde por precio.`,
      },
      {
        titulo: "El problema de medir una vez por año",
        cuerpo: `Los estudios de marca llegan una o dos veces por año. Entre ola y ola, el equipo ejecuta a ciegas. La respuesta de BIP es una **brújula**: señales vivas del mercado, siempre **relativas a la competencia**, que anticipan hacia dónde se mueven esas variables.

Principio rector: **el posicionamiento es relativo**. Subís cuando te movés más que tus competidores, no en valor absoluto. Por eso ninguna señal se lee sola: todas se leen como share.`,
      },
      {
        titulo: "Las cinco familias de señales",
        cuerpo: `1. **Atención y saliencia** → alimenta TOM y SOM. Share of Search, share de alcance en redes, visibilidad SEO de marca, share of voice de pauta.
2. **Afinidad y conversación** → alimenta Intención y Poder. Sentimiento de comentarios, engagement relativo, reviews.
3. **Realidad comercial** → la inercia de todo. Share de mercado, índice de precio, presencia en góndola (floor share).
4. **Diferenciación y propuesta** → alimenta Poder. Precio premium sostenido, distintividad del contenido, búsquedas de atributos propios.
5. **Voz directa del consumidor** → valida todo. Micro-encuestas de recordación y consideración, social listening.

Con cadencia anual, la brújula es **direccional** (vas bien o vas mal), no un predictor de puntos exactos. La ola del estudio no alimenta el modelo: lo audita y lo recalibra.`,
      },
      {
        titulo: "Cómo se traduce a objetivos en el Mapa",
        cuerpo: `En este dashboard los cuatro objetivos del Mapa son justamente TOM, SOM, Intención de compra y Poder de marca (Kantar), y a cada uno se le vinculan los KPIs que lo explican: alcance y Share of Search a TOM/SOM; engagement, VTR y tráfico calificado a Intención; sentimiento y diferenciación a Poder.

Si no tenés estudio, usá la versión operativa: **Notoriedad** (alcance, impresiones, búsquedas de marca), **Consideración** (engagement, VTR, clicks, tráfico) y **Conversión**. Es el mismo embudo con variables observables.`,
      },
    ],
    benchmarks: [
      { metrica: "Share of Search vs share de mercado", valor: "SoS > share = crecimiento probable", nota: "Referencia de Les Binet (IPA): el Share of Search tiende a anticipar el share de mercado. Leelo contra tu propia serie." },
      { metrica: "Excess Share of Voice (ESOV)", valor: "+10 pts ESOV ≈ +0,5 pts de share/año", nota: "Referencia clásica IPA/Nielsen para marcas establecidas. Orientativa: depende de categoría y calidad creativa." },
      { metrica: "Cadencia de lectura", valor: "Mensual (señales) · anual (estudio)", nota: "La brújula es direccional; no reemplaza al estudio, lo anticipa." },
    ],
    checklist: [
      "Definiste qué variable de marca es prioritaria este año (TOM, SOM, Intención o Poder).",
      "Cada señal se lee relativa al set competitivo, no en absoluto.",
      "Tenés al menos una señal por familia (atención, afinidad, comercial).",
      "Cuando llega la ola del estudio, contrastás lo que la brújula anticipaba.",
    ],
    enBip: "Los objetivos de marca se definen en **Mapa Estratégico** y se siguen en **Seguimiento Objetivos**. Las señales de atención están en **Optimización SEO** (Share of Search) y **Redes** (alcance y comparación competitiva); la medición de marca, en **Salud de Marca** (Kantar); la realidad comercial, en **Resultados Comerciales** (GfK) y **Trade Mkt** (Cuadros Básicos y Floor Share).",
    relacionados: ["objetivos-negocio-marketing", "investigacion-competencia", "seo-share-of-search", "modelo-objetivos-kpis"],
  },
  {
    id: "objetivos-negocio-marketing",
    titulo: "Fijar objetivos de negocio y de marketing",
    resumen: "Cómo pasar de la meta comercial a 3-4 objetivos de marketing que la expliquen, formulados como resultado y medibles cada mes.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["transversal"],
    dashSlugs: ["mapa-estrategico", "overview", "resultados"],
    kpiKeys: ["share_mercado", "ingresos"],
    secciones: [
      {
        titulo: "Del negocio al marketing",
        cuerpo: `El objetivo de negocio lo fija la compañía: facturación, unidades, share, margen, entrada a un segmento. El marketing no es dueño de ese número, pero sí de **las condiciones que lo hacen posible**: que la marca sea conocida, considerada, elegida y recomprada.

Por eso el paso clave es la traducción: **¿qué tiene que pasar en la mente y en el comportamiento del consumidor para que el objetivo de negocio ocurra?** Esas respuestas son tus objetivos de marketing.

Ejemplo: el negocio quiere +8% de facturación en lavado. Para lograrlo, la marca necesita más gente que la considere (hoy pierde contra dos competidores en la etapa de comparación) y convertir mejor en su ecommerce. Objetivos: **Consideración** en lavado y **Ventas online**.`,
      },
      {
        titulo: "Cómo se formula un buen objetivo",
        cuerpo: `- **Es un resultado, no una actividad.** "Aumentar la consideración de la marca" es un objetivo; "hacer una campaña de influencers" es una táctica.
- **Es medible con KPIs que tenés.** Si no hay forma de observarlo mes a mes, no se puede gestionar.
- **Tiene horizonte.** Trimestral o anual, con metas mensuales.
- **Son pocos.** Tres o cuatro. Con más, el peso de cada uno se diluye y el equipo pierde foco.
- **Cubren el embudo que importa.** Una marca nueva pesa más arriba (notoriedad); una marca madura con buena notoriedad, más abajo (consideración y conversión).`,
      },
      {
        titulo: "El peso estratégico",
        cuerpo: `Cada objetivo lleva un peso que suma 100% entre todos. El peso **declara dónde elegís ganar**. Si todos pesan lo mismo, no priorizaste.

Criterios para asignarlo:

- **Etapa de la marca.** Lanzamiento o categoría nueva: 40-50% a notoriedad. Marca líder: más peso a consideración y fidelización.
- **Dónde está el cuello.** Si la marca es muy conocida pero poco elegida, el peso va a consideración.
- **Horizonte.** Los objetivos de marca rinden en el largo plazo; los de conversión, en el corto. Un modelo 100% conversión maximiza el trimestre y erosiona el año siguiente.`,
      },
    ],
    pasos: [
      { titulo: "Escribí la meta de negocio", detalle: "Una sola oración con número y plazo: facturación, unidades o share." },
      { titulo: "Identificá el cuello del embudo", detalle: "¿Dónde se pierde más gente: no te conocen, no te consideran o no te eligen?" },
      { titulo: "Formulá 3-4 objetivos", detalle: "Como resultado observable: Notoriedad, Consideración, Ventas online, Generación de consultas, Fidelización." },
      { titulo: "Asigná pesos", detalle: "Que sumen 100% y reflejen el cuello del embudo y la etapa de la marca." },
      { titulo: "Cargalos en el Mapa", detalle: "Cada objetivo con su color, peso y los KPIs que lo explican." },
    ],
    checklist: [
      "La meta de negocio está escrita con número y plazo.",
      "Ningún objetivo es una actividad o una táctica.",
      "Entre 3 y 4 objetivos, con pesos que suman 100%.",
      "Cada objetivo tiene al menos 2 KPIs con fuente de datos.",
    ],
    enBip: "Los objetivos se crean en **Mapa Estratégico** (objetivos, pesos y mix por categoría). Su cumplimiento ponderado se ve en **Seguimiento Objetivos**; el contraste con el negocio, en **Resultados Comerciales**.",
    relacionados: ["modelo-objetivos-kpis", "salud-de-marca", "funnel-360", "bip-mapa-estrategico"],
  },
  {
    id: "modelo-objetivos-kpis",
    titulo: "El modelo: objetivos → KPIs → pesos → metas",
    resumen: "La arquitectura que hace que cumplir los KPIs equivalga a cumplir los objetivos. Cómo elegir KPIs, cómo ponderarlos y cómo se calcula el cumplimiento.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["transversal"],
    dashSlugs: ["mapa-estrategico", "overview"],
    kpiKeys: ["alcance", "engagement", "conversion", "vtr", "clicks"],
    secciones: [
      {
        titulo: "La tesis",
        cuerpo: `Si cada objetivo está explicado por un conjunto de KPIs, y cada KPI tiene una meta coherente, entonces **cumplir el 100% de las metas de los KPIs equivale a cumplir el 100% de los objetivos**. Esa es la tesis que ordena BIP.

El modelo tiene cuatro piezas:

- **Objetivo** con peso estratégico (suma 100% entre objetivos).
- **KPI** vinculado a uno o más objetivos, con un **peso dentro de cada objetivo** (los pesos de los KPIs de un objetivo suman 100%).
- **Meta mensual** por KPI.
- **Cumplimiento** = real ÷ meta, con tope en 100% para que un KPI sobrecumplido no tape a otro en rojo.`,
      },
      {
        titulo: "Cómo elegir los KPIs de cada objetivo",
        cuerpo: `- **Relación causal plausible.** El KPI tiene que ser algo que, si mejora, mueve el objetivo. El alcance explica notoriedad; el engagement y el VTR explican consideración; la tasa de conversión e ingresos explican ventas.
- **Controlable.** Una palanca de marketing tiene que poder moverlo en el trimestre.
- **Con dato confiable y mensual.** Si la fuente se corta seguido, el objetivo queda sin cobertura.
- **Sin redundancia.** Impresiones y alcance miden cosas parecidas; si usás ambos, dale más peso al que mejor representa el objetivo (alcance para notoriedad).
- **Entre 2 y 5 por objetivo.**`,
      },
      {
        titulo: "Cómo ponderar",
        cuerpo: `El peso de un KPI dentro de un objetivo expresa **cuánto de ese objetivo explica**. Tres métodos, de menor a mayor rigor:

1. **Criterio experto.** El equipo acuerda pesos según la lógica del embudo. Es el punto de partida razonable.
2. **Evidencia histórica.** Con 12 o más meses de datos, mirás qué KPIs se movieron junto con el resultado del objetivo (por ejemplo, búsquedas de marca o una medición de marca). Los que más correlacionan, pesan más.
3. **Modelado.** Regresión o MMM sobre el resultado. Es el estándar de la etapa Acelerar y lo que se usa para recalibrar anualmente.

Regla práctica: ningún KPI debería pesar menos de 10% (si pesa tan poco, sacalo) ni más de 60% (si pesa tanto, el objetivo depende de una sola métrica).`,
      },
      {
        titulo: "Cómo se calcula",
        cuerpo: `- **Cumplimiento del KPI** = min(real ÷ meta, 100%). Para KPIs donde menor es mejor (costos), se invierte la relación.
- **Cumplimiento del objetivo** = Σ (peso del KPI × cumplimiento del KPI), renormalizado sobre los KPIs que tienen dato. La proporción de peso con dato es la **cobertura**.
- **Cumplimiento global** = Σ (peso estratégico × cumplimiento del objetivo).

La cobertura es tan importante como el porcentaje: un objetivo al 95% con cobertura de 40% está midiendo menos de la mitad de lo que dice medir.`,
      },
    ],
    checklist: [
      "Cada objetivo tiene entre 2 y 5 KPIs.",
      "Los pesos de KPIs dentro de cada objetivo suman 100%.",
      "Ningún KPI pesa menos de 10% ni más de 60%.",
      "Todo KPI vinculado tiene fuente de datos activa y meta mensual.",
      "Revisás los pesos al cierre de cada trimestre con evidencia.",
    ],
    enBip: "Se arma en **Mapa Estratégico**: el editor fuerza que los pesos por objetivo cierren en 100% y solo deja vincular KPIs del catálogo con fuente de datos. El cálculo se ve en **Seguimiento Objetivos** (cumplimiento, cobertura y aporte de cada KPI).",
    relacionados: ["objetivos-negocio-marketing", "metas-mensuales", "bip-mapa-estrategico", "medicion-atribucion"],
  },
  {
    id: "metas-mensuales",
    titulo: "Metas mensuales realistas y estacionalidad",
    resumen: "Cómo fijar metas que guíen decisiones: coherentes con la inversión, repartidas según la estacionalidad y con umbrales de semáforo que tengan sentido.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["transversal"],
    dashSlugs: ["overview", "performance", "redes", "web"],
    kpiKeys: ["alcance", "trafico", "conversion", "inversion"],
    secciones: [
      {
        titulo: "Qué hace buena a una meta",
        cuerpo: `Una meta sirve si **cambia una decisión**. Metas que siempre se cumplen de sobra o que nunca se alcanzan dejan de mirarse. La meta tiene que ser exigente pero alcanzable con los recursos que efectivamente vas a tener.

Tres fuentes para construirla, combinadas:

- **Historia propia.** El mismo mes del año anterior y la tendencia de los últimos meses.
- **Inversión planificada.** Para KPIs de volumen pago (alcance, impresiones, clicks), la meta sale de presupuesto ÷ costo esperado. Si el presupuesto baja 20%, la meta de alcance no puede subir 10% sin una mejora de eficiencia que la justifique.
- **Ambición del objetivo.** Lo que el negocio necesita, contrastado con lo que es realista.`,
      },
      {
        titulo: "Estacionalidad: no repartas en partes iguales",
        cuerpo: `Casi ninguna categoría se comporta igual todos los meses. En Argentina hay picos claros: **Hot Sale** (mayo), **Día del Padre** (junio), **Día del Niño** (agosto), **Día de la Madre** (octubre), **CyberMonday** (noviembre), **Black Friday** y **Navidad** (noviembre y diciembre), además de la estacionalidad propia de cada categoría (climatización en verano, calefacción en invierno, vuelta a clases en febrero-marzo).

Método práctico para repartir una meta anual:

1. Tomá la serie mensual del año anterior (o de dos años si hubo un evento atípico).
2. Calculá el peso de cada mes sobre el total anual (índice estacional).
3. Repartí la meta anual con esos pesos.
4. Ajustá por cambios conocidos: una campaña que se adelanta, un lanzamiento, un mes con menos inversión.

Para KPIs de tasa (conversión, engagement rate, VTR), la estacionalidad es menor pero existe: en eventos de descuento la conversión sube y el engagement suele bajar por saturación de pauta.`,
      },
      {
        titulo: "Umbrales del semáforo",
        cuerpo: `El default es verde ≥ 100% de la meta y amarillo ≥ 90%. Ajustalo cuando el KPI lo pida:

- KPIs muy volátiles (engagement, tráfico de redes): amarillo desde 85%.
- KPIs donde un pequeño desvío es grave (inversión sobre-ejecutada): definí la dirección correcta. Para costos, **menor es mejor**.
- El semáforo es estado, no decoración: rojo tiene que significar "hay que actuar".`,
      },
    ],
    checklist: [
      "Cada meta de volumen pago es coherente con el presupuesto del mes.",
      "La meta anual se repartió con índice estacional, no en doceavos.",
      "Los eventos comerciales del año están reflejados en las metas.",
      "La dirección del KPI (mayor o menor es mejor) está bien configurada.",
      "Revisás al cierre del trimestre si las metas fueron alcanzables.",
    ],
    enBip: "Las metas se cargan en el panel **Metas** de cada tablero (Plan de Medios, Redes, Web): 12 valores mensuales por KPI más dirección y umbrales. Se reflejan al instante en las cards (Mes y Acumulado YTD) y en **Seguimiento Objetivos**.",
    relacionados: ["modelo-objetivos-kpis", "campanas-estacionales", "presupuesto-marketing", "bip-conectar-fuentes"],
  },
  {
    id: "presupuesto-marketing",
    titulo: "Presupuesto de marketing: cuánto y cómo repartir",
    resumen: "Inversión sobre facturación, balance entre construcción de marca y activación, y cómo gobernar la ejecución contra el plan.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["transversal"],
    dashSlugs: ["inversion", "performance", "resultados"],
    kpiKeys: ["inv_facturacion", "ejecucion_presupuesto", "inversion", "roas"],
    secciones: [
      {
        titulo: "Inversión, no gasto",
        cuerpo: `El presupuesto de marketing es una inversión con dos retornos distintos: uno **inmediato** (ventas que activa) y uno **diferido** (marca que construye y que abarata las ventas futuras). Gobernarlo bien es sostener los dos.

El indicador de control es el ratio **Inversión / Facturación**. No hay un número universal: depende de la categoría, del margen y de la etapa de la marca. Lo que importa es tu serie y la de tus competidores: si el ratio sube año contra año mientras el share no crece, la inversión está rindiendo menos.`,
      },
      {
        titulo: "Marca vs activación",
        cuerpo: `La referencia más citada (Binet & Field, IPA) indica que, en mercados de consumo, el crecimiento sostenido se logra con aproximadamente **60% en construcción de marca y 40% en activación**. La proporción cambia según la categoría: marcas con venta mayormente online o de ciclo corto necesitan más activación; categorías de compra infrecuente y alta implicancia (durables, autos, servicios financieros) sostienen más marca.

Señales de desbalance:

- **Demasiada activación:** el ROAS se ve bien pero el costo por adquisición sube trimestre a trimestre, las búsquedas de marca se estancan y se depende cada vez más de promociones.
- **Demasiada marca sin activación:** crecen notoriedad y consideración pero la conversión no acompaña; se construye demanda que capitaliza la competencia en el punto de venta.`,
      },
      {
        titulo: "Cómo repartir entre canales",
        cuerpo: `1. **Por objetivo primero.** Asigná el presupuesto a objetivos según su peso en el Mapa, no a canales.
2. **Dentro del objetivo, por eficiencia.** El canal con mejor costo por resultado para ese objetivo recibe más, hasta su punto de saturación.
3. **Reservá 10-15% para prueba.** Nuevos formatos, audiencias o medios. Sin prueba no hay aprendizaje.
4. **Planificá por cuatrimestre o trimestre**, con revisión mensual de ejecución.`,
      },
      {
        titulo: "Ejecución contra plan",
        cuerpo: `El desvío entre lo real y lo presupuestado no es solo control contable: indica dónde la ejecución se aparta de la estrategia.

- **Sobre-ejecución** (> 5% sobre plan): revisá si fue decisión o descontrol. Ritmos de gasto acelerados a mitad de mes suelen anticipar sobre-ejecución.
- **Sub-ejecución** (< 70% del plan en un mes cerrado): presupuesto que no trabajó. En medios digitales suele indicar campañas limitadas por audiencia, pujas o aprobaciones.
- Todo desvío relevante se decide: **se corrige la ejecución o se recalibra el plan**.`,
      },
    ],
    benchmarks: [
      { metrica: "Balance marca / activación", valor: "≈ 60/40 (B2C)", nota: "Binet & Field (IPA). Varía por categoría y canal de venta; usalo como punto de partida, no como regla." },
      { metrica: "Reserva de prueba", valor: "10-15% del presupuesto", nota: "Criterio de gestión para sostener aprendizaje." },
      { metrica: "Desvío tolerable de ejecución", valor: "±5% mensual", nota: "Sobre-ejecución > 5% o sub-ejecución < 70% del plan en mes cerrado requieren decisión." },
    ],
    checklist: [
      "Conocés tu ratio Inversión/Facturación y su tendencia.",
      "El presupuesto se asignó primero por objetivo y después por canal.",
      "Hay una reserva explícita para pruebas.",
      "Se revisa la ejecución contra plan todos los meses.",
    ],
    enBip: "Se sigue en **Inversión de Marketing** (real vs presupuesto por cuenta y concepto, ratio sobre facturación) y se contrasta con **Resultados Comerciales**. La ejecución de pauta mes a mes está en **Plan de Medios**.",
    relacionados: ["reasignacion-inversion", "plan-de-medios", "medicion-atribucion", "bip-tableros-planilla"],
  },
  {
    id: "medicion-atribucion",
    titulo: "Medición y atribución: MTA, MMM e incrementalidad",
    resumen: "Qué método usar para saber qué aportó cada canal: atribución multi-touch, marketing mix modeling y experimentos de incrementalidad, con sus límites.",
    nivel: "estrategico",
    etapa: "aprender",
    funnel: ["transversal"],
    dashSlugs: ["web", "performance", "resultados"],
    kpiKeys: ["roas", "cpa", "conversion", "ingresos"],
    secciones: [
      {
        titulo: "La pregunta de fondo",
        cuerpo: `Todo equipo quiere saber **qué canal generó el resultado**. No hay un método único que lo responda bien en todos los casos. Hay tres familias, y elegir mal lleva a decisiones sistemáticamente sesgadas.`,
      },
      {
        titulo: "Atribución multi-touch (MTA)",
        cuerpo: `Reparte el crédito de una conversión entre los puntos de contacto del recorrido del usuario (clicks y visitas rastreadas).

- **Sirve para:** ecommerce y generación de leads, donde hay un camino digital del click a la compra.
- **Herramienta habitual:** GA4 (atribución basada en datos o último clic) y los reportes de rutas de conversión.
- **Límites:** no ve lo que no se clickea (TV, vía pública, video visto sin click, recomendación boca a boca), pierde señal por bloqueo de cookies y consentimiento, y **sobrevalora los canales de cierre** (búsqueda de marca, retargeting) que capturan demanda que otros crearon.

Cada plataforma publicitaria además se atribuye a sí misma con su propia ventana: la suma de conversiones que reportan Meta, Google y TikTok casi siempre supera las ventas reales.`,
      },
      {
        titulo: "Marketing Mix Modeling (MMM)",
        cuerpo: `Modelo estadístico que explica las ventas (o el share) en función de la inversión por medio, la estacionalidad, el precio, la distribución y factores externos.

- **Sirve para:** marcas con venta mayormente offline o en retail, donde no hay tracking individual; y para decidir el reparto de presupuesto entre medios, incluidos los offline.
- **Qué entrega:** contribución de cada medio a las ventas, curvas de saturación (retorno marginal) y efecto de arrastre en el tiempo.
- **Requisitos:** 2 años o más de datos semanales o mensuales, variación real en la inversión (si siempre invertís lo mismo, el modelo no puede aprender) y datos de ventas confiables. Hay herramientas abiertas (Robyn de Meta, Meridian de Google) pero el valor está en el criterio de modelado.`,
      },
      {
        titulo: "Incrementalidad",
        cuerpo: `Experimentos que comparan un grupo expuesto con uno no expuesto: estudios de lift de conversión o de marca en Meta y Google, pruebas geográficas (prender pauta en unas zonas y no en otras), holdouts de audiencias.

- Es la única forma de medir **causalidad** directamente.
- Conviene usarla para validar los supuestos más caros: ¿el retargeting o la búsqueda de marca generan ventas adicionales o capturan las que iban a ocurrir igual?`,
      },
      {
        titulo: "Cómo combinarlos",
        cuerpo: `- **MTA** para optimizar dentro del canal digital en el día a día (qué campaña, qué pieza).
- **MMM** para decidir el reparto entre medios una o dos veces por año.
- **Experimentos** para calibrar a los dos y responder preguntas puntuales.

Mientras no tengas MMM, la regla de prudencia es: **no recortes marca porque "no convierte" en el último clic**. Mirá si al cortarla caen las búsquedas de marca y el tráfico directo en las semanas siguientes.`,
      },
    ],
    checklist: [
      "Sabés qué modelo de atribución usa tu GA4 y lo usás para comparar, no para sumar.",
      "No sumás las conversiones reportadas por cada plataforma.",
      "Tenés al menos una prueba de incrementalidad planificada por año.",
      "Si vendés mayormente offline, evaluás un MMM antes de recortar medios de marca.",
    ],
    enBip: "La contribución por canal en ecommerce se lee en **Web / Ecommerce** (conversión e ingresos por fuente). La inversión por medio, en **Plan de Medios**; el contraste con ventas, en **Resultados Comerciales**. El modelado (MMM) se hace aparte, como estudio de recalibración anual.",
    relacionados: ["ga4-configuracion", "utm-nomenclatura", "funnel-360", "reasignacion-inversion"],
  },
  {
    id: "funnel-360",
    titulo: "El funnel 360 y el rol de cada canal",
    resumen: "Qué hace cada canal en cada etapa (awareness, consideración, conversión, fidelización), con qué KPI se mide y cómo se conectan entre sí.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["awareness", "consideracion", "conversion", "fidelizacion"],
    dashSlugs: ["performance", "redes", "web", "seo-search", "trade"],
    kpiKeys: ["alcance", "vtr", "ctr", "conversion", "roas", "engagement", "sos", "floor_share"],
    secciones: [
      {
        titulo: "Un embudo, muchos canales",
        cuerpo: `El funnel 360 ordena todos los puntos de contacto de la marca según la etapa del consumidor que mueven. No es una secuencia rígida (la gente salta etapas), pero sirve para asignar a cada canal un rol, un KPI y una expectativa de costo.

- **Awareness:** que te conozcan. Se mide con alcance, impresiones, recordación, búsquedas de marca.
- **Consideración:** que te incluyan en la lista. Se mide con VTR, engagement, tráfico calificado, visitas a producto, share of search.
- **Conversión:** que te elijan. Se mide con tasa de conversión, transacciones, CPA, ROAS, ventas en góndola.
- **Fidelización:** que vuelvan y te recomienden. Se mide con recompra, apertura y clicks de email, NPS, reviews.`,
      },
      {
        titulo: "Rol de cada canal",
        cuerpo: `- **Video en TV, YouTube, Meta y TikTok (alcance y vistas):** awareness y consideración. KPI: alcance, CPM, VTR, CPCV.
- **Redes orgánicas:** consideración y comunidad. KPI: alcance orgánico, engagement rate, guardados y compartidos, sentimiento.
- **Influencers y UGC:** consideración y credibilidad. KPI: alcance, engagement de valor, VTR cuando se pautan.
- **Búsqueda paga y SEO:** captura de demanda en consideración y conversión. KPI: share of search, CTR, CPC, conversiones.
- **Performance Max, Demand Gen y campañas de ventas en Meta y TikTok:** conversión. KPI: CPA, ROAS.
- **Web / Ecommerce:** donde la intención se vuelve venta. KPI: tasa de conversión, ticket promedio, ingresos.
- **Punto de venta (trade):** la última milla física. KPI: floor share, cuadro básico, quiebres.
- **CRM, email y WhatsApp:** fidelización y recompra. KPI: aperturas, clicks, conversión, recompra.`,
      },
      {
        titulo: "Cómo se conectan",
        cuerpo: `Los canales no compiten, se encadenan. El video crea demanda que después aparece como búsqueda de marca; la búsqueda trae tráfico que convierte en la web o se va a la góndola; la experiencia de compra alimenta reviews que mejoran la conversión de todos.

Por eso **cada canal se evalúa con el KPI de su etapa**, no con el de la etapa final. Juzgar al video por su ROAS de último clic lleva a cortarlo, y a los tres meses sube el CPA de búsqueda porque hay menos demanda que capturar.`,
      },
    ],
    checklist: [
      "Cada canal tiene un rol explícito y un KPI de su etapa.",
      "Hay inversión en al menos una palanca por etapa del embudo.",
      "No evaluás canales de awareness con métricas de conversión.",
      "Mirás cómo cambian las búsquedas de marca cuando sube o baja la inversión en awareness.",
    ],
    enBip: "Cada etapa del embudo tiene su tablero: **Plan de Medios** (awareness y consideración paga), **Redes** (consideración orgánica), **Optimización SEO** (demanda), **Web / Ecommerce** (conversión) y **Cuadros Básicos** / **Floor Share** (punto de venta). El **Mapa Estratégico** es donde cada canal se vincula al objetivo de su etapa.",
    relacionados: ["plan-de-medios", "objetivos-negocio-marketing", "medicion-atribucion", "brief-campana"],
  },
  {
    id: "investigacion-competencia",
    titulo: "Investigación de mercado y competencia",
    resumen: "Cómo leer a la competencia con datos observables: share of search, share of voice, contenido, precio y góndola, y cómo convertirlo en decisiones.",
    nivel: "estrategico",
    etapa: "aprender",
    funnel: ["awareness", "consideracion"],
    dashSlugs: ["seo-search", "redes", "web", "floor-share", "resultados"],
    kpiKeys: ["sos", "sov", "demanda", "engagement", "floor_share", "share_mercado"],
    secciones: [
      {
        titulo: "Qué se puede observar de un competidor",
        cuerpo: `No tenés los datos internos de la competencia, pero sí muchas señales públicas:

- **Demanda:** cuánto los buscan (Share of Search) y cómo evoluciona interanualmente.
- **Visibilidad orgánica:** en qué keywords de la categoría rankean y en qué posición.
- **Redes:** seguidores, frecuencia de publicación, engagement por pieza, formatos y temas, sentimiento de los comentarios.
- **Pauta:** anuncios activos en la biblioteca de anuncios de Meta y el centro de transparencia de Google; volumen y tipo de creatividades.
- **Web:** tráfico estimado y fuentes.
- **Precio y góndola:** índice de precio relativo, exhibición y surtido en el punto de venta.`,
      },
      {
        titulo: "Cómo leerlo",
        cuerpo: `- **Todo en share.** Un competidor que crece 20% en búsquedas cuando la categoría crece 25% está perdiendo terreno.
- **Movimiento antes que nivel.** La alerta temprana es la aceleración: un competidor que sube su Share of Search tres meses seguidos suele estar invirtiendo o lanzando algo.
- **Brecha entre share of voice y share de mercado.** Si un competidor tiene mucha más voz que share, está invirtiendo para crecer; si tiene menos, está cosechando.
- **Contenido que resuena.** Qué temas y formatos del competidor generan interacción de valor (guardados, compartidos): son territorios disputados o disponibles.`,
      },
      {
        titulo: "Del análisis a la decisión",
        cuerpo: `Cada hallazgo competitivo debería terminar en una de tres decisiones:

1. **Defender:** reforzar inversión o contenido donde el competidor avanza sobre un territorio propio.
2. **Atacar:** ir a keywords, segmentos o formatos donde el competidor es débil y hay demanda.
3. **Diferenciarse:** evitar la pelea frontal y construir un atributo propio que el competidor no reclama.

Un análisis competitivo sin una decisión asociada es información, no inteligencia.`,
      },
    ],
    checklist: [
      "Definiste un set competitivo de 3-5 marcas y lo mantenés estable.",
      "Leés todas las señales como share, no en absoluto.",
      "Revisás la biblioteca de anuncios de los competidores al menos una vez por mes.",
      "Cada hallazgo competitivo termina en defender, atacar o diferenciarse.",
    ],
    enBip: "La capa de competencia aparece en **Optimización SEO** (Share of Search y posiciones por marca), **Redes** (comparación de engagement y contenido) y **Web / Ecommerce**. El punto de venta se compara en **Floor Share** (ranking de marcas en góndola) y el mercado en **Resultados Comerciales** (share GfK por marca y segmento).",
    relacionados: ["salud-de-marca", "seo-share-of-search", "lectura-redes", "trade-marketing"],
  },
];
