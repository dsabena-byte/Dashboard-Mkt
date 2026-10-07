# Plataformas e-commerce AR/LATAM y datos públicos de precio (capa de conectores multicategoría BIP)

> Tests en vivo hechos el **7-oct-2026** desde el sandbox con `curl` + User-Agent de Chrome, 1 request por endpoint, páginas públicas, sin login, sin saltar desafíos anti-bot. "[verificado: curl 7-oct-2026]" = lo vi en la respuesta; "[sin verificar]" = no lo pude comprobar. Algunos dominios de documentación (developers.mercadolibre.com.ar, wmtips.com, storeleads.app, datos.produccion.gob.ar) están **bloqueados por el proxy del sandbox o devolvieron 403**, así que esas partes salen de snippets de búsqueda y van marcadas.

## Matriz de conectores (resumen; el detalle con fuentes está en las secciones de abajo)

| Plataforma | Endpoint / dato estructurado público | Precio de lista | Precio de venta | Cuotas | Stock | EAN/SKU | Variantes | Confiabilidad | Anti-bot visto |
|---|---|---|---|---|---|---|---|---|---|
| **VTEX (legacy + IO)** | `GET /api/catalog_system/pub/products/search?ft=…&_from&_to` (JSON) | `ListPrice` (a veces basura) | `Price` / `PriceWithoutDiscount` | `Installments[]` por medio de pago con `InterestRate` y `NumberOfInstallments` | `AvailableQuantity` (tope 99999 = "hay") + `IsAvailable` | `ean`, `referenceId` | `items[]` (SKU) | Alta (API estable, 12/12 tiendas respondieron) | Ninguno en 1 request (Carrefour detrás de Cloudflare igual respondió) |
| **Tiendanube / Nuvemshop** | Ficha HTML: objeto JS `LS.variants` + JSON-LD `Product` | `compare_at_price_number` | `price_number`, `promotional_price_number`, `price_with_payment_discount_short` | `installments_data` por pasarela (Pago Nube, Mercado Pago, GOcuotas…) con `interest` y `without_interests` | `stock` exacto + JSON-LD `inventoryLevel` | `sku` (sin EAN en LS.variants) | `LS.variants[]` (option0-2) | Alta (3 tiendas, mismo formato) | Ninguno |
| **Shopify** | `/products.json`, `/products/{handle}.js`, JSON-LD | `compare_at_price` | `price` | No (estándar) | Solo `available` (bool) | `sku`; `barcode` solo en `.js` | `variants[]` | Alta técnicamente; poca presencia en grandes retailers AR | Ninguno |
| **WooCommerce** | Store API `GET /wp-json/wc/store/v1/products` | `prices.regular_price` | `prices.sale_price`/`price` (en centavos, `currency_minor_unit`) | No | `is_in_stock`, `low_stock_remaining` | `sku` | `variations` | Media: a veces desactivada (404) | Cloudflare frecuente |
| **Magento / Adobe Commerce** | GraphQL `GET /graphql?query={products(search:…)}` | `price_range.minimum_price.regular_price` | `final_price` | No (estándar) | Opcional (`stock_status`, si está expuesto) | `sku` | `ConfigurableProduct.variants` | Alta en las 2 tiendas probadas | Ninguno |
| **Salesforce Commerce Cloud (Demandware)** | JSON-LD `Product` en ficha + HTML | No en JSON-LD (precio tachado solo HTML) | `offers.price` | Solo texto HTML ("3 cuotas…") | `availability` | `sku`/`mpn` (no GTIN) | No en JSON-LD | Media | Cloudflare |
| **Falabella (Sodimac) Next.js** | `__NEXT_DATA__` en búsqueda/listado | `prices[type=NORMAL]` | `prices[type=AB/…]` | `installment` presente (no inspeccionado) | `availability` (flags de entrega, no cantidad) | `skuId`, `productId` (sin EAN) | `variants` | Media-alta | Cloudflare (respondió 200) |
| **Custom JS (Frávega Next.js, Megatone, Coto Angular)** | Precio cargado por JS/API, no en HTML | — | — | — | — | — | — | Baja si es solo HTML; Coto sí tiene search Constructor.io | Varios |
| **Mercado Libre** | API oficial solo con OAuth (público → 403) | `regular_amount` | `amount` (`/items/{id}/sale_price`) | No en ese endpoint | Según scopes | `catalog_product_id`, GTIN en atributos | — | Alta con token; sin token = nada | 403 PolicyAgent |
| **SEPA / Precios Claros** | API JSON pública detrás de la web | — | precio lista + promos por sucursal | No | Implícito (sucursales con el producto) | **EAN como id** | No | Alta para súper | Ninguno |

## 1. Participación de mercado de plataformas en AR/LATAM

### Takeaway
Por **cantidad de sitios**, en Argentina dominan WooCommerce (~42%) y Tiendanube (~25%), con VTEX ~5% y Shopify cuarto. Por **peso de los grandes retailers** (que es lo que importa para monitorear precios), VTEX es lejos la plataforma dominante: 12 de los ~25 retailers grandes que probé corren VTEX. Mercado Libre se lleva la mayoría del GMV online, y Mercado Shops cerró el 31-dic-2025.

### Cited Findings
- Ranking AR por cantidad de sitios: WooCommerce 42,5%, Tiendanube 25,5%, VTEX 5,1%, Shopify 4º — [wmtips, E-Commerce Platforms in Argentina](https://www.wmtips.com/technologies/e-commerce/country/ar/) (dato del snippet de búsqueda; la página está bloqueada en el sandbox, así que no vi la metodología ni la fecha → [sin verificar el detalle])
- "Tiendanube is more popular in Argentina compared to global average" — [wmtips Shopify vs Tiendanube](https://www.wmtips.com/technologies/compare/shopify-vs-tiendanube/) (snippet)
- 176.933 tiendas vivas en Tiendanube (todos los países, no solo AR) y +38% interanual en el 4T-2025 — [Store Leads, Tiendanube report](https://storeleads.app/reports/tiendanube) (snippet; no vi el desglose por país)
- Mercado Libre ~60% de share del e-commerce, ~25% para tiendas propias (Tiendanube/VTEX/Shopify) — [developargentina.com, Estadística 2026](https://developargentina.com/estadisticas/ecommerce-argentina-2026) (fuente secundaria de calidad dudosa, sin metodología visible → usar con cautela)
- Cuota de VTEX por país — [BuiltWith VTEX Market Share](https://trends.builtwith.com/shop/VTEX/Market-Share) (no lo pude abrir; [sin verificar] los números)
- **Mercado Shops:** desde enero de 2025 no se pueden crear tiendas nuevas y la plataforma cerró definitivamente el **31-dic-2025**. Se migró a "Mi Página" dentro de Mercado Libre: 3 meses gratis y después $15.999/mes en AR — [iProUP](https://www.iproup.com/economia-digital/52790-mercado-libre-cierra-en-argentina-uno-de-sus-negocios) (por snippet)
- **Fingerprint en vivo de retailers grandes de AR** [verificado: curl 7-oct-2026, headers `x-vtex-*` / HTML]:
  - **VTEX (headers `x-vtex-product: store`, render@8 = VTEX IO):** Carrefour, Jumbo, Disco, Vea (Cencosud), Día, Farmacity, Farmaonline, Sporting, Easy (Cencosud), Puppis, On City, Naldo; además Cetrogar (VTEX **FastStore**, header `x-vtex-janus-router-backend-app: faststore-prod`, Next.js). En moda: Levi's, Ayres, 47 Street, Portsaid y Tascani también son VTEX.
  - **Salesforce Commerce Cloud (demandware/dwanalytics):** Dexter y Moov (los dos del grupo Open Sports).
  - **Falabella propia (Next.js, Cloudflare):** Sodimac.
  - **Custom:** Frávega (Next.js propio), Coto Digital (Angular + búsqueda Constructor.io, redirige a coto.com.ar), Megatone (server "GenericServerI").
  - **Magento:** Kosiuko, Mishka, Jazmín Chebar, Rapsodia, Prüne, Paruolo, Grisino, Complot → Magento domina la **moda de marca propia** argentina.
  - **Tiendanube:** Blaquè, Taverniti, Bensimon, Cardón, Cocot, Lupo (marcas medianas).
  - **Shopify:** La Martina (tienda global, precios en EUR), Revlon AR (catálogo en $0, sin venta). No encontré un retailer AR grande en Shopify.
  - **WooCommerce:** Cúspide (librería); Compumundo es WordPress pero la Store API dio 404.
  - **Sin tienda activa:** Musimundo ("Sitio en mantenimiento", servido desde S3), Grimoldi ("Nos estamos renovando", 503), Dafiti AR (ahora es un WordPress/Woo con título "Tu sitio web de moda", sin Store API).
  - **Bloqueados (403):** Adidas AR (Akamai), Nike AR (Cloudflare). Sephora AR: no resolvió (código 000).

### Inferences
- Para cubrir los retailers grandes de varias categorías alcanza con **un conector VTEX**. Le siguen en prioridad Magento GraphQL (moda), el parser de Tiendanube (PyMEs y marcas medianas), Woo y Shopify, y conectores a medida para SFCC, Sodimac, Frávega y Coto.
- El share "por cantidad de sitios" (Woo/Tiendanube) sobrerrepresenta las PyMEs. No conviene usarlo para priorizar el monitoreo de precios de marcas.

### Gaps
- No pude abrir BuiltWith, Wappalyzer, Store Leads ni wmtips (proxy) para ver los números por país con su fecha. No encontré un reporte CACE con el desglose de plataformas.
- No hay datos confiables de share de Salesforce Commerce Cloud ni de Oracle Commerce en AR. Oracle no apareció en ningún retailer probado.

## 2. Tiendanube / Nuvemshop: JSON público y cuotas

### Takeaway
No hay un `/products.json` público. Toda ficha de producto trae embebido el objeto JS **`LS.variants`**, con precio, precio tachado, precio con descuento por medio de pago, **stock exacto** y **`installments_data` completo por pasarela** (cuotas, interés y si son sin interés). Además trae JSON-LD `Product` con `inventoryLevel`. Es la fuente más rica en cuotas de todas las que probé.

### Cited Findings
- Blaquè (`/productos/cartera-de-hombro-clasica-monaco-vison-dyc027vs/`): `LS.variants` con `price_number` 89900, `price_with_payment_discount_short` "$80.910" (10% OFF por transferencia), `stock` 111 y `sku` DYC027VS. `installments_data` trae Pago Nube 2/3/6 cuotas con `interest:0`, `without_interests:true`, y Mercado Pago 1–6 sin interés y 9/12/18/24 con interés (`interest` 0,4347–1,1199, `total_value`). Las claves de cada variante son `available, compare_at_price_number, promotional_price_number, has_promotional_price, price_without_taxes, max_payment_discount_max_installments, option0-2, sku, stock`. **No trae barcode/EAN.** [verificado: curl 7-oct-2026]
- Bensimon (`/productos/chaqueta-habana/`): 4 variantes, `installments_data` = Pago Nube 3 cuotas sin interés, stock 2. [verificado: curl 7-oct-2026]
- El JSON-LD `Product` incluye `offers.price`, `priceCurrency ARS`, `availability`, **`inventoryLevel.value`** y `sku`. Ojo: en la página aparecen 8–10 bloques, la mayoría de productos **relacionados**, así que hay que filtrar por `offers.url` = URL canónica. [verificado: curl 7-oct-2026]
- Los productos se descubren por links `/productos/<slug>/` en la home y las categorías [verificado: curl 7-oct-2026]. Sitemap: [sin verificar].
- Cocot: no se pudo obtener ninguna URL de producto con el patrón usado (código 000) → [sin verificar].

### Inferences
- Un conector "Tiendanube" puede parsear `LS.variants` con regex + JSON y sacar el "máximo de cuotas sin interés por pasarela", que es exactamente la métrica comercial argentina.
- Está la variable `LS.customerHasPriceTables` → hay listas de precios mayoristas que podrían variar con login (no aplica a datos públicos).

### Gaps
- No probé las tiendas en `*.mitiendanube.com` ni Nuvemshop Brasil (`LS.variants` debería ser igual, [sin verificar]).

## 3. Shopify

### Takeaway
`/products.json` y `/products/{handle}.js` son públicos (200 en las 2 tiendas). Dan `price`, `compare_at_price`, `sku`, `available` y `barcode` (solo en `.js`). No hay cantidad de stock ni cuotas. Los retailers de AR casi no usan Shopify, y las tiendas "AR" con Shopify que probé no tenían precios útiles en ARS.

### Cited Findings
- lamartina.com: `products.json` 200, variante con claves `available, compare_at_price, price, sku…`; `/products/{h}.js` con precio en centavos (18000) y `barcode` 7613431881631, sin `inventory_quantity`. Los precios estaban en EUR (tienda global, idioma alemán). [verificado: curl 7-oct-2026]
- revlon.com.ar: `products.json` 200 pero `price 0.00`, `available false` y JSON-LD `priceCurrency USD` (catálogo sin venta). [verificado: curl 7-oct-2026]
- No encontré texto de "cuotas" en las fichas Shopify probadas [verificado: curl 7-oct-2026].

### Inferences
- El conector Shopify es barato de hacer pero rinde poco en AR. Si una tienda usa Shopify Markets, hay que forzar país/moneda (p. ej. `?currency=ARS` o el prefijo de país) [sin verificar].

### Gaps
- No encontré ningún retailer AR relevante con Shopify y precios en ARS para probar las cuotas.

## 4. WooCommerce y Magento

### Takeaway
La **Woo Store API** es pública cuando está activa (Cúspide 200), pero algunos sitios la tienen desactivada (404). El **GraphQL de Magento 2** respondió sin autenticación en Kosiuko y Grisino, con precio regular, precio final y SKUs de variantes. Es la vía para la moda de marca propia.

### Cited Findings
- Cúspide `GET /wp-json/wc/store/v1/products?per_page=1` → 200. `prices {price, regular_price, sale_price, currency_code ARS, currency_minor_unit 2}` (valores en centavos: "4440000" = $44.400), `sku` (ISBN 9789878977560), `is_in_stock`, `low_stock_remaining`, `variations`, `on_sale`. [verificado: curl 7-oct-2026]
- Compumundo y Dafiti (Woo/WordPress): Store API → 404 `rest_no_route`. [verificado: curl 7-oct-2026]
- Kosiuko `GET /graphql?query={products(search:"remera",pageSize:1){items{sku name price_range{minimum_price{regular_price{value currency} final_price{value}}} … on ConfigurableProduct{variants{product{sku}}}}}}` → 200: regular 69000 ARS, final 69000, variantes por talle. Grisino → 200: regular 20000 y **final 16000** (descuento visible). [verificado: curl 7-oct-2026]

### Inferences
- Magento GraphQL permite búsqueda y paginación sin scraping de HTML. Hay que verificar en cada tienda que no esté cerrado.

### Gaps
- No probé campos de stock (`stock_status`) ni de EAN (atributo custom) en Magento.

## 5. JSON-LD / plataforma de grandes retailers por categoría

### Takeaway
En los VTEX no hace falta el JSON-LD: la API de catálogo pública dio precio, precio de lista, EAN, disponibilidad y la grilla completa de cuotas en 12 de 12 tiendas (súper, farmacia, deportes, hogar, mascotas, electro). Fuera de VTEX la calidad varía: SFCC tiene JSON-LD básico, Sodimac usa `__NEXT_DATA__`, Frávega y Megatone no ponen el precio en el HTML.

### Cited Findings
- **VTEX `/api/catalog_system/pub/products/search?_from=0&_to=0` → HTTP 206** con JSON en las 12 tiendas [verificado: curl 7-oct-2026]. Ejemplos:
  - Carrefour: Puré Arcor, EAN 7790580146115, Price 790, ListPrice 1220, 27 opciones de cuotas, 1 teaser de promo.
  - Jumbo y Disco: mismo producto (Bagley, EAN 7790040147720), Price 3900 y **ListPrice 322314 (dato basura)** → hay que validar ListPrice/Price.
  - Día: Price 995, ListPrice 1390, AvailableQuantity 2147 (cantidad real), hasta 3 cuotas sin interés con Naranja.
  - Farmacity: hasta 6 cuotas sin interés con Visa. Farmaonline: Price 13194, ListPrice 21990, 1 `DiscountHighLight`.
  - Sporting: `ean null`, 11 SKUs (talles), sin stock.
  - Easy: EAN interno "2000…".
  - On City: hasta 18 cuotas sin interés. Naldo: 10 cuotas sin interés, AvailableQuantity 10. Cetrogar (FastStore): 12 cuotas sin interés.
  - Puppis: 11 opciones de cuotas.
- AvailableQuantity = 99999 es un tope ("hay stock"), no una cantidad [verificado: aparece en 9 de 12 tiendas].
- **Dexter (SFCC)**, ficha `/…/ADKJ4189.html`: 1 JSON-LD `Product` con `sku` y `mpn` ADKJ4189, `offers.price` 99999.00 ARS e `InStock`. No tiene GTIN ni precio de lista en JSON-LD. El HTML muestra "$99.999", "$82.644" (precio sin impuestos o con descuento) y "3 cuotas" [verificado: curl 7-oct-2026].
- **Sodimac** `/sodimac-ar/search?Ntt=taladro` → `__NEXT_DATA__` con `prices:[{type:"AB", price 127299}, {type:"NORMAL", price 149699}]`, `availability {homeDelivery, clickAndCollect}`, `bankBadge` BANK_PROMOTION, 28 `skuId` y la clave `installment`. No trae EAN [verificado: curl 7-oct-2026].
- **Frávega** ficha `/p/…-782462/`: `__NEXT_DATA__` solo con el `sku` 782462 y diccionarios de UI. No hay precio, JSON-LD ni cuotas en el HTML → el precio se carga por JS/API [verificado: curl 7-oct-2026; el endpoint interno no lo investigué].
- **Megatone** ficha: 200 sin JSON-LD ni precios en el HTML [verificado: curl 7-oct-2026].
- **Coto Digital:** la SPA Angular usa Constructor.io. `ac.cnstrc.com/search/<q>?key=<key embebida en el JS público>` → 200 con `price`, `product_list_price`, `discounts`, `discounts_payment_methods`, `product_main_ean`, `sku_id`, `store_availability`, `product_unit_of_measure` [verificado: curl 7-oct-2026]. Ojo: usa una key de cliente embebida → evaluar los ToS antes de usarla.
- Adidas AR (Akamai) y Nike AR (Cloudflare) → 403 en la home: hay bloqueo anti-bot, no se intentó evadir [verificado: curl 7-oct-2026].

### Inferences
- Esquema canónico sugerido para BIP: `{ean, sku, list_price, sale_price, payment_discount_price, max_cuotas_sin_interes, medio, stock_flag/qty, seller}`. VTEX y Tiendanube lo llenan casi completo; SFCC y Sodimac llenan precio y disponibilidad.
- El matching entre retailers se puede hacer por EAN en súper, farmacia, pet y electro (VTEX lo trae). En moda y deportes no hay EAN (Sporting null, Dexter solo mpn) → hace falta un matching por modelo/mpn.

### Gaps
- No inspeccioné el JSON-LD de las fichas VTEX (no hizo falta por la API).
- Sephora AR no resolvió; no confirmé que exista.

## 6. Marketplaces y agregadores (Mercado Libre, Rappi, PedidosYa, Google Shopping)

### Takeaway
La API de Mercado Libre **ya no responde sin token**: search, items y products dan 403 sin autenticación. El camino es una app registrada + OAuth 2.0, con `/items/{id}/sale_price` como endpoint de precio. Rappi y PedidosYa no exponen APIs públicas de precio (PedidosYa da 403 Cloudflare). Google Shopping vía SerpApi (`gl=ar`) es un agregador pago viable.

### Cited Findings
- `GET api.mercadolibre.com/sites/MLA/search?q=lavarropas` → 403 `forbidden`; `/items/MLA…` y `/products/search` → 403 `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` (PolicyAgent) [verificado: curl 7-oct-2026].
- "Historically /sites/{site_id}/search, /items/{item_id} and /users/{user_id} were public, but as of 2025 Mercado Libre returns HTTP 403 on unauthenticated calls" — [anythingmcp guide](https://anythingmcp.com/es/guides/connect-mercado-libre-to-claude) (secundaria; coincide con mi test).
- 403 = el token no corresponde a la información pedida o faltan scopes en el DevCenter → usar tokens del dueño de la información — [ML Developers, error 403](https://developers.mercadolibre.com.ar/error-403) (snippet).
- Precio de venta: `GET /items/$ITEM_ID/sale_price?context=channel_marketplace,buyer_loyalty_3` con `Authorization: Bearer`. Devuelve `price_id`, `amount`, `regular_amount` (precio original si hay promo), `currency_id`, `reference_date` y `metadata.promotion_id/type` — [ML Developers, API de precios](https://developers.mercadolibre.com.ar/api-de-precios) (snippet; el sitio de docs está bloqueado en el sandbox).
- Flujo OAuth para apps de terceros: [ML Developers, autenticación](https://developers.mercadolibre.com.ar/devsite/authentication-and-authorization-global-selling) (snippet). Que un token de app pueda leer precios de **ítems de otros vendedores**: [sin verificar].
- listado.mercadolibre.com.ar/lavarropas → 200 pero 43 KB sin precios en el HTML (probable muro o render JS); mercadolibre.com.ar detrás de Cloudflare [verificado: curl 7-oct-2026].
- rappi.com.ar → 200 con mención de "captcha"; pedidosya.com.ar → **403 Cloudflare** [verificado: curl 7-oct-2026].
- SerpApi Google Shopping soporta `gl=ar` y devuelve título, precio, moneda, comercio, URL y rating — [SerpApi engine google_shopping](https://glama.ai/mcp/servers/@serpapi/mcp-server/blob/bf9191d4a6c4b2f6061995c4965f4a8ca1d9339b/engines/google_shopping.json) (secundaria). Costo por request y cobertura en AR: [sin verificar].

### Inferences
- Para Mercado Libre, BIP necesita una app con OAuth y validar con un token real si puede consultar ítems de terceros (catálogo/competidores) o solo los propios. Hasta probarlo, no prometerlo.
- Rappi y PedidosYa: no incluirlos en el MVP (anti-bot y sin API pública).

### Gaps
- No pude leer la documentación de ML (bloqueada) ni probar con token. Falta: scopes, límites y acceso a ítems de terceros.
- No pude ver los costos ni la calidad de SerpApi para AR.

## 7. SEPA / Precios Claros (dato oficial de supermercados)

### Takeaway
Sigue vivo en 2026. La API JSON que alimenta preciosclaros.gob.ar responde sin autenticación, con precio por **EAN × sucursal** (incluye promos), 2.067 sucursales listadas. El dataset abierto SEPA (Disp. 494/2024) se publica en datos.produccion.gob.ar, pero ese portal dio 403 desde el sandbox.

### Cited Findings
- `GET d3e6htiiul5ek9.cloudfront.net/prod/sucursales?limit=1` → 200, `total: 2067`, campos `comercioId, banderaId, sucursalId, sucursalTipo, sucursalNombre…` [verificado: curl 7-oct-2026].
- `GET …/prod/productos?string=lavandina&array_sucursales=2-1-384` → `id` = **EAN** (7791905003663), `marca`, `nombre`, `presentacion`, `precioMin/Max`, `cantSucursalesDisponible`. `GET …/prod/producto?id_producto=<EAN>&array_sucursales=…` → por sucursal `preciosProducto` con `promo1/promo2` y campos de bulto con y sin IVA, más `lat/lng`, `provincia`. `maxLimitPermitido` 50. Ojo: si se combinan `lat/lng` con `array_sucursales` da 400 "argumentos incompatibles" [verificado: curl 7-oct-2026].
- SEPA = precios diarios por punto de venta informados por grandes comercios de consumo masivo, electrodomésticos, electrónica y materiales de construcción. Más de 3.600 sucursales, 12 millones de precios de 70.000 productos. Portal abierto por la **Disposición 494/2024** (Subsecretaría de Defensa del Consumidor) — [El Economista](https://eleconomista.com.ar/economia/precios-sepa-gobierno-habilito-plataforma-conocer-12-millones-precios-n76774); [iProfesional, 5-jul-2026](https://www.iprofesional.com/economia/411887-precios-claros-que-podran-hacer-consumidores-con-valores-productos-supermercados).
- Hay un dataset histórico en un repo comunitario — [pdelboca/datasets_preciosclaros](https://github.com/pdelboca/datasets_preciosclaros); [Zenodo 2022](https://zenodo.org/records/6568295).
- `datos.produccion.gob.ar/dataset/sepa-precios` y su API CKAN → 403 desde el sandbox [verificado: curl 7-oct-2026; la causa (bloqueo geográfico, del proxy o anti-bot) no la sé].

### Inferences
- Es la mejor fuente para súper/consumo masivo: oficial, gratuita, con EAN y cobertura nacional por sucursal. Hay diferencias entre fuentes (2.067 sucursales en la API vs. "3.600" en la prensa), así que hay que validar la cobertura con la data real.

### Gaps
- No pude confirmar la frecuencia ni la fecha de la última publicación del ZIP diario en datos.produccion.gob.ar (403). Tampoco confirmé qué tan cubiertos están electro y construcción en la API.
