# Medir precios de cualquier categoría en BIP

**Respuesta corta.** No existe una plataforma global que monitoree precios de "cualquier cosa". El mercado está partido en dos. Por un lado está el **retail de productos** (Profitero+, NIQ Digital Shelf, DataWeave, Intelligence Node, Competera, Price2Spy, Prisync), que captura precio de lista, precio de venta, promo, stock, seller y evidencia, y lo muestra como matriz producto × tienda, índice de precio y alertas. Por otro lado están los **servicios**, con proveedores separados por rubro: Tarifica en telecom, Comperemedia y Competiscan en tarjetas, Lighthouse y RateGain en hoteles, PricingSaaS en software. Esos proveedores modelan la oferta como **plan + abono + promo por N meses + cargos únicos + permanencia + atributos**, y comparan con "perfiles de uso". Ninguno de los dos grupos documenta lo que define el precio en Argentina: **cuotas sin interés por tarjeta, costo financiero (CFT) y descuentos por medio de pago**. Para BIP, el diseño robusto tiene cuatro piezas. La primera es un **núcleo común de observación de precio** con extensiones por tipo (producto o servicio). La segunda son **plantillas de categoría como datos, no como código**: atributos, identificador fuerte, regla de normalización y perfiles. La tercera es un **pool compartido de listados y observaciones** entre clientes, con catálogo, competidores, segmentos y "equivalencias" privados de cada cliente. La cuarta es una **cascada de matching** (identificador → modelo → atributos → IA que elige entre candidatos → revisión humana). Técnicamente es viable. En pruebas en vivo del 7-oct-2026, la API pública de VTEX respondió en **12 de 12 retailers grandes** de súper, farmacia, deportes, hogar, mascotas y electro, con EAN y grilla de cuotas. Además hay tres fuentes oficiales de servicios con estructura (SSSalud, ENACOM y BCRA) y una de supermercados (SEPA/Precios Claros). La credibilidad del producto no va a depender de cuántos sitios cubra, sino de mostrar en cada pantalla **qué tan fresco, completo y verificado** está cada número. Mercado Libre, por ejemplo, ya no responde sin token, y algunos endpoints respondieron de forma intermitente en el mismo día.

> **Cómo leer las marcas.** **[verificado: método]** = comprobado contra la fuente o el endpoint real. **[sin verificar]** = afirmación de una fuente que no se pudo contrastar (muchos dominios oficiales, como `*.gob.ar`, support.google.com o la documentación de Mercado Libre, están bloqueados desde el sandbox y se leyeron por resúmenes de búsqueda), o una inferencia propia. Las cifras de los proveedores ("99% de precisión") son lo que ellos declaran, no auditorías. **Regla del usuario: sin ajuste por inflación; montos nominales en $ y USD.** Los ejemplos de categoría son ilustrativos: electro es uno más, junto a súper, farmacia, moda, deportes, prepagas, telecom y bancos.

## Dos mercados de proveedores, y ninguno cubre la financiación argentina

En **productos**, el benchmark para marcas se consolidó en holdings de medios y en NIQ. Publicis compró Profitero por ~US$210M ([Campaign](https://www.campaignlive.com/article/publicis-groupe-acquires-e-commerce-analytics-platform-profitero-210-million/1754758)). NIQ absorbió Data Impact ([NIQ](https://nielseniq.com/global/en/products/digital-shelf/)). Omnicom compró Flywheel por ~US$835M ([ppc.land](https://ppc.land/omnicom-acquires-flywheel-for-835-million)) e IPG compró Intelligence Node por ~US$100M ([BW Marketing World](https://www.bwmarketingworld.com/article/interpublic-group-acquires-mumbai-based-intelligence-node-in-nearly-100-mn-deal-541522)). En el control de precio sugerido, **Wiser Solutions entró en Chapter 11 en abril de 2026** ([PR Newswire](https://www.prnewswire.com/news-releases/wiser-solutions-announces-bankruptcy-court-approval-of-sale-transaction-302809386.html)), así que deja de ser una referencia segura. Lo que capturan estos proveedores converge: precio base, precio de góndola, promo, precio sugerido (RRP/MAP), códigos de barras y modelo (MPN), envío, stock y plazos ([Skuuudle](https://skuuudle.com/)). Algunos suman **precio efectivo neto y precio por unidad** ([DataWeave](https://dataweave.com/us/pricing-intelligence)), separación entre la oferta del retailer (1P) y la de sellers terceros (3P) ([Minderest](https://www.minderest.com/brands-manufacturers)) y **captura de pantalla como evidencia** ([Intelligence Node](https://www.intelligencenode.com/solutions/map-monitoring-price/)). La cadencia de referencia es diaria, con chequeos intradía para el precio sugerido: Price2Spy hasta 8 por día, Prisync 3 ([Price2Spy](https://www.price2spy.com/solutions/brands-manufacturers.html); [Prisync](https://prisync.com/compare-plans/)). La evidencia académica la justifica: **~48% de los productos de Amazon cambia de precio en una semana** ([NBER w28639](https://www.nber.org/system/files/working_papers/w28639/w28639.pdf)). Self-serve cuesta **US$99–799/mes** (Prisync); enterprise se cotiza a medida.

En **servicios** no hay un "Competera de servicios" horizontal. Cada rubro captura distinto:

| Rubro | Referente | Cómo captura | Qué aprendemos para BIP |
|---|---|---|---|
| Telecom | Tarifica | Todos los planes publicados en 46 países (incluye Argentina), actualización trimestral; "auto-benchmark" = plan más barato de cada operador para un perfil; promos en tiempo real y ofertas por SMS ([Tarifica Solutions](https://tarifica.com/solutions)) | Plantilla por tipo de plan + perfil + evento de cambio |
| Telecom (regulador) | Teligen, OCDE, UIT | Canasta de uso estándar → oferta más barata que cumple ([UIT](https://www.itu.int/en/ITU-D/Statistics/Pages/ICTprices/default.aspx)) | Comparar por "perfil", no por plan |
| Tarjetas/banca | Comperemedia, Competiscan | La oferta es un paquete: cuota anual, tasa intro, rewards, bonus → **Offer Score** de 6 atributos ([PR Newswire](https://www.prnewswire.com/news-releases/comperemedia-unveils-offer-index---a-proprietary-tool-redefining-credit-card-offer-comparisons-302008187.html)) | Índice de oferta por atributos, no un precio único |
| Hoteles/aéreas | Lighthouse, RateGain, ATPCO | "Rate shopping" con parámetros: fecha, estadía, ocupación, canal ([RateGain](https://uno.rategain.com/hotel-rate-intelligence/)) | El contexto de consulta es parte de la observación |
| SaaS | PricingSaaS | Cada cambio de la página de precios = evento estructurado con antes/después; detecta "price reveal" (de "contactar ventas" a precio) y tests A/B de precio ([PricingSaaS](https://pricingsaas.com/pulse/database)) | Modelar eventos, "sin precio publicado" y A/B |

**[sin verificar]** No se encontró evidencia de que los proveedores de retail (Competera, Prisync, Price2Spy, DataWeave) soporten planes o tiers de servicios.

**El hueco local es el mismo en los dos mercados.** Ningún proveedor global documenta cuotas o CFT como campo. Solo herramientas argentinas, como Turbodato, muestran "tu precio vs ML y cada retailer, con las cuotas" ([Turbodato](https://turbodato.com/monitoreo-de-precios-competencia/)). Nubimetrics y Real Trends trabajan dentro de Mercado Libre ([Real Trends](https://www.real-trends.com/ar/mercadolibre)). Los comparadores de servicios (Prepagaya, Selectra) cotizan para un perfil, pero no son plataformas B2B ([Prepagaya](https://www.prepagaya.com.ar/calculadora); [Selectra](https://selectra.com.ar/internet)). **[sin verificar]** Ninguna fuente pública confirma que algún proveedor capture de forma estructurada los descuentos bancarios o la CFT. Ahí está el diferencial posible de BIP.

## Qué recolectar: un núcleo común con extensiones por tipo de oferta

En Argentina un producto no tiene un precio, tiene varios: lista, venta en 1 pago, contado (transferencia o débito), cuotas por tarjeta y promos por banco o billetera. Desde que **Cuota Simple venció el 30-jun-2025 sin renovarse** ([Infobae](https://www.infobae.com/economia/2025/06/14/se-termina-cuota-simple-a-fin-de-mes-que-opciones-de-financiacion-tendran-los-consumidores/)), las cuotas sin interés son promociones de bancos, billeteras y retailers. La **Res. 4/2025 de la Secretaría de Industria y Comercio** exige que todo precio financiado informe **precio de contado, cantidad y monto de cuotas y CFTEA** (costo financiero total efectivo anual), además del precio por unidad de medida, también online ([Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/319787/1); [guía oficial](https://www.argentina.gob.ar/sites/default/files/exhibicion_de_precios_resolucion_4_2025_0.pdf)). **[sin verificar el texto completo; leído por fuentes secundarias]** Esa obligación le da a BIP campos estables para leer, y además algo para auditar.

En servicios, la oferta es un plan con abono recurrente, promo por N meses y precio posterior, cargos únicos (alta, instalación, equipo), permanencia, atributos incluidos (GB, Mbps, canales, copagos) y dimensiones que cambian el precio (zona, edad, grupo familiar). Así modelan sus datos ENACOM y Tarifica ([ENACOM comparador](https://indicadores.enacom.gob.ar/Precios/Comparador/internet); [Tarifica Data](https://tarifica.com/data)).

| Bloque | Campos | Aplica a | Fuente típica |
|---|---|---|---|
| **Núcleo (todo)** | competidor/vendedor, URL, fecha y hora de captura, moneda ($/USD), precio de lista, precio de venta, disponible sí/no, contexto (zona, código postal, canal), método de captura, evidencia cruda, "sin precio publicado" | Todo | Todas |
| Producto: variante y empaque | GTIN/EAN, MPN/modelo, SKU del retailer, talle/color/capacidad, contenido neto + unidad, unidades por pack, bundle sí/no | Súper, farma, moda, electro | API de plataforma, JSON-LD |
| Producto: seller | seller, 1P/3P, tienda oficial | Marketplaces, VTEX con sellers | API, HTML |
| Pago y financiación | precio contado, matriz de cuotas `[medio, banco, n, valor cuota, total, sin interés]`, máx. cuotas sin interés, CFTEA publicada, promos por medio de pago (%, BINs, días, tope, reintegro) | Todo lo que se vende online en AR | VTEX `Installments` y teasers, Tiendanube `installments_data`, landings bancarias |
| Stock | disponible (bool) y cantidad solo si es confiable | Productos | API |
| Servicio: estructura de precio | abono y periodicidad, precio promo, meses de promo, precio post-promo, cargos únicos, equipo, permanencia (meses), penalidad por salida, copagos | Telecom, prepagas, SaaS, seguros | Web, reguladores |
| Servicio: segmento | zona/región, edad o franja etaria, composición familiar, modalidad, fecha de uso | Prepagas, seguros, viajes | Cotizador, SSSalud |
| Servicio: atributos | clave-valor tipados (GB, Mbps, minutos, canales, cobertura, seats, equipaje) | Servicios | Web, ENACOM |
| Eventos derivados | subió/bajó, promo nueva, fin de promo, price reveal, A/B (dos precios para el mismo plan) | Todo | Calculado |

Hay dos detalles de captura que conviene fijar desde el inicio. **El descuento por transferencia no aparece en `Price` de VTEX**: se aplica en el checkout **[verificado: Cetrogar, 7-oct-2026]**. Los descuentos por tarjeta aparecen como *teaser* con lista de BINs **[verificado: Carrefour]**. Los reintegros bancarios posteriores a la compra no están en el catálogo y hay que capturarlos de las landings de promociones ([MODO](https://www.modo.com.ar/promos)) **[inferencia]**. En prepagas, el valor oficial es **precio de lista declarado**, que puede diferir de lo que se factura por bonificaciones ([SSSalud cuadros tarifarios](https://cuadrostarifarios.sssalud.gob.ar/)). Hay que rotularlo así.

## Dónde está el dato: un conector VTEX cubre a los grandes de casi todas las categorías

Por cantidad de sitios, en Argentina dominan WooCommerce (~42%) y Tiendanube (~25%) ([wmtips](https://www.wmtips.com/technologies/e-commerce/country/ar/), **[sin verificar el detalle]**). Pero eso sobrerrepresenta a las PyMEs. Lo que importa es **en qué plataforma están los retailers que el cliente quiere vigilar**. En la prueba en vivo **[verificado: curl con headers `x-vtex-*`, 7-oct-2026]**, corren VTEX Carrefour, Jumbo, Disco, Vea, Día, Farmacity, Farmaonline, Sporting, Easy, Puppis, On City, Naldo y Cetrogar (FastStore), y en moda Levi's, Ayres y 47 Street. Magento domina la **moda de marca propia** (Kosiuko, Mishka, Rapsodia, Grisino). Dexter y Moov usan Salesforce Commerce Cloud, y Sodimac un Next.js propio.

| Plataforma | Vía pública | Lista / venta | Cuotas | Stock | Identificador | Estado de la prueba |
|---|---|---|---|---|---|---|
| **VTEX** | `/api/catalog_system/pub/products/search` (JSON) | `ListPrice` / `Price` | `Installments[]` por medio, con `InterestRate` y n | `IsAvailable`; `AvailableQuantity` poco confiable | `ean`, `referenceId` | **12/12 tiendas respondieron** [verificado] |
| **Tiendanube** | Objeto JS `LS.variants` + JSON-LD en la ficha | `compare_at_price_number` / `price_number`, precio con descuento por medio de pago | `installments_data` por pasarela, con interés y "sin interés" | `stock` exacto | `sku` (sin EAN) | 3 tiendas, mismo formato [verificado] |
| **Shopify** | `/products.json`, `/products/{h}.js` | `compare_at_price` / `price` | No | `available` | `sku`, `barcode` (en `.js`) | Funciona; poca presencia de grandes en AR [verificado] |
| **WooCommerce** | Store API `/wp-json/wc/store/v1/products` | `regular_price` / `sale_price`, **en centavos** | No | `is_in_stock` | `sku` | A veces desactivada (404) [verificado] |
| **Magento 2** | GraphQL `/graphql` | `regular_price` / `final_price` | No | Opcional | `sku`, variantes | 2/2 tiendas [verificado] |
| **SFCC** | JSON-LD `Product` | Solo `offers.price` (tachado solo en HTML) | Solo texto HTML | `availability` | `sku`/`mpn`, sin GTIN | Dexter [verificado] |
| **Next.js propio** | `__NEXT_DATA__` | `prices[NORMAL]` / `prices[AB]` | Clave `installment` (no inspeccionada) | Flags de entrega | `skuId`, sin EAN | Sodimac [verificado] |
| **Mercado Libre** | API oficial **solo con OAuth** | `regular_amount` / `amount` en `/items/{id}/sale_price` | No en ese endpoint | Según scopes | `catalog_product_id`, GTIN | Sin token = 403 [verificado]; leer ítems de terceros con token **[sin verificar]** |
| **SEPA / Precios Claros** | API JSON pública | Precio + promo1/promo2 por sucursal | No | Implícito | **EAN como id** | 2.067 sucursales [verificado] |
| **SSSalud** | Portal de cuadros tarifarios | Cuota por plan × franja etaria × zona × modalidad, mensual | — | — | Plan | **[sin verificar]** si permite descarga masiva |
| **ENACOM** | Comparador web (AMBA) | Abono nominal, promocional y meses de promo, módem, instalación, GB/minutos | — | — | Plan | **[sin verificar]** export/API; frescura despareja |
| **BCRA Transparencia** | CSV y API diarios (días hábiles) | Comisiones y tasas por producto bancario | — | — | Entidad + producto | **[sin verificar]** el esquema oficial |

Fuentes del detalle no probado en vivo: Mercado Libre ([API de precios](https://developers.mercadolibre.com.ar/api-de-precios)), SEPA ([El Economista](https://eleconomista.com.ar/economia/precios-sepa-gobierno-habilito-plataforma-conocer-12-millones-precios-n76774)), SSSalud ([Res. 645/2025](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-645-2025-412870/texto)), ENACOM ([comparador](https://indicadores.enacom.gob.ar/Precios/servicios)) y BCRA ([Régimen de Transparencia](https://www.bcra.gob.ar/regimen-de-transparencia/); [API](https://regimen-transparencia.bcra.apidocs.ar/)).

En los sitios custom el resultado fue variable. Frávega, Megatone y Coto no ponen el precio en el HTML. Coto expone una búsqueda Constructor.io con EAN y descuentos por medio de pago, pero **con una key de cliente embebida, así que hay que revisar sus términos antes de usarla** **[verificado: curl]**. Adidas y Nike devolvieron 403 por anti-bot y no se intentó evadirlo.

**Un conflicto aparente con Frávega.** En pruebas anteriores, la API de catálogo VTEX de Frávega devolvió precios, incluidos sellers terceros como "Panda Toys" y "Fussetti". En la prueba del 7-oct, su ficha HTML no trae precio ni JSON-LD. **Las dos cosas son ciertas.** Frávega usa un frontend headless propio (React/Next.js) sobre carrito, checkout y marketplace de VTEX ([VTEX caso Frávega](https://vtex.com/es-ar/casos-de-clientes/protegiendo-el-legado-de-fravega-con-la-tecnologia-headless/)). El HTML no sirve, pero la API sí sirve (o servía).

**Otro conflicto: el stock de VTEX.** `AvailableQuantity` = 99999 aparece en 9 de 12 tiendas como tope ("hay stock"). En Día vino un valor que parece real (2.147), y en otras pruebas Cetrogar dio 100 y Pardo 1. La regla prudente es leer `IsAvailable` y usar la cantidad solo como dato secundario, cuando no está en un valor tope.

Hay dos cautelas más. **Jumbo y Disco devolvieron `ListPrice` 322.314 para un producto de $3.900** **[verificado]**, así que la relación lista/venta siempre se valida. Y **la unidad de `InterestRate` de VTEX no está documentada [sin verificar]**: conviene calcular la tasa implícita a partir de la cuota, n y el contado.

## Un código maestro para cualquier categoría: plantillas como datos y cascada de matching

Los estándares de catálogo coinciden en tres cosas:

1. **Una clasificación jerárquica separada de los atributos.** En GS1 GPC, la jerarquía es Segmento → Familia → Clase → Brick ([GS1 GPC](https://www.gs1.org/docs/gpc/GPC_Development_Implementation.pdf)). Mercado Libre usa dominio y categoría.
2. **Un set de atributos núcleo más atributos por categoría,** con tipo, unidad, valores permitidos y si son obligatorios. Mercado Libre los expone con los tags `required`, `variation_attribute` y `value_type` `number_unit` ([ML Attributes](https://developers.mercadolibre.com.ar/en_us/attributes)) **[sin verificar: docs bloqueadas]**.
3. **Variantes con ejes explícitos.** Google lo resuelve con `item_group_id` + talle/color/material ([GMC item_group_id](https://support.google.com/merchants/answer/14779112?hl=en)) y schema.org con `ProductGroup.variesBy` ([schema.org](https://schema.org/ProductGroup)).

Google Merchant Center funciona como "mínimo común denominador" multicategoría: `gtin`, `mpn`, `brand`, `identifier_exists`, `multipack`, `is_bundle` y `unit_pricing_measure` ([GMC spec](https://support.google.com/merchants/answer/7052112?hl=en)). Eso habilita una forma de onboarding concreta: **"subí tu feed de Google"** como carga del catálogo propio **[inferencia]**.

**El identificador fuerte cambia por familia, y eso define cuánto se puede automatizar.** DataWeave es el único que publica diferencias por categoría:

- **Moda** tiene tasas de match típicas de **40–60%** por atributos subjetivos.
- **Electrónica** llega a **95%+** con datos limpios.
- **Grocery** se complica porque los UPC de **marca propia no mapean entre retailers** ([DataWeave](https://dataweave.com/blog/how-ai-can-drive-superior-data-quality-and-coverage-in-competitive-insights-for-retailers-and-brands)).

**[sin verificar: síntesis de búsqueda, dominio bloqueado]** Competera menciona lo mismo para marca propia y frescos sin código ([Competera](https://competera.ai/solutions/by-industry/grocery-retail)). La matriz por familia queda así (inferencia de diseño):

| Familia (ejemplos) | Clave fuerte | Clave secundaria | "Equivalente" típico | Automatización esperada |
|---|---|---|---|---|
| Súper/FMCG, limpieza, mascotas | GTIN/EAN | marca + contenido + variedad | mismo segmento y rango de tamaño, en $/kg o $/l | Alta |
| Farma/OTC, belleza | GTIN (farma: + registro ANMAT) | droga + concentración + presentación; ml/g + tono | misma droga y dosis; misma función, en $/100 ml | Alta |
| Electro y electrónica | marca + modelo/MPN | GTIN, capacidad, pulgadas | misma capacidad o tipo, en $/kg, $/l o $/pulgada | Alta-media (sufijos y revisiones de modelo) |
| Moda, calzado, deportes | estilo o código del retailer | imagen + atributos (tela, fit) | tipo de prenda + material + rango de precio | Baja: revisión humana |
| Muebles/hogar | marca + modelo, si hay | medidas, material | mismas medidas ± tolerancia | Baja |
| Autopartes | número OE/parte + marca | fitment (ACES/PIES) | intercambio ([Auto Care](https://www.autocare.org/data-standards)) | Media |
| Servicios | plan del proveedor | atributos (GB, Mbps, cobertura, copagos) | plan más barato que cumple el perfil | No es match: es regla de perfil |

En la muestra se vio que en súper, farmacia, mascotas y electro VTEX trae EAN. En moda y deportes no lo trae: Sporting devuelve `ean null` y Dexter solo `mpn` **[verificado]**. Ni el EAN es infalible. Un estudio sobre 81.782 GTINs encontró **3,2–13,9% de nombres que describen productos distintos** ([ETH Zürich](https://cocoa.ethz.ch/downloads/2013/07/1437_not_so_unique_GTIN.pdf)). En un caso de electro, el mismo modelo apareció con y sin sufijo "0" y con dos EAN distintos en tiendas diferentes **[verificado: curl]**. Solo el maestro de artículos del cliente puede decidir si son el mismo producto.

La **cascada** recomendada sigue la práctica de los proveedores (aceptar / revisar / rechazar, con ~90% procesado en automático en DataWeave, [fuente](https://dataweave.com/blog/pricing-intelligence-in-the-age-of-ai-driven-commerce-price-now-drives-discoverability-not-just-conversion)) y la evidencia académica:

1. **GTIN válido** en el maestro → match exacto automático.
2. **Marca + modelo normalizado** sin atributos contradictorios → match exacto automático.
3. Se arma un **bloque de candidatos**: misma marca y categoría, identificadores parciales.
4. Un **LLM elige entre ~4 candidatos o "ninguno"** y explica por qué. Este modo "selecting" mejora hasta 14,74% de F1 frente a comparar par a par ([arXiv 2405.16884](https://arxiv.org/html/2405.16884v2)). GPT-4 zero-shot llega a **F1 91,92% en WDC Products**, y gpt-4o-mini afinado rinde parecido ([Peeters et al., EDBT 2025](https://www.uni-mannheim.de/media/Einrichtungen/dws/DWS_News/Documents/Peeters-Entity-Matching-using-LLMs-EDBT2025.pdf)).
5. **Revisión humana** de la zona gris. Cada decisión humana vuelve como dato de entrenamiento.

Todos los sistemas caen fuerte con productos "no vistos" ([WDC Products](https://arxiv.org/abs/2301.09521)). Por eso BIP debería **reportar precisión y cobertura por categoría a cada cliente**, en lugar de un "99%" global. Las cifras de los proveedores (Intelligence Node 99%, Competera 95%+) no se miden igual y nadie las audita ([Intelligence Node](https://www.intelligencenode.com/solutions/product-matching/)).

"**Mismo producto**" y "**equivalente**" son cosas distintas y se guardan separadas. El primero es un hecho objetivo (por GTIN o modelo) y se puede compartir entre clientes. El segundo es una regla del cliente sobre atributos de la plantilla: por ejemplo, "lavarropas frontal 8–9 kg", "leche entera 1 l" o "internet ≥300 Mbps CABA". Queda privado. El índice competitivo usa equivalentes. El control de canal (desvío vs precio sugerido) usa mismo producto.

### Modelo de datos multi-tenant (recomendación)

```
-- Referencia global (sin tenant)
category_template (id, padre, tipo producto|servicio, gpc_brick, google_cat_id, ml_domain_id,
                   attributes jsonb /*[{key, tipo, unidad_canónica, valores, rol: identity|variant|
                                       descriptive|normalizer|filter, requerido, peso_matching}]*/,
                   id_strategy /*gtin|mpn|estilo|plan*/, normalizacion jsonb /*dimensión, base*/,
                   perfiles jsonb /*solo servicios: canastas de uso*/, version)
retailer          (id, nombre, plataforma, conector, estado_conector, ultima_ok)

-- Pool compartido (se captura UNA vez aunque lo sigan N clientes)
listing           (id, retailer_id, sku_externo, url_canónica, titulo, marca, gtin_raw, gtin_valido,
                   mpn_raw, template_id, attrs_norm jsonb, content_hash, first_seen, last_seen)
offer_plan        (id, proveedor_id, template_id, nombre_plan, attrs jsonb, url, first_seen, last_seen)
price_observation (id, listing_id | offer_plan_id, seller, seller_tipo, captured_at, contexto jsonb
                   /*zona, CP, canal, segmento edad/familia*/, metodo, parser_version, http_status,
                   moneda, precio_lista, precio_venta, precio_contado, disponible, stock_qty,
                   cuotas jsonb, max_cuotas_sin_interes, promos_pago jsonb, cftea_publicada,
                   abono, periodicidad, precio_promo, meses_promo, cargos_unicos, permanencia_meses,
                   sin_precio_publicado bool, raw_ref, flags_calidad[])   -- solo se agregan filas
price_event       (observation_id, tipo /*sube|baja|promo_nueva|fin_promo|price_reveal|ab*/, antes, despues)
gtin_match_global (listing_id, gtin, metodo, confianza)          -- hechos objetivos, compartibles

-- Propiedad del cliente (tenant)
tenant_product    (tenant_id, sku_propio, template_id, marca, gtin[], mpn[], attrs jsonb,
                   pvp_sugerido, rol clave|core|cola, peso_indice)
tenant_competitor (tenant_id, marca | retailer | seller | proveedor)
tenant_segment    (tenant_id, template_id, regla jsonb /*atributos + tolerancias*/)
tenant_match      (tenant_id, tenant_product_id | segment_id, listing_id | offer_plan_id,
                   tipo exacto|variante|equivalente|excluido, estado auto|pendiente|confirmado|rechazado,
                   confianza, metodo, evidencia jsonb, decidido_por, valid_from, valid_to)
```

El patrón práctico en Postgres/Supabase es este: columnas para lo estable, **JSONB para los atributos de cada categoría validados contra la plantilla**, y tablas hijas para identificadores **[sin verificar con fuente primaria]**. Las plantillas se pueden sembrar con los atributos de categoría de Mercado Libre, que ya vienen en español y para Argentina. Así, un cliente de una categoría nueva se suma **sin deploy**. Los matches no se borran: se cierran con fecha.

## Precio comparable: por unidad, efectivo a N meses y financiado

Para comparar ofertas distintas, BIP necesita tres normalizaciones. Las tres se definen en la plantilla.

**Precio por unidad (productos de consumo).** La fórmula es `precio_comparable = precio_efectivo ÷ (contenido_neto × unidades_por_pack) × base`. Tiene respaldo legal. La Res. 4/2025, vigente desde el 18-ene-2025, exige el precio por 1 kg, l, m, m² o m³ (o por 10 g o 10 ml en envases de ≤50 g o 50 ml), también en canales virtuales ([Res. 4/2025](https://www.argentina.gob.ar/normativa/nacional/norma-408455/texto)) **[sin verificar el texto: dominio bloqueado]**. Como el retailer debe publicarlo, BIP puede usar ese dato publicado como chequeo cruzado de su propio cálculo. Hay algo de inestabilidad normativa a tener en cuenta: la Ley de Góndolas fue **derogada por el DNU 70/2023** ([DNU 70/2023](https://www.argentina.gob.ar/normativa/nacional/decreto-70-2023-395521/texto)), y en octubre de 2026 hay una avanzada opositora en Diputados contra ese DNU ([TN](https://tn.com.ar/politica/2026/10/06/el-gobierno-defendio-el-dnu-7023-frente-a-la-avanzada-opositora-en-diputados-las-normas-que-volverian-atras/)) **[estado sin verificar]**.

En bienes durables la "unidad" es 1, y la comparación relevante es por **atributo de desempeño** ($/kg de capacidad, $/litro, $/pulgada). Eso lo elige el cliente; no es un dato regulatorio. Los bundles se marcan y se excluyen del índice por defecto. En moda, el precio se guarda por variante y se agrega por estilo (mínimo o mediana), junto con el % de la curva de talles disponible **[inferencia]**.

**Precio efectivo mensual a horizonte H (servicios).** La fórmula es `(cargos únicos + Σ abonos mes a mes + equipo requerido − créditos) ÷ H`. Por ejemplo, $30/mes durante 6 meses, luego $50, con $60 de alta, da **$45/mes a 12 meses y $47,50/mes a 24** (cálculo verificado: 60+6×30+6×50 = 540; 60+6×30+18×50 = 1.140). Las metodologías oficiales no se ponen de acuerdo:

- **OCDE** incluye las promos vigentes de al menos 1 mes ([OCDE 2017](https://one.oecd.org/document/DSTI/CDEP/CISP(2017)4/FINAL/En/pdf)).
- **UIT** elige el plan más barato que cumple la canasta y **no** suma cargos únicos ([UIT manual 2025](https://www.itu.int/en/ITU-D/Statistics/Documents/ICT_Prices/ITU_IPBQManual_2025.pdf)).
- **Ofcom** separa el precio para clientes nuevos del que pagan los existentes ([Ofcom 2024](https://www.ofcom.org.uk/siteassets/resources/documents/research-and-data/multi-sector/pricing/2024/pricing-trends-for-communications-services-in-the-uk-2024.pdf?v=387092)).

La recomendación es **mostrar ambas vistas**: lista y efectiva a 12 y 24 meses. La métrica unitaria ($/GB, $/Mbps, $/persona) va como secundaria. En prepagas, el "perfil" es la canasta: por ejemplo, individuo de 30 años en CABA, o pareja de 35 + 1 hijo. La relación máxima de 3:1 entre franjas etarias ([Ley 26.682](https://www.argentina.gob.ar/normativa/nacional/norma-182180/actualizacion)) sirve como control de consistencia.

**Costo implícito de las cuotas (todo lo que se financia).** Cuando existe un precio contado más bajo que el de lista, se resuelve `i` en `Contado = Cuota × [1 − (1+i)^−n] ÷ i` y se anualiza con `(1+i)^12 − 1`. Ejemplo: $500.000 contado frente a 12 × $50.000 da ~2,9% mensual y ~41% anual ([Hacé Cuentas](https://hacecuentas.com/calculadora-12-cuotas-sin-interes), fuente divulgativa). Si no hay contado más bajo, la cuota sin interés es financiación a costo cero. **[sin verificar como estándar]** No se encontró un "índice de precio financiado" publicado; es una construcción propia. Todo se expresa en $ nominales, con opción en USD al tipo de cambio BCRA del día de captura, **sin deflactar**.

## KPIs, pantallas y filtros: núcleo fijo, extensiones según la plantilla

La convención se fija una sola vez y se rotula: **propio ÷ referencia × 100 (>100 = más caro)**. Proveedores como Retailgrid usan la inversa ([Retailgrid](https://www.retailgrid.io/blog/how-to-calculate-price-index-retail-guide)). El índice se calcula sobre **precio neto con promo y solo con competidores en stock**, porque un índice sobre precio de lista "nunca refleja lo que paga el cliente" ([Mindpera](https://www.mindpera.com/en/guides/competitor-price-monitoring)). No hay fórmula estándar. Competera promedia ratios por par ([Competera](https://competera.ai/resources/use-cases/price-index-tutorials)). Las estadísticas oficiales prefieren la media geométrica (Jevons) porque es simétrica ante la dirección del ratio ([ABS](https://www.abs.gov.au/statistics/detailed-methodology-information/concepts-sources-methods/consumer-price-index-concepts-sources-and-methods/2025/price-index-theory)). La holandesa CBS la pondera por facturación ([CBS](https://www.cbs.nl/-/media/imported/onze-diensten/methoden/dataverzameling/korte-onderzoeksbeschrijvingen/documents/2010/21/2010-scanner-data-dutch-cpi.pdf?sc_lang=en-gb)).

| KPI | Fórmula | Aplica | Semáforo inicial (calibrar 30 días) |
|---|---|---|---|
| **Índice competitivo** | `100·exp(Σwᵢ ln(pᵢ/cᵢ) ÷ Σwᵢ)` sobre pares del mismo día; c = mediana de equivalentes en stock; w = peso del cliente (igual por defecto). Siempre con **cobertura de canasta** visible | Todo | Banda del cliente: ±2 pts en productos clave (98–102, [Retailgrid](https://www.retailgrid.io/blog/how-to-calculate-price-index-retail-guide)), ±5 en el resto |
| Brecha vs competidor clave | (propio − competidor) en $ y % | Todo | Igual que el índice |
| Posición | Ranking entre equivalentes (único más barato … único más caro) | Todo | Informativo |
| Desvío vs precio sugerido | (precio observado − PVP) ÷ PVP, por retailer y seller | Productos de marca | Verde <5%, rojo >10% ([SmileAI](https://smileai.co/insights/10-kpi-ecom-pharma), proveedor) |
| Dispersión entre vendedores | rango % = (máx − mín) ÷ mín; CV = σ ÷ μ | Todo | Informativo (CV online 0,10–0,22 habitual, [FTC](https://www.ftc.gov/sites/default/files/documents/reports/prices-and-price-dispersion-online-and-offline-markets-contact-lenses/wp283revised_0.pdf)) |
| Frecuencia de promo | % de días con descuento ≥5% sobre lista ([NBER w26306](https://www.nber.org/system/files/working_papers/w26306/w26306.pdf)) | Todo | Comparativo por marca |
| Profundidad de promo | promedio de (lista − venta) ÷ lista cuando hay promo | Todo | Comparativo |
| Cuotas sin interés | máximo n general vs con banco o tarjeta propia; % de ofertas con ≥12 sin interés | Lo financiable | Comparativo |
| Costo implícito de cuotas | tasa anual implícita (sección anterior) | Lo financiable | Informativo |
| Precio por unidad | precio ÷ contenido × base | Consumo | Igual que el índice |
| **Precio efectivo 12m/24m** | (únicos + Σ abonos + equipo − créditos) ÷ H | Servicios | Igual que el índice, por perfil |
| Promo de servicio | % de planes con promo; meses de promo promedio; salto post-promo % | Servicios | Comparativo |
| Días desde último aumento | hoy − fecha del último evento "sube" | Servicios y todo | Informativo |
| Índice de oferta | puntaje ponderado de atributos (tipo Offer Score) | Banca, tarjetas | Comparativo |
| Disponibilidad | ofertas disponibles ÷ esperadas | Productos | Verde ≥98%, rojo <95% |
| Cobertura de surtido | SKUs propios listados ÷ catálogo activo, por retailer | Productos de marca | Meta del cliente |
| Cambios de precio | n.º de eventos por ítem × vendedor en el período | Todo | Informativo |

Para fabricantes, el KPI se rotula **"desvío vs precio sugerido"** y no "violación de MAP". La Ley 27.442 trata la fijación del precio de reventa como posible práctica restrictiva, mientras que el precio sugerido sin coacción es admisible ([guías CNDC](https://www.argentina.gob.ar/sites/default/files/guias_abuso_posicion_dominante.pdf)).

**Visualización.** La vista más usada es la **matriz de Price2Spy**: ítems en filas, vendedores en columnas y color por estado (más barato, más caro, bajo el precio sugerido, sin stock, chequeo fallido) ([Price2Spy](https://www.price2spy.com/blog/introducing-custom-colour-schemes-into-price2spy/)). La acompañan el "paisaje" (en cuántos ítems soy el más barato o el más caro) y la historia por ítem con línea de referencia ([Price2Spy dashboard](https://www.price2spy.com/pricing-dashboard.html)). En servicios, Tarifica usa rankings por perfil, series de tiempo, box plots, scatter precio × atributo y heat maps ([Tarifica TPIP](https://ww1.prweb.com/prfiles/2023/06/20/19401193/Tarifica_TelecomPricingIntelligencePlatform-Introduction_.pdf)). Lighthouse usa vistas de calendario, gráfico y tabla ([Lighthouse](https://www.mylighthouse.com/resources/blog/how-to-get-most-out-of-lighthouse-rate-insight)). PricingSaaS muestra una línea de tiempo de eventos con antes/después ([PricingSaaS](https://pricingsaas.com/)). Las guías de diseño piden **3–7 KPIs arriba, siempre contra una referencia, barras y líneas antes que tortas, y el color reservado para estado** ([IBCS](https://www.ibcs.com/standards/page/3/); [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)).

Hay un conflicto que BIP tiene que resolver a favor de IBCS. Price2Spy pinta de verde lo "barato", pero para una marca estar debajo del precio sugerido es malo. **El semáforo indica si el valor está dentro o fuera de la banda del cliente; barato o caro se muestra con posición y una escala neutra.**

Una propuesta de pestañas, siguiendo el estándar de BIP (título → "Cómo leer" → un renglón de pestañas):

- **Resumen:** tarjetas con meta + evolución + paisaje + 10 excepciones con evidencia.
- **Matriz:** ítem × vendedor.
- **Ítem/Plan:** historia con línea de referencia, escalera de equivalentes y escalera "lista → 1 pago → contado → cuota" o "promo → post-promo → efectivo 12m".
- **Promos y financiación:** calendario de promos por marca × vendedor, cuotas por banco y promos bancarias vigentes.
- **Ofertas de servicios** (solo plantillas de servicio): escalera por perfil, matriz tarifaria plan × franja etaria × zona como heat map, scatter precio × atributo y línea de tiempo de eventos.
- **Calidad de datos.**
- **Diagnóstico.**

**Filtros.** Hay un set universal: categoría/plantilla, segmento, marca, ítem y rol (clave/core/cola), vendedor y plataforma, seller (1P/3P, tienda oficial), tipo de precio (lista / 1 pago / contado / financiado / por unidad / efectivo H), medio de pago o banco, n.º de cuotas, fecha (ventana deslizante y fecha puntual), disponibilidad, tipo de match, confianza mínima del match y moneda ($/USD). A eso se suman **filtros generados desde la plantilla** (los atributos con rol `filter`: talle, capacidad, Mbps, modalidad) y, en servicios, perfil, zona, franja etaria, composición familiar, horizonte (12/24 meses) y permanencia. El drill-down va de resumen a categoría, de ahí a ítem, a vendedor y a evidencia. Los filtros activos se muestran como chips que se pueden quitar.

## La calidad en el tiempo sale del log que no se reescribe y de los testigos

La referencia académica es el Billion Prices Project del MIT: **un registro por ítem por día, a hora fija y desde la misma URL**, observando cada retailer más de un año antes de usarlo ([Cavallo & Rigobon](https://dspace.mit.edu/bitstream/handle/1721.1/105176/BPP_JEP%20article%20with%20Appendix.pdf?sequence=3&isAllowed=y)). Cavallo muestra que **imputar faltantes sesga la medición de los cambios de precio**, y que un faltante puede ser falta de stock o una falla del software ([Cavallo](https://www.hbs.edu/ris/Publication%20Files/Cavallo_Alberto_J4_Scraped%20Data%20and%20Sticky%20Prices_eb55d968-c3ec-44e7-9d3e-8afd50603ec1.pdf)). La regla que sale de ahí es que **la capa cruda solo se agrega y nunca se rellena**. El "último precio" y los agregados se derivan aparte, para poder reprocesar cuando se corrige un parser.

Zyte, el proveedor que más detalla su control, mide exactitud, validez, completitud, consistencia y oportunidad. Valida contra un esquema versionado, detecta anomalías con z-scores, chequea campos pareados (lista ≥ venta), fija líneas base de completitud por sitio e inspecciona a mano una muestra significativa ([Zyte](https://www.zyte.com/blog/how-zytes-extraction-experts-guarantee-data-quality/)). La causa principal de degradación son los cambios en los sitios: tests A/B, promos estacionales y variantes regionales ([Zyte QA](https://www.zyte.com/blog/data-quality-assurance-for-enterprise-web-scraping/)). Según una auditoría hecha por un competidor (fuente interesada), **ninguno de seis proveedores ofrece un SLA de precisión exigible por contrato** ([ProWebScraper](https://prowebscraper.com/articles/price2spy-alternatives)). Por eso BIP tiene que medir con una muestra propia.

| Control | Regla | Por qué |
|---|---|---|
| Coherencia de precio | >0 si está disponible; lista ≥ venta ≥ contado; n × cuota ≈ total | Atrapa basura como el `ListPrice` 322.314 de Jumbo/Disco |
| Escala y moneda | Un valor ~10×, 100× o 1000× de la mediana de 30 días = error de separador; centavos en Woo y Shopify | Errores de unidad |
| Saltos | ±50% día a día → "sospechoso", se re-captura antes de alertar | Evita falsas alarmas |
| Completitud y volumen | Fill rate por campo y sitio vs su línea base; capturados ÷ esperados | Rotura silenciosa del parser |
| Frescura y estado del conector | Última captura OK por sitio, visible en cada pantalla | Hubo endpoints intermitentes en un mismo día |
| **Ítems testigo** | 3–5 ítems por sitio con precio conocido; si fallan, el sitio queda "no confiable" | Detecta respuestas 200 con contenido señuelo **[diseño inferido]** |
| Muestra manual | Semanal y estratificada por sitio y categoría, contra la evidencia guardada; reporta exactitud con intervalo de confianza | Reemplaza el "99%" del proveedor |
| Re-match | Si cambia el `content_hash` del listado, se re-valida el match | El listado cambia y el match queda viejo |
| Faltantes | "Sin stock" ≠ "falló la captura" ≠ "sin precio publicado"; nunca se imputa | Sesgo documentado |
| Eventos de servicio | Detectar fin de promo, price reveal y dos precios para el mismo plan (A/B); rotular "declarado ≠ facturado" cuando la fuente es un regulador | Patrones de PricingSaaS y SSSalud |
| Evidencia | JSON/HTML crudo siempre; captura de pantalla solo en eventos | Auditoría y reproceso |
| Contexto | Zona, CP, canal de venta (VTEX `sc`), "sin sesión" en cada fila | El precio varía por zona: ~25% de los productos difiere >20% entre códigos postales ([Aparicio et al.](https://link.springer.com/article/10.1007/s11129-023-09273-w)) |

**Legal y costo.** El monitoreo de precios públicos sin login es de lo más defendible. Meta v. Bright Data (2024) sostuvo que los términos no alcanzan el scraping sin sesión ([Apify legal](https://use-apify.com/docs/what-is-apify/is-apify-legal)). En Argentina no hay ley específica. El riesgo está en los términos aceptados con cuenta, en eludir bloqueos técnicos y en copiar fotos o textos protegidos ([Deepyze](https://deepyze.dev/blog/web-scraping-legal-argentina/), blog de consultora). En la UE, republicar un catálogo ajeno puede ser "reutilización" prohibida ([EUR-Lex CV-Online](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62019CJ0762)). Las prácticas defendibles son:

- leer solo páginas públicas, sin sesión;
- no eludir desafíos anti-bot;
- respetar robots.txt con un ritmo bajo;
- guardar precios y metadatos, no imágenes;
- mostrarlos solo a clientes, sin publicar un comparador abierto.

En costo, leer el JSON nativo es uno o dos órdenes de magnitud más barato que renderizar páginas: Zyte cobra **US$0,13–1,27 cada 1.000 pedidos HTTP contra US$1,01–16,08 con navegador** ([Zyte pricing](https://www.zyte.com/pricing/)). Lo caro es mantener parsers, matching y control de calidad. El pool compartido amortiza la captura entre clientes que siguen los mismos sitios.

### Implementación por fases (recomendación, no probada en BIP)

| Fase | Alcance | Criterio para avanzar |
|---|---|---|
| 0. Validar (2 semanas) | Pilotos de 2–3 categorías distintas (ej. súper vía VTEX + SEPA, una marca de moda vía Magento/Tiendanube, una prepaga vía SSSalud); medir la estabilidad diaria de cada conector; primeras plantillas | ≥95% de capturas OK por conector durante 14 días |
| 1. Núcleo de producto | Conector VTEX + SEPA, log de observaciones, matching por GTIN y modelo, Matriz, Ítem, desvío vs precio sugerido, tablero de calidad | Exactitud medida por muestra ≥98% |
| 2. Financiación y medio de pago | Cuotas, contado, teasers bancarios, landings de promos; validar la unidad de `InterestRate` | Coherencia n × cuota ≈ total en ≥99% |
| 3. Servicios | Plantillas con perfiles; SSSalud, ENACOM y BCRA; captura de páginas de planes con eventos (antes/después) | Escalera por perfil reproducible |
| 4. Resto de plataformas | Tiendanube, Magento, Woo, Shopify, JSON-LD, Next.js; decidir Mercado Libre | Cobertura por categoría reportada |
| 5. Equivalencias e IA | Segmentos del cliente, LLM "selecting" + cola de revisión, índice competitivo completo, señales para el Diagnóstico y el copiloto | Precisión y cobertura del match por categoría visibles al cliente |

### Decisiones abiertas

| Decisión | Opciones | Qué condiciona |
|---|---|---|
| Mercado Libre | App OAuth (probar con token si lee ítems de terceros), scraping vía Apify (costo y zona gris) o proveedor (Nubimetrics/Real Trends) | Cobertura del marketplace dominante |
| Construir o comprar la captura | In-house vs una herramienta local para captura, quedándose con matching y KPIs | Costo y velocidad |
| Opinión legal | Pedirla antes de vender (scraping, uso de key de Constructor.io, ML) | Riesgo comercial |
| Fórmula del índice | Jevons (default propuesto) vs Laspeyres con pesos del cliente; mediana vs mínimo como referencia | Comparabilidad entre clientes |
| Política de faltantes | Excluir del par (propuesto) vs arrastrar ≤7 días declarado | Sesgo del índice |
| Bandas y color | Bandas por rol del ítem; semáforo por banda (propuesto) vs verde = barato | Lectura de la pantalla |
| Horizonte de servicios | 12 y/o 24 meses; incluir o no los cargos únicos (OCDE vs UIT) | Ranking por perfil |
| Perfiles por categoría | Quién los define: BIP con plantilla base, el cliente los ajusta | Onboarding |
| Pool compartido | Qué se comparte (observaciones y matches GTIN) y qué no (equivalencias, canasta, pesos) | Privacidad y costo |
| Cadencia | Diaria a hora fija vs intradía en eventos (Hot Sale, CyberMonday) | Costo de captura |
| Capturas de pantalla | Guardar o no, y por cuánto tiempo | Almacenamiento y evidencia |
| Cumplimiento regulatorio como KPI | Mostrar o no (leyenda de impuestos, CFTEA, precio por unidad) | Sensibilidad con los retailers |

## Conclusión

Generalizar a "cualquier categoría" no es sumar conectores; es **sacar la categoría del código**. Lo que cambia entre súper, moda, farmacia o una prepaga son tres cosas: el identificador que sirve, la regla de normalización (por unidad, por atributo o efectivo a N meses) y la definición de "equivalente". Las tres pueden vivir como datos en una plantilla versionada, mientras que la observación de precio, el log, la calidad y las pantallas son las mismas para todos. Eso convierte el problema de producto en un problema de catálogo, y el catálogo se puede sembrar con estándares que ya existen: Mercado Libre, Google Merchant Center, GS1.

El otro aprendizaje es que el diferencial de BIP no está donde compiten los globales. La matriz producto × tienda es un commodity. Lo escaso es medir de forma estructurada **la financiación y el medio de pago** en productos, y **la promo con fecha de vencimiento y el perfil** en servicios, con fuentes oficiales argentinas que nadie integra en un mismo tablero. La confianza del cliente va a depender de una sola cosa visible: que cada número diga de dónde salió, cuándo, con qué confianza de match y si el conector estaba sano ese día.
