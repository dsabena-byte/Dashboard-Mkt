import type { Modulo } from "./types";

// Nivel 2 — Táctico: medios pagos, creatividades y asignación.
export const TACTICO_MEDIOS: Modulo[] = [
  {
    id: "plan-de-medios",
    titulo: "Plan de medios por etapa del funnel",
    resumen: "Cómo armar el mix de medios: qué objetivo de compra usar en cada etapa, cómo repartir la inversión, flighting y qué KPI evalúa cada línea.",
    nivel: "tactico",
    etapa: "construir",
    funnel: ["awareness", "consideracion", "conversion"],
    canal: ["Meta", "Google", "YouTube", "TikTok", "Programática"],
    dashSlugs: ["performance", "inversion"],
    kpiKeys: ["inversion", "alcance", "frecuencia", "cpm", "vtr", "cpcv", "ctr", "cpc", "cpa", "roas"],
    secciones: [
      {
        titulo: "El plan empieza por el objetivo, no por el medio",
        cuerpo: `Un plan de medios es la traducción de los objetivos del Mapa a compras concretas. El orden correcto es:

1. **Objetivo** (del Mapa): Notoriedad, Consideración, Conversión.
2. **Audiencia:** a quién hay que mover y dónde está.
3. **KPI de la línea:** qué se compra y con qué se evalúa.
4. **Medio y formato:** dónde se compra ese KPI con mejor costo.
5. **Inversión y calendario:** cuánto y cuándo.

Cada línea del plan tiene que poder responder: ¿qué objetivo mueve y con qué costo por resultado la vamos a evaluar?`,
      },
      {
        titulo: "Mix por etapa",
        cuerpo: `- **Awareness.** Objetivo de compra: alcance o reconocimiento (CPM). Medios: video en Meta y TikTok, YouTube (bumper y skippable), programática, TV y vía pública si el presupuesto lo permite. KPI: alcance único, frecuencia, CPM.
- **Consideración.** Objetivo: vistas de video, tráfico o interacción. Medios: video más largo en YouTube y Meta, Demand Gen, influencers pautados. KPI: VTR, CPCV, CTR, tráfico calificado (sesiones con interacción).
- **Conversión.** Objetivo: ventas o clientes potenciales. Medios: búsqueda, Performance Max, campañas de ventas en Meta y TikTok, retail media. KPI: CPA, ROAS, tasa de conversión.

Una referencia de partida para una marca establecida es repartir cerca de 60% en awareness y consideración y 40% en conversión, y ajustar según el peso de los objetivos en el Mapa y la etapa de la marca.`,
      },
      {
        titulo: "Flighting: cómo distribuir en el tiempo",
        cuerpo: `- **Continuo:** presencia pareja todo el año. Para categorías de compra frecuente o con demanda estable.
- **Por ráfagas (flighting):** períodos de alta presión y períodos sin pauta. Para eventos, lanzamientos y categorías estacionales. Riesgo: en los huecos la marca desaparece.
- **Pulsante:** una base continua baja más picos en momentos clave. Es el esquema más habitual para marcas medianas y grandes: sostiene memoria y concentra en los momentos de compra.

Los picos se anticipan a la demanda: la presión de awareness arranca 2 a 4 semanas antes del evento comercial, y la de conversión se concentra en la semana del evento.`,
      },
      {
        titulo: "Qué no hacer",
        cuerpo: `- Repartir el presupuesto parejo entre medios "para estar en todos lados". Diluye la frecuencia efectiva en cada uno.
- Comprar awareness con objetivo de tráfico porque el CPC es barato: el algoritmo busca clickeadores, no alcance.
- Cambiar la estructura de campaña todas las semanas: los algoritmos necesitan estabilidad para optimizar.
- Planificar sin medir: cada línea tiene que tener su KPI cargado como meta antes de salir.`,
      },
    ],
    pasos: [
      { titulo: "Bajá los objetivos a líneas", detalle: "Una o más líneas por objetivo del Mapa, con su audiencia y KPI." },
      { titulo: "Estimá costos", detalle: "Usá tus costos históricos (CPM, CPCV, CPC, CPA) por medio. Sin historia, arrancá con la mediana del primer mes y recalibrá." },
      { titulo: "Calculá metas de volumen", detalle: "Presupuesto de la línea ÷ costo esperado = meta de alcance, vistas, clicks o conversiones." },
      { titulo: "Definí el calendario", detalle: "Continuo, ráfagas o pulsante, con picos anticipados a los eventos." },
      { titulo: "Cargá las metas en la plataforma", detalle: "En el panel Metas de Plan de Medios, mes a mes." },
    ],
    checklist: [
      "Cada línea del plan tiene objetivo, audiencia, KPI y costo esperado.",
      "El objetivo de compra de la plataforma coincide con el KPI de la línea.",
      "La presión de awareness se anticipa a los eventos comerciales.",
      "Las metas de volumen salen de presupuesto ÷ costo esperado.",
      "Hay una reserva de prueba (10-15%).",
    ],
    enBip: "Se ejecuta y se sigue en **Plan de Medios**: cards de Inversión, Alcance único, Frecuencia, Impresiones, VTR y Clicks contra meta, más la vista por medio y las piezas con sus métricas. El presupuesto total se controla en **Inversión de Marketing**.",
    relacionados: ["alcance-frecuencia", "benchmarks-medios", "medios-offline", "presupuesto-marketing", "meta-ads-estructura", "google-search"],
  },
  {
    id: "medios-offline",
    titulo: "Medios offline y medios sin API: cómo entran y cómo se leen",
    resumen: "TV Cable, OOH y DOOH, más TikTok, Mercado Ads y Geo Mobile (sin API) en el mismo plan que lo digital: de dónde sale cada dato, cómo leer GRPs, contactos, alcance y frecuencia, y cómo compararlos (y cuándo no) con la pauta digital.",
    nivel: "tactico",
    etapa: "aprender",
    funnel: ["awareness", "consideracion"],
    canal: ["TV Cable", "OOH", "DOOH", "TikTok", "Mercado Ads", "Geo Mobile"],
    dashSlugs: ["performance", "inversion"],
    kpiKeys: ["inversion", "grps", "cpp", "contactos", "alcance", "frecuencia", "cpm"],
    secciones: [
      {
        titulo: "Por qué van en el mismo plan",
        cuerpo: `Si una parte importante de la inversión va a TV, vía pública o pantallas y el tablero solo mira Meta y Google, cualquier conclusión sobre el mix está sesgada: el digital parece "todo el plan" y se le atribuye lo que en realidad movió la TV.

En **Plan de Medios** conviven dos tipos de fuente:

- **Medios con API (la plataforma es la fuente de verdad):** Meta, YouTube y Programmatic (DV360), Google Search y Demand Gen (Google Ads).
- **Medios sin API, cargados desde los reportes mensuales de OMD:** los digitales sin conexión (**TikTok, Mercado Ads, Geo Mobile**) y los tradicionales (**TV Cable, OOH, DOOH**), que siguen el plan de medios aparte.

La regla que ordena todo: **medio con API → volumen de la API; el reporte de OMD solo para medios sin API.** Por eso la fila de Meta que trae OMD se ignora (subcontaba la inversión de video).`,
      },
      {
        titulo: "Cómo entran los datos",
        cuerpo: `- La carga manual se hace por mes y categoría (Brand, Lavado, Refrigeración, Cocción, UGC, Promoción) con inversión y, cuando el reporte los trae, impresiones, alcance, frecuencia, clics y views.
- Cuando el reporte da un total que no abre por categoría (por ejemplo Mercado Ads o Geo Mobile), las impresiones y clics se reparten en proporción a la inversión de cada categoría.
- **OOH es un dato fijo** del plan de gran formato: no cambia mes a mes con el reporte.
- Los **meses futuros** son plan: el tablero solo toma meses cerrados para el "real".
- Nunca se cargan a mano medios que ya vienen por API (DV360, Google): se duplicaría el volumen. Si falta un mes de un medio con API, se corrige el proceso de sincronización, no la carga.`,
      },
      {
        titulo: "GRPs, TRPs y costo por GRP",
        cuerpo: `- **GRP (Gross Rating Point):** 1 GRP = 1% de la población de referencia expuesta una vez. Es presión bruta: **GRPs = alcance % × frecuencia** (o la suma de los ratings de cada salida).
- **TRP:** lo mismo pero sobre el **target** comprado (ej. mujeres 25-54 ABC1). Para evaluar una campaña, los TRPs dicen más que los GRPs de hogares.
- **Costo por GRP (CPP o CPR):** inversión ÷ GRPs. Es el "CPM" de la TV y la radio.

Cómo leerlo: el CPP **se compara dentro del mismo medio, target y franja**. El prime time y los programas de alto rating tienen un CPP más alto; se justifica si llegan a gente que el resto del plan no alcanza. Un soporte con CPP muy por encima de la mediana del medio y sin alcance incremental es el primer candidato a renegociar o recortar.`,
      },
      {
        titulo: "Alcance y frecuencia",
        cuerpo: `- **Alcance 1+:** % (o personas) del target que vio al menos una vez. **Alcance 3+** (frecuencia efectiva): quienes vieron 3 veces o más, la medida habitual de "impacto que se recuerda".
- **Frecuencia media:** GRPs ÷ alcance %. Si subís GRPs y el alcance casi no crece, estás comprando frecuencia sobre las mismas personas (la **curva de alcance** se aplana).
- **El alcance no se deduplica entre medios:** la misma persona ve TV y usa Instagram. En este dashboard el **Alcance único** de Plan de Medios es la **suma del alcance de cada medio** (no deduplicado): leelo como presión, no como personas únicas. Para un alcance combinado real hace falta el consolidado del reporte de la agencia o un estudio de duplicación.`,
      },
      {
        titulo: "Vía pública y DOOH",
        cuerpo: `Estos medios no tienen rating: se miden con **contactos** (impactos estimados por tráfico o circulación) y su **CPM de contactos** (inversión ÷ contactos × 1.000).

- **Vía pública (OOH) y DOOH:** contactos por circuito o pantalla según el tráfico estimado; en DOOH, además, cantidad de salidas (spots). Compará circuitos del mismo tipo y zona.
- En las señales automáticas, TV, OOH y DOOH se tratan como **offline** (sus contactos van aparte) y el CPM mensual se calcula **solo con medios que informan impresiones**.`,
      },
      {
        titulo: "Cómo comparar offline con digital",
        cuerpo: `Un contacto offline y una impresión digital **no son lo mismo**: cambian la visibilidad (una impresión digital puede no verse; un spot puede pasar con la tele de fondo), la atención y cómo se estima cada número. Por eso:

- La **inversión** sí se suma: es el mismo dinero.
- Usá el **CPM de contactos vs el CPM digital** como orden de magnitud, no como regla para mover presupuesto: el rol de la TV (alcance masivo rápido) no es el del Search (capturar demanda).
- Buscá el **efecto de lo offline en lo digital:** en los meses con TV o vía pública deberían subir las búsquedas de marca (Optimización SEO), el tráfico directo (Web) y la interacción en redes. Si no se mueven, revisá el mensaje o la presión.`,
      },
    ],
    pasos: [
      { titulo: "Recibí el reporte mensual de OMD", detalle: "Inversión y performance por medio y categoría. Para los digitales sin API, usá el valor neto de la planilla digital de OMD (no el \"media cost\" bruto del PDF)." },
      { titulo: "Cargá solo medios sin API", detalle: "TikTok, Mercado Ads, Geo Mobile y los tradicionales (TV Cable, OOH, DOOH). Meta, DV360 y Google no se cargan: vienen por API." },
      { titulo: "Conciliá contra OMD", detalle: "Compará el total digital del tablero con la planilla de OMD mes a mes; una diferencia grande suele ser un proceso de API incompleto (revisá Monitoreo conexiones)." },
      { titulo: "Leé el mix y la eficiencia", detalle: "Impacto Campaña: inversión y volumen contra meta. Eficiencia Medios: costo por resultado por medio." },
      { titulo: "Cruzalo con el resto", detalle: "Compará los meses con TV/vía pública contra búsquedas de marca y tráfico en Web; ajustá el plan en la revisión mensual." },
    ],
    checklist: [
      "Cada fila tiene mes, medio, categoría e inversión neta.",
      "Los medios con API (Meta, DV360, Google) no están cargados a mano.",
      "TV trae GRPs o TRPs (idealmente sobre el target comprado).",
      "El alcance se lee como suma por medio, sin asumir personas únicas.",
      "Los meses con offline tienen soporte digital (búsqueda de marca, remarketing).",
    ],
    benchmarks: [
      { metrica: "Frecuencia efectiva en TV", valor: "3+ en el período de la campaña", nota: "Criterio habitual de planificación; validalo con tu propia curva de alcance." },
      { metrica: "Costo por GRP", valor: "vs la mediana del mismo medio y target", nota: "No hay un valor universal: depende de franja, target y temporada. La vara es tu propia historia." },
      { metrica: "CPM de contactos offline", valor: "orden de magnitud vs tu CPM digital", nota: "No son unidades idénticas: sirve para detectar desvíos grandes, no para reasignar punto a punto." },
    ],
    enBip: "En **Plan de Medios** los medios sin API entran desde el reporte de OMD y los medios con API desde su plataforma (gap-fill por medio). Suman a la **Inversión** (cards, metas y Seguimiento de objetivos) y al mix por medio. El presupuesto total, contra el BGT, se controla en **Inversión de Marketing**.",
    relacionados: ["plan-de-medios", "alcance-frecuencia", "benchmarks-medios", "reasignacion-inversion", "tableros-planilla"],
  },
  {
    id: "alcance-frecuencia",
    titulo: "Alcance, frecuencia efectiva y saturación",
    resumen: "Cómo equilibrar cuánta gente alcanzás y cuántas veces: frecuencia efectiva, topes, señales de saturación y alcance incremental.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["awareness"],
    canal: ["Meta", "YouTube", "TikTok", "Programática"],
    dashSlugs: ["performance"],
    kpiKeys: ["alcance", "frecuencia", "impresiones", "cpm"],
    secciones: [
      {
        titulo: "Dos variables que se compensan",
        cuerpo: `Con un presupuesto fijo, **impresiones = alcance × frecuencia**. Si subís una, bajás la otra. La decisión es cuánto de cada una necesita tu objetivo:

- **Alcance** construye notoriedad: más personas que saben que existís. Es el principal motor de crecimiento de una marca (más compradores, no compradores más intensos).
- **Frecuencia** construye memoria: la exposición repetida fija el mensaje. Pero tiene rendimientos decrecientes: la décima vez aporta mucho menos que la segunda, y a partir de cierto punto irrita.`,
      },
      {
        titulo: "Frecuencia efectiva",
        cuerpo: `La frecuencia efectiva es el rango en el que el mensaje se recuerda sin desperdiciar inversión. Depende del contexto:

- **Marca conocida, mensaje simple:** 1 a 2 exposiciones por semana alcanzan.
- **Marca o producto nuevo, mensaje complejo:** 3 o más por semana durante las primeras semanas.
- **Creatividad fuerte:** necesita menos frecuencia que una débil.

Como regla de control mensual por campaña, una frecuencia **de 2 a 4** es sana; **por encima de 4** empezá a vigilar saturación; **por encima de 6**, casi seguro estás pagando impresiones que no suman.`,
      },
      {
        titulo: "Señales de saturación",
        cuerpo: `- La frecuencia sube semana a semana y el **alcance único deja de crecer**.
- El **CTR y el VTR caen** en la misma pieza a medida que pasa el tiempo (fatiga creativa).
- El **CPM sube** porque el algoritmo compite más caro por la misma audiencia chica.
- Aparecen **comentarios negativos** del tipo "otra vez este anuncio".`,
      },
      {
        titulo: "Cómo corregir",
        cuerpo: `1. **Ampliá la audiencia:** sacá exclusiones innecesarias, sumá ubicaciones, usá segmentación amplia o Advantage+.
2. **Poné un tope de frecuencia** en las campañas de alcance (Meta y DV360 lo permiten; en YouTube se configura por campaña).
3. **Rotá creatividades** cada 2 a 4 semanas en campañas de alta presión.
4. **Sumá un medio** que alcance gente que el actual no alcanza (por ejemplo, TikTok para audiencias más jóvenes o CTV para hogares).`,
      },
    ],
    benchmarks: [
      { metrica: "Frecuencia mensual por campaña", valor: "2-4 sano · >4 alerta · >6 exceso", nota: "Criterio de alertas de la plataforma para campañas de awareness. Ajustalo según la complejidad del mensaje." },
      { metrica: "Alcance vs plan", valor: "≥ 80% del planificado", nota: "Por debajo, revisá presupuesto, pujas o tamaño de audiencia." },
      { metrica: "Rotación creativa", valor: "cada 2-4 semanas", nota: "En campañas de alta presión; antes si cae el CTR/VTR de la pieza." },
    ],
    checklist: [
      "Mirás alcance y frecuencia juntos, nunca impresiones solas.",
      "Las campañas de alcance tienen tope de frecuencia.",
      "Revisás semanalmente si el alcance único sigue creciendo.",
      "Tenés creatividades de reemplazo listas antes de lanzar.",
    ],
    enBip: "En **Plan de Medios** las cards de **Alcance único** y **Frecuencia** se leen juntas contra meta; la vista mensual muestra si el alcance crece o solo sube la frecuencia. El alcance y la frecuencia se toman de Meta (Google Ads no expone alcance único comparable).",
    relacionados: ["plan-de-medios", "creatividades", "meta-ads-audiencias", "benchmarks-medios"],
  },
  {
    id: "benchmarks-medios",
    titulo: "Cómo evaluar cada pieza según formato y objetivo",
    resumen: "La vara correcta para cada compra: CPCV en video, ThruPlay en Meta, CPM y frecuencia en alcance, CTR y CPC en tráfico, CPA y ROAS en conversión, y alertas de ritmo de gasto.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["awareness", "consideracion", "conversion"],
    canal: ["Meta", "Google", "YouTube", "TikTok", "Programática"],
    dashSlugs: ["performance"],
    kpiKeys: ["cpcv", "thruplay", "vtr", "vtr_completo", "cpm", "ctr", "cpc", "cpa", "roas", "frecuencia"],
    secciones: [
      {
        titulo: "Principio: cada pieza contra lo que su formato debería entregar",
        cuerpo: `Un umbral plano ("VTR menor a X es malo") no sirve: un bumper de 6 segundos y un video saltable de 30 no se pueden medir igual. La pregunta correcta es: **¿esta pieza entrega lo que su formato y su objetivo deberían entregar, a un costo por resultado real eficiente?**

Y la vara apunta a lo mejor, no al promedio: **benchmark = máximo entre la referencia de industria del formato y el percentil 75 de tus mejores piezas en ese mismo formato y medio**. Si la mayoría de tus campañas anduvo mal, el promedio es malo y no puede ser la vara.`,
      },
      {
        titulo: "Video: la métrica madre es el costo por vista completa (CPCV)",
        cuerpo: `El VTR solo dice qué porcentaje vio; el **CPCV** dice cuánto pagaste por cada vista completa, que es lo que construye memoria. Traduce "gasté mucho y lo vio poca gente entera" en plata.

- **Formatos forzados** (bumper, no saltable): la completación debería superar 90%. Por debajo de 85% hay un problema de formato, de etiquetado o de tráfico inválido.
- **Formatos saltables:** la completación es menor por diseño; lo que importa es el CPCV y la **curva de retención**. Una caída fuerte antes del 25% indica un hook débil.
- **Alerta de costo:** una pieza con CPCV 3 veces mayor que la mediana de su mismo formato, medio y mes merece revisión; 8 veces mayor, pausa.`,
      },
      {
        titulo: "Meta: ThruPlay como referencia",
        cuerpo: `En Meta, ThruPlay cuenta las reproducciones de 15 segundos o completas si el video es más corto. Es la medida más estable de atención en el feed. Como referencia: tasa de ThruPlay sobre impresiones de **15% o más** es un buen objetivo; **menos de 8%** es alerta y **menos de 3%** indica que la pieza no está reteniendo.`,
      },
      {
        titulo: "Alcance, tráfico y conversión",
        cuerpo: `- **Alcance (compra CPM):** CPM contra la mediana de tu medio (los CPM varían mucho entre plataformas), alcance contra plan (alerta si queda por debajo de 80%) y frecuencia (alerta sobre 4).
- **Tráfico (compra CPC):** el CTR se compara **dentro de su medio**: búsqueda y social no se parecen en nada. Para campañas de tráfico en redes, apuntá a 1% o más; debajo de 0,6% revisá creatividad y segmentación. CPC con alerta si supera 1,5 veces la mediana del medio.
- **Conversión:** CPA contra el máximo que tu margen tolera y ROAS contra su punto de equilibrio. CPA 1,5 veces sobre el promedio es alerta.`,
      },
      {
        titulo: "Ritmo de gasto y piezas anómalas",
        cuerpo: `- **Ritmo acelerado:** gasto acumulado del mes 30% por encima de lo que correspondería a los días transcurridos.
- **Ráfaga anómala:** una pieza que se lleva una porción muy grande del gasto del medio en pocos días (por ejemplo, más de 8% en 5 días o menos).
- **Consumo desmedido:** una pieza que gasta por día 8 veces más que la mediana de las piezas del medio.
- **Gasto sin resultado:** inversión relevante con clicks, vistas y alcance casi en cero (configuración rota).
- **Sub-ejecución:** mes cerrado por debajo de 70% del plan.`,
      },
    ],
    benchmarks: [
      { metrica: "Completación en formato forzado", valor: "≥ 90% · crítico < 85%", nota: "Bumper y no saltable. Por la física del formato, no por percentil." },
      { metrica: "ThruPlay rate (Meta)", valor: "≥ 15% · alerta < 8% · crítico < 3%", nota: "Referencia sobre campañas reales de video en Meta." },
      { metrica: "CPCV de una pieza", valor: "alerta > 3× mediana · crítico > 8×", nota: "Mediana del mismo formato, medio y mes. Auto-escala por cliente." },
      { metrica: "CTR búsqueda", valor: "≈ 3-6%", nota: "Varía por categoría y por marca vs genérico. La marca propia suele estar por encima." },
      { metrica: "CTR tráfico en redes", valor: "≥ 1% · alerta < 0,6%", nota: "Campañas con objetivo tráfico. En awareness, 0,1-0,4% es normal y no es un problema." },
      { metrica: "CPM relativo entre plataformas", valor: "TikTok < Meta < YouTube", nota: "En campañas reales analizadas: TikTok ≈ 0,4× y YouTube ≈ 1,7× el CPM de Meta. Compará siempre dentro del medio." },
      { metrica: "Frecuencia", valor: "alerta > 4 · exceso > 6", nota: "Mensual por campaña de awareness." },
    ],
    checklist: [
      "Cada pieza está clasificada por objetivo y formato antes de evaluarla.",
      "El video se evalúa por CPCV y curva de retención, no por VTR crudo.",
      "El CTR se compara solo dentro del mismo medio.",
      "El benchmark es max(industria, p75 propio), no el promedio.",
      "Revisás el ritmo de gasto a mitad de mes.",
    ],
    enBip: "En **Plan de Medios** cada pieza muestra sus métricas de costo y calidad (CPM, CTR, VTR, vistas completas) y la vista por medio compara el costo por resultado. Las mismas reglas alimentan las alertas de desvío del plan de medios.",
    relacionados: ["lectura-video", "alcance-frecuencia", "reasignacion-inversion", "creatividades"],
  },
  {
    id: "creatividades",
    titulo: "Creatividades que funcionan",
    resumen: "El hook de los primeros segundos, marca temprana, formatos nativos por plataforma, variantes para testear y cómo leer la fatiga creativa.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["awareness", "consideracion", "conversion"],
    canal: ["Meta", "TikTok", "YouTube", "Google"],
    dashSlugs: ["performance", "redes"],
    kpiKeys: ["vtr", "thruplay", "ctr", "cpcv", "engagement"],
    secciones: [
      {
        titulo: "La creatividad es la palanca más grande",
        cuerpo: `Con los algoritmos de compra cada vez más automatizados (Advantage+, Performance Max, segmentación amplia), la segmentación fina pesa menos y **la creatividad pasa a ser la principal variable de rendimiento que controlás**. Una pieza fuerte puede rendir varias veces más que una débil con el mismo presupuesto y la misma audiencia.`,
      },
      {
        titulo: "Principios para video",
        cuerpo: `- **Hook en los primeros 2-3 segundos.** Movimiento, un rostro, una pregunta, un resultado visible, un contraste. Si no frenás el scroll ahí, el resto no existe.
- **Marca temprana.** Mostrá la marca o el producto en los primeros segundos, integrado a la escena, no solo en el cierre. Quien abandona a los 3 segundos igual se lleva la marca.
- **Pensado sin sonido y con sonido.** Subtítulos y texto en pantalla para quien mira en silencio; audio que sume en TikTok y Reels.
- **Un mensaje por pieza.** Un beneficio claro vale más que cinco atributos.
- **Activos distintivos.** Colores, sonidos, personajes o tipografía propios, repetidos de forma consistente: son los que construyen memoria de marca.
- **Llamado a la acción coherente con la etapa.** En awareness puede no haberlo; en conversión tiene que ser explícito.`,
      },
      {
        titulo: "Formatos por plataforma",
        cuerpo: `- **Meta (Reels y Stories):** vertical 9:16; en feed, 4:5 rinde mejor que 1:1. Respetá las zonas seguras (arriba y abajo quedan tapadas por la interfaz).
- **TikTok:** vertical 9:16, estética nativa (que parezca contenido, no aviso), ritmo rápido, entre 9 y 30 segundos. Los Spark Ads usan posteos orgánicos reales.
- **YouTube:** 16:9 para in-stream; bumper de 6 segundos para frecuencia; saltable con el mensaje clave antes del segundo 5; Shorts en 9:16.
- **Display y Demand Gen:** varias proporciones de imagen (horizontal, cuadrada, vertical) y textos cortos; el sistema combina.
- **Búsqueda:** el "creativo" son los títulos y descripciones; cuanto más relevantes a la búsqueda, mejor calidad y menor costo.`,
      },
      {
        titulo: "Testear con método",
        cuerpo: `1. **Testeá conceptos antes que detalles.** Dos ideas distintas enseñan más que dos colores de botón.
2. **Una variable por vez** cuando comparás variantes de una misma idea (hook, oferta, formato).
3. **Volumen suficiente:** esperá a que cada variante tenga resultados comparables antes de decidir.
4. **Registrá el aprendizaje:** qué hook, qué beneficio y qué formato ganaron, para el próximo brief.

Fatiga creativa: cuando el CTR o el VTR de una pieza caen de forma sostenida mientras la frecuencia sube, la pieza se gastó. Reemplazala, no le subas presupuesto.`,
      },
    ],
    checklist: [
      "La pieza engancha en los primeros 3 segundos.",
      "La marca aparece antes del segundo 3.",
      "Funciona sin sonido (subtítulos, texto en pantalla).",
      "Tiene la proporción nativa de cada ubicación.",
      "Hay al menos 3 variantes por conjunto de anuncios.",
      "Hay piezas de reemplazo para rotar cuando aparezca fatiga.",
    ],
    enBip: "En **Plan de Medios** las piezas se muestran con sus métricas (VTR, CTR, costo) para comparar creativos del mismo formato. En **Redes** el rendimiento por pilar y por posteo indica qué contenido orgánico conviene convertir en pauta.",
    relacionados: ["benchmarks-medios", "lectura-video", "contenido-organico", "influencers-ugc", "tiktok-ads"],
  },
  {
    id: "reasignacion-inversion",
    titulo: "Reasignar inversión con evidencia",
    resumen: "Cómo mover presupuesto entre medios, campañas y piezas sin romper el aprendizaje de los algoritmos, basándote en costo por resultado y retorno marginal.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["transversal"],
    dashSlugs: ["performance", "inversion", "web"],
    kpiKeys: ["cpm", "cpcv", "cpc", "cpa", "roas", "ejecucion_presupuesto"],
    secciones: [
      {
        titulo: "El criterio: retorno marginal",
        cuerpo: `La pregunta no es "qué canal rinde más en promedio", sino **"dónde rinde más el próximo peso"**. Todo canal tiene una curva de saturación: los primeros pesos compran la audiencia más barata y receptiva; los siguientes, cada vez más cara. Un canal con excelente promedio puede estar ya saturado, y uno con promedio mediocre puede tener mucho recorrido.

Señales de que un canal está cerca de saturarse: sube el CPM o el CPA a medida que sube el presupuesto, la frecuencia crece y el alcance no, el volumen de resultados crece menos que proporcionalmente a la inversión.`,
      },
      {
        titulo: "Reglas para reasignar",
        cuerpo: `1. **Solo dentro del mismo objetivo.** Se compara CPCV con CPCV y CPA con CPA. Nunca se saca plata de awareness porque "no convierte".
2. **Con volumen suficiente.** No decidas con pocos días o pocas conversiones: esperá a tener datos estables (en conversión, al menos varias decenas de eventos por campaña).
3. **Por tramos.** Movimientos de 20-30% por vez. Los cambios bruscos de presupuesto reinician la fase de aprendizaje en Meta y afectan la estabilidad en Google.
4. **Mirá el efecto cruzado.** Si cortás video y a las 3 semanas caen las búsquedas de marca o el tráfico directo, el video estaba generando demanda que otro canal cosechaba.
5. **Documentá y revisá.** Cada reasignación con impacto esperado y fecha de revisión.`,
      },
      {
        titulo: "Matriz de decisión",
        cuerpo: `- **Costo por resultado bajo + poca inversión:** escalar gradualmente.
- **Costo bajo + mucha inversión:** sostener y vigilar saturación.
- **Costo alto + poca inversión:** darle una prueba acotada con otra creatividad o audiencia; si no mejora, cortar.
- **Costo alto + mucha inversión:** es la prioridad de reasignación. Revisá creatividad, segmentación y objetivo de compra antes de cortar.`,
      },
    ],
    checklist: [
      "Comparaste costos dentro del mismo objetivo y formato.",
      "Hay volumen suficiente para decidir.",
      "El movimiento es de 20-30%, no total.",
      "Dejaste registrado el impacto esperado y la fecha de revisión.",
      "Revisaste el efecto sobre búsquedas de marca y tráfico directo.",
    ],
    enBip: "En **Plan de Medios** la vista por medio y la tabla de piezas muestran el costo por resultado; el **Diagnóstico IA** propone de dónde a dónde mover presupuesto con el impacto esperado. El control del total está en **Inversión de Marketing**.",
    relacionados: ["benchmarks-medios", "ciclo-optimizar", "presupuesto-marketing", "medicion-atribucion", "plan-de-accion"],
  },
  {
    id: "campanas-estacionales",
    titulo: "Campañas estacionales y eventos comerciales",
    resumen: "Cómo planificar Hot Sale, CyberMonday, Black Friday, Día de la Madre y otros picos: anticipación, presión escalonada, stock y medición.",
    nivel: "tactico",
    etapa: "acelerar",
    funnel: ["awareness", "consideracion", "conversion"],
    dashSlugs: ["performance", "web", "seo-search"],
    kpiKeys: ["busquedas", "trafico", "conversion", "ingresos", "roas", "cpa"],
    secciones: [
      {
        titulo: "El calendario argentino",
        cuerpo: `Los eventos que concentran demanda en Argentina, con variaciones por categoría: **Hot Sale** (mayo, organizado por la CACE), **Día del Padre** (junio), **Día del Niño** (agosto), **Día de la Madre** (octubre), **CyberMonday** (noviembre, CACE), **Black Friday** (noviembre) y **Navidad y Reyes**. A eso se suma la estacionalidad de cada categoría: climatización y bebidas en verano, calefacción en invierno, vuelta a clases en febrero y marzo.

En eventos de descuento la conversión sube, los CPM y CPC también (hay más anunciantes compitiendo) y la decisión de compra se concentra en pocos días.`,
      },
      {
        titulo: "Las tres fases",
        cuerpo: `1. **Calentamiento (3-4 semanas antes).** Awareness y consideración: video, contenido orgánico, construcción de audiencias (visitantes, interactuantes, lista de CRM). Es barato comparado con los días del evento y es lo que hace rendir la fase siguiente.
2. **Evento.** Máxima presión de conversión: búsqueda (incluida la marca, porque los competidores pujan por ella), campañas de ventas, retargeting a las audiencias construidas, email y WhatsApp a la base. Presupuestos preparados para escalar el primer día.
3. **Extensión y cierre (1 semana después).** Última oportunidad y recuperación de carritos. Después, medición.`,
      },
      {
        titulo: "Checklist operativo",
        cuerpo: `- **Stock y precios** coordinados con comercial: pautar un producto sin stock quema presupuesto y reputación.
- **Web preparada:** velocidad de carga, landing del evento, checkout probado, capacidad del servidor.
- **Seguimiento funcionando:** eventos de compra en GA4 y píxeles verificados antes, no durante.
- **Creatividades aprobadas con anticipación:** las revisiones de las plataformas se demoran más en temporada alta.
- **Límites de presupuesto con margen** para no quedarte sin inversión el día de mayor conversión.`,
      },
      {
        titulo: "Cómo medir un evento",
        cuerpo: `Compará contra el mismo evento del año anterior y contra las semanas previas, no contra el promedio del mes. Mirá tres niveles: **volumen** (tráfico, transacciones, ingresos), **eficiencia** (CPA, ROAS, conversión) y **marca** (búsquedas de marca y share of search durante el evento). Documentá qué funcionó para el próximo.`,
      },
    ],
    checklist: [
      "Calendario de eventos cargado en las metas mensuales.",
      "Fase de calentamiento planificada 3-4 semanas antes.",
      "Stock, precios y web validados con comercial y tecnología.",
      "Seguimiento de conversiones verificado antes del evento.",
      "Creatividades aprobadas con al menos una semana de margen.",
    ],
    enBip: "Las metas con estacionalidad se cargan en el panel **Metas** de cada tablero. Durante el evento, **Plan de Medios** muestra la ejecución, **Web / Ecommerce** la conversión e ingresos por fuente, y **Optimización SEO** la demanda de búsqueda de la categoría y de la marca.",
    relacionados: ["metas-mensuales", "plan-de-medios", "web-cro", "crm-email", "brief-campana"],
  },
  {
    id: "brief-campana",
    titulo: "El brief de campaña",
    resumen: "Qué tiene que tener un brief para que la agencia y el equipo ejecuten lo que el objetivo necesita: objetivo, audiencia, insight, mensaje, canales, KPIs y metas.",
    nivel: "tactico",
    etapa: "construir",
    funnel: ["transversal"],
    dashSlugs: ["mapa-estrategico", "performance"],
    kpiKeys: [],
    secciones: [
      {
        titulo: "Un brief conectado al Mapa",
        cuerpo: `Un brief es el puente entre la estrategia y la ejecución. En el Proceso Estratégico, **todo brief arranca citando el objetivo del Mapa que la campaña tiene que mover y los KPIs con los que se va a medir**. Si la campaña no mueve ningún objetivo del Mapa, la pregunta es por qué se hace.`,
      },
      {
        titulo: "Las partes",
        cuerpo: `1. **Objetivo de negocio y de marketing:** qué objetivo del Mapa mueve y cuánto (meta).
2. **Audiencia:** quién es, qué sabe hoy de la marca, qué la frena. Datos, no adjetivos.
3. **Insight:** una verdad del consumidor que la marca puede resolver. No es un dato ni un deseo de la marca.
4. **Mensaje único:** qué tiene que pensar o hacer la audiencia después de ver la campaña. Una frase.
5. **Razones para creer:** pruebas del mensaje (atributos, garantías, testimonios).
6. **Mandatorios:** marca, legales, tono, activos distintivos.
7. **Canales y rol de cada uno:** por etapa del funnel.
8. **KPIs y metas:** por canal, con el costo esperado.
9. **Presupuesto y calendario.**
10. **Cómo se aprende:** qué se va a testear y cómo se va a decidir.`,
      },
      {
        titulo: "Errores comunes",
        cuerpo: `- Objetivos múltiples y contradictorios ("que nos conozcan, que compren y que nos sigan").
- Audiencia definida solo por demografía ("mujeres 25-45"), sin comportamiento ni barrera.
- Sin métricas de éxito definidas antes de salir.
- Mensaje con cinco beneficios.`,
      },
    ],
    checklist: [
      "Cita el objetivo del Mapa y la meta del KPI.",
      "La audiencia incluye su barrera principal.",
      "Hay un solo mensaje.",
      "Cada canal tiene rol y KPI.",
      "Define qué se testea y cómo se decide.",
    ],
    enBip: "El objetivo y los KPIs del brief salen del **Mapa Estratégico**; las metas por canal se cargan en el panel **Metas** de **Plan de Medios**, **Redes** y **Web** antes del lanzamiento, para que la campaña se siga contra meta desde el primer día.",
    relacionados: ["plan-de-medios", "creatividades", "objetivos-negocio-marketing", "campanas-estacionales"],
  },
  {
    id: "influencers-ugc",
    titulo: "Influencers y contenido generado por usuarios (UGC)",
    resumen: "Cuándo usar creadores, cómo elegirlos por audiencia y no por seguidores, cómo potenciarlos con pauta y cómo medir credibilidad, no solo alcance.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["awareness", "consideracion"],
    canal: ["Instagram", "TikTok", "YouTube"],
    dashSlugs: ["influencia", "redes", "performance"],
    kpiKeys: ["alcance", "engagement", "guardados", "compartidos", "vtr", "cpm", "sentimiento"],
    secciones: [
      {
        titulo: "Para qué sirven",
        cuerpo: `Los creadores aportan dos cosas que la marca no puede comprar con su propio contenido: **credibilidad** (una recomendación de alguien en quien la audiencia confía) y **formato nativo** (contenido que se ve como contenido, no como aviso). Rinden mejor en consideración que en awareness puro: para alcance masivo, la pauta suele ser más eficiente.

El UGC (contenido creado por usuarios o creadores con estética de usuario) funciona especialmente como creatividad para pauta: reseñas, demostraciones de uso y "unboxing" suelen superar a las piezas de estudio en CTR y retención.`,
      },
      {
        titulo: "Cómo elegir",
        cuerpo: `- **Audiencia antes que tamaño.** Pedí datos de audiencia (país, edad, género) y verificá que coincida con tu target. Un micro-creador (10 mil a 100 mil seguidores) con audiencia afín rinde más que un macro con audiencia dispersa.
- **Engagement de calidad.** Comentarios genuinos y guardados, no solo likes. Desconfiá de tasas anormalmente altas o de picos de seguidores.
- **Afinidad con la categoría.** Que el creador ya hable de temas cercanos a tu producto.
- **Historial de marca.** Revisá con qué competidores trabajó recientemente.`,
      },
      {
        titulo: "Potenciar con pauta",
        cuerpo: `El contenido de creadores rinde mucho más cuando se amplifica con pauta: **anuncios de partnership en Meta** (el anuncio sale desde la cuenta del creador y la de la marca) y **Spark Ads en TikTok** (se pauta el posteo orgánico original). Se conservan las interacciones sociales y la credibilidad del perfil.

Acordá en el contrato: derechos de uso para pauta, plazo, autorizaciones de acceso (códigos de Spark Ads, permiso de partnership) y exclusividad de categoría.`,
      },
      {
        titulo: "Cómo medir",
        cuerpo: `- **Alcance y costo** (CPM efectivo = honorario + pauta ÷ impresiones × 1.000), comparable con tu pauta propia.
- **Engagement de valor:** guardados, compartidos y comentarios con intención ("¿dónde lo consigo?", "¿cuánto sale?").
- **Retención de video** cuando se pauta (VTR, ThruPlay).
- **Sentimiento y credibilidad** de los comentarios: ¿la audiencia lo percibe genuino o como publicidad forzada?
- **Tráfico y conversión** con UTMs o códigos propios por creador.

Transparencia: identificá siempre el contenido como publicitario con las herramientas de contenido de marca de cada plataforma. Es obligación y protege la credibilidad.`,
      },
    ],
    benchmarks: [
      { metrica: "Tiers de creadores", valor: "nano <10 mil · micro 10-100 mil · macro 100 mil-1 M", nota: "Clasificación de uso habitual en la industria." },
      { metrica: "CPM efectivo del creador", valor: "comparable con tu CPM de pauta", nota: "Si es varias veces mayor, justificalo con engagement de valor o conversión, no con alcance." },
    ],
    checklist: [
      "Verificaste la audiencia del creador con datos, no con el número de seguidores.",
      "El contrato incluye derechos de pauta y plazo.",
      "Cada creador tiene UTMs o código propio.",
      "El contenido se identifica como publicitario.",
      "Medís comentarios con intención y sentimiento, no solo likes.",
    ],
    enBip: "Cuando se pauta, el contenido de creadores aparece en **Plan de Medios** como piezas con sus métricas de costo y retención. El efecto en la comunidad (engagement, sentimiento) se lee en **Redes**; el tráfico que generan, en **Web / Ecommerce** por fuente, si las UTMs están bien armadas.",
    relacionados: ["creatividades", "tiktok-ads", "lectura-redes", "utm-nomenclatura"],
  },
];
