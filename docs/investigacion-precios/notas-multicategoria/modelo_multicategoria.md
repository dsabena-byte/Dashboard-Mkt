# Modelo de datos y matching de precios multicategoría (agnóstico de categoría) para BIP

> Nota de método (leer primero): el proxy del sandbox BLOQUEÓ el acceso directo (WebFetch) a support.google.com,
> dataweave.com, argentina.gob.ar y arxiv.org. Las citas se obtuvieron vía Perplexity (search/ask), que devuelve la URL
> de la fuente primaria. Marcado:
> - **[V-snippet]** = el texto citado se vio literal en el extracto de la fuente (search result).
> - **[V-perplexity]** = afirmación sintetizada por Perplexity con cita a la URL; NO leí la página completa.
> - **[sin verificar]** = inferencia propia o sin fuente.
> Fecha de la investigación: 7-oct-2026.

## 1. ¿Qué dicen Profitero / DataWeave / NIQ / Intelligence Node (y otros) sobre la precisión del matching por categoría?

### Takeaway
Solo DataWeave publica diferencias explícitas por categoría: moda/apparel es la más difícil (tasa de match 40–60% por atributos subjetivos), electrónica la más fácil (identificadores consistentes, 95%+ en datos limpios) y grocery se complica por private labels y UPC inconsistentes. Profitero, NIQ Digital Shelf, Salsify y Prisync no publican precisión por categoría; Intelligence Node y Competera publican cifras globales de marketing (99% / 95%+), no comparables entre sí.

### Cited Findings
- DataWeave: en apparel las tasas de match son típicamente **40–60%** por atributos subjetivos (estilo, color, fit, tela); reporta precisión **>85%** en fashion y en electrónica; dice que métodos LLM/CLIP mejoraron la precisión en fashion **>15%** (sin baseline ni definición de métrica) — [DataWeave blog "From mess to match"](https://dataweave.com/blog/from-mess-to-match-solving-product-identity-at-retail-scale); [DataWeave product matching](https://dataweave.com/us/product-matching) [V-perplexity; dominio bloqueado, no leído]
- DataWeave: el exact match es más fuerte donde hay identificadores consistentes; puede llegar a **95%+** en datos limpios (electrónica); en grocery los UPC/PLU no aparecen consistentemente y los UPC de **marca propia (private label) no mapean entre retailers** — [DataWeave AI data quality](https://dataweave.com/blog/how-ai-can-drive-superior-data-quality-and-coverage-in-competitive-insights-for-retailers-and-brands) [V-perplexity]
- DataWeave distingue matches **exact / similar / substitute / private-label**, con revisión humana y aprobación de matches; compara precio de lista, de venta, **normalizado por unidad** y neto efectivo; clientes pueden agregar SKUs/sitios y "weighted inputs" — [DataWeave pricing intelligence](https://dataweave.com/us/pricing-intelligence); [DataWeave DSA](https://dataweave.com/us/digital-shelf-analytics) [V-perplexity]
- Intelligence Node: **99% matching accuracy** global (branded + private label), usando atributos, comparación de imagen y texto exacto/semántico; revisión humana en matches de baja confianza; el "similar match" considera rango de precio y similitud visual. Sin cifra por categoría — [Intelligence Node product matching](https://www.intelligencenode.com/solutions/product-matching/); [Guía AI product matching 2022 (PDF)](https://info.intelligencenode.com/hubfs/ebooks/2022/A-Guide-to-AI-driven-Product-Matching-2022.pdf) [V-perplexity]
- Competera (grocery): **95%+** de precisión en precios/stock de competidores vs SKUs del retailer, "hasta 99%"; menciona explícitamente marca propia y frescos sin código de barras estándar, con verificación humana — [Competera grocery](https://competera.ai/solutions/by-industry/grocery-retail); [Competera product matching](https://competera.ai/solutions/by-need/product-matching) [V-perplexity]
- NIQ Digital Shelf (ex Data Impact): mapea listings a su **referencial de producto basado en UPC**, con matching asistido por IA + validación humana; comparación entre retailers, mercados y categorías. Sin cifras por categoría — [NIQ Digital Shelf](https://nielseniq.com/global/en/products/digital-shelf/) [V-perplexity]
- Profitero (Publicis), Salsify DSA, Stackline, Prisync: no se encontró documentación pública de precisión de matching por categoría ni de configuración de catálogo/índice — [Salsify DSA](https://www.salsify.com/pxm/digital-shelf-analytics) [V-perplexity: ausencia de evidencia]
- Moda (EDITED, Intelligence Node, DataWeave, Particl, Stylumia): el material público NO permite confirmar matching sin GTIN auditable ni historial de precio por talle/color; se recomienda pedir en demo: nivel del match (estilo padre vs variante hija), stock por talle, precio por variante vs heredado, markdown como evento fechado — [búsqueda Perplexity sin fuentes primarias concluyentes] [sin verificar]
- Académico (WDC, Univ. Mannheim): en el corpus WDC 2019 (1.100 pares etiquetados por categoría), baseline TF-IDF/coseno F1: computers 0,60, cameras 0,64, watches 0,60 (shoes no visible en el extracto); DeepMatcher RNN con training xlarge F1 agregado 0,90 — [WDC Large-Scale Product Corpus](http://webdatacommons.org/largescaleproductcorpus/); [v2](http://webdatacommons.org/largescaleproductcorpus/v2/) [V-perplexity]
- WDC Products (EDBT 2024): 11.715 ofertas / 2.162 productos, 27 variantes (proporción de corner cases, % de entidades no vistas, tamaño de dev set); todos los sistemas caen fuerte con productos no vistos (R-SupCon el que más) — [arXiv 2301.09521](https://arxiv.org/abs/2301.09521); [WDC Products](https://webdatacommons.org/largescaleproductcorpus/wdc-products/) [V-perplexity]
- LLMs: GPT-4 zero-shot **F1 91,92% en WDC Products** y 95,78% en Abt-Buy; "LLMs requieren menos/ningún dato de entrenamiento y matchean entidades no vistas"; fine-tuned gpt-4o-mini ≈ GPT-4 zero-shot; muy sensibles a la formulación del prompt; pueden explicar decisiones (atributos relevantes, importancia, similitud) — [Uni Mannheim WDI 2024 slides](https://www.uni-mannheim.de/media/Einrichtungen/dws/Files_Teaching/Web_Data_Integration/HWS2024/WDI04-IdentityResolution-HWS2024.pdf); [Peeters/Steiner/Bizer EDBT 2025](https://www.uni-mannheim.de/media/Einrichtungen/dws/DWS_News/Documents/Peeters-Entity-Matching-using-LLMs-EDBT2025.pdf); [arXiv 2310.11244](http://arxiv.org/pdf/2310.11244) [V-snippet]
- Billiger.de Products (2026): benchmark bilingüe de 13 categorías; caída Seen→Unseen de 39,16 / 25,75 / 26,88 F1 para R-SupCon / Ditto / RoBERTa (vs 26,59 / 9,60 / 9,16 en WDC Products); GPT-5.2 casi indiferente al idioma — [arXiv 2609.37713](https://arxiv.org/html/2609.37713v2) [V-snippet]
- Etiquetado con LLM como "teacher": estudiantes (Ditto) entrenados con pares etiquetados por GPT-5.2 quedan a ≤1,78 F1 del training set del benchmark (+0,23 a +1,59 en benchmarks de producto) — [arXiv 2606.28823](https://arxiv.org/pdf/2606.28823v1) [V-snippet]
- Estrategia "selecting" (dar al LLM varios candidatos a la vez) mejora hasta 14,74% F1 sobre comparar par a par; ~4 candidatos es el punto óptimo con ChatGPT — [arXiv 2405.16884](https://arxiv.org/html/2405.16884v2) [V-snippet]

### Inferences
- [sin verificar] Para BIP: el matching debe tener una política por "familia de categoría" — FMCG/electro/electrónica = identificador-primero (GTIN/MPN) con alta automatización; moda/muebles/marca propia = similitud (atributos + imagen + LLM) con revisión humana y métricas separadas para "mismo producto", "mismo estilo otra variante" y "equivalente por atributos".
- [sin verificar] Pipeline viable y barato: blocking (marca + categoría + identificadores) → LLM (gpt-4o-mini, ya usado en BIP/Drean) en modo "selecting" con top-4 candidatos → umbral de confianza → cola de revisión. La evidencia académica soporta que gpt-4o-mini fine-tuned ≈ GPT-4 zero-shot.
- [sin verificar] Las cifras de vendors (99%, 95%+) no son comparables (precisión vs match rate vs cobertura); BIP debería reportar precisión Y cobertura por categoría al cliente.

### Gaps
- No encontré cifras de Profitero ni NIQ por categoría (no publicadas o detrás de login).
- No pude leer las páginas de DataWeave directamente (egress bloqueado); las cifras 40–60% / >85% / +15% vienen de la síntesis de Perplexity.
- Sin tabla per-category de WDC 2019 para shoes, ni F1 por categoría de LLMs.

## 2. Mejor modelo de datos para un SaaS multi-tenant: producto maestro del tenant, pool compartido de listings, plantillas por categoría

### Takeaway
Los estándares y PIMs convergen en: (a) clasificación jerárquica separada del modelo de atributos (GS1 GPC Brick + atributos de Brick; Akeneo family; ML domain/category), (b) un set de atributos "core" estable + atributos por categoría declarados en una plantilla con tipo, unidad, lista controlada y requerido/opcional, y (c) variantes con ejes explícitos (Akeneo hasta 2 ejes; schema.org ProductGroup.variesBy; Google item_group_id; ML variation_attribute). Para Postgres/Supabase, el patrón práctico es columnas relacionales core + JSONB para atributos por categoría validados contra una plantilla, con tablas hijas para identificadores.

### Cited Findings
- GS1 GPC: jerarquía **Segment → Family → Class → Brick**; el Brick es el nivel clave; los *Brick Attributes* con valores controlados agregan detalle; un GTIN se asigna a un único Brick — [GS1 GPC Development & Implementation guide](https://www.gs1.org/docs/gpc/GPC_Development_Implementation.pdf) [V-perplexity]
- GPC se publica **dos veces por año (mayo y noviembre)**; no encontré conteo actual de bricks — [GS1 Germany GPC guide 8.0](https://www.gs1-germany.de/fileadmin/gs1/fachpublikationen/GPC_Development_and_Implementation_Guide_8.0.pdf) [V-perplexity]
- GDSN (modelo de intercambio de trade items) incluye GTIN, marca, nombre funcional, variante, país de origen, **contenido neto y unidad de medida**; el **código de Brick GPC es obligatorio** en el mensaje de trade item — [GDSN Trade Item Implementation Guide 3.1](https://www.gs1.org/docs/gdsn/3.1/GDSN_Trade_Item_Implementation_Guide.pdf) [V-perplexity]
- Akeneo: *families* = plantilla de atributos del producto; requeridos por canal/locale → "completeness"; *family variants* con **hasta 2 ejes** (p.ej. color y talle), atributos compartidos en el modelo y los del eje en la variante; atributo *measurement* con *measurement families* y conversión de unidades — Perplexity no devolvió URL oficial de help.akeneo.com [sin verificar con fuente; coincide con conocimiento previo]
- Salsify: modelo de *properties* (string, enumerated, number); plantillas por categoría del retailer con indicador "Required?" — [Salsify Salsisheet docs](https://salsisheets-help.salsify.com/docs/using-the-salsisheet-update-spreadsheet) [V-perplexity]
- Mercado Libre: `GET /categories/{id}/attributes` devuelve atributos con tipo, valores y tags (`required`, `catalog_required`, `conditional_required`, `variation_attribute`, `allow_variations`, `hidden`); `value_type` (`number_unit`, `list`, `string`, `boolean`); `/categories/{id}/attributes/conditional`; `/domains/{domain_id}/technical_specs` (dominio = familia de producto asociada a 1+ categorías); `/sites/{site}/domain_discovery/search?q=` predice categoría desde el título — [ML Attributes](https://developers.mercadolibre.com.ar/en_us/attributes); [ML categorías y publicaciones](https://developers.mercadolibre.com.ar/en_us/categories-and-listings); [Dominios y categorías](https://developers.mercadolibre.com.ar/dominios-y-categorias) [V-perplexity]
- ML: GTIN como atributo + `EMPTY_GTIN_REASON` cuando no hay; catálogo `GET /products/search` por `q` o GTIN, `catalog_product_id`, `buy_box_winner` (null si no hay competencia en el producto de catálogo) — [ML products search](https://developers.mercadolibre.com.ar/en_us/products-search) [V-perplexity]
- VTEX: especificaciones de producto vs de SKU (las de SKU distinguen variantes), grupos de especificaciones configurados por categoría; SKU con **Unit of measure** y **Unit multiplier** (cantidad que representa el SKU; no calcula ni muestra precio por unidad por sí solo) — [VTEX adding/editing SKUs](https://help.vtex.com/en/docs/tutorials/adding-or-editing-skus) [V-perplexity]
- Postgres: patrón recomendado = campos estables en columnas + **JSONB** para atributos ralos por categoría + tablas hijas para identificadores/alias/cross-reference; unicidad `(tenant_id, identifier_type, normalized_value)`; índice GIN para consultas dentro del documento, B-tree por expresión/columna generada para atributos filtrados frecuentes; EAV solo si los atributos deben administrarse/validarse uno a uno (cuesta joins/pivots) — [síntesis Perplexity SIN fuente citada] [sin verificar]

### Inferences
- [sin verificar] Modelo propuesto para BIP (capas):
  1. **Referencia global (sin tenant):** `category_template` (id, padre, mapeo a Google Product Category id / GPC brick / ML domain_id, `attributes` jsonb = lista de {key, tipo, unidad canónica, valores permitidos, rol: identity|variant|descriptive|price_normalizer, requerido, peso de matching}).
  2. **Pool compartido de listings (sin tenant, dedupe de costo de scraping):** `retailer` + `listing` (retailer_id, url canónica, retailer_sku, título, marca, identificadores extraídos, attrs jsonb normalizados según template, imagen) + `listing_price_obs` (listing_id, ts, precio lista, precio venta, promo, stock, precio por unidad calculado). Un listing se scrapea UNA vez aunque lo sigan N tenants.
  3. **Catálogo del tenant:** `tenant_product` (tenant_id, sku propio, marca, template_id, attrs jsonb, segmento) + `tenant_product_identifier` (gtin/mpn/ml_id/retailer_id) + `tenant_competitor_set`, `tenant_segment`.
  4. **Matches por tenant:** `product_match` (tenant_id, tenant_product_id o "producto equivalente" definido por segmento, listing_id, tipo exact|variant|equivalent|private_label, score, método, estado aprobado/rechazado, evidencia jsonb). Los matches exact por GTIN pueden compartirse entre tenants (son hechos objetivos); los "equivalentes" son opinión del tenant y quedan privados.
- [sin verificar] Plantillas por categoría como datos (no código) permiten sumar un cliente de una categoría nueva sin deploy; se pueden sembrar desde los atributos de ML (`/categories/{id}/attributes`, ya en español y AR) y mapear a Google Product Taxonomy para portabilidad.
- [sin verificar] Variantes: usar 2 niveles como Akeneo/Google (grupo = estilo/modelo; variante = talle/color/capacidad), con el precio observado a nivel variante cuando el retailer lo expone.

### Gaps
- No obtuve docs oficiales de Akeneo ni de modelos internos de Profitero/NIQ/DataWeave (propietarios).
- La recomendación JSONB vs EAV no tiene fuente citada (Perplexity no devolvió la de PostgreSQL); conviene respaldar con la doc de PostgreSQL de GIN/jsonb.
- No encontré evidencia pública de cómo los vendors comparten el pool de listings entre clientes (es inferencia de arquitectura).

## 3. ¿Sirven los atributos de Google Merchant Center (y schema.org) como estándar de facto multicategoría?

### Takeaway
Sí, como "mínimo común denominador": Google Merchant Center define identificadores (gtin, mpn, brand, identifier_exists), variantes (item_group_id + size/color/gender/age_group/material/pattern/size_system/size_type), packs (multipack, is_bundle) y precio unitario (unit_pricing_measure / unit_pricing_base_measure) para todas las categorías, más Google Product Taxonomy como clasificación; schema.org (Product/ProductGroup/Offer/UnitPriceSpecification) es su equivalente semántico en el HTML de los retailers, útil para scraping. No reemplaza a los atributos específicos de categoría.

### Cited Findings
- `unit_pricing_measure` = medida del producto usada para calcular el precio unitario (ej. `150 floz`); `unit_pricing_base_measure` = denominador (ej. `100 floz`), misma dimensión; opcional salvo que la ley local lo exija. Unidades: peso `mg g kg oz lb`; volumen `ml cl l cbm floz pt qt gal`; longitud `in ft yd cm m`; área `sqm sqft`; por unidad `ct` (también `sheet`, `item`) — [GMC unit_pricing_measure](https://support.google.com/merchants/answer/6324455?hl=en); [GMC unit_pricing_base_measure](https://support.google.com/merchants/answer/6324490) [V-perplexity; support.google.com bloqueado]
- `size` requerido en Apparel & Accessories > Clothing / Shoes; `color`, `gender`, `age_group` requeridos en apparel según reglas; `size_system`, `size_type` opcionales de contexto — [GMC product data specification](https://support.google.com/merchants/answer/7052112?hl=en) [V-perplexity]
- `item_group_id`: mismo valor para todas las variantes, cada variante como ítem propio; requerido en ciertos países (US, UK, Brasil, Francia, Alemania, Japón) cuando las variantes difieren por color, talle, patrón, material, edad, género, size type/system — [GMC item_group_id](https://support.google.com/merchants/answer/14779112?hl=en) [V-perplexity]
- `multipack` = cantidad de productos idénticos agrupados por el comerciante; `is_bundle` = combinación de productos distintos con un producto principal — [GMC spec](https://support.google.com/merchants/answer/7052112?hl=en) [V-perplexity]
- Identificadores: enviar GTIN si existe; si no, MPN + brand; nunca SKU interno; `identifier_exists=no` solo si el fabricante no asignó identificadores — [GMC identifier_exists](https://support.google.com/merchants/answer/6324478?hl=en-GB); [GMC unique product identifiers](https://support.google.com/merchants/answer/160161?hl=en) [V-perplexity]
- Google Product Taxonomy: archivo versionado con IDs numéricos y paths jerárquicos; las fuentes difieren en el conteo (**5.595** categorías, versión 2021-09-21, vs ">6.600") — [lynkpim](https://lynkpim.app/blog/google-product-category-taxonomy); [startwithdata](https://startwithdata.co.uk/insight/google-product-taxonomy/); [webappick](https://webappick.com/google-product-category-taxonomy-guide/) [V-perplexity; fuentes secundarias en conflicto]
- schema.org: `UnitPriceSpecification` con `referenceQuantity`, `unitCode` (códigos UN/CEFACT Rec. 20) y `priceType`; `Product` con `gtin`, `mpn`, `size`, `color`, `hasVariant`; `ProductGroup.variesBy` para las propiedades que varían — [schema.org UnitPriceSpecification](https://schema.org/UnitPriceSpecification); [Product](https://schema.org/Product); [ProductGroup](https://schema.org/ProductGroup) [V-perplexity]

### Inferences
- [sin verificar] BIP puede adoptar los nombres de GMC como "atributos core" de toda plantilla (`gtin, mpn, brand, title, google_product_category, item_group_id, size, color, material, multipack, is_bundle, unit_pricing_measure, unit_pricing_base_measure`) y colgar los específicos de la categoría en el jsonb. Ventaja: muchas marcas ya tienen un feed de Merchant Center → se puede ofrecer "subí tu feed de Google" como forma de cargar el catálogo propio.
- [sin verificar] El JSON-LD schema.org en las PDPs de retailers (VTEX y Mercado Libre suelen exponerlo) es la fuente más barata para extraer gtin/mpn/precio sin parsers por sitio.

### Gaps
- No verifiqué directamente qué retailers argentinos (Frávega, Garbarino, Carrefour, Coto, Jumbo) publican gtin en JSON-LD.
- Conteo oficial actual de Google Product Taxonomy no confirmado (requiere bajar el archivo oficial).

## 4. Normalización de precio comparable (unidad, packs, bundles, variantes) y regulación (UE / Argentina)

### Takeaway
En Argentina la obligación vigente es la **Resolución 4/2025** de la Secretaría de Industria y Comercio (en vigor desde el 18-ene-2025): precio por unidad de medida en kg, l, m, m², m³ (o la unidad habitual del producto), por 10 g/10 ml en envases ≤50 g/50 ml, también en canales virtuales. La Ley 27.545 (Góndolas) exigía precio por unidad pero fue **derogada por el DNU 70/2023**. La UE (Directiva 98/6/CE) define lo mismo con kg/l/m/m²/m³ y precio final con impuestos. Esto da a BIP una base legal y un dato que los retailers deberían publicar.

### Cited Findings
- Res. 4/2025 (SIC): en vigor desde **18-ene-2025**; precio unitario en tipografía menor que el precio final; unidad de referencia = precio de **1 kg, 1 l, 1 m, 1 m² o 1 m³** o de la unidad habitual del producto; envases de **≤50 g o ≤50 ml → precio por 10 g o 10 ml**; no exigible si es idéntico al precio de venta; es precio final al consumidor — [Res. 4/2025 texto](https://www.argentina.gob.ar/normativa/nacional/norma-408455/texto); [PDF exhibición de precios](https://www.argentina.gob.ar/sites/default/files/exhibicion_de_precios_resolucion_4_2025.pdf) [V-perplexity; argentina.gob.ar bloqueado]
- Aplica a ofertas presenciales y **virtuales**; el gobierno lo comunicó junto con la posibilidad de exhibir precios en dólares/moneda extranjera — [noticia argentina.gob.ar](https://www.argentina.gob.ar/noticias/los-precios-podran-exhibirse-tambien-en-dolares-o-en-otra-moneda-extranjera); [FAQ exhibición de precios (abr-2025)](https://www.argentina.gob.ar/sites/default/files/2025/04/preguntas_frecuentes_exhibicion_de_precios.pdf) [V-perplexity]
- Ley 27.545 (Góndolas, reglamentada por Decreto 991/2020) exigía precio por unidad de medida; **derogada por art. 7 del DNU 70/2023** ("Derógase la Ley N° 27.545"), vigente desde 30-dic-2023 — [Ley 27.545](https://www.argentina.gob.ar/normativa/nacional/ley-27545-335538); [DNU 70/2023 texto](https://www.argentina.gob.ar/normativa/nacional/decreto-70-2023-395521/texto); [Allende & Brea](https://allende.com/reforma-argentina/desregulacion-economica/derogacion-de-la-ley-de-abastecimiento-la-ley-de-gondolas-y-la-ley-del-observatorio-de-precios-12-27-2023/) [V-perplexity]
- Octubre 2026: hay avanzada opositora en Diputados contra el DNU 70/2023 (si se rechazara, volverían normas derogadas) — [TN 6-oct-2026](https://tn.com.ar/politica/2026/10/06/el-gobierno-defendio-el-dnu-7023-frente-a-la-avanzada-opositora-en-diputados-las-normas-que-volverian-atras/) [V-perplexity; no leído; estado actual sin verificar]
- No se encontró una "Res. 1/2024" sobre precio unitario (el resultado con ese número era de obras públicas CABA); no se verificó el rol actual de la Res. 7/2002 — [Perplexity] [sin verificar]
- UE Directiva 98/6/CE: precio unitario = precio final (IVA incluido) por **1 kg, 1 l, 1 m, 1 m² o 1 m³** u otra unidad habitual en el Estado miembro; no exigible si coincide con el precio de venta; a granel solo precio unitario; los Estados pueden exceptuar productos donde no sea útil o confunda — [EUR-Lex 98/6/EC consolidada](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:01998L0006-20220528) [V-perplexity]
- Omnibus (UE) 2019/2161 agregó art. 6a: al anunciar rebaja, mostrar el "precio anterior" = el más bajo de los **30 días previos**; la guía de la Comisión (2021, actualizada 2024) dice que aplica también si la rebaja es sobre el precio unitario — [Guía Comisión](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:52021XC1229(06)&from=EN) [V-perplexity]
- GMC: `multipack` (idénticos) vs `is_bundle` (distintos) y `unit_pricing_*` permiten normalizar — ver §3.
- ML documenta atributos de venta a granel como `SALE_UNIT` y `YIELD_OF_SALES_UNIT` (pisos/revestimientos, rendimiento por unidad de venta); `UNITS_PER_PACK`, `SALE_FORMAT`, `NET_WEIGHT` existen según categoría, no universales — [ML atributos](https://developers.mercadolibre.com.ar/atributos) [V-perplexity]
- DataWeave compara precios "unit-normalized" con unidades normalizadas — [DataWeave pricing intelligence](https://dataweave.com/us/pricing-intelligence) [V-perplexity]

### Inferences
- [sin verificar] Regla de normalización genérica para BIP, configurable por plantilla:
  `precio_comparable = precio_efectivo / (contenido_neto_por_unidad × unidades_por_pack) × base`, con `base` y dimensión definidas en la plantilla: peso/volumen (100 g/1 kg, 100 ml/1 l), área (m² – pisos, telas), longitud (m – cables), conteo (unidad/lavado/pañal/cápsula – "ct"), y **"por unidad" = 1** para bienes durables (electro, muebles, electrónica, moda), donde la normalización relevante NO es por medida sino por **variante equivalente** y por **atributo de desempeño** (p.ej. $/kg de capacidad en lavarropas, $/litro en heladeras, $/pulgada en TV) — este último es "precio por atributo", decisión del tenant, no regulatorio.
- [sin verificar] Precio efectivo: separar precio de lista, precio de venta, promo condicionada (2x1, 2da unidad 70%, cuotas sin interés, descuento bancario) — en Argentina las cuotas y promos bancarias pesan mucho; almacenar como componentes, no solo un número.
- [sin verificar] Moda: guardar precio a nivel variante (talle×color) cuando el sitio lo expone y agregar a nivel estilo con min/mediana + disponibilidad de talles (% curva disponible); el markdown se detecta como evento (cambio de precio de venta con lista constante).
- [sin verificar] Bundles: no comparar contra producto simple salvo que la plantilla defina la descomposición; marcarlos `is_bundle` y excluirlos del índice por defecto.
- [sin verificar] Como la Res. 4/2025 obliga a mostrar el precio unitario también online, BIP puede usar el precio unitario publicado por el retailer como chequeo cruzado de su propio cálculo (y detectar incumplimientos).

### Gaps
- No leí el texto oficial de la Res. 4/2025 (dominio bloqueado); los detalles (≤50 g → 10 g, letra menor) vienen de la síntesis de Perplexity citando argentina.gob.ar. Validar con el Boletín Oficial antes de usarlo en producto/comunicación.
- No verificado si la Res. 7/2002 sigue vigente o fue reemplazada por la 4/2025.
- No encontré evidencia de un fitness check de la UE sobre precio unitario 2023–2025.

## 5. Diferencias de matching por categoría (identificadores, private label, long tail) y definición de "producto equivalente"

### Takeaway
El identificador fuerte cambia por categoría: GTIN/EAN en FMCG y libros (ISBN-13), marca+MPN/modelo en electrónica y electrodomésticos (cuidado con variantes regionales), números OE/interchange con estándares ACES/PIES en autopartes, GTIN + registro ANMAT (+ bases Kairos/Alfabeta) en farma AR, y casi nada público en moda y muebles (estilo, imagen, atributos). Marcas propias y frescos rompen el GTIN incluso en grocery. "Equivalente" debe ser una definición explícita por atributos (segmento) y no un match de identidad.

### Cited Findings
- Grocery: UPC/PLU inconsistentes en sitios y UPC de marca propia que no mapean entre retailers — [DataWeave](https://dataweave.com/blog/how-ai-can-drive-superior-data-quality-and-coverage-in-competitive-insights-for-retailers-and-brands) [V-perplexity]
- Competera: marca propia y frescos sin código de barras estándar requieren matching por similitud + verificación humana — [Competera grocery](https://competera.ai/solutions/by-industry/grocery-retail) [V-perplexity]
- Autopartes: ACES (fitment vehicular) y PIES (descripción/atributos), apoyados en bases de referencia VCdb, PCdb, PAdb; match por marca + número de parte/OE, con supersesiones e intercambios como relaciones tipadas — [Auto Care Association data standards](https://www.autocare.org/data-standards); [SPS Commerce primer](https://www.spscommerce.com/community/articles/aces-and-pies-explained-a-primer-on-automotive-catalog-data) [V-perplexity]
- Farma AR: la trazabilidad ANMAT usa GTIN + serie + lote + vencimiento; ANMAT menciona la eliminación del troquel para medicamentos alcanzados y que la norma citada no exige EAN per se — [Res. ANMAT 1444/2013](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1444-2013-209753/texto); [FAQ trazabilidad ANMAT](https://www.argentina.gob.ar/anmat/sistema-nacional-de-trazabilidad/preguntas-frecuentes) [V-perplexity]
- GMC: apparel requiere marca y GTIN cuando existe; sin GTIN → MPN + brand — [GMC identifiers](https://support.google.com/merchants/answer/160161?hl=en) [V-perplexity]
- ML: catálogo por GTIN o búsqueda; `catalog_required` para asociar a producto de catálogo; un error de match "productiza" mal la publicación — [ML products search](https://developers.mercadolibre.com.ar/en_us/products-search) [V-perplexity]
- Intelligence Node: el "similar match" usa rango de precio y similitud visual — [IN guide PDF](https://info.intelligencenode.com/hubfs/ebooks/2022/A-Guide-to-AI-driven-Product-Matching-2022.pdf) [V-perplexity]
- WDC Products: la mayor dificultad está en "corner cases" (productos muy parecidos pero distintos y viceversa) y en productos no vistos — [arXiv 2301.09521](https://arxiv.org/abs/2301.09521) [V-perplexity]

### Inferences
- [sin verificar] Matriz de estrategia por familia (para la plantilla):
  | Familia | Clave fuerte | Clave secundaria | Equivalente típico |
  |---|---|---|---|
  | FMCG/alimentos/bebidas/limpieza | GTIN/EAN | marca + contenido neto + variedad/sabor | mismo segmento + rango de tamaño, $/kg o $/l |
  | Beauty/cuidado personal | GTIN | marca + línea + ml/g + tono | misma función + ml, $/100 ml |
  | Electrónica | marca + MPN/modelo | GTIN; capacidad, tamaño pantalla, región | mismo tamaño/spec, $/pulgada o $/GB |
  | Electrodomésticos (ej. Drean) | marca + modelo | GTIN; capacidad kg/l, carga frontal/superior, eficiencia | misma capacidad/tipo, $/kg o $/l |
  | Moda/calzado | estilo/código del retailer | imagen + atributos (tela, fit, silueta) | mismo tipo de prenda + material + rango de precio |
  | Muebles/hogar | marca + modelo (si hay) | dimensiones, material, terminación | mismas medidas ± tolerancia |
  | Autopartes | número OE/parte + marca | fitment (ACES) | intercambio/cross-reference |
  | Farma/OTC | GTIN / registro ANMAT | droga + concentración + presentación | misma droga y dosis (genérico vs marca) |
  | Juguetes/mascotas | GTIN | marca + edad/peso + contenido | mismo segmento, $/kg (alimento mascota) |
- [sin verificar] "Producto equivalente" en BIP = regla del tenant sobre atributos de la plantilla (igualdad en atributos "identity" del segmento, tolerancia en numéricos, p.ej. capacidad ±10%), separada de "mismo producto". El índice de precios por marca usa equivalentes; el monitoreo de cumplimiento (MAP/precio sugerido) usa mismo producto.

### Gaps
- Sin cifras públicas de precisión para autopartes, muebles, farma, juguetes, mascotas.
- No verifiqué disponibilidad de Kairos/Alfabeta vía API ni sus condiciones de licencia.
- No hay evidencia pública de cómo los vendors definen "equivalente" a nivel de configuración de usuario.

## 6. Cómo las plataformas multicategoría permiten al cliente configurar (catálogo, competidores, segmentos, pesos, canasta del índice)

### Takeaway
La documentación pública es escasa: DataWeave muestra alta de SKUs/sitios, "weighted inputs", filtros por marca/retailer/categoría y aprobación/rechazo de matches; NIQ ancla a un referencial UPC propio; Competera documenta un índice de precios como promedio de ratios sobre pares con precio y stock en ambos lados. No existe una fórmula estándar de índice: hay que elegir y documentar dirección, agregación (aritmética/geométrica/Laspeyres), pesos y política de faltantes, y siempre reportar cobertura.

### Cited Findings
- DataWeave: clientes agregan SKUs o sitios y personalizan el tracking con "weighted inputs"; filtros por marcas, retailers, categorías; aprobación de matches — [DataWeave DSA](https://dataweave.com/us/digital-shelf-analytics); [pricing intelligence](https://dataweave.com/us/pricing-intelligence) [V-perplexity]
- Competera: "pricing pair" = producto con precio disponible en tu tienda y en el competidor; índice = ratio % por par usando pares en stock, promedio por producto, luego promedio de productos (no ponderado ni geométrico declarado) — [Competera price index tutorials](https://competera.ai/resources/use-cases/price-index-tutorials) [V-perplexity]
- Teoría de índices: Carli (media aritmética de relativos), Jevons (media geométrica), Laspeyres (canasta fija de cantidades base); imputar el movimiento de un faltante con los demás ítems equivale a excluirlo en ambos períodos (muestra pareada) — [ABS CPI Concepts 2025 – price index theory](https://www.abs.gov.au/statistics/detailed-methodology-information/concepts-sources-methods/consumer-price-index-concepts-sources-and-methods/2025/price-index-theory); [Statistics Canada CPI ch.6](https://www150.statcan.gc.ca/n1/pub/62-553-x/2023001/chap-6-eng.htm) [V-perplexity]
- CBS (Países Bajos): ponderación por participación de facturación + agregación Jevons e imputación de faltantes con Jevons de ítems pareados (scanner data) — [CBS scanner data Dutch CPI](https://www.cbs.nl/-/media/imported/onze-diensten/methoden/dataverzameling/korte-onderzoeksbeschrijvingen/documents/2010/21/2010-scanner-data-dutch-cpi.pdf?sc_lang=en-gb) [V-perplexity]
- Fórmulas (orientación propio/competidor, 100 = paridad): `r_i = 100·p_i/c_i`; ponderado `Σw_i r_i / Σw_i`; geométrico ponderado `100·exp(Σw_i ln(p_i/c_i)/Σw_i)`; Laspeyres `100·Σq_i p_i / Σq_i c_i` — [síntesis Perplexity basada en ABS/StatCan] [V-perplexity]
- Profitero, Salsify DSA, Stackline, Prisync, Omnia, Price2Spy, Minderest, Pricefx, Revionics: no se encontró documentación pública verificable de configuración de canasta/pesos/catálogo — [Perplexity: ausencia] [sin verificar]

### Inferences
- [sin verificar] Onboarding de un tenant BIP (agnóstico): (1) elegir plantilla(s) de categoría (o crearla desde atributos ML); (2) subir catálogo propio: CSV/Excel con sku, marca, gtin/ean, mpn/modelo, título, atributos, precio sugerido — o importar feed de Google Merchant Center / catálogo ML / VTEX; (3) set de competidores = marcas + retailers (+ sellers ML); (4) segmentos = filtros sobre atributos de la plantilla (p.ej. "Lavarropas frontal 8–9 kg"); (5) pesos de atributos para el matching de equivalentes; (6) canasta del índice: SKUs/segmentos con peso (por defecto igual; opcional ventas/facturación del tenant, que BIP ya tiene en Drean vía GfK/facturación).
- [sin verificar] Índice por defecto recomendado: Jevons (geométrico) sobre pares matcheados del mismo día, ponderable por facturación del tenant, con "cobertura de canasta" visible y sin imputar (o carry-forward ≤7 días, declarado). El geométrico es simétrico ante la dirección del ratio, lo que evita sesgos de Carli.
- [sin verificar] En el pool compartido, la canasta y los pesos son del tenant; las observaciones de precio son globales → el costo de scraping se amortiza entre clientes de la misma categoría/retailer.

### Gaps
- No encontré documentación pública de Profitero/NIQ sobre configuración de competitive sets ni fórmulas de índice.
- No hay benchmark público de cuántos clientes de un vendor comparten listings (dato propietario).
