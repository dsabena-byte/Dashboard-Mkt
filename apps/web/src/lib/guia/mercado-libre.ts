// ============================================================================
// Proceso Estratégico — Mercado Libre para marcas (Argentina). Portado a Drean (sep-2026) desde
// la base de conocimiento original. Know-how y mejores prácticas del principal marketplace de AR,
// pensado para fabricantes (como Drean) con tienda oficial y/o que venden a través de retailers y
// revendedores dentro de Mercado Libre, y que invierten en Mercado Ads como un medio más.
//
// ADAPTACIÓN A DREAN: el dash NO tiene datos propios de Mercado Libre (ni ranking, ni catálogo, ni
// reputación, ni ventas del canal). Lo único que ve es la INVERSIÓN en Mercado Ads (Plan de Medios,
// carga manual del reporte de OMD), el share de mercado total (GfK) y la góndola FÍSICA (Floor
// Share / Cuadros Básicos). Los textos "En la plataforma" (enBip) dicen eso y mandan al panel de
// vendedor de Mercado Libre / Mercado Ads para el resto. No prometer datos que el dash no tiene.
//
// REGLA: cada dato duro sale de una fuente oficial de Mercado Libre (Ayuda, Vendedores,
// Developers, Mercado Ads Academy) o de una fuente seria, listada en `fuentes` del módulo.
// Lo que cambia seguido (comisiones, costos de envío, montos mínimos) NO se fija como cifra:
// se explica dónde consultarlo. Relevado el 28-sep-2026.
// ============================================================================
import type { Modulo } from "./types";

const CONSULTA = "2026-09-28";

export const MERCADO_LIBRE: Modulo[] = [
  // ── Índice ────────────────────────────────────────────────────────────────
  {
    id: "mercado-libre-para-marcas",
    titulo: "Mercado Libre para marcas: el mapa completo",
    resumen: "Por dónde empezar si tu marca vende en Mercado Libre (con tienda oficial o a través de retailers y revendedores): qué palancas mueven tus ventas en el marketplace más grande de Argentina y en qué orden trabajarlas.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["consideracion", "conversion", "fidelizacion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["performance", "mercado", "trade"],
    kpiKeys: ["share_mercado", "share_valor", "indice_precio", "inversion"],
    secciones: [
      {
        titulo: "Por qué Mercado Libre merece un plan propio",
        cuerpo: `Para muchas categorías en Argentina, Mercado Libre funciona como **la góndola digital más grande del país**: la gente busca, compara precio, cuotas, envío y opiniones, y compra ahí mismo. Tu marca aparece aunque no vendas directo, porque tus distribuidores y revendedores publican tus productos.

Por eso conviene tratarlo como un canal con objetivos, métricas y rutina propias, y no como "un cliente más". La buena noticia: casi todo lo que decide quién vende más está a la vista y se puede trabajar.`,
      },
      {
        titulo: "Las 7 palancas (en este orden)",
        cuerpo: `1. **Estar bien cargado:** tus productos dentro del catálogo de Mercado Libre, con la marca y la ficha técnica completas. Sin esto no competís.
2. **Publicaciones de calidad:** título, fotos, atributos y video.
3. **Reputación del vendedor:** reclamos, cancelaciones y demoras. Define si podés ganar en el catálogo.
4. **Envío rápido:** Full y envío en el día pesan en la posición y en la elección del comprador.
5. **Precio, cuotas y promociones:** lo que el comprador compara primero.
6. **Publicidad dentro de Mercado Libre (Mercado Ads):** para acelerar lo que ya funciona.
7. **Preguntas y opiniones:** la conversación que convierte (o espanta).

Todo se cierra con **medición** (qué mirar cada semana y cada mes) y un **checklist** de errores comunes. Los encontrás en "Seguí con".`,
      },
      {
        titulo: "Qué parte depende de vos (y qué parte de tus revendedores)",
        cuerpo: `- **Si tenés tienda oficial:** controlás todo el recorrido (publicación, precio, envío, reputación, publicidad) y podés usar formatos de publicidad exclusivos para marcas.
- **Si vendés a través de retailers o revendedores:** el precio, el envío y la reputación son de ellos. Lo que sí controlás es **cómo está cargado tu producto en el catálogo** (ficha, fotos, código universal), el **contenido** que les das (fotos, videos, fichas) y los **acuerdos comerciales** (precio sugerido, stock, participación en eventos).
- **En los dos casos** conviene mirar tu presencia frente a la competencia todas las semanas: buscá tus productos clave como lo haría un comprador y anotá quién aparece arriba, a qué precio y con qué envío.`,
      },
      {
        titulo: "Antes de seguir: los números cambian",
        cuerpo: `Mercado Libre actualiza seguido sus comisiones, costos de envío, montos mínimos y reglas. En estos módulos te explicamos **cómo funciona cada cosa y dónde consultar el valor vigente**, en vez de fijar cifras que pueden quedar viejas. Cada módulo lista al final sus **fuentes oficiales**, con la fecha en que las revisamos.`,
      },
    ],
    checklist: [
      "Sabés si vendés con tienda oficial, a través de revendedores o las dos cosas.",
      "Tus productos están en el catálogo de Mercado Libre con la marca bien cargada.",
      "Tenés una persona responsable del canal y una rutina semanal de revisión.",
      "Medís tu presencia frente a la competencia, no solo tus ventas.",
    ],
    enBip: "El dash de Drean **no tiene datos propios de Mercado Libre** (ni posición, ni catálogo, ni reputación, ni ventas del canal): eso se mira en el **panel de vendedor de Mercado Libre** y en **Mercado Ads**. Lo que sí ves acá: la **inversión en Mercado Ads** como un medio más en **Plan de Medios**; el **share de mercado** total (todos los canales, GfK) en **Resultados Comerciales**; y la góndola **física** (exhibición en tiendas) en **Floor Share** y **Cuadros Básicos**. El copiloto conoce estos módulos: preguntale \"¿cómo mejoramos nuestra posición en Mercado Libre?\".",
    relacionados: ["meli-como-funciona", "meli-publicaciones", "meli-reputacion", "meli-logistica", "meli-precio-promociones", "meli-mercado-ads", "meli-preguntas-opiniones", "meli-medicion", "meli-errores-checklist", "trade-marketing"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Cómo posicionar tus productos en los listados (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/como-posicionar-tus-productos-en-los-listados" },
      { titulo: "Términos y condiciones de publicaciones de catálogo (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/4676", fecha: "2025-01-03" },
      { titulo: "Qué es Mercado Ads (Mercado Ads Academy)", url: "https://academy.mercadoads.com/student/page/1702600-mercado-ads-101" },
    ],
  },

  // ── Cómo funciona para una marca ─────────────────────────────────────────
  {
    id: "meli-como-funciona",
    titulo: "Cómo funciona Mercado Libre para una marca: tienda oficial, catálogo y revendedores",
    resumen: "Las piezas básicas: qué es una tienda oficial, qué es el catálogo y cómo se gana la publicación de un producto (la \"buy box\"), qué pasa con tus revendedores y cómo proteger tu marca de publicaciones que la infringen.",
    nivel: "estrategico",
    etapa: "construir",
    funnel: ["consideracion", "conversion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["mercado", "trade"],
    kpiKeys: ["share_mercado", "indice_precio"],
    secciones: [
      {
        titulo: "Tienda oficial",
        cuerpo: `Una **tienda oficial** es la presencia de la marca dentro de Mercado Libre: tiene **autorización de la marca** para vender lo que publica y se identifica con una **insignia azul**. Un mismo usuario puede tener una o varias marcas.

- **Cómo se abre:** no es un trámite de autogestión: según la documentación oficial, hay que **contactar a un asesor comercial** de Mercado Libre.
- **Qué suma:** además de la confianza de la insignia, algunos formatos de publicidad son **solo para marcas con tienda oficial** (por ejemplo, Brand Ads, la "posición 0" de las búsquedas).
- **Mercado Shops** (la tienda propia fuera del marketplace) **dejó de estar disponible el 31-dic-2025**, según la Ayuda de Mercado Libre: si usabas esa herramienta, la presencia de marca hoy pasa por la tienda oficial.`,
      },
      {
        titulo: "Catálogo: una página por producto",
        cuerpo: `Mercado Libre arma un **catálogo**: una sola página por producto (por ejemplo, un modelo exacto de lavarropas), donde **compiten todos los vendedores** que lo ofrecen. La publicación que gana se muestra como **primera opción de compra**, y esas páginas aparecen entre los **primeros resultados de búsqueda**. Los demás vendedores quedan en **"Otras opciones de compra"**.

- Según la doc para desarrolladores, **la mayoría de las categorías ya son de publicación obligatoria en catálogo** cuando el producto existe: tenés que publicar ahí (la publicación tradicional queda como opcional), y en algunas categorías es **exclusivo** (solo se vende por catálogo).
- Si tu publicación tradicional está asociada a una de catálogo, **comparten stock, código universal, precio, tipo de publicación, envío y garantía**: cambiás una y cambia la otra.
- Los datos del producto de catálogo (características principales, categoría) se corrigen con la opción **"Corregir datos del producto de catálogo"**: Mercado Libre verifica el cambio.`,
      },
      {
        titulo: "Cómo se gana en el catálogo",
        cuerpo: `Mercado Libre dice que gana la publicación que da **la mejor experiencia de compra**, y enumera estos parámetros:

- **Precio**
- **Cuotas sin interés**
- **Condiciones de envío** (por ejemplo Full, envío gratis o en el día)
- **Reputación del vendedor**
- **Stock**

Y dos reglas duras de sus términos y condiciones:
- Con **stock diferido** (producto que hay que fabricar o conseguir) **no podés ganar** si otro vendedor tiene stock disponible.
- Con reputación **naranja o roja** podés participar pero **no ganar**: solo aparecés en "Otras opciones de compra".

Los estados posibles son **ganando**, **compartiendo primer lugar** (condiciones parecidas: sos la primera opción para algunos compradores), **perdiendo** y **listada** (no podés competir por algún motivo). En el detalle de cada publicación de catálogo, la **tabla de competencia** te compara con el mejor competidor y te sugiere qué mejorar. El ganador puede cambiar en cualquier momento: revisalo seguido.`,
      },
      {
        titulo: "Tus revendedores también son tu marca",
        cuerpo: `Si vendés a través de retailers, en la página de catálogo de tu producto **compiten entre ellos**. Para el comprador, la experiencia (precio, envío, reputación, respuesta a preguntas) es de tu marca, la venda quien la venda. Qué podés hacer:

- **Cuidar la ficha del producto:** que el catálogo tenga tus fotos, tu ficha técnica y el código universal correcto (el mismo que imprimís en la caja).
- **Dar contenido a tus revendedores:** fotos en fondo blanco, videos cortos, argumentos de venta y respuestas a preguntas frecuentes.
- **Mirar quién gana tus productos:** si el ganador tiene mala reputación o envíos lentos, es un tema para la conversación comercial con ese cliente.`,
      },
      {
        titulo: "Proteger tu marca: Brand Protection Program",
        cuerpo: `El **Programa de Protección de Propiedad Intelectual** (Brand Protection Program) es **gratuito** y permite a los titulares de derechos (o sus apoderados) **denunciar publicaciones que infringen** marcas registradas, derechos de autor, patentes o diseños industriales (por ejemplo, falsificaciones o uso indebido de tu marca o de tus fotos).

Cómo funciona, según la Ayuda de Mercado Libre: te adherís presentando la documentación de tus derechos; desde la herramienta buscás y denunciás publicaciones (de a una o de forma masiva); Mercado Libre **pausa la publicación** y avisa al vendedor, que tiene **4 días** para responder con documentación (por ejemplo, facturas de compra del original); después vos tenés **4 días** para aceptar o rechazar esa respuesta.

Ojo: es una herramienta de **propiedad intelectual**. Ordenar precios o condiciones con tus distribuidores es parte de tu política comercial, no de este programa.`,
      },
    ],
    pasos: [
      { titulo: "Relevá cómo estás hoy", detalle: "Buscá tus 10 productos principales en Mercado Libre: ¿tienen página de catálogo? ¿Quién la gana? ¿Tus fotos y tu ficha son las que se ven?" },
      { titulo: "Definí el modelo", detalle: "Tienda oficial propia, solo revendedores o las dos. Si querés tienda oficial, pedí contacto con un asesor comercial de Mercado Libre." },
      { titulo: "Corregí el catálogo", detalle: "Donde la ficha esté mal (marca, modelo, medidas, fotos), usá \"Corregir datos del producto de catálogo\" o pedíselo a tu revendedor." },
      { titulo: "Adherite al Brand Protection Program", detalle: "Si ves falsificaciones o uso indebido de tu marca, sumate con la documentación de tu registro de marca." },
    ],
    checklist: [
      "Tus productos principales tienen página de catálogo con tu ficha y tus fotos.",
      "Sabés quién gana cada uno de tus productos en el catálogo.",
      "Tus revendedores tienen un kit de contenido (fotos, videos, preguntas frecuentes).",
      "Estás adherido al Brand Protection Program si tenés marcas registradas.",
    ],
    enBip: "El catálogo, quién gana cada producto y la tabla de competencia se miran en el **panel de vendedor de Mercado Libre** (o pedíselo a tus revendedores): el dash no los trae. En el dash, el resultado de fondo se ve en el **share de mercado** (GfK, todos los canales) de **Resultados Comerciales**, y la presencia en la góndola física en **Floor Share** y **Cuadros Básicos**: una buena ficha de catálogo es el equivalente online de un producto bien exhibido.",
    relacionados: ["mercado-libre-para-marcas", "meli-publicaciones", "meli-reputacion", "trade-marketing"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Diferencias entre Mercado Shops, Mi página y Tienda oficial (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/20398", fecha: "2025-03-04" },
      { titulo: "Tiendas Oficiales (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/es_ar/tienda-oficial" },
      { titulo: "Términos y condiciones de publicaciones de catálogo (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/4676", fecha: "2025-01-03" },
      { titulo: "Cómo funciona la competencia en catálogo (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/como-funciona-la-competencia-en-catalogo" },
      { titulo: "Publicaciones requeridas en catálogo (Developers ML)", url: "https://developers.mercadolibre.com.ar/publicaciones-requeridas-en-catalogo", fecha: "2025-12-30" },
      { titulo: "Qué significa que mi publicación está sincronizada con una de catálogo (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/4636" },
      { titulo: "Programa de Protección de Propiedad Intelectual (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Programa-de-Proteccion-de-Prop_994" },
      { titulo: "Recibí una denuncia en mi publicación (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Recib--una-denuncia-en-mi-publ_2839" },
    ],
  },

  // ── Publicaciones y posicionamiento ──────────────────────────────────────
  {
    id: "meli-publicaciones",
    titulo: "Mercado Libre: publicaciones que se encuentran y convencen",
    resumen: "Qué tiene en cuenta Mercado Libre para ordenar los resultados de búsqueda y cómo armar una publicación de calidad: título, fotos, ficha técnica, código universal y videos cortos (clips).",
    nivel: "operativo",
    etapa: "optimizar",
    funnel: ["consideracion", "conversion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["mercado", "seo-search"],
    kpiKeys: ["conversion"],
    secciones: [
      {
        titulo: "Qué mueve tu posición en la búsqueda",
        cuerpo: `Mercado Libre no publica una fórmula, pero sí dice qué ayuda a posicionar, y aclara que **un buen posicionamiento sale de combinar varias variables**: cambiar una sola cosa no alcanza. Lo que declara:

- **Título claro** (idealmente, usando la sugerencia de títulos de Mercado Libre).
- **Fotos de calidad:** si no cumplen los requisitos, la publicación no va a estar entre los primeros resultados.
- **Ficha técnica completa y precisa:** mejora la calidad de la publicación y hace que aparezcas en los **filtros** de búsqueda.
- **Categoría correcta:** mal categorizado, quedás al final del listado.
- **Stock disponible** (y, si no hay, menor tiempo de disponibilidad).
- **Envío rápido:** las publicaciones con **envío en el día** posicionan mejor; las de **Full** aparecen más arriba y tienen filtro propio.
- **Precio competitivo** (y descuentos para entrar en la sección de Ofertas).
- **Reputación y experiencia de compra:** los vendedores con reputación roja tienen menor exposición; ser MercadoLíder da mejor posicionamiento.
- **Catálogo:** según Mercado Libre, las publicaciones de catálogo aparecen primero en los resultados.
- **Cuotas:** sus términos dicen que ofrecer cuotas más convenientes "ayudará en la exposición de la publicación".`,
      },
      {
        titulo: "El indicador de calidad de la publicación",
        cuerpo: `Cada publicación tiene un **indicador de calidad de 0 a 100** que la clasifica como **Básica, Estándar o Profesional**. Lo ves en el listado de publicaciones y al modificarlas (también en el editor masivo), junto con los **objetivos pendientes** para subirlo (por ejemplo, completar atributos técnicos o sumar fotos). A medida que cumplís objetivos, sube. Es el primer lugar donde mirar: te dice exactamente qué le falta a cada publicación.`,
      },
      {
        titulo: "Título",
        cuerpo: `- Estructura que recomienda Mercado Libre: **producto + marca + modelo + alguna especificación que lo identifique** (ej.: "Lavarropas Automático [Marca] [Modelo] 8 Kg Blanco").
- **No pongas** envío gratis, cuotas, devoluciones, descuentos ni el estado (nuevo/usado): Mercado Libre ya muestra esa información al lado del producto.
- **No menciones stock** (la publicación puede ser moderada) ni **marcas de terceros**, salvo para indicar compatibilidad.
- Sin signos de puntuación ni símbolos, y sin errores de ortografía.
- El **largo máximo lo fija cada categoría** (en muchas es de 60 caracteres); Mercado Libre te lo marca al publicar.`,
      },
      {
        titulo: "Fotos",
        cuerpo: `- **Primera foto con fondo blanco puro** (hecho digitalmente), producto centrado y nítido. En algunas categorías de Moda y Hogar se aceptan fondos en contexto.
- **Resolución:** la foto tiene que tener al menos **500 píxeles** de lado; Mercado Libre **recomienda 1200 × 1200** para que el comprador pueda hacer zoom.
- Mostrá el producto **desde varios ángulos** y en uso. La cantidad máxima de fotos la define la categoría.
- **Fotos propias o autorizadas:** usar fotos ajenas infringe propiedad intelectual y puede pausar la publicación.`,
      },
      {
        titulo: "Ficha técnica y código universal",
        cuerpo: `- Completá **todos los atributos** que pide la categoría con datos reales (marca, modelo, capacidad, medidas, consumo, color…). Es lo que usan los **filtros** y lo que más mueve el indicador de calidad.
- Cargá el **código universal del producto** (GTIN/EAN, el del código de barras) si lo tiene: Mercado Libre dice que suma a la calidad y facilita que te encuentren. Además es la llave para asociar bien tu producto al catálogo.
- Usá la **descripción** para lo que no entra en la ficha (instalación, garantía, qué incluye la caja) y sumá una sección de **preguntas frecuentes** con lo que más te consultan.`,
      },
      {
        titulo: "Videos cortos (clips)",
        cuerpo: `Los **clips** son videos cortos verticales que se ven dentro de Mercado Libre, en una experiencia parecida a las redes sociales. Son **gratis**. Requisitos que pide Mercado Libre:

- **Formato vertical**, de **10 segundos a 1 minuto**.
- **Un solo producto por video**, mostrado **en uso** y en contexto; buen audio, sin ruido; subtítulos o textos de apoyo.
- Se suben desde el listado de publicaciones o desde "Modificar"; la aprobación tarda **hasta 2 días hábiles**.
- Aplica a publicaciones **activas, con stock y de productos nuevos**, y necesitás tener **color de reputación**.

Mercado Libre afirma que los clips aumentan **en promedio 2 veces** las ventas (es su dato; medilo en tus productos).`,
      },
    ],
    pasos: [
      { titulo: "Ordená por calidad", detalle: "En tu listado de publicaciones, filtrá las **Básicas** y **Estándar** de tus productos que más venden: ahí está el retorno más rápido." },
      { titulo: "Completá la ficha", detalle: "Atributos técnicos y código universal primero: es lo que más pesa en el indicador y en los filtros." },
      { titulo: "Rehacé la primera foto", detalle: "Fondo blanco puro, producto centrado, 1200 × 1200." },
      { titulo: "Sumá un clip por producto clave", detalle: "Vertical, menos de un minuto, producto en uso. Reutilizá material de tus redes adaptado a formato vertical." },
      { titulo: "Revisá títulos", detalle: "Producto + marca + modelo + especificación. Sacá envío, cuotas, descuentos y signos." },
    ],
    checklist: [
      "Tus productos más vendidos tienen calidad Profesional.",
      "Todas las publicaciones tienen código universal y ficha técnica completa.",
      "La primera foto es en fondo blanco y de al menos 1200 × 1200.",
      "Cada producto clave tiene al menos un clip aprobado.",
      "Los títulos siguen producto + marca + modelo + especificación.",
    ],
    enBip: "La calidad de cada publicación (Básica, Estándar o Profesional) y lo que le falta se ve en el **panel de vendedor de Mercado Libre**; el dash no la trae. Para títulos y fichas, las búsquedas y el **Share of Search** de **Optimización SEO** te dicen qué atributos pide la gente (capacidad, tecnología, tamaño): usalos también en Mercado Libre.",
    relacionados: ["mercado-libre-para-marcas", "meli-como-funciona", "meli-mercado-ads", "creatividades", "meli-errores-checklist"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Cómo posicionar tus productos en los listados (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/como-posicionar-tus-productos-en-los-listados" },
      { titulo: "Cómo posicionar tus productos en los resultados de búsqueda (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/como-posicionar-tus-productos-en-los-listados" },
      { titulo: "Qué es calidad de la publicación y cómo la mejoro (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/4132" },
      { titulo: "Calidad de publicaciones (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones" },
      { titulo: "Publicar productos: título y reglas (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/publica-productos", fecha: "2026-01-09" },
      { titulo: "Cómo sacar buenas fotos de tus productos (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Sacar-bue-nas-fotos-productos_805", fecha: "2025-05-02" },
      { titulo: "Trabajar con imágenes (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes" },
      { titulo: "Identificadores de productos / código universal (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/identificadores-de-productos" },
      { titulo: "Destacá tus anuncios en Meta con clips de producto (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/destaca-tus-anuncios-en-meta-con-clips-de-producto" },
      { titulo: "Subí videos y aumentá tus ventas (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/sube-videos-de-tus-productos-para-llegar-a-mas-personas" },
      { titulo: "Tarifas y facturación: cuotas y exposición (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Tarifas-y-facturacion_1044", fecha: "2025-05-02" },
    ],
  },

  // ── Reputación y MercadoLíder ────────────────────────────────────────────
  {
    id: "meli-reputacion",
    titulo: "Mercado Libre: reputación del vendedor y MercadoLíder",
    resumen: "Cómo se calcula el termómetro de reputación (reclamos, cancelaciones, demoras), cuáles son los topes para cada color, qué pide MercadoLíder y por qué la reputación decide si podés ganar en el catálogo.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["conversion", "fidelizacion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["mercado"],
    kpiKeys: ["sentimiento"],
    secciones: [
      {
        titulo: "Qué es y por qué importa",
        cuerpo: `La **reputación** es cómo Mercado Libre mide la atención que das a tus compradores. Se muestra como un **termómetro de colores** (rojo, naranja, amarillo, verde claro y verde) en todas tus publicaciones. Pesa en tres lugares:

- **Posición en la búsqueda:** los vendedores con reputación roja tienen menor exposición.
- **Catálogo:** con naranja o rojo **no podés ganar** la página de un producto.
- **Confianza del comprador:** la ve antes de comprar.

Se empieza a medir después de las **primeras 10 ventas** (antes, el termómetro está gris) y puede cambiar **todos los días**.`,
      },
      {
        titulo: "Las variables",
        cuerpo: `Mercado Libre mide el **porcentaje de ventas afectadas** por:

- **Reclamos:** ojo, según la Ayuda solo afectan tu reputación los reclamos por **productos incompletos o con faltantes** y por **calidad** (defectuoso, falla de fábrica, dejó de funcionar). Un paquete dañado en el transporte no cuenta. Para una marca, esto significa que **la calidad del producto pega directo en la reputación de quien lo vende**. La doc para desarrolladores indica que se necesitan al menos 3 ventas con reclamo para que empiece a afectar.
- **Mediaciones** (reclamos en los que tuvo que intervenir Mercado Libre).
- **Ventas canceladas por vos** (si el comprador se arrepiente, no te afecta; si hubo reclamo y después cancelaste, cuenta como reclamo).
- **Despachos con demora** en envíos por Mercado Libre.

**Período:** si tuviste **50 ventas concretadas o más en los últimos 60 días**, se miden esos 60 días; con menos de 50, se toman los **últimos 365 días**.`,
      },
      {
        titulo: "Los topes por color (Argentina)",
        cuerpo: `Según la documentación oficial para desarrolladores de Mercado Libre (sitio Argentina), el máximo de ventas afectadas para cada nivel es:

- **Reclamos:** MercadoLíder 1% · verde 1,5% · amarillo 3% · naranja 6% · rojo más de 6%.
- **Cancelaciones:** MercadoLíder 0,5% · verde 1% · amarillo 2,5% · naranja 3% · rojo más de 3%.
- **Despachos con demora:** MercadoLíder 8% · verde 10% · amarillo 15% · naranja 22% · rojo más de 22%.

Son topes: para estar en un color no tenés que superarlos. Verificá siempre los valores vigentes en la sección **Reputación** de tu cuenta.`,
      },
      {
        titulo: "MercadoLíder",
        cuerpo: `Es la distinción para los vendedores con muy buena atención **y** mucho volumen. Tiene tres niveles: **MercadoLíder, Gold y Platinum**. Requisitos según la Ayuda de Mercado Libre:

- Más de **4 meses** de antigüedad y reputación **verde oscuro**.
- En los **últimos 60 días**: una cantidad mínima de **ventas concretadas** (la página publicada en jun-2025 pedía 60, 180 y 415 según el nivel) y un **monto facturado mínimo** que Mercado Libre actualiza (consultalo en la Ayuda, "Todo sobre ser MercadoLíder").
- Calidad: menos de **1%** de reclamos, **0,5%** de mediaciones, **0,5%** de cancelaciones y **8%** de despachos con demora.

Beneficios que declara: **mayor exposición** de las publicaciones, beneficios de envío, atención personalizada y capacitaciones.`,
      },
      {
        titulo: "Si tu reputación bajó",
        cuerpo: `- **Mirá cuál variable te está tirando abajo** en la sección Reputación: casi siempre es una sola.
- **Demoras:** si no llegás a despachar a tiempo, evaluá **Full** (Mercado Libre almacena y despacha por vos) o ajustá el tiempo de disponibilidad para ser realista.
- **Reclamos por calidad:** leé los reclamos y las opiniones: suelen apuntar a una falla concreta (instalación, un componente, el embalaje). Es un tema de producto y posventa, no solo del vendedor.
- **Cancelaciones:** casi siempre son por falta de stock. Sincronizá stock real o usá Full.
- Mercado Libre tiene programas para vendedores nuevos o con reputación baja (**Programa de Despegue** y **Beneficio de Reputación**) que congelan el color en verde por un tiempo a cambio de dejar dinero en garantía. Revisá sus condiciones en tu cuenta.`,
      },
    ],
    checklist: [
      "Revisás tu reputación (o la de tus revendedores principales) cada semana.",
      "Sabés qué variable está más cerca de su tope.",
      "Los reclamos por calidad se trasladan al equipo de producto y posventa.",
      "El stock publicado es el stock real (cero cancelaciones por faltante).",
    ],
    enBip: "La reputación (tuya o de tus revendedores) se ve en la sección **Reputación** del panel de vendedor de Mercado Libre; el dash de Drean no la trae. Si vendés por revendedores, pediles ese dato para tus productos clave: un ganador del catálogo con reputación baja es un riesgo para la marca. El efecto de fondo se lee en el **share de mercado** de **Resultados Comerciales**.",
    relacionados: ["mercado-libre-para-marcas", "meli-logistica", "meli-preguntas-opiniones", "meli-como-funciona"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Qué es y cómo funciona la reputación como vendedor (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Como-funciona-la-reputacion-de-vendedor_866", fecha: "2025-06-11" },
      { titulo: "Qué se tiene en cuenta para calcular mi reputación (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/variables-reputacion_30193" },
      { titulo: "Reputación de vendedores: fórmulas y topes por país (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/reputacion-de-vendedores", fecha: "2025-08-11" },
      { titulo: "Todo sobre ser MercadoLíder (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Como-llegar-a-ser-MercadoLider_864", fecha: "2025-06-05" },
      { titulo: "Qué necesitás para ser MercadoLíder (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/que-necesitas-para-ser-mercadolider" },
      { titulo: "Programa de Despegue y Beneficio de Reputación (Developers ML)", url: "https://developers.mercadolibre.com.ar/recuperacion-reputacion", fecha: "2025-02-04" },
      { titulo: "Términos y condiciones de publicaciones de catálogo (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/4676", fecha: "2025-01-03" },
    ],
  },

  // ── Logística ─────────────────────────────────────────────────────────────
  {
    id: "meli-logistica",
    titulo: "Mercado Libre: logística (Full, Flex, Colecta y envío gratis)",
    resumen: "Qué opciones de envío tiene Mercado Libre, qué beneficios declara para Full y por qué la velocidad de entrega pesa en tu posición, en el catálogo y en tu reputación.",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["conversion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["mercado", "trade"],
    kpiKeys: ["share_unidades"],
    secciones: [
      {
        titulo: "Por qué la logística es marketing",
        cuerpo: `En Mercado Libre, el envío no es solo operación: **las publicaciones con envío en el día posicionan mejor**, las de **Full aparecen más arriba** y tienen su propio filtro, las **condiciones de envío** son uno de los parámetros para **ganar el catálogo**, y los **despachos con demora** bajan tu reputación. Un producto excelente con envío lento pierde contra uno parecido que llega mañana.`,
      },
      {
        titulo: "Las opciones",
        cuerpo: `- **Envíos Full (fulfillment):** mandás tu stock a un centro de almacenamiento de Mercado Libre y ellos **guardan, embalan, etiquetan y despachan** cada venta. Beneficios que declara Mercado Libre: **entrega al día siguiente**, publicaciones **destacadas** (más arriba en los listados y con filtro propio), **descuento en el costo de ofrecer envío gratis** (el porcentaje y el monto mínimo están en la Ayuda) y **posventa**: Mercado Libre responde los reclamos sobre la entrega o el producto entregado.
- **Envíos Flex:** hacés vos las entregas con tus propios transportistas, normalmente en el día o al día siguiente, en tu zona.
- **Colecta:** un transportista de Mercado Libre retira las ventas en tu depósito (también sirve para llevar stock a Full).`,
      },
      {
        titulo: "Envío gratis",
        cuerpo: `A partir de cierto precio del producto, el envío es **gratis para el comprador**: el costo lo paga el vendedor, con un **descuento** que aporta Mercado Libre según la reputación y la logística que uses (Full tiene un descuento mayor). **El monto desde el que aplica cambia seguido** (las páginas oficiales muestran valores distintos según la fecha y la modalidad), así que no lo fijamos acá: consultalo en la Ayuda de Mercado Libre, sección **Envíos**, o en la calculadora de costos al publicar.

Para productos grandes y pesados (como línea blanca), el costo de envío pesa mucho en el margen: calculalo producto por producto antes de definir precio.`,
      },
      {
        titulo: "Cómo decidir",
        cuerpo: `- **Productos de alta rotación y tamaño manejable:** Full suele ser la mejor opción por posición, catálogo y reputación (Mercado Libre se ocupa de los tiempos).
- **Productos voluminosos o de baja rotación:** compará el costo de almacenamiento de Full contra el de despachar vos (las tarifas vigentes de Full están en la Ayuda, "Costos de usar Envíos Full").
- **Si vendés por revendedores:** preguntales qué logística usan en tus productos clave. Si el que gana el catálogo no usa envíos rápidos, hay una oportunidad para otro distribuidor o para vos.`,
      },
    ],
    checklist: [
      "Tus productos de mayor venta tienen envío rápido (Full o en el día).",
      "Conocés el costo de envío por producto y está en tu cálculo de precio.",
      "Tus despachos con demora están lejos del tope de reputación.",
      "Sabés qué logística usa el revendedor que gana cada uno de tus productos.",
    ],
    enBip: "Stock, logística y tiempos de despacho se miran en el panel de vendedor de Mercado Libre (el dash no los trae). En el dash, **Cuadros Básicos** y **Floor Share** muestran la disponibilidad y la exhibición en la tienda física: si un producto falta en la góndola física y también en Mercado Libre, el problema suele ser de abastecimiento, no del canal.",
    relacionados: ["mercado-libre-para-marcas", "meli-reputacion", "meli-precio-promociones", "meli-como-funciona"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "¿Qué es Envíos Full? (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/que-es-mercado-envios-full_5162", fecha: "2024-11-20" },
      { titulo: "Cuáles son los beneficios de usar Envíos Full (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/cual-es-el-costo-de-usar-mercado-envios-full_5171" },
      { titulo: "Cómo funcionan los envíos de Mercado Libre (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/como-funcionan-los-envios-de-mercado-libre" },
      { titulo: "Envíos Flex: tarifas (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/envios-flex-tarifas" },
      { titulo: "Términos y condiciones de Mercado Envíos (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/terminos-y-condiciones-Merc-Env_4784" },
      { titulo: "Cómo posicionar tus productos en los listados (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/como-posicionar-tus-productos-en-los-listados" },
    ],
  },

  // ── Precio, cuotas y promociones ──────────────────────────────────────────
  {
    id: "meli-precio-promociones",
    titulo: "Mercado Libre: precio, cuotas, costos y promociones",
    resumen: "Cómo cobra Mercado Libre, qué cambia si ofrecés cuotas, qué promociones podés usar y cómo prepararte para los eventos comerciales (Hot Sale, CyberMonday, Black Friday).",
    nivel: "tactico",
    etapa: "optimizar",
    funnel: ["conversion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["mercado", "performance"],
    kpiKeys: ["indice_precio", "share_valor"],
    secciones: [
      {
        titulo: "Cuánto cuesta vender",
        cuerpo: `- **Publicar es gratis.** Cuando concretás una venta, pagás un **cargo por vender** que **depende de la categoría**.
- Para productos de **bajo precio** hay además un **costo fijo por unidad**.
- Si **ofrecés cuotas** más convenientes, se suma un **costo por ofrecerlas**.
- Se cobran los cargos **vigentes al momento de la compra**.

Los porcentajes y montos cambian: consultalos en la Ayuda, **"Costos por vender un producto y opciones de cuotas"**, o en el simulador al publicar.`,
      },
      {
        titulo: "Cuotas: ya no se llaman Clásica y Premium",
        cuerpo: `En Argentina, Mercado Libre dejó de llamar a las publicaciones "Clásica" y "Premium". Ahora se diferencian por las **cuotas que agregás**:

- **Sin agregar cuotas:** el comprador solo tiene las cuotas con interés de los bancos; pagás el cargo por vender (y el costo fijo si aplica). Hay una opción intermedia de **cuotas con interés bajo**.
- **Agregando cuotas:** ofrecés cuotas al mismo precio publicado (3, 6, 9 o 12, según la campaña) y pagás el cargo por vender **más un costo por ofrecer cuotas**.
- Podés **cambiar entre las dos modalidades sin cargo**.

Por qué importa: las **cuotas sin interés** son uno de los parámetros para **ganar el catálogo**, y los términos de Mercado Libre dicen que ofrecer cuotas más convenientes **ayuda a la exposición** de la publicación. En categorías de ticket alto (como electrodomésticos) suelen ser decisivas.`,
      },
      {
        titulo: "Promociones",
        cuerpo: `La **Central de promociones** (desde Publicaciones o Marketing) muestra qué campañas tenés disponibles para cada publicación, con el descuento, la vigencia y el precio final antes de sumarte:

- **Descuentos propios** (por porcentaje o por cantidad).
- **Oferta del día** (dura 24 horas) y **oferta relámpago** (6 horas, pensada para mover stock rápido).
- **Campañas de Mercado Libre y co-fondeadas**, donde Mercado Libre agrega un descuento al que ponés vos. La disponibilidad y las condiciones cambian por campaña.
- **Precios automáticos:** podés definir un mínimo y un máximo y dejar que el precio se ajuste según publicaciones similares de la competencia.`,
      },
      {
        titulo: "Eventos comerciales",
        cuerpo: `Los grandes eventos de comercio electrónico en Argentina los organiza la **Cámara Argentina de Comercio Electrónico (CACE)**: **Hot Sale** (en 2026 fue del 11 al 13 de mayo) y **CyberMonday** (en 2026, del 2 al 4 de noviembre, según el calendario difundido por la CACE). **Black Friday** se suma a fin de noviembre. Mercado Libre arma sus propias campañas en esas fechas: las ves en la Central de promociones y la participación depende de que tus publicaciones cumplan los requisitos que te muestra.

Cómo prepararte (vale para vos y para tus revendedores):
1. **Stock** en los productos que vas a empujar (sin stock no ganás el catálogo y las cancelaciones bajan la reputación). Si usás Full, mandalo con anticipación.
2. **Precio y cuotas** definidos antes, con el margen calculado.
3. **Publicaciones en calidad Profesional** y con clip.
4. **Mercado Ads** con presupuesto que no se corte en el pico (mirá las impresiones perdidas por presupuesto).
5. **Equipo para preguntas** en los horarios de más venta.`,
      },
    ],
    checklist: [
      "Conocés el cargo por vender de tu categoría y el costo de ofrecer cuotas.",
      "Tus productos de ticket alto ofrecen cuotas sin interés (o sabés por qué no).",
      "Revisás la Central de promociones cada semana.",
      "Tenés un plan de stock, precio y pauta para CyberMonday y Black Friday.",
    ],
    enBip: "El dash no trae precios de Mercado Libre. El **índice de precio** de **Resultados Comerciales** (GfK) compara el precio de Drean con el del mercado **en todos los canales**: sirve de referencia, pero no reemplaza mirar el precio publicado y las cuotas en Mercado Libre. Si el share cae y el índice de precio sube, casi siempre es precio o cuotas.",
    relacionados: ["mercado-libre-para-marcas", "campanas-estacionales", "meli-mercado-ads", "meli-logistica"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Costos por vender un producto y opciones de cuotas (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Costos-de-vender-un-producto_870" },
      { titulo: "Tarifas y facturación (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/Tarifas-y-facturacion_1044", fecha: "2025-05-02" },
      { titulo: "Tipos de publicación: con y sin cuotas (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos", fecha: "2026-06-01" },
      { titulo: "Campañas con cuotas para Marketplace (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/campana-con-cuotas-para-marketplace", fecha: "2026-02-11" },
      { titulo: "Conocé tu Central de promociones y ofrecé descuentos (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/conoce-tu-central-de-promociones-y-ofrece-descuentos" },
      { titulo: "Cómo posicionar tus productos: precios automáticos (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/como-posicionar-tus-productos-en-los-listados" },
      { titulo: "Hot Sale 2026: 11 al 13 de mayo, organizado por la CACE (TN)", url: "https://tn.com.ar/economia/2026/05/04/llega-el-hot-sale-mas-de-800-marcas-ofrecen-sus-productos-cuotas-y-descuentos-para-impulsar-el-consumo/", fecha: "2026-05-04" },
      { titulo: "Fechas de CyberMonday y Black Friday 2026 (C5N)", url: "https://www.c5n.com/economia/descuentos-y-ofertas-confirmaron-las-fechas-del-black-friday-y-cyber-week-2026-n237316", fecha: "2026-05-06" },
    ],
  },

  // ── Mercado Ads ───────────────────────────────────────────────────────────
  {
    id: "meli-mercado-ads",
    titulo: "Mercado Ads: Product Ads, Brand Ads y Display",
    resumen: "Los formatos de publicidad dentro de Mercado Libre, cómo se decide qué anuncio se muestra (ROAS objetivo y relevancia), qué métricas mirar y cómo no quemar presupuesto en publicaciones que no convierten.",
    nivel: "tactico",
    etapa: "acelerar",
    funnel: ["awareness", "consideracion", "conversion"],
    canal: ["Mercado Libre", "Mercado Ads"],
    plataforma: "mercadolibre",
    dashSlugs: ["performance", "mercado"],
    kpiKeys: ["inversion", "roas", "ctr", "cpc", "clicks", "impresiones"],
    secciones: [
      {
        titulo: "Los formatos",
        cuerpo: `- **Product Ads:** promociona tus publicaciones en los primeros resultados de búsqueda, en un espacio destacado al final de los resultados o dentro de la página de una publicación. Se paga **por clic**. Es el formato de venta directa.
- **Brand Ads:** muestra **tres productos de tu marca** en una posición premium, la **"posición 0"**, antes que cualquier otro resultado (incluso antes que Product Ads). Está disponible para **marcas con tienda oficial**. Sirve para que te descubran justo cuando están por comprar.
- **Display Ads:** anuncios visuales en lugares de alto impacto de **Mercado Libre y Mercado Pago**, con audiencias segmentadas, comprados de forma directa o programática. Hay también **video** (por ejemplo, en Mercado Play). Es el formato de marca y consideración.`,
      },
      {
        titulo: "Cómo se decide qué anuncio se muestra (Product Ads)",
        cuerpo: `Cada búsqueda es una subasta entre anuncios. Mercado Libre considera dos cosas:

- **ROAS objetivo:** cuántos pesos de venta querés obtener por cada peso invertido. Un **ROAS objetivo más bajo** significa que aceptás invertir más por venta, y eso te da **más chances de mostrarte**. (Mercado Libre reemplazó el viejo "ACOS objetivo" por el ROAS objetivo; la equivalencia es ACOS = 1 ÷ ROAS × 100. El ROAS objetivo va de 1x a 35x y la herramienta te sugiere opciones.)
- **Relevancia del anuncio:** la probabilidad de que lo compren, según la **calidad** de la publicación y sus **ventas**.

Consecuencia práctica: **la publicidad no arregla una mala publicación**. Una publicación con pocas ventas y baja calidad necesita invertir mucho más para mostrarse que una buena.`,
      },
      {
        titulo: "Métricas que tenés que mirar",
        cuerpo: `- **ROAS** (retorno sobre la inversión publicitaria) = ventas atribuidas ÷ inversión. 3x = $3 de venta por cada $1 invertido.
- **ACOS** = inversión ÷ ventas atribuidas (la inversa del ROAS, en %). Comparalo con tu **margen**: si el ACOS es más alto que tu margen, perdés plata en cada venta publicitada.
- **Clics, CTR** (clics ÷ impresiones) e **inversión** por campaña y por anuncio.
- **Impresiones ganadas / perdidas por presupuesto / perdidas por ranking:** suman 100%. Muchas perdidas por **presupuesto** = hay demanda que no estás cubriendo (subí el presupuesto diario). Muchas perdidas por **ranking** = mejorá la publicación o ajustá el ROAS objetivo.
- **Ventana de atribución:** una venta cuenta para la campaña si ocurre **hasta 14 días después del clic**.
- **Ventas por publicidad sobre ventas totales:** qué parte de tus ventas depende de la pauta. Conviene seguirla junto con la inversión total sobre ventas totales (algunos equipos lo llaman TACOS; no es una métrica con ese nombre en Mercado Libre, lo calculás vos).

Para marcas con tienda oficial y acceso al DSP, Mercado Ads ofrece **Conversion Path** (en el Intelligence Hub), que muestra cómo se combinan Display, Brand Ads y Product Ads en el camino a la compra.`,
      },
      {
        titulo: "Buenas prácticas",
        cuerpo: `1. **Primero la publicación, después la pauta:** calidad Profesional, buen precio, stock y envío rápido.
2. **Elegí qué querés lograr** con cada campaña: lanzar productos nuevos (necesitan visibilidad) o sostener los más vendidos (proteger posición).
3. **Pausá** los anuncios que tampoco venden orgánicamente y **empujá** los que ya venden bien.
4. **No cortes en el pico:** en eventos, revisá las impresiones perdidas por presupuesto todos los días.
5. **Sumá Brand Ads** si tenés tienda oficial y competís en búsquedas genéricas de la categoría ("heladera no frost", "lavarropas 8 kg"): es la forma de aparecer antes que todos.
6. **Leé la pauta de Mercado Libre junto con tu pauta en Meta y Google**, no aislada: muchas búsquedas en Mercado Libre nacen de campañas afuera.`,
      },
    ],
    checklist: [
      "Cada campaña tiene un objetivo claro (lanzamiento o sostener posición).",
      "Comparás el ACOS con tu margen por producto.",
      "Revisás impresiones perdidas por presupuesto y por ranking cada semana.",
      "No pautás publicaciones de calidad Básica.",
      "Si tenés tienda oficial, evaluaste Brand Ads en las búsquedas genéricas de tu categoría.",
    ],
    enBip: "En **Plan de Medios**, **Mercado Ads** aparece como un medio más: su inversión (y las impresiones y clics que informa OMD) sale de la **carga manual del reporte de OMD**, porque no hay conexión directa con Mercado Ads. El dash **no tiene ventas atribuidas, ROAS ni ACOS** de Mercado Ads: esas métricas se miran en el panel de Mercado Ads (o pedíselas a OMD en el reporte mensual). La pauta en Meta y Google también está en **Plan de Medios**: leelas juntas.",
    relacionados: ["mercado-libre-para-marcas", "meli-publicaciones", "meli-precio-promociones", "plan-de-medios", "meli-medicion"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Qué es Mercado Ads (Mercado Ads Academy)", url: "https://academy.mercadoads.com/student/page/1702600-mercado-ads-101", fecha: "2026-09-28" },
      { titulo: "Introducción a Mercado Ads (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/introduccion-a-mercado-ads", fecha: "2024-08-05" },
      { titulo: "Cómo funciona el sistema de pujas de Product Ads (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/como-funciona-el-sistema-de-pujas-de-product-ads" },
      { titulo: "Product Ads: ROAS objetivo reemplaza al ACOS objetivo (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/pads-read", fecha: "2026-02-18" },
      { titulo: "Product Ads: métricas, impresiones perdidas y ventana de 14 días (Mercado Ads Knowledge Hub)", url: "https://knowledgehub.academy.mercadoads.com/product-ads" },
      { titulo: "ROAS en Product Ads (Mercado Ads Academy)", url: "https://academy.mercadoads.com/student/page/3219067-roas-en-product-ads", fecha: "2026-03-30" },
      { titulo: "Conocé las 3 nuevas métricas de competitividad en Product Ads (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/conoce-las-3-nuevas-metricas-de-competitividad-en-product-ads" },
      { titulo: "Conversion Path (Mercado Ads Knowledge Hub)", url: "https://knowledgehub.academy.mercadoads.com/conversion-path" },
    ],
  },

  // ── Preguntas y opiniones ────────────────────────────────────────────────
  {
    id: "meli-preguntas-opiniones",
    titulo: "Mercado Libre: preguntas y opiniones que venden",
    resumen: "Cómo responder las preguntas de los compradores a tiempo (la primera hora importa), cómo funcionan las opiniones de producto y cómo usar las dos para mejorar tus publicaciones y tu producto.",
    nivel: "operativo",
    etapa: "optimizar",
    funnel: ["conversion", "fidelizacion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["mercado", "redes"],
    kpiKeys: ["sentimiento"],
    secciones: [
      {
        titulo: "Preguntas: la primera hora",
        cuerpo: `Quien pregunta ya está interesado: la respuesta rápida muchas veces define **a quién le compra**. Lo que dice Mercado Libre:

- Si respondés **dentro de la primera hora**, los compradores te pueden **encontrar más rápido en los listados**.
- En su herramienta de preguntas vas a ver avisos de **"¡Apurate a responder!"** (cerca de la hora) y **"Respuesta atrasada"** (pasó más de una hora).
- En otra nota recomienda responder **dentro de los primeros 10 minutos** para no perder el interés.
- Según Mercado Libre, **la mayoría de las ventas se concretan entre las 20 y las 23 h**: si nadie responde en ese horario, perdés ventas.
- Las preguntas sin responder por más de **7 meses** se eliminan (doc para desarrolladores).`,
      },
      {
        titulo: "Cómo responder mejor",
        cuerpo: `- **Respondé completo y cálido:** saludá, contestá lo que preguntó y sumá un dato útil (garantía, instalación, qué incluye).
- Si no queda clara la duda, **repreguntá** dentro de la respuesta.
- Usá **respuestas rápidas** (plantillas) y la **respuesta sugerida con IA** que ofrece Mercado Libre, revisándolas antes de enviar.
- **No incluyas datos de contacto** ni propongas cerrar la venta por fuera: va contra las reglas.
- **Detectá las preguntas que se repiten** y sumalas a la descripción como "preguntas frecuentes": bajan las consultas y suben las ventas.
- Si vendés por revendedores, **dales un documento de respuestas** a las preguntas técnicas más comunes de cada producto.`,
      },
      {
        titulo: "Opiniones de producto",
        cuerpo: `- Solo puede opinar quien **compró y recibió** el producto: pone de **1 a 5 estrellas** y un comentario.
- Las estrellas y la cantidad de opiniones se ven **debajo del título** de la publicación. En catálogo, las opiniones se agrupan por producto.
- Mercado Libre puede **editar o eliminar** comentarios inadecuados u ofensivos (términos y condiciones).
- Las opiniones negativas recientes suelen apuntar a **un problema concreto** (entrega, instalación, una falla): son información de producto y posventa, no solo de marketing. Y recordá que los **reclamos por calidad** también bajan la reputación del vendedor.`,
      },
    ],
    pasos: [
      { titulo: "Medí tu tiempo de respuesta", detalle: "Revisalo en tu cuenta de vendedor (o pedile el dato a tus revendedores)." },
      { titulo: "Cubrí el horario pico", detalle: "Asigná a alguien (o turnos) para las 20 a 23 h y los fines de semana." },
      { titulo: "Armá las plantillas", detalle: "Respuestas rápidas para las 10 preguntas más comunes de cada producto." },
      { titulo: "Leé las opiniones de 1 y 2 estrellas", detalle: "Una vez por mes, agrupalas por tema y mandá el resumen a producto y posventa." },
    ],
    checklist: [
      "Respondés dentro de la primera hora, también en el horario pico.",
      "Las preguntas frecuentes están en la descripción.",
      "Tus revendedores tienen las respuestas técnicas de cada producto.",
      "Las opiniones negativas se revisan cada mes con producto y posventa.",
    ],
    enBip: "Las preguntas, el tiempo de respuesta y las opiniones se ven en el panel de vendedor de Mercado Libre; el dash de Drean no los trae. Lo más parecido en el dash es el **sentimiento** de los comentarios en **Redes Sociales**: si un tema negativo aparece en redes y en las opiniones de Mercado Libre, es un problema de producto o posventa, no de comunicación.",
    relacionados: ["mercado-libre-para-marcas", "meli-reputacion", "meli-publicaciones", "lectura-redes"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Respondé con éxito las preguntas y concretá más ventas (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/responde-con-exito-las-preguntas-y-concreta-mas-rapido-la-operacion" },
      { titulo: "Herramientas para responder preguntas más rápido (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/herramientas-para-responder-preguntas-mas-rapido" },
      { titulo: "Cómo explotar tu potencial como vendedor: horario de ventas (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/como-explotar-tu-potencial-como-vendedor" },
      { titulo: "Cómo contestar preguntas (Mercado Libre)", url: "https://www.mercadolibre.com.ar/tips_comerciales8" },
      { titulo: "Preguntas y respuestas (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/es_ar/gestiona-preguntas-respuestas", fecha: "2023-09-29" },
      { titulo: "Opiniones de productos (Developers ML)", url: "https://developers.mercadolibre.com.ar/opiniones-sobre-producto", fecha: "2023-04-28" },
      { titulo: "Términos y Condiciones Marketplace: opiniones (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/23050", fecha: "2025-04-18" },
      { titulo: "Qué se tiene en cuenta para calcular mi reputación (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/variables-reputacion_30193" },
    ],
  },

  // ── Medición ──────────────────────────────────────────────────────────────
  {
    id: "meli-medicion",
    titulo: "Mercado Libre: qué medir y dónde verlo en el dash de Drean",
    resumen: "Las métricas que importan para una marca en Mercado Libre (presencia, posición, precio relativo, reputación, conversión, pauta), cuáles se ven en el dash de Drean (inversión en Mercado Ads, share de mercado, góndola física) y cuáles hay que mirar directamente en el panel de vendedor de Mercado Libre y en Mercado Ads.",
    nivel: "tactico",
    etapa: "aprender",
    funnel: ["consideracion", "conversion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["performance", "mercado", "trade"],
    kpiKeys: ["inversion", "share_mercado", "indice_precio", "floor_share", "roas"],
    secciones: [
      {
        titulo: "Tres niveles de métricas",
        cuerpo: `- **Competitividad en la góndola digital (semanal):** qué lugar ocupan tus productos frente a la competencia en la búsqueda y en el catálogo, a qué precio relativo y con qué opiniones.
- **Operación de la cuenta (semanal):** calidad de publicaciones, reputación, tiempo de respuesta, stock, estado en el catálogo (ganando / perdiendo). Lo ves en tu cuenta de vendedor de Mercado Libre (o te lo pasan tus revendedores).
- **Negocio (mensual):** ventas del canal, peso del canal en tus ventas, margen después de comisiones, envío y pauta, y el retorno de Mercado Ads.`,
      },
      {
        titulo: "Qué está en el dash de Drean (y qué no)",
        cuerpo: `**Lo que sí ves en el dash:**

- **Plan de Medios:** **Mercado Ads** es un medio más. Su inversión (y las impresiones y clics que informa OMD) sale de la **carga manual del reporte mensual de OMD**, porque no hay conexión directa con Mercado Ads. Lo leés junto al resto de los medios: cuánto se invirtió, cuánto pesa en el plan y cómo evoluciona mes a mes.
- **Resultados Comerciales:** **share de mercado** en valor y unidades e **índice de precio** (GfK). Ojo: es el mercado **total, en todos los canales**; no abre Mercado Libre por separado.
- **Floor Share** y **Cuadros Básicos:** la góndola **física** (exhibición y surtido en tiendas). Sirven de espejo: si un producto pierde exhibición en tienda y también posición en Mercado Libre, el problema suele ser de abastecimiento o de acuerdo comercial, no del canal.

**Lo que NO está en el dash (se mira en Mercado Libre y en Mercado Ads):**

- Posición en la búsqueda, quién gana cada producto en el catálogo y la tabla de competencia.
- Calidad de publicaciones, reputación, preguntas, opiniones y tiempo de respuesta.
- Ventas y unidades del canal.
- Ventas atribuidas, **ROAS**, **ACOS** e impresiones perdidas de Mercado Ads (pedíselas a OMD en el reporte mensual o miralas en el panel de Mercado Ads).

Si querés cruzar esos reportes con el resto, podés subirlos como planilla en **Mis tableros**.`,
      },
      {
        titulo: "Cómo interpretarla",
        cuerpo: `- **Perdiste posiciones y tu precio subió:** casi siempre es precio o cuotas.
- **Perdiste posiciones con precio estable:** mirá stock, envío, reputación del vendedor y reseñas recientes.
- **Entró un competidor:** lanzamiento o promoción; conviene saber cuál esa misma semana.
- **Casi no aparecés en el catálogo:** revisá que tus productos (o los de tus distribuidores) estén asociados al catálogo con la marca bien cargada. Es gratis y te hace visible.
- **Un competidor aparece en las búsquedas sugeridas de Mercado Libre y vos no:** hay demanda por nombre que se está generando (pauta, lanzamiento, promoción). El **Share of Search** de Optimización SEO te da la misma lectura en Google.
- **Posición en Mercado Libre no es share de mercado:** el share real sigue viniendo del panel GfK (Resultados Comerciales) o de tus ventas.`,
      },
      {
        titulo: "El tablero mensual del canal",
        cuerpo: `Una vez por mes, juntá en una sola vista:

1. Ventas y unidades del canal, y su peso en tus ventas totales.
2. Presencia en la góndola digital: en cuántos de tus productos clave ganás el catálogo o estás en los primeros resultados, vs el mes anterior.
3. Índice de precio promedio vs la categoría.
4. Rating promedio y cantidad de opiniones nuevas.
5. Reputación (tuya y de tus revendedores principales).
6. Inversión en Mercado Ads, ROAS y ventas por publicidad sobre ventas totales.
7. Qué hiciste distinto (promociones, lanzamientos, cambios de precio) para explicar los movimientos.`,
      },
    ],
    checklist: [
      "Revisás tus productos clave en Mercado Libre cada lunes y anotás qué cambió y por qué.",
      "No confundís tu posición en Mercado Libre con share de mercado.",
      "Sabés qué parte de la foto está en el dash (inversión en Mercado Ads, share GfK, góndola física) y qué parte en el panel de Mercado Libre.",
      "Tenés una vista mensual del canal con ventas, presencia, precio, reputación y pauta.",
      "Las búsquedas de la gente alimentan tus títulos y tu pauta.",
    ],
    enBip: "En el dash de Drean: **Plan de Medios** para la inversión en Mercado Ads (carga de OMD); **Resultados Comerciales** para share de mercado e índice de precio (GfK, todos los canales, no solo Mercado Libre); **Floor Share** y **Cuadros Básicos** para la góndola física. El resto (posición, catálogo, reputación, preguntas, ventas del canal, ROAS de Mercado Ads) vive en el panel de vendedor de Mercado Libre y en Mercado Ads: si querés cruzarlo acá, subí esos reportes como planilla en **Mis tableros**.",
    relacionados: ["mercado-libre-para-marcas", "meli-mercado-ads", "meli-errores-checklist", "reporte-mensual", "tableros-planilla"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Competencia en catálogo: estados ganando/compartiendo/perdiendo/listada (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/competencia-en-catalogo" },
      { titulo: "Calidad de publicaciones (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones" },
      { titulo: "Reputación de vendedores (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/reputacion-de-vendedores", fecha: "2025-08-11" },
      { titulo: "Product Ads: métricas (Mercado Ads Knowledge Hub)", url: "https://knowledgehub.academy.mercadoads.com/product-ads" },
    ],
  },

  // ── Errores comunes y checklist ───────────────────────────────────────────
  {
    id: "meli-errores-checklist",
    titulo: "Mercado Libre: errores comunes y checklist mensual",
    resumen: "Los errores que más le cuestan a una marca en Mercado Libre y una rutina simple, semanal y mensual, para no perder la góndola digital.",
    nivel: "operativo",
    etapa: "aprender",
    funnel: ["conversion", "fidelizacion"],
    canal: ["Mercado Libre"],
    plataforma: "mercadolibre",
    dashSlugs: ["performance", "mercado", "trade"],
    kpiKeys: ["inversion", "share_mercado", "indice_precio"],
    secciones: [
      {
        titulo: "Los errores más comunes",
        cuerpo: `1. **Productos fuera del catálogo o con la marca mal cargada:** no competís por la primera opción de compra y no aparecés en los filtros.
2. **Pautar publicaciones malas:** con calidad Básica o pocas ventas, Mercado Ads cobra más caro por mostrarlas y convierten poco.
3. **Bajar el precio como primera reacción:** muchas caídas de posición son de stock, envío o reputación; el precio es solo una de las variables.
4. **Stock publicado que no existe:** cancelaciones → reputación → no ganás el catálogo.
5. **Envío lento en productos clave:** perdés posición y catálogo frente a quien ofrece Full o envío en el día.
6. **Preguntas sin responder de noche:** el horario de más ventas es de 20 a 23 h.
7. **Ignorar las opiniones negativas:** suelen avisar una falla concreta que también está generando reclamos.
8. **Títulos con "envío gratis", "cuotas" u "oferta":** no suman (Mercado Libre ya lo muestra) y ocupan caracteres que necesitás para el modelo y los atributos.
9. **Dejar el canal en manos de los revendedores sin mirarlo:** la experiencia es de tu marca, la venda quien la venda.
10. **Llegar a CyberMonday sin plan:** sin stock, sin precio definido y con presupuesto de pauta que se corta en el pico.`,
      },
      {
        titulo: "Rutina semanal (30 minutos, los lunes)",
        cuerpo: `- Buscá tus productos clave en Mercado Libre como un comprador: posición, precio, cuotas, envío y opiniones frente a la competencia.
- Mirá quién **gana tus productos** en el catálogo y si cambió.
- Revisá **reputación** (tuya y de tus revendedores principales) y la variable más cerca de su tope.
- En Mercado Ads: **impresiones perdidas por presupuesto y por ranking**, ROAS por campaña.
- Anotá qué cambió y por qué (así el mes se explica solo).`,
      },
    ],
    checklist: [
      "Tus 20 productos principales están en el catálogo con la marca, la ficha y el código universal correctos.",
      "Todos tienen calidad Profesional (o sabés qué les falta).",
      "Cada producto clave tiene al menos un clip aprobado.",
      "Reputación en verde, con reclamos, cancelaciones y demoras lejos de sus topes.",
      "Productos de mayor venta con envío rápido (Full o en el día) y stock real.",
      "Precio y cuotas revisados contra la categoría (índice de precio cerca de 100 o con una razón para estar arriba).",
      "Central de promociones revisada; próximo evento comercial con plan de stock, precio y pauta.",
      "Mercado Ads: ACOS por debajo del margen, sin campañas cortadas por presupuesto.",
      "Tiempo de respuesta a preguntas dentro de la primera hora, también en el horario pico.",
      "Opiniones de 1 y 2 estrellas del mes leídas y enviadas a producto y posventa.",
      "Revendedores con el kit de contenido actualizado (fotos, clips, respuestas).",
      "Publicaciones que infringen tu marca denunciadas por el Brand Protection Program.",
    ],
    enBip: "La rutina semanal arranca en el **panel de vendedor de Mercado Libre** y en **Mercado Ads** (el dash no trae esos datos). En el dash, el mes se cierra con la inversión de Mercado Ads en **Plan de Medios**, el share y el índice de precio en **Resultados Comerciales**, y la góndola física en **Floor Share**. Podés pedirle al copiloto: \"armame el checklist de Mercado Libre para Drean\".",
    relacionados: ["mercado-libre-para-marcas", "meli-medicion", "reporte-mensual", "meli-publicaciones", "meli-reputacion"],
    fuentesConsultadas: CONSULTA,
    fuentes: [
      { titulo: "Cómo posicionar tus productos en los listados (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/como-posicionar-tus-productos-en-los-listados" },
      { titulo: "Términos y condiciones de publicaciones de catálogo (Ayuda ML)", url: "https://www.mercadolibre.com.ar/ayuda/4676", fecha: "2025-01-03" },
      { titulo: "Cómo funciona el sistema de pujas de Product Ads (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/nota/como-funciona-el-sistema-de-pujas-de-product-ads" },
      { titulo: "Cómo explotar tu potencial como vendedor (Vendedores ML)", url: "https://vendedores.mercadolibre.com.ar/aprender/nota/como-explotar-tu-potencial-como-vendedor" },
      { titulo: "Publicar productos: reglas de títulos (Developers ML)", url: "https://developers.mercadolibre.com.ar/es_ar/publica-productos", fecha: "2026-01-09" },
    ],
  },
];
