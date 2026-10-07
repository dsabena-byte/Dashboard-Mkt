# KPIs y visualización para dashboards de monitoreo competitivo de precios (equipos de marketing/comercial de un fabricante)

> Notas de investigación (oct-2026). Fuentes: páginas de producto / help docs / blogs de vendors (Price2Spy, Prisync, Wiser, Profitero, DataWeave, NIQ, Omnia, MetricsCart), frameworks de pricing (Umbrex), estándares de visualización (IBCS, SAP, NN/g), literatura académica sobre dispersión y promociones (NBER, FTC, econstor), y normativa argentina (precios transparentes / CFT, Ley 27.442).
> Advertencia de calidad: varias fuentes de "rankings" (worldmetrics, zipdo, wifitalents, thunderbit) son agregadores SEO de baja confiabilidad; se usan solo como señal secundaria y se marcan. Muchos umbrales "de industria" vienen de blogs de vendors, no de estudios: se reportan como práctica declarada, no como estándar.

## 1. Definiciones y fórmulas de KPIs

### Takeaway
El núcleo es un **índice de precio** (precio propio ÷ precio de referencia × 100, ponderado por ventas/unidades y calculado sobre precio NETO con promo y solo con competidores en stock), acompañado de **brecha vs competidor clave**, **posición/rank**, **dispersión entre retailers** (CV y rango %), **cumplimiento de PVP/MAP** (tasa, profundidad, duración, reincidencia), **intensidad promocional** (frecuencia = % días/semanas en promo; profundidad = % descuento promedio) y **disponibilidad**. Para Argentina hay que sumar el **precio efectivo financiado** (cuotas + CFT), porque el precio de lista no refleja lo que paga el consumidor.

### Cited Findings

**Índice de precio**
- Índice por producto = Precio propio ÷ Precio competidor × 100; 100 = paridad, >100 más caro, <100 más barato. Índice de canasta ponderado = Σ(Precio propio × unidades propias) ÷ Σ(Precio competidor × unidades propias) × 100; las ponderaciones salen de las unidades PROPIAS (no se conocen las del competidor) — [Mindpera](https://www.mindpera.com/en/guides/competitor-price-monitoring)
- Variante "vs mercado": índice = precio propio ÷ promedio de precios de competidores EN STOCK × 100 (ej.: propio $199 vs media $201 de 4 competidores en stock → 99,0). Recomienda ponderar por unidades cuando se protege share y por revenue cuando se protege margen, y reportar ambos si difieren >1 punto — [PriceIntelligence.io (snippet; página bloqueada para fetch)](https://priceintelligence.io/competitor-price-analysis)
- Índice de categoría ponderado por revenue: Category PI = Σ(PI_item × peso revenue) ÷ Σ pesos; "siempre ponderar, los índices no ponderados engañan" — [SkillMD competitive-price-monitoring](https://skillmd.com/skills/goldenzero/competitive-price-monitoring)
- Dos métodos de agregación: ratio de canasta (total propio ÷ total competidor) vs promedio de ratios ponderado; el segundo evita que un producto caro domine — [Booper glossary](https://booper.fr/en/glossary/price-index)
- Excluir productos sin stock del cálculo del índice; usar precio NETO (con promociones), porque un índice sobre precio de lista "nunca refleja lo que paga el cliente" — [Booper – price image KPIs](https://booper.fr/en/blog/measure-image-retail-price)
- Convención de dirección: algunos vendors invierten la fórmula (competidor ÷ propio): Retailgrid y PricingCraft usan competidor en el numerador → >100 significa que el competidor es más caro. Hay que fijar y rotular la convención — [Retailgrid](https://www.retailgrid.io/blog/how-to-calculate-price-index-retail-guide); [PricingCraft](https://pricingcraft.com/resources/blog/how-to-calculate-price-index/)
- Retailgrid: ejemplo en que el índice no ponderado daba "paridad" y ponderado por unidades daba ~97 (3% más caro en lo que realmente compran los clientes); recomienda índice KVI aparte con corredor estrecho (98–102 vs competidor de referencia) y la cola con banda más ancha — [Retailgrid](https://www.retailgrid.io/blog/how-to-calculate-price-index-retail-guide)
- Competitive Price Index: comparar like-for-like, agregar gaps con pesos (revenue, unidades o sobrepeso KVI), reportar índice por competidor ("+1,8% vs Discounter A; −0,7% vs Specialty B") con cortes por categoría, marca, región, canal; refresco diario-semanal en e-commerce, usar medias móviles para reducir ruido; calcular sobre precio normal Y opcionalmente sobre "effective price" vs precio promo — [Umbrex – Competitive Price Index](https://umbrex.com/resources/frameworks/pricing-frameworks/competitive-price-index/)

**Brecha (gap) y posición/rank**
- Price Gap = Precio propio − Precio competidor (en $ y %) — [SkillMD](https://skillmd.com/skills/goldenzero/competitive-price-monitoring)
- Posición/rank: Price2Spy clasifica el precio propio en "single most expensive / most expensive not single / cheapest not single / single cheapest / #N (shared)" — [Price2Spy blog – "My price is…" column](https://www.price2spy.com/blog/my-price-is-new-column-added-to-the-price-matrix-report/)
- Prisync "Brand Reports": por marca muestra Index, Position, Minimum Price y Best Matched Competitor; detalle con gráfico de historia de precio, gráfico de posición e índice por competidor — [Prisync Help Center](https://helpcenter.prisync.com/hc/en-us/articles/213009869-Brand-Reports-Premium-Plan)

**Dispersión entre retailers**
- Rango absoluto = Máx − Mín; Rango porcentual = (Máx − Mín) ÷ Mín × 100 (>100% = el máximo duplica al mínimo); Coeficiente de variación = σ ÷ μ (CV > 0,1 = desviación fuerte del precio de equilibrio). Online promedio CV ≈ 0,20–0,22 en su muestra alemana — [Ostfalia Working Paper 2022](https://www.ostfalia.de/fileadmin/user_upload/Fakultaeten/w/Dateien/WolfsburgWorkingPaper/2022/fakw_WWP_22-03_Unicorn-Yeti-Nessie-and-Neoclassical-Market.pdf)
- Medidas alternativas: Value of Information VoI = (Media − Mín) ÷ Mín (ahorro de comprar al mínimo) y D1-2 = (2º precio más bajo − mejor precio) ÷ mejor precio (foco en la parte relevante para el consumidor) — [econstor – price adjustment costs & dispersion (geizhals.at)](https://www.econstor.eu/bitstream/10419/207117/1/1662582374.pdf)
- FTC (lentes de contacto): CV online 0,10 y rango/precio medio 0,37; dispersión offline ≈ 2x la online — [FTC working paper 283](https://www.ftc.gov/sites/default/files/documents/reports/prices-and-price-dispersion-online-and-offline-markets-contact-lenses/wp283revised_0.pdf)
- Revisión 2026: niveles de dispersión reportados en la literatura entre ~8% y >70% según categoría y método — [Springer, AMS Review 2026](https://link.springer.com/content/pdf/10.1007/s13162-026-00352-1.pdf)

**PVP/MAP: cumplimiento**
- MAP aplica al precio ANUNCIADO, no al precio final ni al MSRP/PVP sugerido — [Price2Spy MAP](https://www.price2spy.com/map-price-monitoring.html)
- Métricas de programa MAP: Violation Rate (% de listings/SKUs monitoreados por debajo de MAP en un momento dado; objetivo ej. <5%), Time to Resolution (horas detección→corrección; "gold standard" <24 h autorizados, <72 h no autorizados), Repeat Offender Rate (vendedores con ≥3 violaciones en 90 días), Revenue/Margin at Risk (velocidad × profundidad × duración), Compliance Score por retailer (ranking mensual para QBR) — [MetricsCart – MAP compliance monitoring](https://metricscart.com/insights/map-compliance-monitoring/); [MetricsCart – electronics](https://metricscart.com/insights/map-monitoring-software-for-electronics-brands/); [MetricsCart – 5 metrics](https://metricscart.com/insights/map-compliance-tool-metrics/) (vendor)
- Otras métricas: severidad (cuánto por debajo), time to detection, incidencia de vendedores no autorizados — [Market Edge](https://marketedgemonitoring.com/blog/minimum-advertised-price-monitoring)
- Wiser declara resultados típicos: 95%+ de cumplimiento promedio a 6 meses, −70% reincidencia, 80% de violaciones resueltas en 72 h (claim de marketing) — [Wiser MAP Execution](https://www.wiser.com/products/map-execution/)
- Evidencia: distinguir "primera detección" del inicio real de la violación y no asumir que el precio quedó igual entre chequeos (la duración medida está acotada por la frecuencia de crawl) — [Price2Spy blog – responder violaciones](https://www.price2spy.com/blog/how-should-brands-respond-to-map-violations/)

**Promociones**
- Profundidad: δ = (precio base − precio realizado) ÷ precio base; se considera promo si δ ≥ 5% (umbral para no contar ruido). Frecuencia = proporción de períodos (semanas) en promo. Mediana de producto en EE.UU.: frecuencia 0,147 (≈1 de cada 6,8 semanas) y profundidad 19,5% — [NBER w26306, Hitsch-Hortaçsu-Lin](https://www.nber.org/system/files/working_papers/w26306/w26306.pdf)
- Promo depth = (Lista − Promo) ÷ Lista; Promo frequency = % de días en promo; además dispersión entre sellers y "waterfall" lista → neto → promo → fees/envío/impuestos → efectivo — [Umbrex – Competitor Pricing Comparison](https://umbrex.com/resources/company-analysis/marketing/competitor-pricing-comparison/)
- Comparación de intensidad promocional entre marcas: % de volumen vendido en promo, profundidad promedio, % de semanas con promo / eventos por trimestre (alta frecuencia = modelo high-low) — [Daasity – Promotional Comparison](https://help.daasity.com/core-concepts/dashboards/report-library/retail-analytics/promotional-comparison-urms)
- DataWeave mide frecuencia, ubicación y prominencia de promos (banners, listings, homepage), share of media, y captura promos por tarjeta de crédito/banco y por volumen — [DataWeave Flyers & Promo Intelligence](https://dataweave.com/us/flyers-promo-intelligence); [DataWeave – guía de métricas](https://dataweave.com/blog/a-guide-to-digital-shelf-metrics-for-consumer-brands)
- DataWeave compara múltiples "price points": precio de lista, precio de venta, precio normalizado por unidad y net-effective price — [DataWeave Pricing Intelligence](https://dataweave.com/us/pricing-intelligence)
- NIQ tiene un producto específico para "el precio efectivo al consumidor detrás de cada promoción (descuentos, vouchers, bundles)" — [NIQ Product Finder](https://nielseniq.com/global/en/products/)

**Frecuencia de cambio de precio**
- Price Change Frequency = número de cambios de precio en un período — [Novadata](https://novadata.io/amazon-kpi/profitability/good-buy-box-percentage)
- Profitero: en Amazon el producto promedio cambia de precio 5 veces por mes — [Profitero blog](https://www.profitero.com/blog/connecting-digital-shelf-data-retail-media)

**Disponibilidad / quiebre**
- Availability = % de listings donde el producto está en stock (ej.: en stock en 2 de 4 retailers = 50) — [DataWeave DSA guide](https://dataweave.com/us/digital-shelf-analytics-ultimate-guide-for-brands)
- OOS rate: "bueno" <2% de los días del mes, "malo" >5% — [42Signals](https://www.42signals.com/blog/4-digital-shelf-performance-metrics/) (vendor)

**Share of search / shelf / media, buy box**
- Share of Search/Shelf = proporción de tus productos en resultados de búsqueda/categoría para una keyword y retailer; versiones orgánica y sponsored; Share of Media = presencia en ubicaciones pagas — [DataWeave DSA](https://dataweave.com/us/digital-shelf-analytics)
- Buy Box % = unidades/tiempo ganado como oferta destacada ÷ total en que el ASIN estuvo activo × 100 — [Novadata](https://novadata.io/amazon-kpi/profitability/good-buy-box-percentage); [GoAura](https://goaura.com/blog/what-is-a-good-amazon-buy-box-percentage)

**Elasticidad**
- Elasticidad = % cambio de demanda ÷ % cambio de precio — [Novadata](https://novadata.io/amazon-kpi/profitability/good-buy-box-percentage)
- NIQ: elasticidad de precio regular entre ~1,1 y ~2,0 dentro del mismo portafolio, y varía fuertemente por canal → no es un número único por marca — [NIQ – Pricing Under Pressure 2026](https://nielseniq.com/global/en/insights/analysis/2026/pricing-under-pressure/)

**Precio efectivo financiado (Argentina)**
- En e-commerce se debe informar precio de contado, anticipo, cantidad y monto de cuotas y Costo Financiero Total (CFT, en %, tipografía más grande y en color); el precio en un pago debe ser igual en efectivo, débito o crédito; si el costo financiero está incluido en el precio, no se puede decir "sin interés" — [Argentina.gob.ar – Precios transparentes](https://www.argentina.gob.ar/justicia/derechofacil/leysimple/precios-transparentes); [Argentina.gob.ar – noticia 2017](https://www.argentina.gob.ar/noticias/los-comercios-deberan-separar-el-precio-al-contado-de-la-opcion-en-cuotas)
- Tasa implícita de un plan "sin interés": resolver Contado = Cuota × [1 − (1+i)^−n] ÷ i; CFT anual ≈ (1+i)^12 − 1 (ej.: contado $500.000 vs 12×$50.000 → i ≈ 2,92% mensual, ≈41% anual). Práctica frecuente: precio de lista inflado + "descuento por contado" del 15–25% — [Hacé Cuentas](https://hacecuentas.com/calculadora-12-cuotas-sin-interes) (fuente divulgativa, no oficial)

**Encuadre legal del "PVP/MAP" en Argentina**
- Ley 27.442 art. 3 inc. a): fijar directa o indirectamente el precio de venta es práctica restrictiva si configura art. 1 (perjuicio al interés económico general); las guías de la autoridad distinguen precio de reventa mínimo (en principio perjudicial) de "precios sugeridos" sin coacción — [Guías de abuso de posición dominante](https://www.argentina.gob.ar/sites/default/files/guias_abuso_posicion_dominante.pdf); [Ley 27.442 (WIPO Lex)](https://wipolex-res.wipo.int/edocs/lexdocs/laws/es/ar/ar208es.html)
- Caso CNDC JUMAR c/ SIKA (precios mínimos de reventa en MercadoLibre con amenaza de corte de suministro): la CNDC no lo consideró anticompetitivo por falta de posición dominante y de perjuicio — [CNDC resolución](https://cndc.produccion.gob.ar/sites/default/files/cndcfiles/cond1800.pdf)

### Inferences
- Para un fabricante, el índice relevante tiene dos lecturas distintas que conviene NO mezclar: (a) **índice competitivo** (mi SKU vs SKUs equivalentes de otras marcas, en el mismo retailer), y (b) **índice de ejecución/canal** (precio de mi SKU en cada retailer vs mi PVP sugerido → dispersión y "cumplimiento"). Los vendors de MAP hacen (b); los de price intelligence retail hacen (a).
- En Argentina conviene calcular el índice sobre el **precio de contado** y mostrar aparte un **índice de precio financiado** (valor presente de las cuotas o cuota mensual comparable + CFT), porque las cuotas "sin interés" desplazan la competencia del precio de lista a la financiación.
- Dado el marco de la Ley 27.442, en Argentina es más seguro rotular el KPI como "desvío vs PVP sugerido" que como "violación de MAP".
- Usar el umbral δ ≥ 5% de NBER para definir "en promo" evita contar como promo micro-ajustes de precio.

### Gaps
- No encontré definiciones publicadas de los vendors (Profitero, Wiser, NIQ) con fórmulas propietarias exactas de sus "scores" de precio; los help docs están detrás de login.
- No encontré una fórmula estándar publicada de "share of assortment" en precio (solo definiciones genéricas de assortment gap); se infiere = SKUs propios listados ÷ SKUs de la categoría listados en el retailer.
- No encontré fuentes que traten específicamente el "índice de precio financiado" para electrodomésticos en Argentina; es una construcción a validar.

## 2. Cómo visualizan las plataformas líderes

### Takeaway
El patrón dominante es: **matriz SKU × retailer coloreada** (más barato/más caro/violación/sin stock), **historia de precio por SKU con línea de PVP/MAP**, **widgets de "paisaje de precios"** (cuántos SKUs soy el más barato/caro), **reportes de violaciones con captura de pantalla + timestamp + URL + seller**, **scorecards por retailer/marca**, y **dashboards de tendencia de violaciones** para ejecutivos. La tendencia 2025–2026 es agregar **agentes conversacionales** (Omnia Agent, NIQ Optiq) y "explicar por qué" (conexión con ventas/share).

### Cited Findings
- **Price2Spy – Price Matrix** (uno de sus reportes más usados): filas = productos, columnas = sitios; código de color por defecto: verde claro = único más barato, verde oscuro = más barato no único, rojo = único más caro, rojo claro = más caro no único, naranja = viola MAP, gris = URL inactiva, rosa claro = chequeo fallido, verde azulado = cambio de precio más reciente; colores personalizables (porque la percepción de color varía por cultura) — [Price2Spy – colour schemes](https://www.price2spy.com/blog/introducing-custom-colour-schemes-into-price2spy/)
- Price Matrix en modo porcentaje: base = el más barato o = mi precio, y el resto como +/−% — [Price2Spy – price difference as percentage](https://www.price2spy.com/blog/price-difference-as-percentage/)
- Price Matrix con "Availability coloring": amarillo = no disponible — [Price2Spy – matrix availability](https://www.price2spy.com/blog/price-matrix-new-option-colors-indicate/)
- **Price2Spy – Pricing dashboard**: widget "Pricing landscape" (cuántos productos son más baratos/caros/debajo/encima/igual a mi precio, no disponibles, violando precio objetivo, debajo/encima del promedio, con selector de fecha histórica); gráfico de historia por producto con la línea MAP en naranja para ver quién y cuándo la violó; widget de Price Index vs 2 sitios — [Price2Spy – Pricing dashboard](https://www.price2spy.com/pricing-dashboard.html)
- Price2Spy MAP: alertas por email, lista de productos, price matrix, dashboard, reporte "price below MAP" y screenshots como evidencia — [Price2Spy MAP](https://www.price2spy.com/minimum-advertised-price-map-monitoring.html)
- **Prisync**: dashboard principal con precios de competidores, alertas y resumen de posición; vista de producto con mi precio vs cada competidor, posición, stock y resumen de cambios; Brand Reports con índice/posición/mínimo y detalle con historia, gráfico de posición e índice por competidor; índice general de la tienda; filtros por segmento — [ThePriceGeek review](https://www.thepricegeek.com/competitor-monitoring/prisync-review/); [Prisync Help](https://helpcenter.prisync.com/hc/en-us/articles/213009869-Brand-Reports-Premium-Plan); [Prisync home](https://prisync.com/)
- **Wiser MAP**: dashboard que corta violaciones por seller, SKU y región; gráficos de tendencia de violaciones y margen protegido "para compartir con liderazgo"; cliente cita revisión semanal ejecutiva — [Wiser MAP Execution](https://www.wiser.com/products/map-execution/)
- **Profitero**: Digital Shelf 360 con vista global por país/región, "Profitero scores", insights en lenguaje plano + alertas configurables, pantalla unificada por producto, benchmark vs competidores/best sellers, y conexión con datos de ventas y share — [Profitero press](https://www.profitero.com/press/press-release-brands-can-now-accelerate-e-commerce-performance-with-profitero-s-digital-shelf-360-analytics-suite); seguimiento de precios para "mantenerse dentro de rangos negociados", detección de MAP y 3P no autorizados, exportación vía Snowflake a Tableau/Looker/PowerBI — [Profitero Digital Shelf](https://www.profitero.com/product/digital-shelf)
- **DataWeave**: filtros y "sliding timeline windows" por marca, retailer, categoría para detectar markdowns; auditoría de calidad de matching y aprobación/rechazo de matches desde el dashboard; detección estadística de anomalías con alertas; dashboards configurables con "weighted inputs"; drill-down a región, código postal o tienda; vistas de disponibilidad por marca/retailer/ciudad/categoría con historia — [DataWeave Pricing Intelligence](https://dataweave.com/us/pricing-intelligence); [DataWeave DSA](https://dataweave.com/us/digital-shelf-analytics); [DataWeave DSA guide](https://dataweave.com/us/digital-shelf-analytics-ultimate-guide-for-brands)
- **NIQ Digital Shelf** (ex Data Impact): scorecards configurables a nivel global/mercado/retailer, monitoreo de precio y promo con detección MAP, ventas y share junto a KPIs del shelf "en una vista", y asignación de impacto en revenue por KPI con IA — [NIQ Digital Shelf](https://nielseniq.com/global/en/products/digital-shelf/)
- **Omnia**: "Omnia Agent" conversacional ("¿qué competidores cambiaron precios esta semana?", "¿en qué productos estoy muy por encima del promedio de mercado?") con visualizaciones acompañadas de explicación; "Show Me Why" para ver las reglas que llevaron a un precio; filtros whitelist/blacklist de competidores; retención de datos de precios 30 días — [Omnia analytics](https://www.omniaretail.com/pricing-hub/pricing-analytics-solution); [Omnia price monitoring](https://www.omniaretail.com/price-monitoring-software); [Omnia brands](https://www.omniaretail.com/solutions/brand-d2c)
- Match-confidence scoring (Omnia, Competera, Intelligence Node) para filtrar comparaciones por confiabilidad del emparejamiento — [Worldmetrics (agregador, baja confiabilidad)](https://worldmetrics.org/best/competitive-pricing-intelligence-software/)
- 42Signals: gráficos (barras, líneas, torta, heatmaps) para "ver anomalías de precio en 10 retailers de un vistazo" — [42Signals](https://www.42signals.com/blog/best-digital-shelf-analytics-software-2026/)
- Escalera de precios (price ladder) y waterfall (lista → neto → promo → fees/impuestos → efectivo) como formatos de salida recomendados — [Umbrex – Competitor Pricing Comparison](https://umbrex.com/resources/company-analysis/marketing/competitor-pricing-comparison/)
- Evidencia de violación: screenshot con nombre/modelo, precio, identidad del seller, URL, fecha-hora con zona horaria; si el precio aparece tras cupón/carrito/login, capturar los pasos — [Price2Spy blog](https://www.price2spy.com/blog/how-should-brands-respond-to-map-violations/)

### Inferences
- Para el user de marketing de un fabricante, las 5 vistas "canónicas" serían: (1) scorecard ejecutivo (índice, cumplimiento PVP, % SKUs en promo, disponibilidad); (2) heatmap SKU × retailer del desvío % vs PVP o vs competidor; (3) historia de precio por SKU con una línea por retailer + línea PVP; (4) escalera de precios por segmento (marcas en eje de precio); (5) tabla de excepciones con evidencia.
- No encontré capturas públicas de "box plots" de dispersión en estos vendors; los box plots / strip plots son una opción derivada de la literatura de dispersión, no un estándar observado.
- Calendario de promos: ningún vendor muestra públicamente un "promo calendar" tipo Gantt en las páginas revisadas; se infiere útil (días en promo por marca/retailer) pero es propuesta propia.

### Gaps
- No pude ver screenshots/demos de Profitero, Wiser, Competera, Intelligence Node ni NIQ (detrás de login o en video); las descripciones vienen de páginas de producto.
- Intelligence Node y Competera: no encontré documentación primaria con detalle de visualizaciones (solo agregadores).

## 3. Umbrales de semáforo y reglas de alerta

### Takeaway
No hay un estándar universal: las fuentes recomiendan **bandas por rol de producto** (KVI estrecho, cola ancha) y calibrar sobre la volatilidad observada. Valores citados: índice KVI ±2% (98–102); desvío vs PVP <5% verde, >10% rojo; MAP: 1–3% menor, 3–10% moderado, >10% severo; >30% bajo MAP = prioridad máxima; cumplimiento >95% bueno, <85% malo; OOS <2% días bueno, >5% malo; buy box >90–95% bueno, <70% rojo.

### Cited Findings
- Corredor KVI 98–102 vs competidor de referencia, cola más ancha — [Retailgrid](https://www.retailgrid.io/blog/how-to-calculate-price-index-retail-guide)
- KVI Price Index: alerta si desvío >2% del objetivo (frecuencia diaria) — [Booper](https://booper.fr/en/blog/measure-image-retail-price)
- Guardrails por rol: KVI con banda estrecha vs competidor primario; core más ancha; premium exclusivo sin matching directo; cada métrica con dueño, umbral, cadencia y escalamiento — [Umbrex – guardrails](https://umbrex.com/resources/retail-industry-playbooks/retail-pricing-architecture-playbook/pricing-rules-guardrails-governance-and-tools/)
- Pricing KPIs: vistas con semáforos, "top 10 excepciones" y links a playbooks; alertas por umbral para brechas de piso y MAP — [Umbrex – Pricing KPIs & Dashboards](https://umbrex.com/resources/frameworks/pricing-frameworks/pricing-kpis-dashboards/)
- Pharma e-commerce: objetivo gap <5% vs precio recomendado en canales autorizados; amarillo si >10% por debajo; rojo si seller no autorizado recorta o el gap causa pérdida de buy box. Recomendación: 30 días sin alertas para medir volatilidad natural y fijar umbrales por encima de ella — [SmileAI](https://smileai.co/insights/10-kpi-ecom-pharma) (vendor; fecha del sitio inconsistente)
- Severidad MAP: menor 1–3% bajo MAP (puede ser redondeo/cupón), moderada 3–10%, severa >10% o reincidente; plazo de corrección típico 24–48 h; escalamiento: aviso → carta legal → suspensión de suministro → baja — [PageCrawl](https://pagecrawl.io/blog/map-monitoring-violation-detection)
- ≥30% bajo MAP = enforcement prioritario sin importar el tipo de seller; reincidente = ≥3 violaciones en 90 días — [MetricsCart electronics](https://metricscart.com/insights/map-monitoring-software-for-electronics-brands/)
- Umbrales good/bad: MAP compliance >95% bueno, <85% malo; OOS <2% días/mes bueno, >5% malo; Buy Box >90% bueno, <70% malo; Share of search top-3 y >15% bueno — [42Signals](https://www.42signals.com/blog/4-digital-shelf-performance-metrics/)
- Buy box: 90%+ excelente, 70–89% fuerte, 50–69% promedio, <50% a mejorar (marca única en la ficha debería estar cerca de 100%) — [GoAura](https://goaura.com/blog/what-is-a-good-amazon-buy-box-percentage)
- Alertas típicas de Prisync: competidor baja por debajo de mi precio, competidor sin stock, dejo de ser el más barato; frecuencia diaria a tiempo real según plan — [ThePriceGeek](https://www.thepricegeek.com/competitor-monitoring/prisync-review/)
- Price2Spy: alertas instantáneas o diarias; Basic 1 chequeo/día, Premium hasta 8/día — [Price2Spy MAP](https://www.price2spy.com/map-price-monitoring-old.html)
- MAP: chequeo diario es suficiente para la mayoría (las violaciones duran días/semanas); ruteo: brand manager = todo; ventas de canal = sus retailers; legal = reincidentes/severas — [PageCrawl](https://pagecrawl.io/blog/map-monitoring-violation-detection)
- Detección estadística de anomalías como disparador de alertas — [DataWeave](https://dataweave.com/us/pricing-intelligence)

### Inferences
- Propuesta de semáforo para índice competitivo (no es estándar, combina fuentes): verde dentro de la banda objetivo ±2 pts para SKUs clave y ±5 pts para el resto; ámbar hasta el doble; rojo fuera. Para desvío vs PVP: verde |desvío| <5%, ámbar 5–10%, rojo >10% (alineado a SmileAI/PageCrawl).
- Alertas mínimas recomendables: baja de precio de un competidor > X% (calibrar con la volatilidad; p.ej. >5%), nueva promo de competidor (δ ≥ 5%), SKU propio por debajo de PVP en un retailer, quiebre de stock propio en retailer clave, y cambio de rank (dejo de ser / paso a ser el más barato).

### Gaps
- No encontré fuentes primarias (Simon-Kucher, McKinsey, Professional Pricing Society) con umbrales numéricos de semáforo para índice de precio; las bandas citadas vienen de blogs de vendors/consultoras.

## 4. Filtros y drill-downs recomendados

### Takeaway
Filtros recurrentes: **categoría/segmento, marca, retailer/canal (incl. marketplace y seller 1P/3P/autorizado), región/ciudad/tienda, rango de fechas (con ventana deslizante y fecha histórica), tipo de precio (lista/venta/unitario/neto-efectivo/financiado), stock, rol del SKU (KVI/core/cola)** y, en plataformas maduras, **confianza del match**. Drill-down: scorecard → categoría → SKU → retailer → evidencia.

### Cited Findings
- Cortes del índice: categoría, marca, región/zona, canal, KVI vs no-KVI, por competidor — [Umbrex – CPI](https://umbrex.com/resources/frameworks/pricing-frameworks/competitive-price-index/); por rol de ítem, categoría, competidor, zona y canal (un índice único "puede esconder problemas") — [Umbrex – guardrails](https://umbrex.com/resources/retail-industry-playbooks/retail-pricing-architecture-playbook/pricing-rules-guardrails-governance-and-tools/)
- DataWeave: filtros por marca/retailer/categoría + ventana de tiempo deslizante; tipos de precio lista/venta/unitario/net-effective; drill-down región/ZIP/tienda; por dispositivo e idioma — [DataWeave](https://dataweave.com/us/pricing-intelligence); [DataWeave DSA](https://dataweave.com/us/digital-shelf-analytics)
- Wiser: violaciones por seller, SKU y región; seller autorizado vs gray-market — [Wiser](https://www.wiser.com/products/map-execution/)
- Seller autorizado vs no autorizado y el seller específico en marketplaces (varios sellers por ficha) — [MetricsCart](https://metricscart.com/insights/best-map-enforcement-software/); [Price2Spy blog](https://www.price2spy.com/blog/how-should-brands-respond-to-map-violations/)
- Price2Spy: filtros de disponibilidad y fecha histórica en el "Pricing landscape"; exportar a Excel para filtrar "solo productos donde soy el 2º más barato" — [Price2Spy dashboard](https://www.price2spy.com/pricing-dashboard.html); [Price2Spy "My price is"](https://www.price2spy.com/blog/my-price-is-new-column-added-to-the-price-matrix-report/)
- Foco recomendado: top 20% de productos que hacen el 80% del revenue y top 5–10 marcas competidoras — [DataWeave guide](https://dataweave.com/us/digital-shelf-analytics-ultimate-guide-for-brands)
- NIQ: tecnología/durables con elasticidad que varía por canal → cortar por canal — [NIQ 2026](https://nielseniq.com/global/en/insights/analysis/2026/pricing-under-pressure/)
- Dashboards por rol (ejecutivo ve resultados y riesgos; CoE de pricing ve cumplimiento; ventas ve realización) — [Umbrex KPIs](https://umbrex.com/resources/frameworks/pricing-frameworks/pricing-kpis-dashboards/)
- Filtros visibles como "chips" removibles, con efecto inmediato — [Tim Graf UX guide](https://timgraf.com/ux-design/designing-for-data-rich-interfaces-a-comprehensive-ux-guide-to-tables-dashboards-and-data-visualization-that-actually-works/)

### Inferences
- Para Argentina, "tipo de precio" debería incluir contado, lista y financiado (n cuotas + CFT), y "medio de pago" (promos bancarias/billeteras) como dimensión de promo.
- "Segmento" para electrodomésticos = subsegmento de producto (p.ej. capacidad/ancho), alineado a la segmentación GfK que ya usa el dash.

### Gaps
- No encontré documentación pública de jerarquías de drill-down específicas por vendor (más allá de descripciones genéricas).

## 5. Buenas prácticas generales de diseño aplicadas a pricing

### Takeaway
Few/NN/g/IBCS convergen en: una pantalla "a simple vista", 3–7 KPIs arriba a la izquierda, comparación explícita contra referencia (PVP, competidor, período anterior), **color reservado para variaciones/estado (verde bueno / rojo malo)**, notación semántica consistente (real sólido, plan contorno, pronóstico rayado), barras/líneas antes que tortas/gauges, tablas con micrográficos, y progresiva revelación (resumen → contexto → detalle). En pricing esto se completa con **frescura del dato y evidencia** visibles.

### Cited Findings
- Definición de Few: "visual display of the most important information… arranged on a single screen so it can be monitored at a glance"; regla 3–7 métricas primarias; F-pattern de NN/g → métrica principal arriba a la izquierda; niveles 5 s / 30 s / 2–5 min — [whennotesfly (cita a Few y NN/g)](https://whennotesfly.com/technology/data-analytics-insights/dashboards-that-actually-work)
- NN/g: longitud y posición 2D son atributos preatentivos → barras y líneas se leen más rápido que área/ángulo; dashboards operativos vs analíticos — [NN/g – dashboards preattentive](https://www.nngroup.com/articles/dashboards-preattentive/)
- Treemaps/burbujas no aptos para comparación precisa (área no preatentiva) — [Fuselab (cita NN/g)](https://fuselabcreative.com/data-visualization-best-practices/)
- IBCS "SUCCESS" (Say, Unify, Condense, Check, Express, Simplify, Structure); "same-same, different-different" — [IBCS / ACCID](https://accid.org/wp-content/uploads/2021/12/HOWTOI1-1.pdf)
- IBCS: verde = bueno, rojo = malo, gris = neutro, solo para variaciones; real sólido, año previo más claro, plan contorneado, pronóstico rayado; variaciones con "+"; ejes semánticos; tiempo siempre horizontal; ejes de valor desde cero; sparklines solo con escala consistente (indexada); tablas con barras, puntos de alerta, sparklines y semáforos embebidos; para daltonismo reemplazar verde por azul-verde — [IBCS Standards](https://www.ibcs.com/standards/page/3/); [SAP – IBCS](https://www.sap.com/design-system/sac-dashboard-design-best-practices/resources/ibcs); [IBCS working group](https://www.ibcs.com/wp-content/uploads/2018/12/IBCSWorkingGroup-Mandatory-vs-optional_2018-12-13_jf.pdf)
- IBCS: color solo para resaltar; evitar decoración, pie/radar con cuidado; mensaje clave arriba — [IBCS top & bottom 5](https://www.ibcs.com/resource/top-and-bottom-5-of-international-business-communication-standards/); [AFP Exchange / IBCS](https://www.ibcs.com/wp-content/uploads/2016/08/AFP_Exchange_Lapajne_Seiten_43-47_aus_November_2015.pdf)
- Tres zonas: titular (1–3 KPIs) → desglose (tendencias, cortes, vs objetivo) → detalle (tabla accionable); paletas divergentes para valores por encima/debajo de un umbral — [Tim Graf](https://timgraf.com/ux-design/designing-for-data-rich-interfaces-a-comprehensive-ux-guide-to-tables-dashboards-and-data-visualization-that-actually-works/)
- Siempre emparejar el KPI con una base (meta, benchmark, % vs período anterior); la vista por defecto debe responder la pregunta principal sin interacción — [Aufait UX](https://www.aufaitux.com/blog/dashboard-design-principles/); [whennotesfly](https://whennotesfly.com/technology/data-analytics-insights/dashboards-that-actually-work)
- Price2Spy usa por defecto verde = barato, rojo = caro y permite cambiarlo (asociación cultural) — [Price2Spy](https://www.price2spy.com/blog/introducing-custom-colour-schemes-into-price2spy/)
- Frescura/calidad: los vendors destacan reportes de auditoría de calidad, chequeos fallidos marcados (rosa claro en Price2Spy), y match confidence — [DataWeave](https://dataweave.com/us/pricing-intelligence); [Price2Spy](https://www.price2spy.com/blog/introducing-custom-colour-schemes-into-price2spy/)
- Cada métrica con dueño, umbral, cadencia y ruta de escalamiento; diccionario de métricas con fórmula, inclusiones/exclusiones, ventana y fuente — [Umbrex KPIs](https://umbrex.com/resources/frameworks/pricing-frameworks/pricing-kpis-dashboards/)

### Inferences
- Conflicto de color a resolver: en pricing "verde = barato" (Price2Spy) no siempre es "bueno" para un fabricante (estar más barato que el PVP es malo para el canal). Aplicando IBCS, el color debe codificar bueno/malo respecto del objetivo (banda), no barato/caro; barato/caro se codifica con posición (paleta divergente neutra).
- Mostrar en el encabezado: fecha/hora de la última captura, % de chequeos fallidos y cobertura (SKUs × retailers capturados / esperados).

### Gaps
- No encontré guías específicas de Stephen Few o IBCS sobre dashboards de pricing (solo principios generales).
