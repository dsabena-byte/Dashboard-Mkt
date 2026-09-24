import type { Modulo } from "./types";

// Método BIP: el ciclo trimestral que ordena toda la plataforma.
export const METODO: Modulo[] = [
  {
    id: "metodo-bip",
    titulo: "El Método BIP",
    resumen: "Cómo pasar de medir mucho a decidir bien: el ciclo Datos → Aprendizaje → Decisiones → Resultados, los 4 pilares y el trimestre como unidad de gestión.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["transversal"],
    dashSlugs: ["mapa-estrategico", "overview"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "El problema que resuelve",
        cuerpo: `La mayoría de los equipos de marketing mide mucho y decide poco. Hay un reporte de redes, otro de pauta, un export de GA4, una planilla de presupuesto y una encuesta de marca una vez por año. Cada uno dice algo cierto, pero ninguno responde la pregunta que importa: **qué acción concreta movió el objetivo del negocio, y cuánto costó moverlo**.

El Método BIP existe para cerrar esa brecha. No agrega más métricas: conecta las que ya tenés con los objetivos que las justifican, y les pone una meta mensual. A partir de ahí, cada número tiene una lectura clara: acerca o aleja el objetivo.`,
      },
      {
        titulo: "Datos → Aprendizaje → Decisiones → Resultados",
        cuerpo: `El método es una cadena de cuatro eslabones. Si se corta uno, el resto no sirve.

- **Datos.** Las fuentes (Meta, Google Ads, DV360, GA4, reportes de OMD, presupuesto BGT, GfK, Kantar y el relevamiento de Cuadros Básicos y Floor Share) alimentan los tableros por procesos automáticos o cargas controladas. El dato no es el fin: es la materia prima.
- **Aprendizaje.** El dato se lee **contra una meta** y **contra un objetivo**. Un alcance de 2 millones no dice nada; un alcance que cumple el 78% de su meta y explica el 50% del objetivo de Notoriedad sí.
- **Decisiones.** Lo aprendido se traduce en acciones con dueño, prioridad e impacto esperado: pausar, reasignar, escalar, corregir una landing, cambiar un creativo.
- **Resultados.** Las decisiones se verifican en el ciclo siguiente. Si la acción no movió el KPI, se aprende eso también.

La regla operativa es simple: **si una métrica no tiene un vínculo claro con un objetivo, no se sigue; si una acción no tiene un KPI que la mida, no se hace**.`,
      },
      {
        titulo: "Los 4 pilares",
        cuerpo: `- **Orden.** Definís objetivos con impacto real en el mercado y un modelo donde cada métrica, meta y acción están conectadas. Es lo que construís en el Mapa Estratégico.
- **Control.** Todos tus planes, KPIs y la ejecución viven en un solo lugar, siempre contra meta. Es el Seguimiento de Objetivos más los tableros de cada plan.
- **Eficiencia.** Al medir qué impacta en qué, reasignás inversión y esfuerzo con evidencia, no con intuición. Es la lectura de costo por resultado y el Diagnóstico IA.
- **Expertise.** El criterio experto y las mejores prácticas del mercado están adentro de cada tablero: qué mirar, qué benchmark usar, qué palanca mover. Es esta guía.`,
      },
      {
        titulo: "El trimestre como unidad de gestión",
        cuerpo: `El Método trabaja en ciclos de tres meses. Un mes es poco para ver el efecto de una decisión de marca; un año es demasiado para corregir. El trimestre es la unidad donde una campaña se planifica, se ejecuta, se mide y se ajusta.

1. **Construir** (arranque del trimestre): objetivos, modelo, pesos y metas mensuales.
2. **Aprender** (semanas 2 a 6): leer real vs meta, encontrar las brechas que más pesan, entender la causa.
3. **Optimizar** (semanas 6 a 10): reasignar inversión, cambiar creativos, corregir fricciones.
4. **Acelerar** (cierre del trimestre): escalar lo que probó funcionar y recalibrar el modelo para el próximo ciclo.

Cada vuelta del ciclo te deja un modelo más preciso: pesos mejor calibrados, metas más realistas, benchmarks propios.`,
      },
      {
        titulo: "Qué cambia en la forma de trabajar",
        cuerpo: `- La reunión mensual deja de ser "cómo nos fue" y pasa a ser **"qué objetivo está en riesgo, por qué y qué movemos"**.
- El presupuesto se discute por retorno marginal, no por asignación histórica.
- El equipo comparte un mismo lenguaje: objetivo, KPI, peso, meta, brecha, palanca.
- La agencia y los proveedores se evalúan contra los KPIs que alimentan objetivos, no contra entregables sueltos.`,
      },
    ],
    checklist: [
      "Cada objetivo del Mapa está formulado como resultado, no como actividad.",
      "Cada KPI seguido está vinculado al menos a un objetivo, con peso.",
      "Todos los KPIs vinculados tienen meta mensual cargada.",
      "Hay una revisión mensual fija con agenda: brechas → causas → acciones.",
      "Al cierre del trimestre se registra qué se aprendió y qué se recalibra.",
    ],
    enBip: "El ciclo arranca en **Mapa Estratégico** (objetivos, KPIs y pesos) y en el panel **Metas** de cada tablero. Se lee en **Seguimiento Objetivos** (cumplimiento ponderado por objetivo) y se baja a cada plan de acción: Plan de Medios, Redes, Influencia, Web, SEO y Trade (Cuadros Básicos y Floor Share). El **Diagnóstico IA** al pie de cada tablero propone el plan de acción con evidencia.",
    relacionados: ["ciclo-construir", "ciclo-aprender", "ciclo-optimizar", "ciclo-acelerar", "modelo-objetivos-kpis"],
  },
  {
    id: "ciclo-construir",
    titulo: "01 · Construir: la base del trimestre",
    resumen: "Qué dejar listo al arrancar cada trimestre: fuentes conectadas, objetivos con peso, KPIs vinculados y metas mensuales realistas.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["transversal"],
    dashSlugs: ["mapa-estrategico", "overview"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "Para qué sirve esta etapa",
        cuerpo: `Construir es definir **contra qué te vas a medir** antes de ejecutar. Sin esta etapa, cualquier resultado se puede justificar a posteriori. Con ella, cada número del trimestre tiene una vara.

El entregable de Construir no es un documento: es un modelo cargado en la plataforma, con objetivos, KPIs, pesos y metas por mes.`,
      },
      {
        titulo: "Qué hacer, en orden",
        cuerpo: `1. **Revisá que las fuentes estén al día.** En **Monitoreo conexiones** cada proceso (Meta, GA4, Google Ads, DV360, OMD, BGT, Cuadros Básicos / Floor Share, GfK) muestra su última actualización con semáforo. Una fuente caída hace que un objetivo quede con baja cobertura.
2. **Confirmá los objetivos del trimestre.** Tres o cuatro, formulados como resultado (Notoriedad, Consideración, Ventas online). Si cambió la estrategia de negocio, cambiá el Mapa; si no, no lo toques por tocar.
3. **Revisá los pesos.** ¿Refleja el peso de cada objetivo dónde el negocio quiere ganar este trimestre? Un lanzamiento pide más peso en Notoriedad; una temporada de venta, en Conversión.
4. **Cargá las metas mensuales** de cada KPI vinculado, con estacionalidad. La meta del trimestre se reparte según el comportamiento histórico, no en tercios iguales.
5. **Definí los umbrales del semáforo** si el default (verde ≥100%, amarillo ≥90%) no aplica a un KPI.`,
      },
      {
        titulo: "Errores típicos",
        cuerpo: `- **Metas copiadas del año anterior + 10%** sin mirar inversión ni estacionalidad. La meta tiene que ser coherente con el presupuesto que la financia.
- **Demasiados KPIs.** Más de 4 o 5 por objetivo diluye el peso y hace ilegible el diagnóstico.
- **Objetivos que son tácticas** ("publicar 20 posts por mes"). Eso es una actividad; el objetivo es lo que esa actividad debería mover.
- **Arrancar a ejecutar sin metas cargadas.** El Seguimiento queda sin cobertura y el primer mes se pierde para aprender.`,
      },
    ],
    pasos: [
      { titulo: "Monitoreo conexiones", detalle: "Entrá a Monitoreo conexiones y verificá que cada proceso esté en verde (actualizado según su periodicidad)." },
      { titulo: "Mapa Estratégico", detalle: "Ajustá objetivos, pesos y el mix por categoría (Brand / Lavado / Refrigeración / Cocción) solo si cambió la estrategia." },
      { titulo: "Metas por tablero", detalle: "En cada tablero (Plan de Medios, Redes, Web) abrí el panel Metas y cargá los 12 meses del año, con foco en el trimestre en curso." },
      { titulo: "Validación", detalle: "Entrá a Seguimiento Objetivos: cada objetivo debería mostrar cobertura alta. Si no, falta una meta o una fuente." },
    ],
    checklist: [
      "Procesos de datos en verde en Monitoreo conexiones.",
      "3-4 objetivos con peso estratégico que suma 100%.",
      "Pesos de KPIs por objetivo cerrados al 100%.",
      "Metas mensuales cargadas para todos los KPIs vinculados.",
      "Cobertura de cada objetivo ≥ 80% en Seguimiento.",
    ],
    enBip: "Se hace en **Monitoreo conexiones** (estado de las fuentes), **Mapa Estratégico** y el panel **Metas** de cada tablero. Se valida en **Seguimiento Objetivos**, mirando la cobertura de cada objetivo antes que el porcentaje de cumplimiento.",
    relacionados: ["metodo-bip", "bip-conectar-fuentes", "bip-mapa-estrategico", "metas-mensuales", "objetivos-negocio-marketing"],
  },
  {
    id: "ciclo-aprender",
    titulo: "02 · Aprender: leer real vs meta y entender por qué",
    resumen: "Cómo leer el Seguimiento para encontrar la brecha que más pesa, distinguir ruido de señal y llegar a la causa antes de actuar.",
    nivel: "estrategico",
    etapa: "aprender",
    funnel: ["transversal"],
    dashSlugs: ["overview", "performance", "redes", "web"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "De arriba hacia abajo",
        cuerpo: `Aprender es leer en el orden correcto. Empezá siempre por el objetivo, no por la métrica:

1. **Objetivo.** ¿Qué objetivo está debajo de lo esperado, mes y acumulado del año?
2. **KPI.** Dentro de ese objetivo, ¿qué KPI explica la brecha? La prioridad es **peso × brecha**: un KPI que pesa 50% y está al 70% de su meta importa mucho más que uno que pesa 10% y está al 40%.
3. **Plan de acción.** Bajá al tablero del plan (Medios, Redes, Web) y buscá la causa: qué medio, qué pieza, qué fuente, qué categoría.
4. **Causa.** Formulá una hipótesis concreta y verificable: "el alcance cayó porque bajó la inversión en video en Meta", no "el alcance anduvo mal".`,
      },
      {
        titulo: "Señal vs ruido",
        cuerpo: `- **Un mes rojo no es una tendencia.** Mirá el acumulado del año (YTD) y los últimos tres meses. Si el YTD está verde y un mes se cae, puede ser estacionalidad o un corte de pauta puntual.
- **Mirá la cobertura antes que el porcentaje.** Un objetivo al 120% con 30% de cobertura no es confiable: faltan KPIs con dato.
- **Compará contra la inversión.** Si un KPI de volumen (alcance, impresiones, tráfico) cae junto con la inversión, no hay un problema de eficiencia: hay un problema de presupuesto o de ritmo de ejecución.
- **Buscá correlaciones, no coincidencias.** Que el engagement y las ventas suban el mismo mes no prueba nada. Que suban juntos varios meses, con un mecanismo que lo explique, empieza a ser evidencia.`,
      },
      {
        titulo: "Preguntas que ordenan la lectura",
        cuerpo: `- ¿Qué objetivo está en riesgo de no cumplirse en el trimestre?
- ¿Qué KPI con más peso está más lejos de su meta?
- ¿Es un problema de **volumen** (compramos poco), de **eficiencia** (compramos caro) o de **calidad** (compramos lo que no convierte)?
- ¿Qué cambió respecto del mes anterior: inversión, creativos, estacionalidad, competencia, stock?
- ¿Qué está funcionando mejor que lo esperado y todavía no escalamos?`,
      },
    ],
    checklist: [
      "Identificaste el objetivo en riesgo y el KPI de mayor peso × brecha.",
      "Verificaste cobertura y que la fuente esté al día.",
      "Separaste volumen, eficiencia y calidad.",
      "Tenés una hipótesis de causa verificable, con el dato que la sostiene.",
      "Registraste también lo que funciona mejor que lo esperado.",
    ],
    enBip: "Empezá en **Seguimiento Objetivos** (hero de objetivos + scorecard por plan, con desvío mes y YTD). Después bajá al tablero del plan y abrí el **Diagnóstico IA** (al pie del tablero): correlaciona KPIs con metas y objetivos y deja la evidencia numérica de cada hallazgo.",
    relacionados: ["ciclo-optimizar", "plan-de-accion", "bip-insights-chat", "reporte-mensual"],
  },
  {
    id: "ciclo-optimizar",
    titulo: "03 · Optimizar: reasignar con evidencia",
    resumen: "Cómo convertir el diagnóstico en decisiones concretas: qué pausar, qué reasignar, qué corregir y cómo medir si la decisión funcionó.",
    nivel: "estrategico",
    etapa: "optimizar",
    funnel: ["transversal"],
    dashSlugs: ["performance", "web", "redes", "overview"],
    kpiKeys: ["cpm", "cpc", "cpa", "cpcv", "roas"],
    secciones: [
      {
        titulo: "Optimizar no es gastar menos",
        cuerpo: `Optimizar es **comprar más resultado con el mismo presupuesto**, o el mismo resultado con menos. La unidad de decisión es el **costo por resultado** del objetivo correcto: CPM y alcance para notoriedad, CPCV y VTR para consideración en video, CPC y CTR para tráfico, CPA y ROAS para conversión.

Nunca compares costos entre objetivos distintos: un CPC alto en una campaña de alcance no es un problema, porque esa campaña no compra clicks.`,
      },
      {
        titulo: "Las cinco palancas",
        cuerpo: `1. **Reasignar entre medios o campañas.** Mové presupuesto del medio con peor costo por resultado al de mejor costo, dentro del mismo objetivo. Hacelo por tramos (20-30%) para no romper el aprendizaje de los algoritmos.
2. **Cambiar creativos.** Las piezas con VTR o CTR muy por debajo de su bucket consumen presupuesto sin retorno. Pausalas y rotá variantes con otro hook.
3. **Ajustar audiencias y frecuencia.** Si la frecuencia sube y el alcance no crece, estás repitiendo sobre las mismas personas: ampliá audiencia o bajá presión.
4. **Corregir la experiencia.** Si el tráfico llega pero no convierte, el problema está en la landing, el precio, el stock o el checkout, no en la pauta.
5. **Redistribuir en el tiempo.** Si la ejecución va adelantada o atrasada contra el plan, corregí el ritmo antes de que el mes cierre.`,
      },
      {
        titulo: "Cómo documentar una decisión",
        cuerpo: `Cada decisión se escribe con cuatro datos: **acción**, **por qué** (el dato que la justifica), **impacto esperado** (qué KPI y cuánto) y **cuándo se revisa**. Esto convierte la optimización en aprendizaje: al mes siguiente verificás si el impacto esperado ocurrió.

Ejemplo: "Pasamos 25% del presupuesto de la campaña de video de YouTube a Reels en Meta. Por qué: CPCV de Meta 40% más bajo con VTR similar. Esperado: +15% de vistas completas con la misma inversión. Revisión: cierre de mes."`,
      },
    ],
    checklist: [
      "Cada decisión compara costos dentro del mismo objetivo.",
      "Las reasignaciones se hacen por tramos, no todo de una vez.",
      "Cada acción tiene dueño, impacto esperado y fecha de revisión.",
      "Se separan problemas de pauta de problemas de experiencia (landing, stock, precio).",
    ],
    enBip: "La evidencia para optimizar está en **Plan de Medios** (tabla por medio, piezas con métricas de costo y calidad), **Web / Ecommerce** (conversión por fuente y embudo) y **Redes** (rendimiento por pilar). El **Diagnóstico IA** arma el plan de acción priorizado con impacto esperado.",
    relacionados: ["reasignacion-inversion", "benchmarks-medios", "plan-de-accion", "web-cro", "creatividades"],
  },
  {
    id: "ciclo-acelerar",
    titulo: "04 · Acelerar: escalar y recalibrar",
    resumen: "Qué hacer al cierre del trimestre: escalar lo que probó funcionar, podar lo que no, y recalibrar pesos, metas y benchmarks para el próximo ciclo.",
    nivel: "estrategico",
    etapa: "acelerar",
    funnel: ["transversal"],
    dashSlugs: ["overview", "mapa-estrategico", "inversion", "resultados"],
    kpiKeys: ["inv_facturacion", "share_mercado"],
    secciones: [
      {
        titulo: "Escalar lo que funciona",
        cuerpo: `Acelerar es poner más recursos donde la evidencia del trimestre mostró retorno. Lo que probó funcionar en un tramo chico se escala de forma gradual, vigilando el **retorno marginal**: toda palanca tiene un punto de saturación a partir del cual cada peso adicional rinde menos.

- En pauta, subí presupuesto de a 20-30% por semana en las campañas ganadoras y mirá si el costo por resultado se sostiene.
- En contenido, ampliá el pilar o formato que rindió sobre el promedio.
- En web, replicá la mejora de conversión en otras categorías o landings.`,
      },
      {
        titulo: "Recalibrar el modelo",
        cuerpo: `El cierre del trimestre es el momento de revisar el modelo, no solo los resultados:

- **Pesos.** ¿El KPI al que le diste 50% realmente explica el objetivo? Si el objetivo se movió aunque ese KPI no, el peso está mal calibrado.
- **Metas.** ¿Fueron alcanzables con la inversión disponible? Metas que siempre se cumplen al 150% o que nunca pasan del 60% dejan de guiar decisiones.
- **Benchmarks propios.** Actualizá tu p75 por formato y medio: es la vara que va a usar el trimestre siguiente.
- **Objetivos.** Solo se cambian si cambió la estrategia de negocio. La estabilidad del modelo es lo que permite comparar trimestres.`,
      },
      {
        titulo: "Cerrar contra el negocio",
        cuerpo: `El último paso es subir del marketing al negocio: ¿la facturación y el share acompañaron? ¿El ratio de inversión sobre facturación se mantuvo sano? Crecer en KPIs de marketing mientras el share cae es una alerta que ningún tablero de canal muestra por sí solo.`,
      },
    ],
    checklist: [
      "Listaste las 3 acciones que más movieron un objetivo y su costo.",
      "Definiste qué se escala, con qué incremento y qué umbral de costo lo frena.",
      "Revisaste pesos y metas con la evidencia del trimestre.",
      "Actualizaste los benchmarks propios (p75) por formato y medio.",
      "Contrastaste marketing contra facturación y share.",
    ],
    enBip: "Se hace en **Seguimiento Objetivos** (cierre del trimestre), **Mapa Estratégico** (pesos), el panel **Metas** de cada tablero (próximo trimestre) e **Inversión de Marketing** y **Resultados Comerciales** (GfK) para cerrar contra el negocio.",
    relacionados: ["metodo-bip", "reasignacion-inversion", "presupuesto-marketing", "metas-mensuales", "medicion-atribucion"],
  },
];
