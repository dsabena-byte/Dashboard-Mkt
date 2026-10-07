# Matching / unificación de SKU entre retailers para monitoreo de precios (entity resolution de listados)

> Notas de investigación (7-oct-2026). Contenido en español; estructura fija Takeaway / Cited Findings / Inferences / Gaps.
> Incluye una **prueba propia con datos reales** (APIs públicas VTEX de retailers argentinos, 7-oct-2026) marcada como [verificado: curl].

## 1. Identificadores: GTIN/EAN/UPC, MPN/modelo, SKU del retailer, ids de marketplace — disponibilidad y confiabilidad

### Takeaway
El EAN (GTIN-13) es la llave más fuerte y, en retailers argentinos sobre VTEX, suele estar expuesto públicamente en `items[].ean`; pero no siempre (Frávega no lo expone en ítems de sellers 3P) y el GTIN no es infalible (≈2–14% de nombres inconsistentes por GTIN en fuentes online). Por eso se usa en cascada: EAN validado → código de modelo normalizado → atributos → texto/IA, con revisión humana en la zona gris.

### Cited Findings
- schema.org `Product` define `gtin` (8/12/13/14 dígitos, con dígito verificador GS1 válido), `gtin13` (= EAN/UCC-13; un UPC de 12 dígitos pasa a GTIN-13 anteponiendo un 0), `mpn` (Manufacturer Part Number) y `sku`; recomienda proveer "strong product identifiers via the gtin8/gtin13/gtin14 and mpn properties" — [schema.org/Product](https://schema.org/Product); [schema.org wiki: How to add Product Identifiers](https://github.com/schemaorg/schemaorg/wiki/How-to-add-Product-Identifiers)
- Google Merchant Center acepta `gtin8/12/13/14`/`gtin` y `mpn` en structured data; los GTIN "must be the correct length and contain the correct check digit"; recomienda JSON-LD — [Google Merchant Center: structured data attributes](https://support.google.com/merchants/answer/6386198?hl=en-GB)
- VTEX: el SKU tiene "Alternate IDs" `RefId` y `EAN`; para activar un SKU debe tener al menos uno de los dos. La Catalog API tiene endpoints "Get SKU by EAN" y "Get SKU by RefId" — [VTEX: Managing SKUs](https://developers.vtex.com/docs/guides/managing-skus); [VTEX Catalog API](https://developers.vtex.com/docs/api-reference/catalog-api)
- VTEX orderForm documenta `refId` (SKU reference ID) y `ean` ("the SKU barcode, as registered in the SKU registration"), ambos "String or null" (pueden faltar) — [VTEX orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields)
- Toda tienda VTEX expone una API pública sin autenticación `/api/catalog_system/pub/products/search` (`ft=`, `fq=`, ventana máx. 50 ítems, HTTP 206 normal en paginación); estructura producto → `items[]` (SKUs) → `sellers[]` → `commertialOffer` (Price, ListPrice, AvailableQuantity) — [TabNews: API pública de catálogo VTEX](https://www.tabnews.com.br/antoniorincon/a-api-publica-de-catalogo-da-vtex-que-quase-ninguem-usa); [VTEX Legacy Search API](https://developers.vtex.com/docs/api-reference/search-api). Se puede filtrar por EAN con `fq=alternateIds_Ean:<ean>` — [vtex-utils (GitHub)](https://github.com/felipe-ssilva/vtex-utils)
- **Prueba propia [verificado: curl a la API pública VTEX, 7-oct-2026, búsqueda "lavarropas drean", 3 primeros resultados por tienda]:**
  - Carrefour AR: `ean` presente en los 3 (p.ej. LSDR0680TB0 → 7795473038065); `RefId` heterogéneo: a veces = EAN, a veces código del seller 3P (`66460005583-DMF` de "Demelf", `LRDR56SB0-DRN` de "Drean SA"); hay especificación "EAN" y "Modelo" en algunos productos; sellers 3P conviven con Carrefour en el mismo SKU.
  - Cetrogar: `ean` presente (3/3); `RefId` = código interno (`LB3957`); especificaciones "Modelo", "Capacidad de lavado", "Centrifugado", "Color", "Tecnología Inverter".
  - On City y Naldo: `ean` presente (3/3); `RefId` = id interno numérico; especificaciones "Modelo", "Capacidad", "Color", "Centrifugado RPM", "Inverter".
  - **Frávega: `ean` VACÍO en los 3 ítems**, `RefId` = `fravegasellerprod1191-…` (seller 3P "Fussetti"), y el título no trae el código de modelo ("Lavarropas Drean 6,5kg 800rpm") → ahí solo queda matching por atributos/texto/imagen.
  - Mismo EAN en dos retailers = match trivial: LSDR0680TB0 → 7795473038065 en Carrefour y Naldo; LRDR57SB0 → 7795473037846 en On City y Naldo.
  - Caso borde observado: Cetrogar lista "LRDR57SB" con EAN 7795473036979 mientras On City/Naldo listan "LRDR57SB0" con EAN 7795473037846 → mismo nombre comercial, EAN distinto. Causa sin verificar (probable revisión de modelo con sufijo "0" = GTIN nuevo, o error de carga).
  - Musimundo (301) y Megatone (404) no respondieron en la ruta VTEX (no son VTEX o redirigen); no se probó JSON-LD de esas tiendas.
- Mercado Libre: las publicaciones (`MLA…` item id) pueden asociarse a un producto de catálogo (`catalog_product_id`, p.ej. `MLA6005934`) cuya ficha la mantiene ML; el seller es responsable de que coincida — [ML Developers: Catalog listing](https://developers.mercadolibre.com.mx/en_us/api-docs/catalog-listing). La API de ítems expone `catalog_listing` y `catalog_product_id` — [api.mercadolibre.com/items](https://api.mercadolibre.com/items/). Existe filtro `missing_product_identifiers` (ítems sin GTIN cargado) — [ML Items & Searches](https://developers.mercadolivre.com.br/en_us/api-docs/items-and-searches). Prueba propia: `GET /sites/MLA/search` sin token devolvió **403 forbidden** (7-oct-2026) [verificado: curl].
- GS1: un GTIN asignado "MUST NOT be assigned to another item"; se requiere GTIN nuevo para productos nuevos y para cambios que el consumidor deba distinguir (principios rectores), cambios de contenido neto, cambios >20% en dimensión/peso, cambio de marca primaria, y cambios en assortments/bundles predefinidos — [GS1 Sweden: GTIN Management Rules](https://gs1.se/en/identify/global-trade-item-number-gtin/gtin-management-rules/); [GS1 UK: GTIN management handbook](https://www.gs1uk.org/sites/default/files/The_GTIN_management_handbook.pdf); [GS1 GTIN Decision-Support Tool](https://www.gs1.org/1/gtinrules/en/decision-support). Un color distinto suele implicar GTIN distinto (ej. GS1 de construcción: "A paint that is offered in a different shade of white" = producto nuevo) — [GS1 GTIN Management Guideline for Construction Products](https://www.gs1.org/standards/gtin-management-guideline-construction-products/current-standard)
- Confiabilidad del GTIN en la web: ETH Zürich consultó 10 fuentes online para 81.782 GTINs: 48,56% devolvió nombres distintos y entre **3,2% y 13,9% de los GTIN tenían nombres que describen productos diferentes** — [The not so unique GTIN (ETH/Auto-ID Labs)](https://cocoa.ethz.ch/downloads/2013/07/1437_not_so_unique_GTIN.pdf). Otro estudio estimó **~1,8–2,2% de nombres de producto incorrectos** por GTIN vs fuente autoritativa — [ETH: Detecting incorrect product names](https://cocoa.ethz.ch/downloads/2014/07/1765_incorrect%20product%20data.pdf). (Datos 2010–2014; no encontré medición más reciente.)
- GS1 UK "Data Crunch": datos de retailers inconsistentes en >80% de los casos; >60% de un millón de registros eran duplicados de GTIN dentro de retailers; en 4 de 5 casos el dato del proveedor era más exacto que el del retailer — [GS1 UK Data Crunch Report (Cranfield)](https://dspace.lib.cranfield.ac.uk/server/api/core/bitstreams/c62030d8-e86f-4aee-8469-83cdaa72aed2/content)
- Price2Spy recomienda Automatch por identificadores estandarizados "like EANs, MPNs, UPCs, or ASINs" cuando son >1000 productos y "competitors' websites are searchable via unique product identifiers" — [Price2Spy Automatch](https://www.price2spy.com/automatch.html)
- DataWeave: "UPC and GTIN codes only take you so far"; donde hay identificadores limpios el matching exacto supera 99%, en apparel/marca propia cae a 40–60% de match rate — [DataWeave: Pricing Intelligence in the Age of AI-Driven Commerce](https://dataweave.com/blog/pricing-intelligence-in-the-age-of-ai-driven-commerce-price-now-drives-discoverability-not-just-conversion)

### Inferences
- Para línea blanca en AR, el EAN es la llave primaria práctica para retailers VTEX "1P" (Carrefour, Cetrogar, On City, Naldo en la muestra). El código de modelo del fabricante (p.ej. `LCFDR0814SG`) es la segunda llave: aparece en títulos y/o en la especificación "Modelo" en la mayoría, pero con variaciones de mayúsculas y sufijos.
- El `RefId`/SKU del retailer **no sirve para cruzar tiendas** (es interno o del seller 3P); sirve como clave estable del listado dentro de una tienda.
- Hay que validar dígito verificador GS1 y el prefijo de la marca (Drean usa 779547303xxxx en la muestra) antes de confiar en un EAN, y desconfiar si un mismo EAN aparece con capacidad/color distintos.
- Marketplaces (Frávega 3P, ML) son la zona de menor calidad de identificadores.

### Gaps
- No medí el % de cobertura de EAN sobre todo el catálogo de cada retailer (solo 3 productos por tienda) ni JSON-LD `gtin13/mpn` en tiendas no-VTEX (Frávega HTML no devolvió JSON-LD con gtin/mpn en la página de listado; no probé páginas de producto).
- No verifiqué si la API pública de ML expone GTIN de un ítem sin token (búsqueda dio 403).
- No encontré estudios 2023–2026 que midan tasas de GTIN erróneos en e-commerce de electrodomésticos.

## 2. Enfoques de matching y precisión/recall reportados (vendors y academia)

### Takeaway
La práctica de la industria es una cascada multiseñal (identificador → atributos clave → texto → imagen) con umbrales y revisión humana; los vendors prometen "99%" pero lo definen distinto (precisión sobre matches exactos). En academia, LLMs zero-shot (GPT-4/4o) llegan a ~89–96% F1 en benchmarks de productos sin entrenamiento, y fine-tunear un modelo chico (GPT-4o-mini) iguala a GPT-4 zero-shot.

### Cited Findings
**Vendors**
- Intelligence Node: SLA contractual "Matching Accuracy 99%: If 100 SKUs are matched, only 1 can be a false positive (applies to exact matches)" y "Recall Rate 2%: If 50 out of 100 SKUs are matched, the remaining 50 unmatched SKUs will not have more than 1 false negative"; tres tipos: exact, similar (private label), variant; atributos "mandatory" vs "non-mandatory"; repositorio >1.200M productos — [Intelligence Node Product Matching](https://www.intelligencenode.com/solutions/product-matching/)
- Intelligence Node (ebook): enfoque de tres patas: comparación de atributos clave, similitud de imagen, y texto (palabra por palabra + BERT afinado para similitud semántica); los casos de baja probabilidad los evalúan analistas; matches aceptados alimentan un loop de reentrenamiento. "Variant match" = mismo producto con distinto pack/cantidad/color/talle con precio unitario; "Similar match" exige atributos + rango de precio similar + confirmación visual — [Intelligence Node: A Guide to AI-driven Product Matching (2022)](https://info.intelligencenode.com/hubfs/ebooks/2022/A-Guide-to-AI-driven-Product-Matching-2022.pdf)
- DataWeave: matching exact, similar, variant, substitute, competitor y basket, con criterios configurables por vertical; extracción y normalización de atributos de títulos (marca, familia, capacidad, color…); imágenes con features visuales y embeddings CLIP sobre >100M imágenes; "close to 90% of matches are auto-processed", lo ambiguo va a revisores humanos (Veracite); >40M pares verificados como datos de entrenamiento; reporta match rate, miss rate y accuracy; "99%-plus accuracy with under 1% misses" — [DataWeave blog 2026](https://dataweave.com/blog/pricing-intelligence-in-the-age-of-ai-driven-commerce-price-now-drives-discoverability-not-just-conversion); [DataWeave Product Matching](https://dataweave.com/us/product-matching). Permite aprobar/desaprobar matches desde el dashboard — [DataWeave Pricing Intelligence](https://dataweave.com/us/pricing-intelligence)
- Price2Spy: tres modos — Automatch (identificadores; reglas definidas con el cliente; corre continuo para detectar cuando un competidor agrega el producto; aprobación configurable automática/manual/híbrida), Manual (equipo humano revisa nombre, specs técnicas e imágenes) e Hybrid (ML propone candidatos, humano decide); considera variaciones de nombre ("Galaxy S24 Onyx Black" vs "Galaxy S24 Black"), criterios lingüísticos, precio y color; manual se vuelve caro >10.000 productos — [Price2Spy Automatch](https://www.price2spy.com/automatch.html); [Price2Spy Product matching](https://www.price2spy.com/product-matching-obsolete.html). Declara "100% matching accuracy" en su servicio con verificación humana — [Price2Spy Product Matching Service](https://www.price2spy.com/product-matching-service.html). Un comparativo de un competidor (Dealavo) cita 99,5% para Automatch — [Dealavo 2026](https://dealavo.com/en/competitor-price-analysis-tools-comparison-for-sellers-2026/) (fuente con conflicto de interés).
- Price2Spy: "the first and foremost rule of product matching is to minimize false positives"; desaconseja matchear vía Google Search o marketplaces — [Price2Spy blog](https://www.price2spy.com/blog/product-matching-accuracy-matters/)
- Advertencia independiente-ish: los "99%" de vendors "are not measured the same way" (precisión vs recall) y son garantías del vendor, no benchmarks independientes — [Ficstar 2026](https://www.ficstar.com/best-price-intelligence-services-2026). Matching automático por nombre/atributos sin QA da "single-digit percentage errors" — [Dealavo](https://dealavo.com/en/competitor-price-analysis-tools-comparison-for-sellers-2026/)
- Minderest: no encontré documentación pública con métricas de matching (gap).

**Academia**
- Ditto (VLDB 2021, transformers fine-tuneados): F1 Abt-Buy 89,33, Amazon-Google 75,58, Walmart-Amazon 86,76; hasta +29 F1 sobre el SOTA previo; logra el SOTA previo con la mitad de datos etiquetados — [Li et al., PVLDB 14(1)](https://www.vldb.org/pvldb/vol14/p50-li.pdf)
- Contrastive learning (R-SupCon): Abt-Buy 94,29 F1, Amazon-Google 79,28 — [Peeters & Bizer, Supervised Contrastive Learning for Product Matching](https://d-nb.info/1266490159/34)
- WDC Products (EDBT 2024): benchmark con tres dimensiones (corner cases, entidades no vistas, tamaño de entrenamiento); "all matching systems struggle with unseen entities" — [arXiv 2301.09521](https://arxiv.org/abs/2301.09521)
- LLMs (Peeters, Steiner, Bizer, EDBT 2025): GPT-4 zero-shot ≥89% F1 en 5 de 6 datasets; supera al mejor PLM en 3/6; en transferencia a datasets no vistos GPT-4 supera al mejor PLM transferido por 40–68% F1; fine-tuning de GPT-mini rivaliza con GPT-4; modelos sensibles a la redacción del prompt; Llama 3.1 fine-tuneado ≈ GPT-4 en 4/6 — [Entity Matching using LLMs, EDBT 2025](https://openproceedings.org/2025/conf/edbt/paper-81.pdf); [slides](https://www.uni-mannheim.de/media/Einrichtungen/dws/DWS_News/Documents/Peeters-Entity-Matching-using-LLMs-EDBT2025.pdf). Cifras resumen: GPT-4 Abt-Buy 95,78% F1, WDC Products 91,92% F1 — [Uni Mannheim, Identity Resolution HWS2025](https://www.uni-mannheim.de/media/Einrichtungen/dws/Files_Teaching/Web_Data_Integration/HWS2025/WDI05-IdentityResolution-HWS2025.pdf)
- "Match, Compare, or Select?" (2024): pedir al LLM que **elija entre varios candidatos** (selecting) supera a la clasificación binaria por par (81,60 vs 64,02 F1 promedio con GPT-3.5); el combinado ComEM 86,42 F1 con GPT-4o-mini y a menor costo — [arXiv 2405.16884](https://arxiv.org/pdf/2405.16884v2); [alphaXiv](https://www.alphaxiv.org/abs/2405.16884)
- Destilación (2026): etiquetar pares con un LLM "teacher" y entrenar un modelo chico (Ditto/RoBERTa) iguala al entrenamiento con benchmark en 7 de 8 tareas, infiere 34–459× más rápido; pero con muchos productos no vistos conviene usar el LLM directo; product matching lidia con "product variants, accessories, and kits" — [arXiv 2606.28823](https://arxiv.org/html/2606.28823v2)
- LLMs también extraen/normalizan atributos de títulos: GPT-4 91% F1 en WDC-PAVE — [Brinkmann et al., ADBIS 2024 (perfil Bizer)](https://www.linkedin.com/in/chrisbizer)
- Pipeline estándar de ER: normalizar → blocking (generar candidatos) → scoring → decidir (match/review/no-match) → clustering con ids estables; "deterministic-first waterfall": exacto por identificadores fuertes validados primero, probabilístico en el resto, humano en la banda incierta — [Entity Resolution pattern (citing Splink)](https://erikevenson.github.io/architect/patterns/entity-resolution/)

### Inferences
- Para línea blanca (catálogo de marca acotado: cientos de SKUs por marca, no millones), el grueso se resuelve con EAN + código de modelo normalizado; IA (LLM) solo para el residuo (listados sin EAN ni modelo, títulos ambiguos) y para extraer atributos (kg, rpm, carga frontal/superior, inverter, color).
- El formato "selecting" (dar al LLM el listado + top-k candidatos del catálogo maestro y pedir cuál es o "ninguno") encaja directo con un catálogo maestro y es más preciso que preguntar par por par.
- Las cifras de vendors no son comparables entre sí ni con F1 académico; pedir siempre precisión y recall por separado y sobre muestra auditada.

### Gaps
- No hay benchmark público específico de electrodomésticos; Abt-Buy (electrónica) es el más cercano.
- Minderest: sin métricas públicas encontradas. Image similarity para línea blanca: sin estudios específicos (los productos blancos se parecen mucho entre sí; inferencia sin verificar de que la imagen aporta poco para distinguir modelos).

## 3. Variantes y casi-equivalentes: color, sufijos, bundles, reacondicionados, sellers 3P, kits; "exact" vs "comparable"

### Takeaway
Los líderes separan explícitamente tipos de match (exact / variant / similar o comparable / substitute / private label) con lógica y umbrales distintos; para un índice de precios por segmento hace falta además una "equivalencia" definida por atributos obligatorios (p.ej. lavarropas carga frontal 8 kg inverter 1400 rpm), análoga al "comparable substitution" de las estadísticas de precios.

### Cited Findings
- Intelligence Node: exact (mismo producto, misma marca), variant (mismo producto con variación de pack, cantidad, color, talle; normaliza a precio unitario), similar (atributos + rango de precio + confirmación visual) — [Intelligence Node ebook](https://info.intelligencenode.com/hubfs/ebooks/2022/A-Guide-to-AI-driven-Product-Matching-2022.pdf); atributos "mandatory" vs "non-mandatory" según el cliente — [Intelligence Node](https://www.intelligencenode.com/solutions/product-matching/)
- DataWeave: tipos exact, similar, variant, substitute, competitor, basket con "similarity criteria and tolerance thresholds configurable by vertical"; soporta "brand equivalence mapping" y ponderación de atributos por categoría — [DataWeave blog](https://dataweave.com/blog/pricing-intelligence-in-the-age-of-ai-driven-commerce-price-now-drives-discoverability-not-just-conversion); [DataWeave Product Matching FAQ](https://dataweave.com/us/product-matching)
- Herramientas que dependen solo de códigos "silently lose private-label products, bundles and multipacks" — [Dealavo](https://dealavo.com/en/competitor-price-analysis-tools-comparison-for-sellers-2026/)
- GS1: bundle/assortment predefinido = GTIN propio; cambiar un componente del bundle requiere GTIN nuevo — [GS1 UK handbook](https://www.gs1uk.org/sites/default/files/The_GTIN_management_handbook.pdf)
- VTEX: un mismo SKU puede tener varios `sellers[]` (1P + 3P) con ofertas distintas — [TabNews VTEX](https://www.tabnews.com.br/antoniorincon/a-api-publica-de-catalogo-da-vtex-que-quase-ninguem-usa); observado en Carrefour (Demelf + CARREFOUR; Drean SA + CARREFOUR) y Frávega (Fussetti + Frávega) [verificado: curl 7-oct-2026].
- Estadísticas de precios (CPI): "matched model" + sustitución; cuando el ítem se discontinúa el analista decide si el reemplazo es "comparable" (todo el cambio de precio cuenta) o "non-comparable" (se ajusta por calidad con hedónicos, overlap, costo o class-mean). BLS usa hedónicos para heladeras/microondas (desde jul-2000) y lavarropas/secarropas (oct-2000) — [BLS hedonic white paper](https://www.bls.gov/cpi/white-papers/hedonic-quality-adjustments-statistical-agency-perspective.pdf); [UNECE/BLS paper](https://unece.org/sites/default/files/2021-05/Session_3_US-BLS_Paper_0.docx); [National Academies ch.4](https://www.nationalacademies.org/read/10131/chapter/6)
- ILO CPI manual: la sustitución "comparable" requiere guías de qué es un buen sustituto e información de características que determinan precio; si se juzga comparable algo que no lo es, la diferencia de calidad se lee como precio y sesga el índice; con recambio de modelos frecuente conviene chaining/hedónicos — [ILO CPI Manual ch.8](https://webapps.ilo.org/CPI/doc/revisions/chapter8.pdf)

### Inferences
- Para línea blanca conviene separar: (a) **exact** = mismo modelo base del fabricante (puede abarcar variaciones de sufijo de revisión si el fabricante confirma que es el mismo producto); (b) **variant** = mismo modelo base, distinto color (blanco/gris/inox) → precio comparable pero reportar aparte; (c) **equivalent/comparable** = otro modelo/marca dentro del mismo segmento definido por atributos obligatorios (tipo de carga, kg, rpm, inverter, ancho/capacidad en litros para heladeras, no-frost); (d) excluidos: reacondicionado/outlet/usado, kits/bundles (lavarropas + secarropas), accesorios, repuestos.
- Las ofertas de sellers 3P sobre el mismo SKU deben guardarse como ofertas separadas del listado (seller como dimensión), para no mezclar precio 1P con 3P.
- Para el índice por segmento: cada producto maestro lleva su "segment_key" construido de atributos normalizados; el índice compara promedios/medianas por segmento (o vía regresión hedónica si se quiere ajuste fino).

### Gaps
- No encontré documentación pública de cómo los vendors manejan sufijos regionales/de revisión de electrodomésticos (p.ej. "LRDR57SB" vs "LRDR57SB0"); hay que confirmarlo con el fabricante (para Drean, contra su propio maestro de artículos).
- No hallé fuente sobre reglas de detección de reacondicionados en retailers AR (heurística por palabras "reacondicionado", "outlet", "exhibición": sin verificar).

## 4. Human-in-the-loop: colas de revisión, umbrales, re-validación, auditoría

### Takeaway
El patrón común es tres bandas (auto-aceptar / revisar / auto-rechazar), con ~90% auto-procesado en vendors grandes, revisión humana del medio, y cada decisión humana reutilizada como dato de entrenamiento; la precisión se mide revisando una muestra de lo aceptado, el recall solo con verdad de referencia etiquetada. Hay que re-correr matching y re-validar cuando el listado cambia o aparecen productos nuevos.

### Cited Findings
- DataWeave: ~90% de matches auto-procesados (alta confianza aceptada o rechazo claro); ambiguos a especialistas; cada decisión vuelve como ejemplo de entrenamiento; reportes de match rate, miss rate, accuracy; el usuario puede marcar registros incorrectos y ver URL cacheada — [DataWeave blog](https://dataweave.com/blog/pricing-intelligence-in-the-age-of-ai-driven-commerce-price-now-drives-discoverability-not-just-conversion); [Ficstar](https://www.ficstar.com/best-price-intelligence-services-2026)
- Intelligence Node: casos de baja probabilidad los revisan analistas; matches aceptados alimentan el entrenamiento ("self-learning loop") — [Intelligence Node ebook](https://info.intelligencenode.com/hubfs/ebooks/2022/A-Guide-to-AI-driven-Product-Matching-2022.pdf)
- Price2Spy: aprobación automática con umbral de "matching accuracy", manual o híbrida; Automatch puede correr continuo para encontrar productos que el competidor agrega luego — [Price2Spy Automatch](https://www.price2spy.com/automatch.html)
- Managed discovery: el proveedor "refinds them when a source changes its URL or relists an offer" — [Dealavo](https://dealavo.com/en/competitor-price-analysis-tools-comparison-for-sellers-2026/)
- Splink (Fellegi-Sunter): umbral de probabilidad de match elegido con datos etiquetados (Threshold Selection Tool); revisar pares a ambos lados del umbral; métricas de precisión/recall requieren "ground truth… achieved by Clerical Labelling"; umbral de clustering separado y más alto que el de pares para evitar merges transitivos falsos — [Splink edge evaluation](https://moj-analytical-services.github.io/splink/topic_guides/evaluation/edge_overview.html); [Splink accuracy chart](https://moj-analytical-services.github.io/splink/charts/accuracy_analysis_from_labels_table.html); [ER pattern](https://erikevenson.github.io/architect/patterns/entity-resolution/)
- El etiquetado humano no es verdad absoluta (varía entre etiquetadores); spot-check enfocado cerca del umbral — [GOV.UK MoJ Splink transparency record](https://www.gov.uk/algorithmic-transparency-records/moj-splink-master-record)
- Muestreo estratificado de revisión por bandas de score puede bajar el esfuerzo de revisar ~23% a ~7% de los pares — [arXiv 2608.01401](https://arxiv.org/pdf/2608.01401.pdf)
- LLMs pueden generar explicaciones estructuradas de decisiones de matching y ayudar a identificar causas de errores — [Peeters et al. EDBT 2025 slides](https://www.uni-mannheim.de/media/Einrichtungen/dws/DWS_News/Documents/Peeters-Entity-Matching-using-LLMs-EDBT2025.pdf)

### Inferences
- Para un equipo chico: bandas sugeridas (a calibrar con una muestra etiquetada propia, no son valores de literatura): auto-aceptar = EAN válido idéntico, o modelo normalizado idéntico + marca + atributos clave consistentes; revisar = solo texto/LLM o atributos parciales; rechazar = marca o atributo obligatorio en conflicto (kg/carga/tipo).
- Re-validación: disparar revisión cuando cambia el hash de (título, EAN, modelo, marca, atributos clave) del listado, cuando el precio sale de banda vs el resto de retailers (p.ej. >40% del mediano — umbral sin verificar, a calibrar), o cuando el listado desaparece/vuelve con otra URL.
- Auditoría: guardar quién/qué decidió (método, versión del modelo/prompt, evidencia), y nunca borrar matches: cambiar estado.

### Gaps
- Ningún vendor publica sus umbrales numéricos de confianza.

## 5. Modelo de datos recomendado (catálogo maestro + tabla de matches + grupos de equivalencia)

### Takeaway
Separar entidades: producto maestro (código propio estable), listado del retailer (URL/SKU por tienda), oferta/precio por seller y fecha, y match con estado/confianza/método/autor; más un grupo de equivalencia por segmento para comparables. Esto replica la separación exact/variant/similar de los vendors y el pipeline normalizar→block→score→decidir→cluster de ER.

### Cited Findings
- Pipeline ER de 5 etapas con ids estables para entidades y "deterministic-first waterfall" — [ER pattern](https://erikevenson.github.io/architect/patterns/entity-resolution/)
- VTEX separa producto → SKU (`items[]`) → sellers → oferta; IDs alternos RefId/EAN — [VTEX Catalog](https://developers.vtex.com/docs/guides/catalog-integration); [TabNews VTEX](https://www.tabnews.com.br/antoniorincon/a-api-publica-de-catalogo-da-vtex-que-quase-ninguem-usa)
- ML separa publicación (`MLA…`) de producto de catálogo (`catalog_product_id`) — [ML Catalog listing](https://developers.mercadolibre.com.mx/en_us/api-docs/catalog-listing)
- Vendors manejan tipos de match distintos y equivalencias de marca configurables — [DataWeave](https://dataweave.com/us/product-matching); [Intelligence Node](https://www.intelligencenode.com/solutions/product-matching/)

### Inferences (propuesta práctica, no extraída de una fuente única)
```
master_product(id PK, brand, model_base, model_codes[] /*alias y sufijos*/, gtins[] /*EAN válidos*/, category,
               attrs jsonb /*kg, carga, rpm, inverter, color, litros, no_frost, ancho_cm*/, segment_key, status, created_at)
equivalence_group(id PK, category, segment_key UNIQUE, definition jsonb /*atributos obligatorios y tolerancias*/, label)
retailer(id PK, name, platform /*vtex|ml|custom*/, base_url)
retailer_listing(id PK, retailer_id, external_sku /*itemId/RefId/MLA*/, product_url, title, ean_raw, ean_valid bool,
                 model_raw, brand_raw, attrs_raw jsonb, attrs_norm jsonb, content_hash, first_seen, last_seen, active)
listing_offer(listing_id, seller_name, captured_at, price, list_price, available_qty, installments jsonb)  -- serie de precios
match(id PK, listing_id, master_product_id, match_type /*exact|variant|equivalent|excluded*/, status
      /*auto_accepted|pending_review|confirmed|rejected|stale*/, confidence numeric, method
      /*ean|model_regex|attributes|text_fuzzy|llm_select|manual*/, evidence jsonb, model_version,
      decided_by, decided_at, valid_from, valid_to)  -- historial: no se borra, se cierra valid_to
match_audit(match_id, old_status, new_status, actor, reason, at)
```
- Cascada sugerida: (1) EAN válido (checksum GS1) presente en `master_product.gtins` → exact, confianza ~0,99, auto. (2) Regex de modelo normalizado (mayúsculas, sin espacios/guiones, alias de sufijos) + marca → exact, auto si atributos clave no contradicen. (3) Atributos normalizados (LLM o regex extrae kg/rpm/carga/color) + fuzzy título → candidatos top-k → (4) LLM "selecting" elige uno o "ninguno" con explicación → pending_review. (5) Sin candidato → asignar solo `segment_key` (equivalent) para índice de segmento.
- Un `match` exacto de un listado nuevo con EAN conocido enriquece `master_product.model_codes` (aprendizaje de alias) solo tras confirmación humana.
- `content_hash` del listado → al cambiar, el match pasa a `stale`/re-review.

### Gaps
- No encontré un esquema de datos publicado por los vendors (son propietarios); el modelo es una síntesis.
- Falta validar con datos completos qué % de listados de Frávega/ML quedaría sin EAN ni modelo (solo muestra de 3).
