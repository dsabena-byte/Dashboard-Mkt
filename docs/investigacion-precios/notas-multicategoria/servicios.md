# Monitoreo competitivo de precios de SERVICIOS y ofertas no-catálogo (insumo para BIP)

> Fecha de relevamiento: 7-oct-2026. Método: Perplexity (ask/search, con citas) + intentos de WebFetch directo.
> **Limitación de verificación:** la red del sandbox bloqueó el acceso directo a `*.gob.ar` (ENACOM, BCRA) y a `tarifica.com`
> (EGRESS_BLOCKED). Todo lo de esas fuentes viene de snippets/síntesis de Perplexity que citan la URL oficial, NO de una lectura
> propia de la página. Marcado: **[verificado-snippet]** = texto de la página oficial visto en resultado de búsqueda;
> **[síntesis-Perplexity]** = afirmación de la síntesis con cita a fuente oficial, no leída por mí; **[sin verificar]** = no hallé fuente.
> Regla del user respetada: sin propuestas de ajuste por inflación (solo $ nominal y USD).

## 1. ¿Qué vendors cubren precios de servicios (global y LATAM) y cómo capturan el dato?

### Takeaway
No hay un "Competera de servicios" horizontal: el mercado está **verticalizado** (telecom: Tarifica/Teligen/Tefficient; seguros US: Quadrant/Perr&Knight por filings; banca/tarjetas: Comperemedia/Competiscan por ofertas de marketing; hoteles/aéreas: Lighthouse/RateGain/Infare/ATPCO por "rate shopping"; SaaS: PricingSaaS por diffs de pricing pages). Los vendors de precio retail (Competera, Prisync, Price2Spy, etc.) no mostraron evidencia de soportar planes/tiers. Cada vertical captura distinto: **oferta publicada en web**, **filings regulatorios**, **cotización por perfil sintético** o **piezas de marketing**.

### Cited Findings
**Telecom**
- Tarifica (fundada 2008, NY) se enfoca exclusivamente en planes/precios/promos/dispositivos telecom; plantillas de datos separadas por tipo de plan (pospago móvil, banda ancha fija, móvil con equipo, bundles, promociones) "en formato cross-comparable"; recolecta datos anualmente de 175+ países [verificado-snippet] — [Tarifica Company](https://tarifica.com/company)
- Tarifica TPIP: captura "todos los planes de consumo móvil, banda ancha fija y multi-play publicitados" en 46 países; incluye en Sudamérica **Argentina, Brasil, Chile, Colombia, Ecuador, Paraguay, Perú, Uruguay**; **actualización trimestral** (se captura cada oferta del país); "Auto Benchmarking" calcula **el precio más bajo de cada proveedor** para un perfil estándar o personalizado; precios en moneda local, euros o USD PPP; exporta a Excel [verificado-snippet] — [Tarifica Solutions](https://tarifica.com/solutions)
- Tarifica Arch: tracking "en tiempo real" de promos/descuentos/cambios de plan con alertas; PlanDetector monitorea SMS promocionales de operadores móviles (ofertas BTL "ocultas"); PlanScout usa feeds diarios [verificado-snippet] — [Tarifica Solutions](https://tarifica.com/solutions); [Tarifica home](https://tarifica.com/)
- Tarifica metodología: analistas mapean detalles de plan y contratos a sus plantillas + algoritmos de control de calidad que corrigen anomalías; destaca la importancia de promos "teaser rate", OTT incluidos, equipos gratis, descuentos multi-línea [verificado-snippet] — [Tarifica Data](https://tarifica.com/data)
- Tarifica visualiza: rankings auto-benchmark, series de tiempo por país/proveedor, barras, box plots, scatter/burbujas, heat maps, tablas por plan con export [síntesis-Perplexity] — [Tarifica TPIP intro PDF (PRWeb 2023)](https://ww1.prweb.com/prfiles/2023/06/20/19401193/Tarifica_TelecomPricingIntelligencePlatform-Introduction_.pdf)
- Tarifica en noticias: "Two-Thirds of Mobile Plans in Latin America Offer Zero Rating" (Telecompaper, 12-ago-2025); alianza con Luxon Consulting para LATAM; TeleSemana "La banda ancha móvil de la Argentina es la más cara de América latina" [verificado-snippet, titulares] — [Tarifica News](https://tarifica.com/news)
- Teligen (Strategy Analytics → TechInsights): canasta estandarizada; calcula cargos fijos del período (ej. un año) + costo variable según parámetros de uso (tipos de llamada, duración, distribución horaria, cantidad) y suma a un total mensual/anual comparable; las canastas PSTN/móvil/líneas dedicadas siguen metodología OCDE [síntesis-Perplexity] — [TRA/Teligen proposal PDF](https://tra-website-prod-01.s3-me-south-1.amazonaws.com/Media/Documents/Market-indicators/20230821115204933_rcjm05lm_sxb.pdf); [AREGNET Price Benchmarking Methodology 2012](https://tra-website-prod-01.s3-me-south-1.amazonaws.com/Media/mediafiles/document/AREGNETPriceBenchmarkingMethodology2012.pdf)
- Tefficient: trabaja a nivel mercado con **ingreso por GB de uso real** (revenue de servicio móvil ÷ GB efectivamente consumidos) y lo distingue del allowance publicitado; también presenta "mejores precios" de planes/canastas [síntesis-Perplexity] — [Tefficient para EETT (Grecia), 2024](https://www.eett.gr/wp-content/uploads/2026/08/Assessment-of-Greeces-mobile-usage-and-revenue-in-an-EU-context-by-Tefficient-for-EETT-8-Feb-2024-final.pdf)

**Seguros (US)**
- Quadrant Information Services: dataset de rating P&C basado en filings de aseguradoras, "location-driven"; recibe filings diariamente y actualiza el dataset de rating mensualmente [síntesis-Perplexity] — [Quadrant](https://quadinfo.com/); [Quadrant data services](https://quadinfo.com/data-services/)
- Perr&Knight / RateFilings.com: analistas recolectan e indexan filings de tarifas, reglas y formularios; >25.000 filings nuevos por mes; investigación de factores de rating, territorios, guías de suscripción. RateFilings.com se vendió a SNL Financial en 2015 (hoy S&P Global Market Intelligence) [síntesis-Perplexity] — [RateFilings services](https://www.ratefilings.com/services); [Perr&Knight 30 años](https://www.perrknight.com/30th-anniversary/)
- Nota: el modelo de "cotización con perfiles sintéticos" (para Quadrant) no quedó verificado en estas fuentes; lo verificado es filings + rate sets por ubicación [sin verificar el detalle].

**Banca / tarjetas / ofertas de marketing**
- Mintel Comperemedia (hoy de OpenBrand): inteligencia competitiva cross-canal para servicios financieros, seguros, telecom y media; trackea targeting, precios, ofertas, lanzamientos; paneles rolling y lifecycle [síntesis-Perplexity] — [Comperemedia Direct](https://www.mintel.com/products/comperemedia-direct/); [OpenBrand adquiere Comperemedia](https://openbrand.com/newsroom/blog/openbrand-acquires-comperemedia)
- Comperemedia **Offer Index** (tarjetas): reduce la comparación a 6 atributos — cuota anual, rewards, incentivo de adquisición, APR de compra, APR introductoria de compra, oferta de balance transfer — produce un **Offer Score** y sigue cambios trimestre a trimestre [síntesis-Perplexity] — [PR Newswire Offer Index](https://www.prnewswire.com/news-releases/comperemedia-unveils-offer-index---a-proprietary-tool-redefining-credit-card-offer-comparisons-302008187.html); ejemplos de gráficos de teaser rates/períodos intro/fees en [presentación Comperemedia a CFPB](https://files.consumerfinance.gov/f/documents/Comperemedia-presentation.pdf)
- Competiscan: base de comunicaciones (direct mail, email, digital, social, print) actualizada a diario, con creatividad, volumen estimado, targeting, promos; **Value Proposition Tracker** de tarjetas compara APR regular e intro, cuota anual y rewards en 600+ tarjetas, filtrable por emisor/tipo/riesgo, y trends por canal [síntesis-Perplexity] — [Competiscan VP Trackers](https://competiscan.com/value-proposition-trackers/); [Competiscan MI Database](https://competiscan.com/market-intelligence-database/)
- Curinos, Moebs, Bankrate, RateWatch (S&P), Informa Research Services: **no encontré fuente primaria** sobre su método de captura (encuesta a bancos vs. web vs. cuentas sintéticas) ni cadencia [sin verificar].

**Viajes (rate shopping)**
- RateGain: "shopping schedules" configurables por canal, length of stay, días de semana y días a la llegada; Optima refresca datos de calendario en <60 s tras pedido [síntesis-Perplexity] — [RateGain rate intelligence](https://uno.rategain.com/hotel-rate-intelligence/); [RateGain Optima](https://rategain.com/hotels-2/hotel-rate-shopping-optima/)
- Lighthouse (ex OTA Insight) Rate Insight: mapeo de tipos de habitación, monitoreo de tarifa y paridad por canal, tarifas pasadas/actuales/futuras, vistas Calendar/Graph/Table, visibilidad de paridad hasta 12 meses; refresh on-demand. Una integración (Atomize) reporta shop 2x/día para fechas cercanas, diario a 15–90 días y menos frecuente más lejos (es configuración de esa integración, no SLA) [síntesis-Perplexity] — [Lighthouse blog Rate Insight](https://www.mylighthouse.com/resources/blog/how-to-get-most-out-of-lighthouse-rate-insight); [Lighthouse overview PDF](https://content.mylighthouse.com/hubfs/lh-documents/sales/company-and-product-overview-presentation-en.pdf); [Atomize help](https://help.atomize.com/ota-insights-rate-shopping-frequency)
- ATPCO: datos de tarifas aéreas provistos directamente por las aerolíneas; datos "unassembled" hasta cada hora, "assembled" vía web services [síntesis-Perplexity] — [ATPCO subscriptions](https://atpco.net/pricing-shopping-subscriptions/)
- Infare: no se halló fuente primaria con volumen de observaciones/día ni cobertura de fare families/equipaje [sin verificar].

**SaaS / suscripciones**
- PricingSaaS (Pulse): trackea 3.000+ empresas SaaS/IA (otra página dice 4.396 pricing pages); cada cambio se guarda como **evento estructurado** (categorías Pricing/Packaging/Product; tags price_change, metric change, feature change; valores antes/después; screenshots anotados); API REST + servidor MCP. Ejemplo: Linear Business $49→$59/seat (may-2025), nuevo tier Enterprise "custom pricing" (ene-2025). Detecta "price reveals" (pasar de "Contact sales" a precio publicado, ej. Slack Enterprise+ $45 el 4-oct-2026) y tests A/B de precio (Intercom mostrando $19 vs $29) [verificado-snippet] — [PricingSaaS database](https://pricingsaas.com/pulse/database); [PricingSaaS home](https://pricingsaas.com/); [Rob Litterst, LinkedIn feb-2026](https://www.linkedin.com/posts/roblitterst_weve-built-the-largest-saas-pricing-dataset-activity-7432855080443305984-TBSP)
- Visualping: monitoreo de cambios en páginas de precios con alertas (page-diff, no base normalizada) [síntesis-Perplexity] — [Visualping competitive monitoring](https://visualping.io/competitive-monitoring)
- Crayon / Klue / Kompyte, Vendr, Paddle ProfitWell (Price Intelligently), Competera, Prisync, Price2Spy, DataWeave, Minderest, Intelligence Node: **sin evidencia** de extracción estructurada de planes/tiers/servicios en lo relevado [sin verificar].

**LATAM / Argentina (comparadores privados)**
- Prepagaya: precio de referencia para individuo de 30 años, calculadora por franjas de edad, pide provincia; avisa que el precio varía por edad y zona y que hay que confirmarlo con la prepaga [síntesis-Perplexity] — [Prepagaya calculadora](https://www.prepagaya.com.ar/calculadora); [Prepagaya](https://www.prepagaya.com.ar/)
- Cuantomecuesta: ejemplo de cotización con grupo familiar (2 adultos 36–40 + 1 hijo) [síntesis-Perplexity] — [cuantomecuesta prepagas](https://cuantomecuesta.com/ar/prepaga-comparador/)
- Selectra AR (internet): lista planes por velocidad y precio, marca promos de 2–12 meses e indica el precio después del período promocional [síntesis-Perplexity] — [Selectra internet](https://selectra.com.ar/internet)
- No encontré fuente sobre Ookla publicando precios de planes, ni sobre Infiniti Research con producto de monitoreo de servicios [sin verificar].

### Inferences
- Para BIP (cliente de cualquier industria), el patrón replicable es el de Tarifica/PricingSaaS: **captura de la oferta publicada en la web del competidor → plantilla estructurada por tipo de oferta → evento de cambio (antes/después)**. El de seguros US (filings) no aplica en AR; el de rate-shopping (parámetros de consulta) aplica a viajes/hoteles.
- PricingSaaS valida dos eventos que un tracker de servicios debe modelar explícitamente: "price reveal" (de "consultar/contactar ventas" a precio) y precio A/B (mismo plan, dos precios).
- Comperemedia/Competiscan muestran que en banca/tarjetas la "oferta" es un paquete de atributos (cuota, tasa intro, bonus) que se puntúa con un índice, no un precio único.

### Gaps
- Precios y cobertura AR específicos de Tarifica (cuántos operadores AR, si incluye TV paga/prepago) — sitio bloqueado.
- Método real de Curinos/Moebs/RateWatch/Informa e Infare; Quadrant con perfiles sintéticos.
- Si existe un vendor LATAM horizontal de precios de servicios (no encontré ninguno).

## 2. Fuentes regulatorias públicas en Argentina usables como fuente de precios

### Takeaway
Hay tres fuentes oficiales fuertes y estructuradas: **SSSalud (cuadros tarifarios de prepagas por plan, franja etaria y zona, mensual desde Res. 645/2025)**, **ENACOM (comparador de precios de internet/móvil/TV/bundles con precio nominal, promocional y meses de promo, AMBA)** y **BCRA Régimen de Transparencia (CSV/API diarios de comisiones y tasas por producto)**. SSN (seguros) no mostró comparador de primas. SEPA/Precios Claros es retail de góndola (diario), no servicios.

### Cited Findings
**SSSalud — prepagas**
- Desde ene-2024 (DNU 70/2023) la SSSalud dice no tener competencia para fijar cuotas; la tabla oficial de aumentos autorizados es histórica 2012–2023 (resolución, grupo de entidades, vigencia, % autorizado) [síntesis-Perplexity] — [Aumentos autorizados histórico](https://www.argentina.gob.ar/aumentos-autorizados-entidades-de-medicina-prepaga-historico-anos-2012-al-2023)
- **Resolución SSSalud 645/2025** (firmada 15-may-2025, BO 16-may-2025 N° 35.667): las prepagas deben presentar, antes de notificar a los socios, el aviso de aumento, el % y la **nueva cuota desglosada por plan, franja etaria y, si aplica, región/zona**, el cuadro tarifario vigente y copagos por prestación; plazo **dentro de 5 días de que INDEC publica el IPC**, con ≥30 días corridos de aviso antes del vencimiento [síntesis-Perplexity] — [Res. 645/2025 texto](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-645-2025-412870/texto); [Infoleg](https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=412870)
- Portal **cuadrostarifarios.sssalud.gob.ar**: muestra los valores declarados por cada entidad por período; filtros por período, prepaga, región, plan, **modalidad** y **rango etario**; comparación mes a mes. Son valores **declarados**, pueden diferir de lo facturado por bonificaciones/descuentos [síntesis-Perplexity] — [Cuadros tarifarios SSSalud](https://cuadrostarifarios.sssalud.gob.ar/); [SSSalud Valores de planes](https://www.argentina.gob.ar/sssalud/valores-de-planes)
- Ley 26.682 art. 17: relación máx. **3:1** entre la primera y la última franja etaria; art. 12: socios >65 años con >10 años de antigüedad en la misma entidad no pueden recibir aumento por edad [síntesis-Perplexity] — [Ley 26.682 actualizada](https://www.argentina.gob.ar/normativa/nacional/norma-182180/actualizacion)

**ENACOM — telecom**
- Comparador de precios ENACOM (indicadores.enacom.gob.ar/Precios): según ENACOM, basado en precios principales y condiciones comerciales "de acuerdo a las publicaciones de las páginas web oficiales" de los prestadores; cubre **AMBA/CABA/Buenos Aires** [síntesis-Perplexity] — [ENACOM Precios servicios](https://indicadores.enacom.gob.ar/Precios/servicios)
- Campos por servicio: **internet fija** = prestador, plan (la velocidad suele ir en el nombre), abono nominal, precio promocional, duración/condiciones de la promo, descuento, precio del módem; **móvil** = precio nominal y promocional, GB, minutos, SMS, WhatsApp (sin campo de duración de promo consistente); **TV** = nominal, promocional, duración promo, cantidad de canales, instalación, cargo mensual de decodificador, localidad; **bundles** = velocidad, precios, promo, instalación, canales [síntesis-Perplexity] — [Comparador internet](https://indicadores.enacom.gob.ar/Precios/Comparador/internet); [Comparador móviles](https://indicadores.enacom.gob.ar/Precios/Comparador/comunicaciones-moviles); [Comparador TV](https://indicadores.enacom.gob.ar/Precios/Comparador/tv); [Triple play](https://indicadores.enacom.gob.ar/Precios/Comparador/triple-play)
- Frescura: metadata de actualización 2026 en internet y móvil; TV mostraba 20-sep-2025 → frescura despareja [síntesis-Perplexity] — mismas URLs
- Material regulatorio de ENACOM indica que los prestadores móviles deben informar mensualmente todos los planes ofrecidos [síntesis-Perplexity] — [ENACOM normativas grupos](https://www.enacom.gob.ar/normativas/grupos)
- Res. ENACOM 1467/2020 crea la **Prestación Básica Universal Obligatoria (PBU)**; no es un registro general de planes comerciales [síntesis-Perplexity] — [Res. 1467/2020](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1467-2020-345456/texto)
- **No se confirmó** dataset descargable/API del comparador en datosabiertos.enacom.gob.ar [sin verificar].

**BCRA — Régimen de Transparencia**
- Archivos **CSV** por producto: cajas de ahorro, paquetes de productos, plazo fijo, préstamos hipotecarios/personales/prendarios, tarjetas de crédito; actualización en días hábiles (primera 11:00, última 19:00) [síntesis-Perplexity] — [BCRA Régimen de Transparencia](https://www.bcra.gob.ar/regimen-de-transparencia/)
- API documentada para productos, tasas, comisiones y demás datos que las entidades deben publicar [síntesis-Perplexity] — [BCRA API Transparencia (PDF)](https://www.bcra.gob.ar/archivos/Catalogo/Content/files/pdf/regimen-transparencia-v1.pdf); [docs](https://regimen-transparencia.bcra.apidocs.ar/); [Catálogo de APIs BCRA](https://www.bcra.gob.ar/en/central-bank-api-catalog/)
- Comparador de comisiones y cargos del BCRA [síntesis-Perplexity, campos exactos sin verificar] — [BCRA comisiones-cargos](https://www.bcra.gob.ar/comisiones-cargos/)
- Esquema normalizado de un tercero sobre esos datos: fecha de vigencia, código/nombre de entidad, producto, subproducto, moneda, tipo de precio, métrica, valor, unidad (no es el esquema oficial) [síntesis-Perplexity] — [almanac.ar dataset](https://almanac.ar/datasets/bcra.transparencia.tasas-y-comisiones)

**SSN / SEPA**
- SSN: no se encontró comparador oficial ni dataset público de primas por producto [sin verificar — ausencia de evidencia].
- SEPA: precios minoristas de grandes establecimientos, >70.000 productos, ~12 millones de registros **por día** [síntesis-Perplexity] — [datos.produccion.gob.ar SEPA](https://datos.produccion.gob.ar/dataset/sepa-precios)

### Inferences
- Para clientes BIP de **prepagas**, el portal SSSalud resuelve el problema más difícil (precio por edad/zona detrás de cotizador): es la fuente oficial mensual con plan × franja × región × modalidad. Conviene ingerirlo antes que scrapear cotizadores. Cuidado: es precio **de lista declarado**, no el promocional/bonificado.
- Para **telecom**, ENACOM ya trae el modelo nominal + promo + meses de promo + equipo/instalación (casi el data model que BIP necesita), pero solo AMBA y sin export confirmado → probablemente scraping del comparador o de los sitios de operadores.
- Para **bancos**, el CSV/API BCRA es la fuente de comisiones/tasas más limpia (diaria hábil).
- Ninguna de estas fuentes cubre streaming, aerolíneas, educación ni delivery → ahí solo queda captura de la web del competidor.

### Gaps
- Si cuadrostarifarios.sssalud permite descarga masiva (CSV/API) o solo consulta — no verificado.
- Lista exacta de franjas etarias y modalidades (individual / grupo familiar / aportes derivados) que usa el portal.
- Esquema oficial del CSV del BCRA y si el comparador de comisiones incluye CFT por tarjeta/paquete.
- Base legal exacta de la obligación de informar planes de internet/TV a ENACOM.

## 3. Métodos de normalización de "precio efectivo" (plantillas de buenas prácticas)

### Takeaway
Las metodologías oficiales (OCDE, UIT, Comisión Europea/BEREC, Ofcom) comparan ofertas heterogéneas con **canastas de uso estándar + la oferta más barata que cumple** cada canasta; difieren en el tratamiento de promos y cargos únicos. La práctica comercial agrega **precio efectivo mensual sobre 12/24 meses** (promo + precio regular + cargos únicos ÷ horizonte) y métricas unitarias (por GB, por Mbps) como secundarias.

### Cited Findings
- **OCDE 2017:** canastas de uso; se calcula la oferta de menor costo **por operador y canasta**; promos incluidas si estaban vigentes al relevar y disponibles ≥1 mes (incluye rebajas de abono o conexión); en las canastas standalone **solo se incluye el abono mensual** (sin amortizar instalación); se suma un "Incumbent Access Fee" si es obligatorio [síntesis-Perplexity] — [OECD DSTI/CDEP/CISP(2017)4/FINAL](https://one.oecd.org/document/DSTI/CDEP/CISP(2017)4/FINAL/En/pdf)
- **OCDE 2020 bundles:** incluye cargos recurrentes y no recurrentes y promociones [síntesis-Perplexity] — [OECD bundled communication price baskets 2020](https://www.oecd.org/content/dam/oecd/en/publications/reports/2020/12/oecd-bundled-communication-price-baskets_371f0c20/64e4c18a-en.pdf)
- **UIT (ITU) ICT Price Baskets** (metodología adoptada 2024, aplicada a datos 2025): canasta data-only 5 GB; móvil voz+datos baja (70 min, 50 SMS, 1 GB) y alta (140 min, 20 SMS, 5 GB); banda ancha fija ≥5 GB y ≥256 kbit/s; se elige **el plan más barato que cumple o supera** el allowance; **no se recolectan cargos no recurrentes** (instalación); se consideran add-ons/excedentes si hacen falta para llegar a la canasta; resultados en % del INB per cápita mensual, USD y USD PPP [síntesis-Perplexity] — [ITU ICT prices](https://www.itu.int/en/ITU-D/Statistics/Pages/ICTprices/default.aspx); [ITU IPB Manual 2025](https://www.itu.int/en/ITU-D/Statistics/Documents/ICT_Prices/ITU_IPBQManual_2025.pdf); [ITU FF25 methodology](https://www.itu.int/itu-d/reports/statistics/2025/10/15/ff25-methodology/)
- **Comisión Europea "Mobile and Fixed Broadband Prices in Europe"** (estudio con Empirica/Teligen): ofertas de ISPs y operadores relevadas en una ventana de 4 semanas; canastas según guías BEREC (fija por velocidad, móvil por volumen, voz+datos, bundles de hogar); normaliza **cargos únicos, límites de volumen, descuentos, duración de contrato** y límites de uso [síntesis-Perplexity] — [EC study 2023](https://op.europa.eu/en/publication-detail/-/publication/686dfb5e-fb32-11f0-8da5-01aa75ed71a1/language-en); [EC study 2024](https://op.europa.eu/en/publication-detail/-/publication/54e3f6da-12c1-11f1-8870-01aa75ed71a1/); [DG Connect 2024 insights](https://digital-strategy.ec.europa.eu/en/library/mobile-and-fixed-broadband-price-europe-2024-insights-european-broadband-market); [BEREC benchmarking methodology](https://www.berec.europa.eu/en/document-categories/berec/reports/berec-report-on-mobile-broadband-prices-benchmarking-methodology)
- **Ofcom Pricing Trends 2024:** perfiles de uso de hogares; oferta más barata que cumple por proveedor; distingue precios **"front-book" (clientes nuevos) vs lo que pagan clientes existentes**; históricamente usó enfoque econométrico (hedónico) para controlar diferencias de características y equipos en móviles [síntesis-Perplexity] — [Ofcom Pricing Trends 2024](https://www.ofcom.org.uk/siteassets/resources/documents/research-and-data/multi-sector/pricing/2024/pricing-trends-for-communications-services-in-the-uk-2024.pdf?v=387092); [Ofcom pricing](https://www.ofcom.org.uk/phones-and-broadband/bills-and-charges/pricing)
- Fórmula práctica de precio efectivo mensual a horizonte H: (cargos únicos + Σ abonos mes a mes + equipo requerido − créditos) ÷ H; ejemplo: 30/mes × 6 meses y luego 50, con 60 de alta → 540 en 12 meses = **45/mes efectivo**; 1.140 en 24 meses = **47,50/mes** [síntesis-Perplexity, cálculo verificado por mí: 60+6×30+6×50=540; 60+6×30+18×50=1.140] — fuente de contexto: [EC study 2023](https://op.europa.eu/en/publication-detail/-/publication/686dfb5e-fb32-11f0-8da5-01aa75ed71a1/language-en)
- Tefficient advierte que precio por GB del allowance ≠ ingreso por GB de uso real [síntesis-Perplexity] — [Tefficient/EETT](https://www.eett.gr/wp-content/uploads/2026/08/Assessment-of-Greeces-mobile-usage-and-revenue-in-an-EU-context-by-Tefficient-for-EETT-8-Feb-2024-final.pdf)
- Tarifica se presenta como alternativa flexible a las canastas fijas OCDE: perfiles definidos por el usuario (largo de contrato, volumen de datos) [síntesis-Perplexity] — [Tarifica TPIP intro](https://ww1.prweb.com/prfiles/2023/06/20/19401193/Tarifica_TelecomPricingIntelligencePlatform-Introduction_.pdf)

### Inferences
- Plantilla category-agnostic para BIP derivable de estas metodologías: (1) definir **perfiles/canastas por categoría** (ej. prepaga = individuo 30 años CABA / pareja 35 + 1 hijo; internet = ≥300 Mbps; móvil = ≥10 GB); (2) por competidor, **oferta más barata que cumple**; (3) reportar a la vez **precio de lista, precio promo + meses, precio efectivo 12m y 24m**; (4) métricas unitarias ($/GB, $/Mbps, $/mes por persona) solo como secundarias.
- La diferencia OCDE (incluye promos) vs UIT (no amortiza alta, no usa promo como estándar) sugiere mostrar **ambas vistas** (lista vs efectiva) en lugar de elegir una.
- Las normalizaciones PPP/INB son para comparación entre países; para BIP mono-país alcanza $ nominal y USD (regla del user).

### Gaps
- Texto literal de la regla OCDE 2017 sobre promos y de la UIT sobre promociones (Perplexity fue ambiguo en UIT).
- Ningún método oficial para servicios no-telecom (prepagas, seguros, educación): habría que adaptar la lógica de canasta.

## 4. Data model, KPIs, visualización y desafíos de recolección

### Takeaway
El modelo de datos común es **oferta = plan/tier con precio recurrente + cargos únicos + promo (precio, duración, precio post-promo) + permanencia + atributos/allowances + dimensiones de segmentación (zona, edad, grupo familiar, canal, fecha de viaje/estadía)**, guardado como **serie de observaciones con timestamp y eventos de cambio**. Visualizaciones típicas: ranking/escalera por perfil, matriz tarifaria, series de tiempo y calendarios, heat maps, paridad, índices de oferta.

### Cited Findings
- Dimensiones de una consulta de rate-shop hotelero: propiedad, check-in, length of stay, ocupación, tipo de habitación, tipo de tarifa (reembolsable/desayuno), canal/OTA, punto de venta; resultados con precio observado, disponibilidad, match de habitación/tarifa, timestamp, paridad [síntesis-Perplexity] — [RateGain](https://uno.rategain.com/hotel-rate-intelligence/); [Lighthouse overview](https://content.mylighthouse.com/hubfs/lh-documents/sales/company-and-product-overview-presentation-en.pdf)
- Vistas Lighthouse: Calendar, Graph, Table; mediana del compset, alta/baja; paridad por canal [síntesis-Perplexity] — [Lighthouse blog](https://www.mylighthouse.com/resources/blog/how-to-get-most-out-of-lighthouse-rate-insight)
- Prepagas: precio depende de edad de cada integrante, composición familiar y zona; los comparadores muestran estimaciones de referencia [síntesis-Perplexity] — [Prepagaya](https://www.prepagaya.com.ar/calculadora); [cuantomecuesta](https://cuantomecuesta.com/ar/prepaga-comparador/)
- Telecom AR: promo precio + duración (2–12 meses) + precio posterior; abono nominal vs promocional, módem, instalación, decodificador [síntesis-Perplexity] — [Selectra](https://selectra.com.ar/internet); [ENACOM comparador](https://indicadores.enacom.gob.ar/Precios/Comparador/internet)
- Tarifica: plantillas separadas por tipo de oferta; promos con OTT incluidos, equipo gratis, descuento multi-línea; ofertas BTL por SMS (PlanDetector) [verificado-snippet] — [Tarifica Data](https://tarifica.com/data); [Tarifica Solutions](https://tarifica.com/solutions)
- Tarifica visualiza rankings, series de tiempo, box plots, scatter/burbuja, heat maps [síntesis-Perplexity] — [Tarifica TPIP intro](https://ww1.prweb.com/prfiles/2023/06/20/19401193/Tarifica_TelecomPricingIntelligencePlatform-Introduction_.pdf)
- Comperemedia: Offer Score de 6 atributos con cambio trimestral; gráficos de prevalencia de tasas intro, duración intro, fees [síntesis-Perplexity] — [Offer Index](https://www.prnewswire.com/news-releases/comperemedia-unveils-offer-index---a-proprietary-tool-redefining-credit-card-offer-comparisons-302008187.html); [CFPB deck](https://files.consumerfinance.gov/f/documents/Comperemedia-presentation.pdf)
- PricingSaaS: timeline de eventos por empresa (precio/packaging/producto), diffs antes/después, % de cambio por tier, resumen semanal del mercado ("279 cambios en 4.396 páginas") [verificado-snippet] — [PricingSaaS](https://pricingsaas.com/); [Pulse database](https://pricingsaas.com/pulse/database)
- Desafíos de captura vistos en fuentes: ofertas BTL por SMS (Tarifica), "Contact sales" sin precio y A/B de precios (PricingSaaS), precio declarado ≠ facturado por bonificaciones (SSSalud), cobertura solo AMBA y frescura despareja (ENACOM), precio front-book vs base instalada (Ofcom) — fuentes arriba.

### Inferences
- **Esquema mínimo sugerido para BIP (inferencia, no de un vendor):**
  - `oferta` (competidor, categoría, plan/tier, canal de venta, URL fuente, tipo de fuente: web / regulador / comparador / SMS-mail / cotizador)
  - `precio_obs` (fecha_obs, moneda $/USD, precio_lista_recurrente, periodicidad, precio_promo, meses_promo, cargo_unico/instalación, equipo, permanencia_meses, penalidad_salida, "sin precio publicado" flag)
  - `segmento` (zona/localidad, edad o franja, composición familiar, fecha de uso/estadía, ocupación)
  - `atributos` (clave-valor tipados: GB, Mbps, minutos, canales, cobertura, copagos, equipaje, usuarios/seats)
  - derivados: precio efectivo 12m/24m, $/unidad de atributo principal, rank por perfil, `evento_cambio` (subió/bajó/promo nueva/fin promo/price reveal).
- **KPIs:** índice de precio vs competencia por perfil (precio propio ÷ mediana del set), posición en la escalera, brecha vs más barato, % de ofertas con promo, profundidad media de descuento y meses de promo, frecuencia de cambios por competidor, días desde último aumento.
- **Visualizaciones a priorizar:** escalera de precios por perfil (barras ordenadas), matriz precio × atributo (scatter/burbuja tipo Tarifica), timeline de promos (barras horizontales de inicio–fin por competidor), serie mensual de precio efectivo, calendario (para viajes), tabla de eventos de cambio.

### Gaps
- No encontré documentación pública detallada de dashboards (capturas) de Tarifica Arch, Lighthouse o Competiscan para copiar layouts.
- Sin evidencia sobre cómo los vendors manejan precios detrás de login/cotizador personalizado más allá de perfiles sintéticos genéricos.
