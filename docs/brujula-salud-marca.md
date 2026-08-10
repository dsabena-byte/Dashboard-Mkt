# Brújula de Salud de Marca — modelo de proyección entre olas Kantar

> **Estado:** marco conceptual acordado. NO implementado todavía. Documento vivo
> para retomar el proyecto.
> **Mapa visual (artifact):** https://claude.ai/code/artifact/cc567cbf-49cc-4750-af6e-feb2468413fd

## El problema

Kantar mide la salud de marca **una vez al año** (antes semestral, ahora anual).
Entre olas quedan 12 meses a ciegas: se ejecuta plan, pauta y acciones sin saber
si mueven las variables de posicionamiento. Queremos una **brújula**: un modelo
que, con señales vivas del mercado, **proyecte el movimiento** de las variables
Kantar entre olas y responda "¿estoy enfocando bien los recursos?", validándose
con cada ola nueva.

Variables Kantar a proyectar: **TOM** (Top of Mind), **SOM** (Share of Mind),
**Intención de compra**, **Poder de Marca**.

## Principio rector: todo es RELATIVO

El posicionamiento sube cuando te movés más que la competencia, no en absoluto.
Ninguna señal entra en valor absoluto — todas relativas al set competitivo:
Share of Search (% de la categoría), share de voz, share de sentiment/engagement,
índice de precio (base 100 categoría), visibilidad SEO relativa.

## Decisiones y foco (refinamiento del cliente)

- **Alta confianza / medición directa y correlacionable: TOM, SOM, Intención de
  compra.** Acá la brújula va a ser sólida — se proxyean muy bien con señales
  comportamentales (búsqueda, atención, comercial).
- **Poder de Marca: baja confianza.** Arrastra lo cualitativo (meaningful /
  different), que es muy difícil de proyectar. Se trata como **derivado / de
  menor confianza**; no sobre-prometer.
- **Camino de calibración:** acumular **este año** de historia digital + pauta +
  señales de mercado, y con esa base hacer las correlaciones de forma **ya
  estadística** (no solo priors teóricos). Mientras tanto, **construir el
  proceso/modelo** desde ahora.

## Arquitectura

Señales del mercado (relativizadas vs competencia) → modelo → proyección de las
4 variables Kantar. La ola anual **no alimenta** el modelo: lo **audita y
recalibra** (state-space / anclaje: la ola fija el nivel, las señales vivas
dibujan la trayectoria entre olas).

### Capa 1 — Inercia comercial (ya existe, base sólida)

El modelo de `salud-marca` ya conecta la realidad comercial GFK con el equity
Kantar (OLS calibrado, correlaciona bien). Es el piso: dónde debería estar el
equity solo por las ventas.
- Fuente: `mercado_share` (GFK) — value/unit share por segmento **low/mid/high**,
  `index_price` relativo. Historia desde 2022. Modelo en `salud-marca-model.ts` +
  `salud-marca-queries.ts` (drivers: value share gama alta, unit share, mix).

### Capa 2 — Aporte del marketing (lo nuevo)

Encima del piso comercial, las señales de marketing (Drean **y** competencia,
todas relativas) explican el movimiento que la inercia no explica.

## Las 5 familias de señales

| # | Familia | Alimenta | Fuentes reales (tablas) | Estado |
|---|---------|----------|--------------------------|--------|
| 1 | **Atención & saliencia** | TOM, SOM | `vw_share_of_search`, `trends_interest`, `social_competitor`/`social_followers` (share de alcance), `seo_rankings` (visibilidad branded); share de voz de pauta (`meta_paid_creatives`, Google Ads, DV360 — hoy solo Drean) | Ya se mide + competencia; falta share de voz competitivo |
| 2 | **Afinidad & conversación** | Poder, Intención | `social_competitor` (sentiment +/–/0, engagement), `social_brand_sentiment_summary` (resúmenes LLM) | Ya se mide (5 marcas); falta reviews |
| 3 | **Realidad comercial (inercia)** | Todo | `mercado_share` (share, index_price, segmentos), `floor_share` (góndola) | Ya se mide, historia 2022+ |
| 4 | **Diferenciación & propuesta** | Poder (different) | `index_price` (premium sostenido), `social_competitor.pilar` (distintividad de contenido), búsqueda de features/diferenciales | Parcial — el eje más flojo |
| 5 | **Voz directa del consumidor** | TOM, Intención, valida todo | **NO EXISTE aún** — micro-encuestas/pulse, social listening, reviews | Fuente nueva, prioridad alta |

## Matriz de conexión (fuerza, con priors — se ajusta ola a ola)

`●●●` fuerte · `●●○` media · `●○○` incipiente.

| Variable | Atención | Afinidad | Comercial | Diferenciación | Voz consumidor |
|----------|:--:|:--:|:--:|:--:|:--:|
| **TOM** | ●●● (Share of Search) | ●○○ | ●●○ | ●○○ | ●●● (recall pulse) |
| **SOM** | ●●● (SoS + alcance) | ●●○ | ●●○ | ●○○ | ●●○ |
| **Intención** | ●●○ (búsqueda transaccional) | ●●● (sentiment + reviews) | ●●● (precio + góndola) | ●●○ | ●●● (consideración pulse) |
| **Poder** | ●●○ | ●●● (meaningful) | ●●○ | ●●● (different) | ●●○ |

## Fuentes nuevas a incorporar (priorizadas)

1. **Micro-encuestas / pulse trackers** (ALTA) — preguntar al consumidor lo mismo
   que Kantar (recall + consideración), muestra chica, mensual/trimestral.
   Convierte la brújula en "mini-Kantar continuo". Aporta a TOM e Intención.
2. **Meta Ad Library** (ALTA, gratis) — anuncios activos de cada competidor →
   share de voz de pauta **relativo real** (hoy solo tenemos la pauta de Drean).
3. **Reviews e-commerce + ABSA** (MEDIA) — scraping ML/Frávega + IA que puntúa
   marcas en atributos (calidad, durabilidad, precio-valor, diseño, postventa).
   Refuerza Diferenciación y Afinidad.
4. **Social listening / menciones** (MEDIA) — conversación fuera de cuentas
   propias, share of conversation + alerta temprana.
5. **Prensa / blogs / PR** (BAJA) — earned media, share of voice en medios.

## Loop de validación (anual)

1. **Hoy:** priors teóricos (Share of Search → saliencia) + comparación entre
   marcas **dentro** de la ola disponible (≈6 marcas × 3 categorías ≈ 18 obs).
2. **Durante el año:** la brújula proyecta y marca en rojo si se invierte donde la
   aguja no se mueve — antes de que Kantar lo confirme.
3. **Llega la ola:** backtest (¿predijo el movimiento?), se poda/refuerza.
4. **Recalibración:** +≈18 obs de panel por año; los pesos se re-estiman, la banda
   de incertidumbre se angosta. Con 2–3 olas se gana confianza con evidencia.

**Regla de uso:** con cadencia anual la brújula es **direccional** (vas bien / vas
mal), no un predictor de puntos exactos. Corrige el rumbo dentro del año; no
reemplaza a Kantar, lo anticipa.

## Realidad de la data (verificado en Supabase, ago-2026)

Solape de señales vivas con olas Kantar (nov-23 → nov-25) es **fino** — no hay
años de historia digital para back-fittear:
- Share of Search / search_volume: desde **jul-2025**.
- Trends: desde ago-2025. Social posts (sentiment/engagement): desde **oct-2024**
  (la de más historia). social_competitor: solo feb–may 2026.
- Pauta (Meta/GAds/DV360): desde **abr-2026**. SEO matrix, followers, web
  competencia: 2026.
- GFK `mercado_share`: desde **2022** (backbone comercial firme).
- Marcas con equity Kantar por categoría: Lavado (Drean, Samsung, Whirlpool, LG,
  Philco), Refrigeración (+Gafa), Cocción (Drean, Whirlpool, Escorial, Gafa,
  Electrolux, Longvie, Florencia). Kantar está **hardcodeado** en
  `salud-marca-model.ts` (constantes KANTAR_*), no en Supabase.

Conclusión: calibración **forward-looking**. Se acumula este año y se estima
estadísticamente al cerrar el ciclo.

## Próximos pasos (cuando se retome)

- [ ] Migrar Kantar de hardcode (`salud-marca-model.ts`) a Supabase + crosswalk de
      nombres de marca entre fuentes (Kantar/GFK/search/social los nombran distinto).
- [ ] Definir el pipeline que **persiste mensualmente** las señales relativas
      (snapshots de Share of Search, share de voz, sentiment, etc.) para construir
      la historia del año.
- [ ] Sumar micro-encuestas / pulse (fuente nueva #1) y Meta Ad Library (#2).
- [ ] Construir el índice compuesto de **una** variable (arrancar por TOM o SOM,
      las de mayor confianza) y mostrar la aguja vs el piso comercial.
- [ ] Al cerrar el año: primera calibración estadística (panel marcas × categorías
      × período) y backtest contra la ola.
