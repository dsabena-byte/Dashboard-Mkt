# Recolección de precios competitivos y calidad de datos (pipeline + gobierno) para un producto de monitoreo de precios

> Notas de investigación (oct-2026). Fuentes 2023–2026 salvo precedentes legales/académicos más viejos que siguen vigentes (marcados con su fecha). Precios de proveedores = precios de lista públicos al momento de cada fuente; pueden cambiar.

## 1. Métodos de recolección: APIs públicas, datos estructurados, HTML, navegadores headless; cadencia, geolocalización, logueado vs no logueado, A/B, anti-bot y crawling responsable

### Takeaway
El orden práctico es: (1) endpoints JSON de la plataforma (VTEX, Shopify products.json) → (2) JSON-LD schema.org Offer embebido en el HTML → (3) parseo de HTML → (4) navegador headless solo cuando hace falta. **Mercado Libre ya NO permite la búsqueda pública anónima por API (403 desde abr-2025)**, así que monitorear ML exige un token OAuth (con alcance acotado) o el HTML renderizado, que está detrás de un challenge anti-bot. Los precios online cambian a diario o más seguido y pueden variar por código postal, así que la cadencia y la "región" son parte de la definición de cada observación.

### Cited Findings
**APIs de plataforma**
- VTEX Legacy Search API expone endpoints públicos (`/api/catalog_system/pub/...`): `products/search/{search}`, búsqueda con filtro/orden/paginado, búsqueda por URL de producto (`/{product-text-link}/p`) y ofertas por producto/SKU (`/pub/products/offers/{productId}/sku/{skuId}`). — [VTEX Legacy Search API](https://developers.vtex.com/docs/api-reference/search-api)
- VTEX Intelligent Search API v1 reemplaza a la legacy (`/api/io/_v/api/intelligent-search/*`), suma caché HTTP (`Cache-Control: public, max-age=600`), regionalización explícita sin la cookie de segmento y un endpoint `GET /products` para la página de producto; "todas las integraciones headless nuevas deben usar v1" y la legacy se va a deprecar. — [VTEX Intelligent Search API (Legacy)](https://developers.vtex.com/docs/api-reference/intelligent-search-api); [Intelligent Search API v1](https://developers.vtex.com/docs/api-reference/intelligent-search-api-v1)
- La respuesta de búsqueda de VTEX trae `items[].sellers[].commertialOffer` (por ejemplo `AvailableQuantity`, `discountHighlights`, `DeliverySlaSamples`) → precio y stock por seller. — [VTEX guide: consult product search information](https://developers.vtex.com/docs/guides/consult-product-search-information)
- En VTEX el precio y el stock dependen del contexto: la v1 NO lee la cookie de segmento y hay que pasar `sc` (canal de venta / política comercial), `regionId`, `country`, `zip-code` y `coordinates` como parámetros explícitos. — [VTEX: Migrating to Intelligent Search API v1](https://developers.vtex.com/docs/guides/migrating-to-intelligent-search-api-v1)
- La función Region de VTEX filtra sellers, precio y stock según la región de entrega; puede haber diferencia de precio/promo entre la vidriera y el carrito cuando el seller que entrega tiene otras condiciones comerciales. — [VTEX Help: Configure seller regionalization](https://help.vtex.com/docs/tutorials/configure-seller-regionalization)
- VTEX manda a Google Merchant Center precio y stock regionales por grupo de códigos postales; el `region_id` (Base64 de `vtex:{countryCode}:{postalCode}`, ej. `ARG`) va en la URL. — [VTEX: Google regional price and availability](https://developers.vtex.com/docs/guides/adapting-headless-storefronts-to-google-raap)
- Shopify: `/products.json` en la tienda pública, sin autenticación, hasta 250 productos por página (el default es 30), paginado por `page` hasta que vuelve un array vacío. Hay un tope de offset de 25.000 (HTTP 400 "Page * Limit exceeds the 25000 limit"); para pasarlo se recorre `/collections/{handle}/products.json`. Precio y stock van **por variante**; `price` es un string en unidades mayores, mientras que `/products/{handle}.js` devuelve enteros en centavos. — [dev.to: Shopify products.json pagination](https://dev.to/odeeb/shopify-productsjson-pagination-250-limit-and-the-25000-cap-1g37)
- En Shopify, `compare_at_price` no nulo = promo activa (tiene el precio original). Algunas tiendas Shopify Plus/headless desactivan el endpoint (403/404) → caer a sitemap + JSON-LD. Shopify no publica límites de tasa para products.json, pero hay 429 o arrays vacíos silenciosos si se va rápido; se sugieren ~2 s entre páginas. En una prueba, 6 de 8 tiendas devolvieron datos. — [Decodo: scraping Shopify](https://decodo.com/blog/web-scraping-shopify)
- Mercado Libre: la API pública de búsqueda (`api.mercadolibre.com/sites/MLA/search`) devuelve `403 forbidden` sin token desde ~abr-2025. Respuesta de ML citada: "las búsquedas generales realizadas mediante la función 'search' ya no estarán disponibles… las consultas deberán ser personalizadas según el usuario". — [Reddit r/devsarg, abr-2025](https://www.reddit.com/r/devsarg/comments/1jovh3s/quien_de_ustedes_rompi%C3%B3_las_apis_de_mercadolibre/)
- Medición independiente (sep-2026): el 403 es idéntico desde una conexión hogareña, un datacenter y un proxy residencial AR/MX, así que es un muro de autenticación y no un bloqueo por bot. El HTML de búsqueda sobrevive detrás de un challenge de proof-of-work; las IPs de datacenter reciben un "decoy" con HTTP 200, que es un bloqueo blando. — [dev.to: Mercado Libre scraper, sep-2026](https://dev.to/devil_scrapes/we-doubled-mercado-libres-scraper-memory-and-clearance-went-from-50-to-90-with-zero-code-33p0)
- Otra fuente midió el 27-sep-2026 que `/sites/{site}/search` exige un token OAuth en cada llamada, más una allowlist de IP en la aplicación. — [ReefAPI MercadoLibre](https://reefapi.com/mercadolibre-api)
- La documentación de precios de ML dice que se van a dar de baja los campos `price`, `base_price` y `original_price` de `/items`. Recomienda `/items/{id}/sale_price?context=channel_marketplace,buyer_loyalty_3` (el precio "ganador" según canal y nivel de lealtad del comprador) y `/items/{id}/prices`. Si el token no es del seller, no vuelve el metadata del tipo de promoción. — [ML Developers: Products prices](https://developers.mercadolivre.com.br/en_us/price-apl)
- La búsqueda por seller pasó a `/users/{user_id}/items/search`, que es un recurso privado del propio seller. — [ML Developers: Items & Searches](https://developers.mercadolivre.com.br/en_us/api-docs/items-and-searches)

**Datos estructurados (schema.org)**
- Google reconoce 3 precios en Offer: activo (sin `priceType`), tachado (`priceType = https://schema.org/StrikethroughPrice`; `ListPrice` se acepta en transición) y de socio (`validForMemberTier`). Si hay `offers.price` y `offers.priceSpecification` en conflicto, Google usa `offers.price`. La vigencia de la promo va en `validFrom` + `validThrough`/`priceValidUntil` (ISO 8601). — [Google Search Central: Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- Merchant Center: `price` es un número sin símbolos ni separadores de miles; `priceCurrency` es ISO 4217. El markup debe estar en el HTML que devuelve el servidor (no generado por JS después de cargar), y Google recomienda JSON-LD. Envío vía `OfferShippingDetails`/`shippingDetails`. — [Google Merchant Center: supported structured data attributes](https://support.google.com/merchants/answer/6386198?hl=en-GB)
- En la guía de Shopify, los campos núcleo de precio son `price`, `priceCurrency`, `priceValidUntil`, `availability` e `itemCondition` dentro de `Offer`. — [Shopify: Ecommerce schema 2026](https://www.shopify.com/blog/ecommerce-schema)

**Cadencia y variación de precios (evidencia empírica)**
- En los almacenes online de EE. UU. (datos por hora), la probabilidad de cambio de precio en el mismo día es 0,069 (Amazon) y 0,082 (Walmart); entre días consecutivos, 0,173 y 0,117. ~48% de los productos de Amazon cambia de precio en una semana, y los cambios se concentran en días específicos (miércoles en Amazon, jueves en Walmart). — [NBER w28639, Aparicio et al.](https://www.nber.org/system/files/working_papers/w28639/w28639.pdf)
- Esos mismos algoritmos fijan precios distintos por código postal de entrega: ~25% de los productos difiere más de 20% entre códigos postales, y el 35,5% de los precios es idéntico entre ciudades online contra 61% offline. Para recolectar, los autores cargaban códigos postales en los sitios. — [Aparicio et al., QME 2023 (Springer)](https://link.springer.com/article/10.1007/s11129-023-09273-w); [MIT Open Access](https://dspace.mit.edu/bitstream/handle/1721.1/153153/11129_2023_Article_9273.pdf?sequence=1)
- Los retailers más sofisticados ajustan precios en menos de una hora y responden algorítmicamente a sus rivales. — [Brookings, Brown & MacKay 2022](https://www.brookings.edu/articles/are-online-prices-higher-because-of-pricing-algorithms/)
- Hay experimentación de precios: los almaceneros online "exploran la grilla de precios" con pequeños experimentos. — [Aparicio, "AI and Pricing" (2023)](https://diegoaparicio.org/wp-content/uploads/2023/05/AI_Chapter.pdf)
- Billion Prices Project (MIT): bajan las páginas **a una hora fija cada día**, con la misma URL todos los días. Cuando el precio depende del código postal, eligen algunos de ciudades grandes y tratan cada uno como un retailer independiente. Observan cada retailer más de un año antes de usarlo en un índice. — [Cavallo & Rigobon, JEP 2016 (MIT)](https://dspace.mit.edu/bitstream/handle/1721.1/105176/BPP_JEP%20article%20with%20Appendix.pdf?sequence=3&isAllowed=y); [Cavallo, "Scraped Data and Sticky Prices"](https://www.hbs.edu/ris/Publication%20Files/Cavallo_Alberto_J4_Scraped%20Data%20and%20Sticky%20Prices_eb55d968-c3ec-44e7-9d3e-8afd50603ec1.pdf)
- Cadencias de los proveedores: Prisync hasta 3 veces por día en los planes estándar; Price2Spy Premium hasta 8 por día (cada 3 h) y Basic 1 por día a 1 cada 14 días; Omnia permite programar al minuto; Minderest actualiza a diario. — [Ficstar 2026](https://www.ficstar.com/best-price-intelligence-services-2026); [Price2Spy technical FAQ](https://www.price2spy.com/technical-questions.html); [ZenRows 2026](https://www.zenrows.com/blog/price-intelligence-tools)
- DataWeave ofrece frecuencias desde diaria hasta varias por día, y "near real-time" para flash sales. Detalla por tienda, barrio, código postal o país, y por desktop, mobile y apps. — [DataWeave competitor price monitoring](https://dataweave.com/us/competitor-price-monitoring); [DataWeave digital shelf](https://dataweave.com/us/digital-shelf-analytics)

**Logueado vs no logueado y crawling responsable**
- RFC 9309 (Robots Exclusion Protocol): los crawlers "SHOULD NOT" usar la copia cacheada de robots.txt más de 24 h (salvo que no se pueda alcanzar) y deben parsear al menos 500 KiB. — [IETF RFC 9309](https://datatracker.ietf.org/doc/rfc9309/)
- `Crawl-delay` no es parte de RFC 9309 (Google no lo soporta, Bing y Yandex sí). Además, robots.txt "no es una forma de autorización de acceso". — [ProxyEmpire, citando RFC 9309](https://proxyempire.io/web-crawler-vs-web-scraper-key-differences-explained/); [CERN OSSYM 2022](https://indico.cern.ch/event/1149330/contributions/5074600/attachments/2524742/4346236/ossym2022-robotstxt-sn.pdf)
- Guía de buenas prácticas para Shopify: leer solo el listado público (título, variante, precio, SKU, disponibilidad), nunca `/cart`, `/checkout` ni `/account`, y autolimitar la tasa con backoff. — [SparkProxy: scraping Shopify](https://www.sparkproxy.io/blog/how-to-scrape-shopify-stores)

### Inferences
- Para Argentina, la mayoría de los retailers grandes de electro corre sobre VTEX (no lo verifiqué tienda por tienda). El conector de mayor rendimiento sería Intelligent Search v1 con `sc` y `zip-code` fijos y registrados en la observación. Para Shopify, products.json; para el resto, JSON-LD y como último recurso un headless.
- Para ML, el camino legítimo es la API con OAuth (útil para catálogo y para los precios de un seller propio). Para la competencia en el marketplace queda el HTML, que hoy exige proxies residenciales y resolver un challenge: más costo y más riesgo de que el sitio lo vea como elusión de medidas técnicas.
- Como los precios cambian intradía y por zona, cada observación debería llevar un "contexto de captura" (región/CP, canal, sesión logueada o no, dispositivo). Conviene una hora fija diaria (como BPP) más re-chequeos intradía solo para SKUs prioritarios.
- Los precios de socio o lealtad (`validForMemberTier`, `buyer_loyalty` de ML) son un tipo de precio distinto: si no se separan, aparecen "saltos" falsos.

### Gaps
- No encontré documentación oficial de VTEX sobre límites de tasa de los endpoints públicos `pub/`.
- No hay datos públicos sobre la frecuencia de A/B testing de precios en retailers argentinos.
- No verifiqué si los retailers AR publican JSON-LD Offer completo (con StrikethroughPrice) en el HTML del servidor.
- No encontré una guía oficial de ML que autorice el uso de su API para monitorear la competencia.

## 2. Qué guardar por observación, esquema (append-only / series de tiempo / SCD) y deduplicación

### Takeaway
La práctica de referencia (Billion Prices Project, Zyte, DataWeave) es guardar **una fila inmutable por producto × contexto × momento de captura**. Esa fila lleva todos los tipos de precio (lista/tachado, venta, socio, contado vs cuotas, unitario), stock, seller y envío, el timestamp de captura, la URL y la evidencia (HTML crudo, caché o captura de pantalla). La deduplicación se hace por identificador configurable, y se distingue "faltante por error de scraping" de "faltante por sin stock".

### Cited Findings
- Los robots de BPP siempre recolectan id de producto, nombre, descripción, marca, presentación, categoría y precio; cuando existen, también precio de oferta e indicador de stock. Guardan **un registro por producto por día**. — [Cavallo & Rigobon, BPP](https://www.hbs.edu/ris/Publication%20Files/Cavallo_Alberto_J7_The%20Billion%20Prices%20Project_9c302f5e-d31c-4356-9f92-4b906fcf137f.pdf); [Cavallo, Scraped Data and Sticky Prices](https://www.hbs.edu/ris/Publication%20Files/Cavallo_Alberto_J4_Scraped%20Data%20and%20Sticky%20Prices_eb55d968-c3ec-44e7-9d3e-8afd50603ec1.pdf)
- Cavallo muestra que el promedio temporal y la imputación de precios faltantes sesgan la duración y el tamaño de los cambios. Los faltantes del dato scrapeado vienen de productos sin stock **o** de fallas del software, y él elimina los precios "carried forward" antes de analizar. → No imputar en la capa cruda. — [Cavallo, Scraped Data and Sticky Prices](https://www.hbs.edu/ris/Publication%20Files/Cavallo_Alberto_J4_Scraped%20Data%20and%20Sticky%20Prices_eb55d968-c3ec-44e7-9d3e-8afd50603ec1.pdf)
- DataWeave distingue precio de lista (MRP/MSRP), precio de venta, precio promocional, precio final al usuario después de ofertas y precio normalizado por unidad. Muestra al usuario la recencia del dato, su calidad y las **URLs cacheadas**, y permite marcar registros inexactos. — [DataWeave competitor price monitoring](https://dataweave.com/us/competitor-price-monitoring); [DataWeave home](https://dataweave.com/us); [DataWeave pricing intelligence](https://dataweave.com/us/pricing-intelligence)
- Price2Spy y Minderest capturan pantallas como evidencia de violaciones de MAP. En Price2Spy es un add-on, configurable "para cualquier cambio de precio o solo para violaciones". — [Price2Spy technical FAQ](https://www.price2spy.com/technical-questions.html); [Price2Spy MAP](https://www.price2spy.com/map-price-monitoring.html); [ProWebScraper (Minderest screenshots)](https://prowebscraper.com/articles/price2spy-alternatives)
- Price2Spy también documenta campos de seller, envío, stock y campos custom según el plan, y guarda el historial desde el inicio del monitoreo. — [pricemonitor.io review of Price2Spy](https://pricemonitor.io/price2spy-review)
- Un proveedor managed describe su entrega con flags de QA por campo (clean/flagged/review needed), un timestamp de captura en cada fila y cobertura por sitio por entrega (esperados vs recolectados vs faltantes). Es una fuente de vendedor y por lo tanto interesada. — [ProWebScraper](https://prowebscraper.com/articles/price2spy-alternatives)
- Zyte detecta duplicados "a través de identificadores configurables" y compara datasets entre entregas. — [Zyte: How extraction experts guarantee data quality (2025)](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- Requisitos legales argentinos que definen qué campos existen en la página: la Res. SIC 4/2025 obliga a mostrar el precio final en pesos, el "PRECIO SIN IMPUESTOS NACIONALES" (desde el 1-abr-2025, Ley 27.743 art. 99) y el precio por unidad de medida. Si se muestra financiado, también precio de contado, cantidad y monto de cuotas y CFTEA. — [Res. 4/2025 texto oficial](https://www.argentina.gob.ar/normativa/nacional/norma-408455/texto); [Guía oficial exhibición de precios](https://www.argentina.gob.ar/sites/default/files/exhibicion_de_precios_resolucion_4_2025_0.pdf)
- Para comparar hay que igualar modelo, variante, bundle, condición, tipo de seller y disponibilidad antes de tratar un precio más bajo como comparable. — [ZenRows 2026](https://www.zenrows.com/blog/price-intelligence-tools)
- En Shopify el precio va por variante (un producto con 12 talles = 12 filas de variante con su `price` y `available`). — [dev.to: Shopify products.json](https://dev.to/odeeb/shopify-productsjson-pagination-250-limit-and-the-25000-cap-1g37)

### Inferences
- **Esquema sugerido (inferido de lo anterior, no tomado de un estándar):**
  - `price_observation` es append-only. Clave natural: (retailer, offer_id/SKU de la tienda, seller_id, contexto [CP/región, canal, logueado, dispositivo], captured_at).
  - Campos: url, http_status, método (api/jsonld/html/headless), parser_version, price_active, price_strikethrough/list, price_member, moneda, precio sin impuestos nacionales, precio contado, cuotas (n, monto, CFTEA, "sin interés"), precio unitario, availability (enum schema.org), stock_qty si viene, shipping_cost/free_shipping, promo_labels (texto crudo), priceValidUntil, raw_payload_ref (HTML/JSON en object storage) y screenshot_ref (opcional, solo en cambios o alertas).
- Para el producto: una tabla de estado actual (SCD tipo 2 o "último valor" materializado) derivada del log, con `valid_from/valid_to` por cambio de precio. El log crudo no se reescribe nunca, para poder reprocesar con un parser corregido (lineage).
- La deduplicación en dos niveles: misma URL o oferta capturada dos veces en la misma ventana → quedarse con la última. Mismo producto en varias URLs (variantes, parámetros de tracking) → canonicalizar la URL y deduplicar por id de oferta.
- Guardar la evidencia cruda (HTML o JSON comprimido) es barato comparado con su valor. Sirve como prueba ante un retailer o la marca y para re-parsear después de un bug. La captura de pantalla convendría solo en eventos (cambio de precio o violación), como hace Price2Spy.

### Gaps
- No encontré esquemas de datos publicados por Prisync, Minderest o Profitero (son propietarios).
- No encontré guías específicas sobre la retención de HTML crudo (costos y plazos) en proveedores de price intelligence.

## 3. Dimensiones y controles de calidad de datos (precisión, completitud, frescura, consistencia), reglas de validación, detección de rotura de parsers, SKUs canario, muestreo manual, tableros de salud; cómo describen la QA los proveedores

### Takeaway
La práctica madura (Zyte como referencia más detallada) combina varias capas:
- validación por esquema (JSON Schema) en cada campo;
- monitores por corrida (Spidermon): baneos, errores, caída de cobertura;
- detección estadística de anomalías (z-score, comparación contra entregas previas);
- líneas base de completitud por sitio;
- QA manual sobre una muestra estadísticamente significativa más un diff visual contra la página.

La observabilidad de datos agrega los 5 pilares (frescura, distribución, volumen, esquema, linaje). Los proveedores anuncian "99%+" pero, según una auditoría de terceros, **no ofrecen SLA de precisión exigibles** en sus contratos estándar.

### Cited Findings
**Cómo lo hace Zyte (el más documentado)**
- Cinco dimensiones formalizadas: **exactitud, validez, completitud, consistencia y oportunidad**. En el sitio de su servicio managed suma cobertura y frescura a la puntuación de cada entrega. — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/); [Zyte Web Data](https://www.zyte.com/data-extraction/)
- El JSON Schema versionado es la "fuente de verdad operativa" de cada proyecto: campos, tipos, rangos, formatos y reglas. — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- Exactitud: checks automáticos de no-nulos y tipos, más **inspección manual de una muestra estadísticamente significativa** para encontrar selectores incorrectos. Usan **z-scores** para detectar anomalías. — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- Validez: los campos pareados se validan juntos con modificadores condicionales (el análogo de "lista ≥ venta"). — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- Consistencia: normalizan separador decimal, símbolo de moneda y unidades. **Si el formato del precio cambia de golpe entre entregas, se marca para revisión manual.** — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- Completitud: líneas base por proyecto (cantidad esperada de registros y % de cobertura por campo de entregas previas), con alerta si bajan de un umbral. Los campos requeridos que faltan fallan la validación; los opcionales solo bloquean la entrega si su cobertura cae debajo de lo aceptable. Además usan "crawl, tag record IDs, crawl again, measure overlap" (captura-recaptura) para estimar registros perdidos. — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- Oportunidad: monitores de frecuencia de entrega; por ejemplo, si un dataset semanal no tiene un job nuevo a los 8 días, se notifica. — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- Su herramienta interna MATT genera JSON Schemas, valida campos, detecta duplicados, compara datasets entre entregas, hace **diff visual** contra el sitio sobre una muestra y genera reportes de QA. — [Zyte 2025](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)
- QA en cuatro capas: (1) pipelines de limpieza y validación durante el scraping, (2) Spidermon (esquema, baneos, errores, caídas de cobertura de ítems; puede frenar el spider en tiempo real si los datos no sirven), (3) tests automáticos ejecutados por un equipo de QA, (4) QA manual y visual con spot checks por muestreo. — [Zyte: Data QA for enterprise web scraping](https://www.zyte.com/blog/data-quality-assurance-for-enterprise-web-scraping/) (2018, sigue citado como base del proceso)
- La causa principal de degradación son los cambios del sitio: A/B tests, promos estacionales y variantes regionales rompen spiders. La cobertura y la exactitud se degradan con el tiempo sin monitoreo continuo. — [Zyte: Data QA for enterprise web scraping](https://www.zyte.com/blog/data-quality-assurance-for-enterprise-web-scraping/)
- Zyte publicó en 2026 un pipeline que consulta a un modelo de IA calibrado si cada campo "sigue pareciendo real" y frena el crawl cuando demasiados no lo parecen. — [Zyte blog, data quality topic](https://www.zyte.com/blog/topic/data-quality/)

**Observabilidad y herramientas de tests**
- Monte Carlo define 5 pilares: frescura (¿está al día? ¿hay huecos?), distribución (¿los valores están en rango? nulos, negativos), volumen ("si 200M filas pasan a 5M, tenés que saberlo"), esquema (campos agregados, quitados o cambiados) y linaje (qué se rompió upstream y downstream). — [Monte Carlo: 5 pillars](https://montecarlo.ai/blog-introducing-the-5-pillars-of-data-observability); [Monte Carlo governance](https://montecarlo.ai/blog-the-new-face-of-data-governance)
- Great Expectations tiene `expect_column_pair_values_a_to_be_greater_than_b` (con `or_equal`, `ignore_row_if`), que sirve para validar lista ≥ venta. Está marcado como EXPERIMENTAL. — [Great Expectations docs](https://greatexpectations.io/legacy/v1/expectations/expect_column_pair_values_a_to_be_greater_than_b/)
- dbt-expectations porta esos tests a dbt: `expect_column_values_to_be_between` (min/max, `row_condition`, `strictly`) y `expect_column_pair_values_A_to_be_greater_than_B`. — [calogica/dbt-expectations](https://github.com/calogica/dbt-expectations)

**Proveedores de price intelligence**
- DataWeave: reportes de auditoría de calidad, detección estadística de anomalías con alertas, aprobación o rechazo de matches en el dashboard. Veracite es su herramienta de validación con humano en el loop. — [DataWeave pricing intelligence](https://dataweave.com/us/pricing-intelligence); [DataWeave home](https://dataweave.com/us)
- DataWeave anuncia ">99%" de precisión de matching en la home y "más de 95%" en la página de Pricing Intelligence: dos cifras oficiales distintas. — [CheckThat.ai: DataWeave](https://checkthat.ai/brands/dataweave)
- Minderest anuncia 99%+ de exactitud de datos, maneja renderizado dinámico, anti-bot y cambios de formato en más de 180 mercados, y tiene certificación ISO 27001. Su matching es IA más manual (sin EAN/UPC). — [Ficstar 2026](https://www.ficstar.com/best-price-intelligence-services-2026); [Minderest brands](https://www.minderest.com/brands-manufacturers)
- Price2Spy ofrece matching manual, híbrido o automático. Su "Automatch" usa ML con reglas del cliente y umbral de precisión, y opcionalmente aprobación manual de cada match. — [pricemonitor.io review](https://pricemonitor.io/price2spy-review)
- Una auditoría de seis proveedores (Prisync, Price2Spy, Competera, Omnia, Profitero, Minderest) concluye que **ninguno ofrece SLA de precisión exigibles en sus contratos estándar**. En reseñas aparecen quejas recurrentes: precio equivocado, moneda o impuestos mal, sitios bloqueados, URLs que hay que actualizar a mano y arreglos de 1 a 4 días. **Fuente interesada** (ProWebScraper vende un servicio managed competidor). — [ProWebScraper 2026](https://prowebscraper.com/articles/price2spy-alternatives)
- Recomendación para evaluar proveedores: darles a todos el mismo set ciego de SKUs difíciles, con ground truth manual, y medir precisión y recall del matching, completitud de campos, frescura del timestamp y éxito de entrega. Preguntar qué mide su "accuracy" (¿precisión, recall o ambos?). — [Ficstar 2026](https://www.ficstar.com/best-price-intelligence-services-2026)
- Para el matching conviene un spot check manual antes de confiar a escala: "un match equivocado produce una recomendación equivocada con confianza". — [MarketIntelligenceTools 2026](https://marketintelligencetools.com/rankings/pricing-intelligence/)
- Los cambios reales de precio suelen ser chicos: condicionado a que haya cambio, ~50% de los cambios está dentro de 3,7% y 25% dentro de 5 centavos (almacén online EE. UU.). — [Aparicio et al. 2023](https://link.springer.com/article/10.1007/s11129-023-09273-w)
- BPP: la frecuencia diaria facilita detectar errores, y usan "monitoring controls to check scraping, cleaning, statistics". — [Cavallo & Rigobon](https://www.hbs.edu/ris/Publication%20Files/Cavallo_Alberto_J7_The%20Billion%20Prices%20Project_9c302f5e-d31c-4356-9f92-4b906fcf137f.pdf); [Cavallo ECB lecture](https://www.ecb.europa.eu/events/pdf/conferences/140407/presentations/invited_speakers/CavalloLecture.pdf)

### Inferences
**Reglas de validación concretas para el producto** (síntesis propia de lo anterior):
1. `price > 0` y no nulo cuando `availability = InStock`.
2. `price_list ≥ price_sale` (test de par de columnas).
3. Moneda ∈ {ARS, USD} y que coincida con el sitio.
4. Detección de error de separador decimal o de miles: ratio contra la mediana de los últimos 30 días ≈ 10×, 100× o 1000×.
5. Salto de ±50% día a día → se marca como "sospechoso" y no se publica como alerta hasta re-chequear (una segunda captura o la evidencia).
6. z-score o percentiles contra la historia del SKU y de la categoría.
7. Cuotas × monto ≈ precio financiado; precio sin impuestos ≈ precio / 1,21 para el IVA general (aproximado; varía por alícuota).
8. Fill rate por campo y por sitio contra su línea base (alerta si cae más de X pp).
9. Volumen: ofertas capturadas / esperadas por sitio y corrida.
10. Frescura: hora de la última captura OK por sitio.

**Detección de rotura de parsers.** Que por sitio y corrida caigan de golpe el fill rate de precio, la cantidad de ítems o la proporción de precios distintos a la corrida anterior. También que crezca la proporción de "sin precio" o "precio idéntico en todos los SKUs", o que aparezcan respuestas 200 con contenido "decoy" (el caso de ML).

**SKUs canario.** Por sitio, un set chico de SKUs con precio conocido o verificable (idealmente los de la propia marca, cuyo precio de lista se conoce) que se re-chequea en cada corrida. Si falla, el sitio entero queda "no confiable" en el tablero. Es la versión estructurada del spot check de muestra de Zyte. (El término "canary SKU" no aparece en las fuentes; es una inferencia de diseño.)

**Muestreo manual.** Muestra aleatoria estratificada por sitio, por ejemplo semanal, comparada contra la evidencia guardada. Se reporta la exactitud medida como "% de precios correctos en la muestra" con su intervalo de confianza: así se respalda un "98–99%" con datos propios en vez de afirmarlo.

**Tablero de salud.** Por sitio: última captura OK, cobertura vs base, fill rate de precio, % de observaciones marcadas, resultado de los canarios y estado del parser (versión). Equivale a frescura/volumen/distribución/esquema de Monte Carlo aplicado a scraping.

### Gaps
- No encontré documentación pública detallada de QA de Prisync ni de Profitero (solo material de marketing).
- No encontré SLA contractuales públicos de exactitud (98–99%) con definición medible. La cifra "99%" de Minderest proviene de reseñas o marketing, no de un contrato.
- No hay benchmarks públicos de tasa real de error de precio por proveedor.

## 4. Consideraciones legales del scraping de precios públicos (EE. UU., UE, Argentina)

### Takeaway
En EE. UU., scrapear páginas públicas **sin loguearse** no viola la CFAA (Van Buren 2021, hiQ 2022), y Meta v. Bright Data (2024) sostuvo que los términos de Meta no alcanzan el scraping deslogueado. En cambio, **el contrato sí muerde** cuando hay cuenta o aceptación de términos (hiQ terminó pagando USD 500k por incumplimiento contractual y uso de cuentas falsas), y Ryanair v. Booking muestra el riesgo de entrar en zonas logueadas.

En la UE, el derecho sui generis sobre bases de datos (CV-Online 2021) puede prohibir la extracción sustancial que ponga en riesgo la inversión del dueño. Ryanair v. PR Aviation (2015) permite restringir por contrato si no hay derecho de base de datos.

En Argentina no hay norma específica: los precios no son datos personales (la Ley 25.326 no aplica a ellos). El riesgo está en los términos de servicio aceptados, en la protección de compilaciones originales (Ley 11.723), en eludir medidas técnicas (Código Penal, acceso ilegítimo) y en el daño por sobrecarga. Ninguna de estas fuentes es asesoramiento legal.

### Cited Findings
**EE. UU.**
- hiQ v. LinkedIn: el 9º Circuito (abr-2022) sostuvo que acceder a perfiles públicos probablemente no viola la CFAA ("no gates to lift or lower"). En nov-2022 el tribunal de distrito encontró incumplimiento del User Agreement de LinkedIn, y el 8-dic-2022 hubo un consent judgment: USD 500.000, injunction permanente y borrado de datos y código. La parte CFAA de ese acuerdo se basó en el uso de **cuentas falsas para páginas protegidas por contraseña**. — [webscraping.ai 2026](https://webscraping.ai/blog/is-web-scraping-legal); [Apify legal 2026](https://use-apify.com/docs/what-is-apify/is-apify-legal)
- Meta v. Bright Data (N.D. Cal., 23-ene-2024, juez Chen): summary judgment a favor de Bright Data. Los términos de Meta "do not bar logged-off scraping of public data". Meta abandonó el resto del caso en feb-2024 y renunció a apelar. — [Apify legal 2026](https://use-apify.com/docs/what-is-apify/is-apify-legal); [ScrapeHero legal](https://www.scrapehero.com/legal/)
- X Corp. v. Bright Data (N.D. Cal., 9-may-2024): se rechazaron todas las demandas, en parte por falta de daño por el acceso y por preemption de copyright. El tribunal citó a hiQ sobre el riesgo de "information monopolies". — [Eric Goldman blog](https://blog.ericgoldman.org/archives/2024/05/elon-musks-gifts-to-web-scrapers-guest-blog-post.htm); [Opinion PDF](https://www.courthousenews.com/wp-content/uploads/2024/05/X-Corp.pdf)
- Hay fuentes secundarias que discrepan sobre Meta v. Bright Data: una dice que el reclamo contractual "sobrevivió parcialmente" por la relación previa de Bright Data con Meta y que el caso "se acordó". Contradice a Apify y ScrapeHero, que hablan de summary judgment y de que Meta abandonó. Prefiero estas últimas por citar fecha, juez y número de caso (3:23-cv-00077-EMC). — [SociaVault (contradice)](https://sociavault.com/blog/web-scraping-legality-court-cases-public-vs-private-data)
- Ryanair v. Booking.com (D. Del.): un jurado (jul-2024) encontró violación de la CFAA por acceso inducido a la zona **logueada** "myRyanair", con USD 5.000 de daño (el mínimo). El 31-ene-2025 el juez revirtió el veredicto porque no se probaron USD 5.000 de pérdida. Ryanair apeló al 3er Circuito el 28-feb-2025, y la EFF y otros presentaron amicus a favor de una lectura estrecha de la CFAA (jul-2025). Según una fuente de jul-2026 la apelación sigue pendiente. — [Reuters 2024](https://www.reuters.com/legal/us-court-rules-against-bookingcom-ryanair-screen-scraping-case-2024-07-19/); [ch-aviation 2025](https://www.ch-aviation.com/news/156303-lobby-groups-back-bookingcom-in-ryanair-legal-row); [webscraping.ai 2026](https://webscraping.ai/blog/is-web-scraping-legal)

**UE**
- Ryanair v. PR Aviation (CJEU C-30/14, 15-ene-2015): si la base no está protegida ni por copyright ni por el derecho sui generis, los arts. 6, 8 y 15 de la Directiva 96/9 no impiden restricciones contractuales al uso. El sitio puede entonces prohibir el screen scraping por términos, sin perjuicio del derecho nacional. Los términos de Ryanair prohibían la extracción automatizada "for commercial purposes" sin licencia escrita. — [Lexology](https://www.lexology.com/library/detail.aspx?g=5f0b65dd-f699-4c81-a1bc-53e1cebb1d34); [webscraping.ai 2026](https://webscraping.ai/blog/is-web-scraping-legal)
- CV-Online Latvia v. Melons (CJEU C-762/19, 3-jun-2021): un buscador especializado que copia e indexa toda o una parte sustancial de una base accesible libremente y permite buscarla en su propio sitio "extrae" y "reutiliza" ese contenido. El dueño puede prohibirlo **si eso pone en riesgo recuperar su inversión** en obtener, verificar o presentar los datos, lo que verifica el juez nacional. — [EUR-Lex C-762/19](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62019CJ0762); [AC&R summary](https://acr.amsterdam/en/ecj-database/c-762-19)
- El art. 7(5) de la Directiva prohíbe también la extracción "repetida y sistemática" de partes no sustanciales si entra en conflicto con la explotación normal. Esto es relevante para un monitoreo diario. — [EUR-Lex C-762/19 (cita del art. 7)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62019CJ0762)
- GDPR y datos personales: la EDPB Opinion 28/2024 y el GDPR siguen aplicando a datos personales públicos. Los precios no son datos personales, pero sí podrían serlo los nombres de sellers persona física o las reseñas. — [Apify legal 2026](https://use-apify.com/docs/what-is-apify/is-apify-legal)

**Argentina**
- No existe una "ley de scraping". Hay tres marcos: (1) Ley 25.326 si se extraen datos de personas ("estaba público" ≠ consentimiento); (2) términos de servicio, un plano contractual de riesgo bajo si se navega sin cuenta y alto si se aceptaron términos logueado; (3) el Código Penal, que castiga el acceso ilegítimo a sistemas restringidos y puede alcanzar a quien elude contraseñas, paywalls o bloqueos técnicos, además de la responsabilidad por daños si se tumba un sitio. "El monitoreo de precios públicos es… de las [prácticas] más defendibles legalmente", siempre sin eludir bloqueos, con ritmo moderado y sin copiar contenido protegido (fotos o descripciones, Ley 11.723). Es un blog de una consultora, no jurisprudencia. — [Deepyze 2026](https://deepyze.dev/blog/web-scraping-legal-argentina/)
- La Ley 11.723 protege compilaciones cuya selección u organización sea original. Extraer porciones sustanciales de una base organizada puede generar responsabilidad. También se mencionan la competencia desleal, la buena fe contractual y el deber de prevención del daño del Código Civil y Comercial. — [Estudio Lexar 2026](https://estudiolexar.com/scraping-datos-publicos/)
- La AAIP (autoridad argentina de datos) firmó una declaración conjunta internacional: los datos personales públicamente accesibles siguen protegidos, y el scraping masivo de ellos puede ser una brecha reportable. — [AAIP declaración conjunta](https://www.argentina.gob.ar/sites/default/files/declaracion_conjunta_aaip_datascraping.pdf)
- Existe una fuente oficial abierta de precios minoristas: SEPA/Precios Claros (más de 70 mil productos, ~12 millones de registros diarios de grandes comercios, Res. 678/2020). Es un benchmark o fuente legal alternativa para consumo masivo, no para electro. — [datos.produccion.gob.ar SEPA](https://datos.produccion.gob.ar/dataset/sepa-precios)
- La Res. SIC 4/2025 exige mostrar el precio final y que "en ningún caso se impedirá el acceso de los consumidores a los precios exhibidos, previo a la decisión de compra". Es un argumento de que el precio es información pública por mandato, aunque esto es una inferencia y no una interpretación jurídica publicada. — [Res. 4/2025](https://www.argentina.gob.ar/normativa/nacional/norma-408455/texto)

### Inferences
- **Postura defendible para el producto:**
  - Solo páginas públicas y deslogueadas (o APIs oficiales con el token de cada cliente para sus propios datos).
  - Nunca usar cuentas propias o falsas para ver precios "de socio".
  - No eludir challenges ni CAPTCHAs (el caso ML es una zona gris en este punto).
  - Respetar robots.txt (cacheado ≤24 h), con una tasa baja y un User-Agent identificable con contacto.
  - Guardar precios y metadatos, no fotos ni descripciones (copyright).
  - No republicar el catálogo completo de un tercero como buscador (el riesgo CV-Online en la UE y de compilación en AR).
- Mostrar precios a clientes pagos (uso interno de inteligencia) tiene un perfil de riesgo distinto que armar un comparador público (la "reutilización" de CV-Online).
- Antes de vender el producto conviene una opinión legal local, en particular sobre los términos de Mercado Libre y los grandes retailers.

### Gaps
- No encontré jurisprudencia argentina específica sobre scraping de precios.
- No verifiqué los términos y condiciones de Mercado Libre Argentina ni de los retailers grandes respecto del scraping.
- No hay resultado conocido de la apelación Ryanair v. Booking en el 3er Circuito (pendiente a jul-2026 según la fuente).

## 5. Construir vs comprar: proveedores de datos y APIs (Bright Data, Apify, Zyte, Oxylabs, SerpApi) y costos

### Takeaway
El costo por 1.000 páginas va de **~USD 0,06–1,27 (HTTP simple, Zyte por nivel de dificultad)** a **USD 1–16 (renderizado con navegador)**. Bright Data cobra ~USD 0,75–1,50 por 1.000 registros exitosos. Los modelos de cobro (por éxito, por crédito con multiplicadores, por GB, por compute unit) cambian mucho el costo real. Para una cartera chica de SKUs × pocos retailers × 1–3 capturas por día, el costo de infraestructura es bajo. Lo caro es el mantenimiento de parsers, el matching y la QA, algo en lo que coinciden varias fuentes.

### Cited Findings
- **Zyte API** (pago por uso, 5 niveles por dificultad del sitio). HTTP: USD 0,13 / 0,23 / 0,44 / 0,70 / 1,27 por 1.000. Renderizado con navegador: USD 1,01 / 2,01 / 4,02 / 8,04 / 16,08 por 1.000. Con compromiso de USD 100/mes: HTTP 0,10–0,95 y browser 0,75–12. Con USD 500/mes: HTTP desde 0,06 y browser 0,48–7,68. Solo cobra respuestas exitosas, y la prueba trae USD 5 de crédito. — [Zyte pricing](https://www.zyte.com/pricing/); [Zyte API](https://www.zyte.com/zyte-api/)
- **Bright Data**: Web Scraper API USD 1,50 por 1.000 registros (pago por uso) y plan Scale de USD 499/mes por 384.000 registros, hasta USD 0,75 por 1.000 al máximo volumen. Solo cobra éxitos y da 5.000 gratis por mes. Los sitios premium o muy protegidos cuestan ~USD 2,50 por 1.000. **Fuente: blog del propio proveedor.** — [Bright Data blog](https://brightdata.com/blog/web-data/best-ecommerce-scrapers); [Bright Data best APIs](https://brightdata.com/blog/web-data/best-web-scraping-apis)
- Para la Web Unlocker de Bright Data hay cifras distintas: ~USD 3 por 1.000 según una fuente y USD 1,50 por 1.000 pago por uso o USD 499/mes por ~383k según otra. Hay que verificarlo en el sitio. — [use-apify.com](https://use-apify.com/blog/bright-data-vs-oxylabs-2026); [PageCrawl sep-2026](https://pagecrawl.io/blog/best-web-scraping-apis-2026)
- **Oxylabs**: prueba de 2.000 resultados y después USD 49/mes por 98.000 resultados (~USD 0,50 por 1.000), USD 99 por 220.000 y USD 249 por 622.500, con multiplicadores por target y renderizado. Tiene una E-Commerce Scraper API para Amazon y Google Shopping. — [PageCrawl sep-2026](https://pagecrawl.io/blog/best-web-scraping-apis-2026); [use-apify.com](https://use-apify.com/blog/bright-data-vs-oxylabs-2026)
- **Apify**: USD 5 de crédito gratis por mes, planes desde USD 19–29/mes, y compute unit (1 GB-hora) a USD 0,20 por encima del plan. Hay actores de terceros, por ejemplo un scraper de Shopify a USD 0,50 por 1.000 productos con proxy incluido. — [PageCrawl](https://pagecrawl.io/blog/best-web-scraping-apis-2026); [Apify Shopify Products API actor](https://apify.com/insight.solutions/shopify-products-api)
- Benchmark de terceros (AIMultiple, sep-2026): costo efectivo por 1.000 páginas de producto exitosas: Nimble USD 1, Bright Data USD 1,30–1,50, Zyte USD 4,08–8,55 y Apify USD 3,29–13,70 (ajustado por una tasa de éxito de 70,1%, porque factura cada intento). — [AIMultiple e-commerce scraper benchmark](https://aimultiple.com/ecommerce-scraper)
- En las APIs con créditos, el renderizado JS (5 créditos) o los proxies stealth (75 créditos) multiplican el costo por pedido: "250.000 requests" pasan a ser 3.333. Es un dato de Bright Data sobre competidores, fuente interesada. — [Bright Data best APIs](https://brightdata.com/blog/web-data/best-web-scraping-apis)
- **SerpApi** (Google Shopping, entre otros): Free 250 búsquedas por mes; Starter USD 25 por 1.000; Developer USD 75 por 5.000; Production USD 150 por 15.000; Big Data USD 275 por 30.000. Solo cuenta búsquedas exitosas, y el throughput por hora es 20% del volumen mensual. Incluye "U.S. Legal Shield". — [SerpApi pricing](https://serpapi.com/pricing)
- SaaS de price monitoring como referencia: Prisync USD 59–599/mes, con API +20%. Price2Spy desde USD 39,95/mes; Basic hasta 2.000 URLs; add-ons aparte (repricing ~USD 100/mes, automatch ~USD 54, screenshots). Minderest con precio a medida, mínimo de 3 meses y sin prueba gratis. — [ProWebScraper](https://prowebscraper.com/articles/price2spy-alternatives); [MarketIntelligenceTools 2026](https://marketintelligencetools.com/rankings/pricing-intelligence/)
- El trabajo que queda después de comprar un SaaS: mantener el feed de productos, las excepciones de matching, los cambios de los sitios, la revisión de QA y las reglas de negocio. — [Ficstar 2026](https://www.ficstar.com/best-price-intelligence-services-2026)
- BPP: el software requiere customización por retailer y "needs to be updated when there are website changes". — [Cavallo ECB lecture](https://www.ecb.europa.eu/events/pdf/conferences/140407/presentations/invited_speakers/CavalloLecture.pdf)

### Inferences
- Ejemplo de orden de magnitud (cálculo propio, no de las fuentes): 2.000 ofertas × 2 capturas por día × 30 días = 120.000 páginas por mes.
  - Por JSON o HTTP simple (VTEX/Shopify): ~USD 15–150/mes en Zyte según el nivel.
  - Con renderizado de navegador: ~USD 120–1.900/mes.
  - Con Bright Data a USD 1,50 por 1.000: ~USD 180/mes.
  - Usar APIs JSON nativas (VTEX y Shopify) baja el costo uno o dos órdenes de magnitud frente a usar headless.
- **Híbrido recomendado:** conectores propios para VTEX, Shopify y JSON-LD (baratos y estables), un unblocker o proveedor gestionado solo para los sitios difíciles (ML HTML, anti-bot) y SerpApi o Google Shopping para descubrir ofertas. La QA y el matching quedan in-house porque son el diferencial.
- Los "Legal Shield" o "compliance" (SOC 2, ISO 27001) de los proveedores no transfieren la responsabilidad contractual frente a los términos del sitio scrapeado. Es una inferencia: no encontré los términos de esos escudos.

### Gaps
- No encontré precios públicos de DataWeave ni de Profitero (son enterprise, con cotización).
- No encontré costos de mano de obra de mantenimiento de parsers (horas por sitio por mes) en fuentes confiables.
- No verifiqué si algún proveedor ofrece proxies residenciales o geolocalización por código postal argentino.
