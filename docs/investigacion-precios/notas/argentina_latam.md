# Monitoreo de precios de electrodomésticos en Argentina y LATAM: plataformas, modelo de datos local (cuotas) y regulación

> Notas de investigación, 7-oct-2026. Método: Perplexity (fuentes citadas) + **pruebas en vivo desde el sandbox** contra
> las APIs públicas de VTEX de los retailers (7-oct-2026) y la API de Mercado Libre. boletinoficial.gob.ar y
> developers.vtex.com están **bloqueados por la red del sandbox**: los textos normativos se citan a través de fuentes
> secundarias o de las URLs oficiales que devolvió la búsqueda, sin poder leerlos completos. El spec OpenAPI oficial de VTEX
> se bajó de GitHub (`vtex/openapi-schemas`, "VTEX - Search API.json").
> Marcas: **[verificado en vivo]** = probado contra el endpoint real el 7-oct-2026; **[sin verificar]** = no se pudo comprobar.

## (a) Proveedores locales/LATAM de inteligencia de precios: qué recolectan

### Takeaway
Hay dos grupos. (1) Herramientas **centradas en Mercado Libre** (Nubimetrics, Real Trends): precio, ventas/unidades estimadas, stock y ranking dentro de ML. (2) Plataformas de **digital shelf / monitoreo de retailers** (Minderest, Wiser, Neogrid con Predify, Horus y Lett en Brasil). Ninguna fuente pública confirma que alguna capture de forma estructurada **cuotas sin interés por tarjeta/banco, CFT o descuentos bancarios** en Argentina. Eso hay que pedírselo explícitamente a cada proveedor (con una muestra de exportación). Para la medición offline del mercado, GfK/NIQ ya es la fuente de Drean (share y precio por canal), y SEPA es el dataset público oficial.

### Cited Findings
- **Nubimetrics**: tendencias de mercado y categoría, comportamiento de búsqueda, publicaciones y vendedores competidores, seguimiento de precios, rankings de vendedores, ventas y market share por categoría. Se conecta a cuentas de Mercado Libre y permite seguir competidores, publicaciones y tiendas oficiales — [Nubimetrics producto](https://www.nubimetrics.com/producto); [landing](https://landings.nubimetrics.com/); comparación de terceros: [woosync](https://www.woosync.io/blog/nubimetrics-vs-real-trends-analisis-completo/)
- **Real Trends**: productos y ventas de competidores, cambios de precio, cambios en publicaciones, actualizaciones de stock, rankings por categoría, market share, facturación, unidades, precio promedio y métricas de vendedores en Mercado Libre. Tiene sitio para Argentina y promete seguir en tiempo real los cambios de precio y stock de la competencia — [Real Trends AR](https://www.real-trends.com/ar/mercadolibre); [Real Trends](https://www.real-trends.com/)
- **Minderest**: precios en retailers y marketplaces, promociones, quiebres de stock, surtido, historial de precios y, según la configuración, costos de envío. Tiene oferta para marcas y fabricantes. Las fuentes revisadas no nombran clientes ni retailers argentinos — [Minderest](https://www.minderest.com/); [Minderest marcas](https://www.minderest.com/brands-manufacturers)
- **Wiser (Digital Shelf, página en portugués/Brasil)**: precios competitivos actuales e históricos, surtido, alertas de stock por retailer, control de contenido de producto, reseñas y share of search por retailer — [Wiser BR](https://www.wiser.com/br/products/digital-shelf-intelligence/)
- **Neogrid (Brasil)**: tomó el control mayoritario de **Predify** en 2024. Predify optimiza precios con IA y compara contra la competencia sobre una base de más de 10 millones de productos — [Neogrid + Predify](https://neogrid.com/en/noticias/neogrid-predify-together/)
- **Horus** (inteligencia de mercado para fabricantes, con precios y market share en dashboards) y **Lett** (inteligencia de e-commerce / trade marketing digital en tiempo real para marcas y retailers) son parte del portafolio de Neogrid — [Neogrid soluciones](https://ri.neogrid.com/en/about-neogrid/neogrid-solutions/)
- **SEPA (Sistema Electrónico de Publicidad de Precios Argentinos, la base de datos detrás de Precios Claros)**: base de datos abierta oficial con precios diarios de supermercados ("12 millones de precios por día" según la página oficial). Es consumo masivo, no electrodomésticos de retailers especializados — [argentina.gob.ar SEPA](https://www.argentina.gob.ar/economia/industria-y-comercio/defensadelconsumidor/precios-sepa)
- **Scentia** publica reportes de tendencias de consumo (por ejemplo, junio de 2026), centrados en consumo masivo — [Scentia jun-26 PDF](https://scentiaconsulting.com.ar/mailing/descargas/scentia-tendencias-de-consumo-jun26.pdf)

### Inferences
- Para electrodomésticos, ML + VTEX cubren la mayor parte del canal online visible. Un monitoreo propio puede leer los campos de cuotas que los proveedores no documentan (ver (d)), y esa es una diferencia concreta frente a las herramientas comerciales.
- Nubimetrics y Real Trends dependen del acceso a la API de ML. Con las restricciones de 2025 (ver (d)), su cobertura de competidores pasa por los acuerdos y tokens que tengan con ML [sin verificar].

### Gaps
- No se encontraron fuentes confiables sobre: cobertura argentina de InfoPrice, Lett, Horus, Profitero y Wiser; qué retailers mide el panel Tech & Durables de NIQ‑GfK Argentina y si el precio es de transacción o de góndola; si Scentia hace monitoreo de e-commerce; ni sobre el estado de Precios Claros como app en 2024‑2026 (solo se confirmó que SEPA sigue publicado).
- La relación societaria entre Profitero y Lett y los clientes citados de Lett (Whirlpool Brasil, por ejemplo) no están verificados.
- No se encontró ninguna agencia argentina dedicada al monitoreo de precios de línea blanca con fuente pública.

## (b) Modelo de datos de precios argentino para e-commerce de electrodomésticos

### Takeaway
Un producto en Argentina no tiene "un precio". Tiene un **precio de lista/tachado**, un **precio de venta en 1 pago**, una **matriz de cuotas por medio de pago** (cantidad, valor de cuota, con o sin interés, total financiado), **descuentos por medio de pago** (transferencia, débito, tarjeta propia, banco y día, con BINs restringidos) y condiciones de **envío/retiro/stock**. Los planes oficiales de cuotas (Ahora 12 → Cuota Simple) **ya no existen**: Cuota Simple venció el 30-jun-2025 y no se renovó. Hoy las cuotas sin interés son promociones de bancos, billeteras o retailers.

### Cited Findings
- **Ahora 12 → Cuota Simple (histórico):** la Resolución 50/2024 de la Secretaría de Comercio (publicada el 26-ene-2024) renombró el programa "Cuota Simple", vigente desde el 1-feb-2024, con **3 y 6 cuotas fijas** y tasas directas máximas iniciales de 10,76% (3 cuotas) y 19,76% (6 cuotas). Incluía **línea blanca** (heladeras, lavarropas, cocinas, hornos, calefones, termotanques) — [Res. 50/2024](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-50-2024-396239/texto); [anuncio oficial](https://www.argentina.gob.ar/noticias/el-gobierno-pone-en-marcha-el-programa-cuota-simple); [Ámbito](https://www.ambito.com/economia/cuota-simple-gobierno-publico-la-letra-chica-del-programa-que-reemplaza-al-ahora-12-n5930550)
- En mayo de 2024 se prorrogó hasta el 31-dic-2024 y se sumaron 9 y 12 cuotas. A fines de 2024 se extendió hasta el **30-jun-2025**, de nuevo solo con 3 y 6 cuotas y solo para comercios MiPyME. **Venció el 30-jun-2025 y no se renovó** — [argentina.gob.ar](https://www.argentina.gob.ar/noticias/cuota-simple-se-extiende-hasta-fin-de-ano-y-suma-9-y-12-cuotas-fijas); [Infobae 14-jun-2025](https://www.infobae.com/economia/2025/06/14/se-termina-cuota-simple-a-fin-de-mes-que-opciones-de-financiacion-tendran-los-consumidores/); [portal Cuota Simple](https://www.argentina.gob.ar/economia/comercio/cuota-simple/consumidores)
- **2026:** volvieron las **12 cuotas sin interés** en electrodomésticos, en productos y tarjetas seleccionados. Hay ofertas de hasta 20 cuotas con Banco Nación y hasta 24 con Mercado Pago para marcas y categorías adheridas — [Infobae 4-abr-2026](https://www.infobae.com/economia/2026/04/04/vuelven-las-12-cuotas-sin-interes-al-sector-de-electrodomesticos-se-suman-las-marcas-de-ropa/)
- La regulación vigente (Res. 4/2025, art. 2 inc. d) exige que todo **precio financiado** informe **precio de contado, cantidad y monto de cada cuota y CFTEA (costo financiero total efectivo anual)** — [Res. 4/2025, Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/319787/1); [PDF argentina.gob.ar](https://www.argentina.gob.ar/sites/default/files/exhibicion_de_precios_resolucion_4_2025_0.pdf)
- **Ejemplo real de la matriz de cuotas** [verificado en vivo, Cetrogar, "Lavarropas Drean LRDR57SB 5Kg", 7-oct-2026]: ListPrice $232.999, Price $219.999. Hay **47 opciones de cuotas**: Visa y Mastercard en 1/3/6/9/12 sin interés y 15/18/20 con interés (en 20 cuotas: InterestRate 0,7, total $250.798,80); Amex hasta 9 sin interés; Cabal hasta 9 sin interés (12 con interés); Naranja 6/9/12 sin interés; tarjeta propia TUYA hasta 12. Medios en 1 pago: débito, MODO y "Transferencia Bancaria - Con descuento adicional". Ese descuento por transferencia **no se refleja en `Price`** (se aplica en el checkout) — consulta en vivo a `cetrogar.com.ar/api/catalog_system/pub/products/search`
- **Descuento por medio de pago codificado como promoción** [verificado en vivo, Carrefour]: los teasers dicen "PROMO-Adicional 15% Off en 1 pago" (condiciones MinInstallmentCount=1 y MaxInstallmentCount=1) y "Tarjeta Carrefour 15%" (condición `RestrictionsBins` con una lista de BINs y efecto `PercentualDiscount` 15). En Pardo, la promoción "Pago con DEBITO - lista de precios de contado" tiene condición `PaymentMethodId` y efecto `PromotionalPriceTableItemsIds`, o sea, una **tabla de precios de contado distinta**
- **Medios de pago visibles por retailer** [verificado en vivo, 7-oct-2026]:
  - Frávega: MercadoPagoPro, MODO, Vale, Naranja, Cabal…
  - Naldo: "Crédito Personal".
  - Electrolux: GOcuotas, Mercado Crédito, MercadoPagoWallet, Diners; hasta **18 cuotas sin interés**.
  - Whirlpool: "Transferencia bancaria"; 6 a 9 cuotas sin interés.
  - Carrefour: "Tarjeta Carrefour Mastercard", "Prepaga BSF"; 6 cuotas sin interés en lavarropas.
  - Naldo: 9 a 12 cuotas sin interés.
- Se citan las promociones de Frávega por banco, con cuotas atadas a tarjetas específicas y MODO (por ejemplo, Banco Provincia) — [Frávega promociones bancarias](https://www.fravega.com/promociones/bancarias); [Frávega promociones](https://www.fravega.com/e/promociones/); promociones de MODO por retailer (cuotas, reintegros) — [MODO promos](https://www.modo.com.ar/promos)

### Inferences
- Modelo mínimo propuesto por observación (SKU × retailer × seller × fecha):
  - precio de lista (tachado);
  - precio de venta en 1 pago;
  - precio contado/transferencia/débito, si existe una tabla aparte o un teaser;
  - por cada medio de pago y cantidad de cuotas: valor de la cuota, `InterestRate`, total, flag sin interés;
  - máximo de cuotas sin interés;
  - "mejor cuota sin interés" por tarjeta general vs. tarjeta propia o banco específico;
  - promociones (nombre, % de descuento, BINs/banco, días, tope de reintegro si se publica);
  - envío/retiro;
  - disponibilidad.
- El **CFT/TEA casi nunca viene en la API**: VTEX da `InterestRate` y `TotalValuePlusInterestRate`, y a partir de eso se puede calcular la tasa implícita. Que `InterestRate` sea mensual o un porcentaje con otra definición **no está verificado** (Cetrogar: 0,33 para 15 cuotas → total +4,95%).
- Descuentos por banco y día con reintegro y tope (por ejemplo "20% los miércoles con Banco X, tope $Y"): en general se publican como banners o landings de promociones, o como teasers con BINs. El reintegro posterior (lo devuelve el banco) **no aparece en el precio del catálogo**. Hay que capturarlo aparte (landing de promociones del retailer, MODO, sitios de bancos) [inferencia; solo se vio el caso de teasers de Carrefour].
- **Inflación:** comparar precios nominales entre meses distorsiona las tendencias (alta inflación histórica). Por regla del usuario **no se ajusta por inflación**: solo se deja constancia del problema. En comparaciones entre retailers en la misma fecha no afecta. Las cuotas sin interés tienen un valor financiero real para el comprador que no se ve en el precio nominal.

### Gaps
- No se obtuvo el texto de la respuesta oficial de VTEX sobre la unidad de `InterestRate`.
- No se verificaron Musimundo, Megatone, On City ni Garbarino (ver (d)).
- No se encontró ninguna fuente sobre topes de reintegro estructurados.

## (c) Regulación: qué hay que exhibir

### Takeaway
El régimen general de exhibición de precios hoy es la **Resolución 4/2025 de la Secretaría de Industria y Comercio** (Boletín Oficial del 17-ene-2025), que **derogó** las resoluciones 7/2002, 51‑E/2017, 915‑E/2017, entre otras. Exige:
- precio final en pesos (se permite además moneda extranjera);
- "PRECIO SIN IMPUESTOS NACIONALES" en letra menor, desde el 1-abr-2025;
- para precios financiados, precio de contado + cantidad y monto de cuotas + CFTEA;
- en e-commerce, precio total y final destacado antes de aceptar la compra.

Las leyes 24.240 (arts. 7 y 36) y 25.065 (art. 37) siguen vigentes.

### Cited Findings
- Contenido de la Res. 4/2025:
  - art. 2 incs. a/b: pesos (se puede sumar dólar u otra moneda) y precio total y final;
  - inc. c: "PRECIO SIN IMPUESTOS NACIONALES" (sin IVA ni otros impuestos nacionales indirectos) en caracteres menores, en comercios y en anuncios;
  - inc. d: precio financiado → precio de contado, cantidad y monto de cuotas, CFTEA;
  - inc. e: precio por unidad de medida en caracteres menores;
  - art. 3: información clara, visible, horizontal, legible, en formato físico o digital;
  - art. 4: comercio electrónico → precio total y final destacado antes de aceptar;
  - art. 5: servicios con el exterior se pueden expresar en moneda extranjera;
  - **art. 15: deroga las resoluciones 7/2002, 50/2002, 2/2005, 3/2013, 31/2014, 51‑E/2017, 915‑E/2017 y 926/2017** y sus modificatorias.

  Fuentes: [Boletín Oficial Res. 4/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/319787/1); [Infoleg id 408455](https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=408455); [PDF](https://www.argentina.gob.ar/sites/default/files/exhibicion_de_precios_resolucion_4_2025_0.pdf); [precios en moneda extranjera](https://www.argentina.gob.ar/noticias/los-precios-podran-exhibirse-tambien-en-dolares-o-en-otra-moneda-extranjera). Texto leído vía Perplexity, no directo (Boletín Oficial bloqueado).
- El "precio sin impuestos nacionales" rige desde el **1-abr-2025** — [preguntas frecuentes oficiales](https://www.argentina.gob.ar/sites/default/files/2025/04/preguntas_frecuentes_exhibicion_de_precios.pdf)
- **Norma del 3-nov-2025 sobre publicidad de precios:** los anuncios con precios deben cumplir los arts. 2 y 3 de la Res. 4/2025. En medios gráficos, radio y TV, las cuotas y la CFTEA pueden informarse en una web o canal indicado en el anuncio; en **medios digitales deben estar en el propio canal** — [Boletín Oficial 3-nov-2025](https://www.boletinoficial.gob.ar/pdf/aviso/primera/333879/20251103); comentario: [abogados.com.ar](https://abogados.com.ar/defensa-del-consumidor-y-lealtad-comercial-nuevo-estandar-integral-de-transparencia-en-materia-de-publicidad-juegos-apuestas-e-influencers-en-entornos-digitales/37898). **Número de la norma no identificado** [sin verificar].
- **Ley 24.240**: el art. 7 regula la oferta (vigencia, modalidades, condiciones, limitaciones). El art. 36 regula operaciones de crédito: precio de contado, monto financiado, tasa efectiva anual, CFT, sistema de amortización, cantidad y periodicidad de pagos — [Infoleg Ley 24.240](https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm) (URL estándar de Infoleg; contenido según la síntesis de Perplexity)
- **Ley 25.065 (tarjetas), art. 37 inc. c**: prohíbe fijar un precio distinto entre contado y tarjeta. Las fuentes encontradas **no muestran que el DNU 70/2023 lo haya modificado** — [Infoleg Ley 25.065](https://servicios.infoleg.gob.ar/infolegInternet/anexos/55000-59999/55556/texact.htm); [DNU 70/2023](https://www.argentina.gob.ar/normativa/nacional/decreto-70-2023-395521/texto)
- **Histórico (2017):** la Res. 51‑E/2017 obligaba a separar el precio de contado de la opción en cuotas, prohibía anunciar "sin interés" si el costo de financiación estaba incluido en el precio, y aplicaba el mismo precio a 1 pago en efectivo, débito o crédito — [Infoleg Res. 51-E/2017](https://servicios.infoleg.gob.ar/infolegInternet/anexos/270000-274999/271185/norma.htm); [argentina.gob.ar 2017](https://www.argentina.gob.ar/noticias/los-comercios-deberan-separar-el-precio-al-contado-de-la-opcion-en-cuotas). **Conflicto:** una de las respuestas trata la 51‑E como operativa, pero según el art. 15 de la Res. 4/2025 está **derogada**. Hay que tratarla como histórica.

### Inferences
- En la práctica conviven "precio contado/transferencia" más bajo y "precio de lista" para tarjeta (lo confirman los teasers de Pardo y Carrefour), aunque el art. 37 de la Ley 25.065 sigue vigente. Las implementaciones lo encuadran como "promoción" o "descuento adicional" sobre el precio de lista. Esto es una lectura de la práctica, **no una opinión legal**.
- Un monitor de cumplimiento podría verificar en las fichas web:
  - que esté la leyenda "precio sin impuestos nacionales";
  - que esté la CFTEA cuando hay cuotas con interés;
  - que el precio de contado esté visible junto al financiado.

### Gaps
- No se leyeron los textos completos (Boletín Oficial bloqueado).
- No se encontró ninguna comunicación del BCRA vigente sobre exhibición de CFT 0% en publicidad.
- No se verificó si hubo cambios normativos en 2026 posteriores a la norma de noviembre de 2025.

## (d) Cómo exponen estos datos los sitios de retailers argentinos (VTEX, Mercado Libre)

### Takeaway
La mayoría de los retailers de electrodomésticos y tiendas de marca **exponen la API pública de catálogo de VTEX**, que devuelve precio de lista, precio, **matriz completa de cuotas por tarjeta**, teasers de promociones (con BINs y % de descuento), `PriceValidUntil` y disponibilidad. Hay que tener en cuenta que `AvailableQuantity` viene **topeado o ficticio** (100 / 99999) y no sirve como stock real. **Mercado Libre cerró su búsqueda pública en 2025**: `/sites/MLA/search` e `/items` devuelven 403 sin token [verificado en vivo].

### Cited Findings
- **Respuesta del endpoint VTEX `/api/catalog_system/pub/products/search` probado en vivo** (`?ft=lavarropas&_from=0&_to=0`, 7-oct-2026):

  | Sitio | HTTP | Lectura |
  |---|---|---|
  | Frávega | 206 | VTEX |
  | Cetrogar | 206 | VTEX |
  | Naldo | 206 | VTEX |
  | Carrefour AR | 206 | VTEX |
  | Pardo | 206 | VTEX |
  | Whirlpool AR | 206 | VTEX |
  | Electrolux (redirige a `tienda.electrolux.com.ar`) | 206 | VTEX, con headers `x-vtex-*` |
  | Megatone | 418 | Bloqueo anti-bot con header `resources: 0-0/19`, o sea, es VTEX con protección |
  | Musimundo | 301 → home | CloudFront/S3, no expone la ruta VTEX |
  | Drean.com.ar | 500 | — |
  | Rodo | 404 | — |
  | On City (home) | 200 | No se probó la ruta VTEX con éxito |
  | Garbarino | timeout | — |

  [verificado en vivo]
- VTEX confirma oficialmente que Frávega es cliente desde 2014. Hoy usa un frontend headless propio (React) con carrito y checkout VTEX y un marketplace de sellers — [VTEX caso Frávega](https://vtex.com/es-ar/casos-de-clientes/fravega-ecommerce-composable-vtex/); [VTEX headless Frávega](https://vtex.com/es-ar/casos-de-clientes/protegiendo-el-legado-de-fravega-con-la-tecnologia-headless/); [Corebiz](https://blog.corebiz.ag/es/fravega-evoluciona-su-legado-con-tecnologia-headless/). En vivo, la búsqueda de Frávega devuelve **sellers de terceros** (por ejemplo "Panda Toys", "Fussetti") además de "Frávega", que aparece con Price 0 y AvailableQuantity 0 cuando no vende ese SKU.
- **Spec oficial de VTEX** ([openapi-schemas, Search API](https://github.com/vtex/openapi-schemas)):
  - Respuesta 200 o **206** (contenido parcial); el header `resources: 0-9/19` da el total.
  - `_from` debe ser ≤2500 y `_to - _from` ≤ 50 (**máximo 50 ítems por request**).
  - Filtros: `ft` (texto), `fq=C:/…` (categoría), `fq=B:/…` (marca), `fq=P:[a TO b]` (precio), `productClusterIds` (colección), `skuId`, `alternateIds_Ean` (**EAN13**), `alternateIds_RefId`.
  - Orden `O=OrderByPriceASC/DESC`, `OrderByTopSaleDESC`, `OrderByBestDiscountDESC`, etc.
  - Descripciones de campos:
    - `ListPrice` "List price of the product";
    - `PriceWithoutDiscount` "Price of the product without discount";
    - `InterestRate` "Interest rate of the installment";
    - `TotalValuePlusInterestRate` "Total value plus interest rate of the installment";
    - `AvailableQuantity` "Available quantity. Use the `IsAvailable` field instead.";
    - `PriceValidUntil`;
    - `Teasers` "List with teasers information".
- **Campos de `items[].sellers[].commertialOffer` observados en vivo** (Cetrogar):
  - `Installments[]` con {`Value`, `InterestRate`, `TotalValuePlusInterestRate`, `NumberOfInstallments`, `PaymentSystemName`, `PaymentSystemGroupName` (creditCardPaymentGroup, debitCardPaymentGroup, customPrivate_401…), `Name` (en portugués: "Visa 12 vezes sem juros" / "com juros" / "à vista")};
  - `Price`, `ListPrice`, `PriceWithoutDiscount`, `FullSellingPrice`, `RewardValue`, `PriceValidUntil`, `AvailableQuantity`, `IsAvailable`, `Tax`;
  - `DiscountHighLight[]`, `Teasers[]`, `PromotionTeasers[]`, `GiftSkuIds`, `BuyTogether`, `DeliverySlaSamples`;
  - `PaymentOptions.installmentOptions[]` (valores en centavos, `hasInterestRate`, `sellerMerchantInstallments`);
  - `PriceToken` (JWT).

  En la ficha: `productName`, `brand`, `link`, ids. El campo `spotPrice` no apareció en la respuesta de Cetrogar.
- La **Intelligent Search API** de VTEX y su app GraphQL (`vtex.search-graphql`) exponen `priceRange` y datos de cuotas en la búsqueda de productos — [Intelligent Search API](https://developers.vtex.com/docs/api-reference/intelligent-search-api); [search-graphql](https://developers.vtex.com/docs/apps/vtex.search-graphql) (sin leer directo: dominio bloqueado).
- **Stock:** `AvailableQuantity` viene topeado: Cetrogar 100, Naldo 99999, Electrolux 99999 o 100, Pardo 1, Whirlpool 74 o 125 (Whirlpool parece real). Coincide con la indicación oficial de usar `IsAvailable` [verificado en vivo].
- **Mercado Libre:** [verificado en vivo, 7-oct-2026] `GET api.mercadolibre.com/sites/MLA/search?q=…` sin token → **403** `{"message":"forbidden"}`; `GET /items/{id}` → **403** `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`. La documentación de abril de 2025 orienta las búsquedas a consultas autenticadas y específicas del vendedor (`/users/{user_id}/items/search`) — [ML Items & Searches](https://developers.mercadolivre.com.br/en_us/api-docs/items-and-searches); [auth](https://developers.mercadolivre.com.br/en_us/authentication-and-authorization/items-and-searches). Desarrolladores argentinos reportaron el 403 en 2025 y citaron a ML diciendo que la búsqueda general deja de estar disponible (corroboración no oficial) — [r/devsarg](https://www.reddit.com/r/devsarg/comments/1jovh3s/quien_de_ustedes_rompi%C3%B3_las_apis_de_mercadolibre/). **Conflicto:** otra síntesis sigue describiendo `/sites/MLA/search` como recurso "público" según la documentación ([ML docs](https://developers.mercadolibre.com.ar/en_us/items-and-searches)); la prueba en vivo indica que hoy no lo es.
- **API de precios de ML:** la guía recomienda dejar de leer `price`/`base_price`/`original_price` de `/items` y usar `GET /items/{id}/prices` y `GET /items/{id}/sale_price` (precio efectivo, por canal o contexto de fidelización), con bearer token — [ML API de precios](https://developers.mercadolibre.com.ar/api-de-precios). Los resultados de búsqueda (cuando hay acceso) traen `installments` (cantidad, tasa, monto), `shipping.free_shipping`, `shipping.logistic_type` y `official_store_id` — [ML docs](https://developers.mercadolibre.com.ar/en_us/items-and-searches) (síntesis). El catálogo con buy box está en `/products/{id}/items` [sin verificar en vivo].
- Herramientas propias de ML para marcas: **Mercado Ads / Brand Ads** para tiendas oficiales, con reportes y métricas — [Mercado Ads](https://developers.mercadolibre.com.ar/es_ar/introduccion-a-mercado-ads).

### Inferences
- Para un monitor propio de Drean y sus competidores: VTEX permite buscar por **EAN** (`fq=alternateIds_Ean:`) o marca/categoría y leer en una sola llamada precio de lista y venta, la matriz de cuotas por tarjeta y las promociones de medios de pago. Musimundo, Megatone (anti-bot), Garbarino y On City requieren otro método (HTML o render) [sin probar].
- Los nombres de cuotas en portugués ("vezes sem juros") son la plantilla de VTEX. Conviene normalizar por `InterestRate == 0` y no por el texto.
- Para Mercado Libre hace falta una app y un token. Para los avisos de competidores, el acceso general por API está restringido desde 2025. Las alternativas son scraping (Apify, ya usado en el proyecto) o proveedores con acuerdos (Nubimetrics, Real Trends) [inferencia].
- El descuento por transferencia (Cetrogar, Whirlpool) y el reintegro bancario no están en `Price`: hay que leer teasers, landings de promociones o simular el checkout (`/api/checkout/pub/orderForms/simulation`, endpoint VTEX no probado acá).

### Gaps
- No se probó el endpoint de Intelligent Search ni la simulación de checkout de VTEX.
- No se confirmó la plataforma de Musimundo, On City, Garbarino, Rodo y Coppel. Que Coppel haya salido de Argentina no está verificado.
- No se capturaron envío y retiro en tienda (`DeliverySlaSamples` vino vacío; requiere código postal y simulación).
- No hay fuente sobre la cobertura de cuotas de ML en el payload actual autenticado.
