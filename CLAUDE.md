# Dashboard-Mkt — memoria del proyecto

> Claude Code lee este archivo al inicio de cada sesión. Mantenerlo **conciso**:
> orientación + decisiones + gotchas + punteros a `docs/`. El detalle va en `docs/`.
> NO poner secretos acá (solo nombres de env vars).

## Cómo trabajar con este usuario (preferencias — aplican siempre)
- **Español**, directo y conciso. No re-explicar lo ya decidido ni narrar opciones que no se van a tomar.
- **Validá con datos, NO asumas.** Es su preferencia #1. Antes de afirmar una causa, comprobala
  (consultá la DB por REST con la service key, corré el código, leé el archivo). Si no lo podés
  verificar, decilo — no maquilles ni inventes. Corregí explícitamente cuando algo que dijiste
  resultó mal.
- **Compilá antes de pushear:** `cd apps/web && pnpm exec tsc --noEmit` (hay `node_modules`).
- **Deploy:** commit + `git push origin HEAD:main` (Vercel deploya solo; rebasar si main avanzó).
- **Mergeá siempre sin preguntar:** cuando termina un cambio validado (tsc OK), abrí el PR y
  **mergealo directo** (squash a `main`) — no preguntes "¿lo mergeo?". Preferencia explícita del user.
- **Mantené esta memoria al día:** después de cualquier decisión/fix importante, actualizá este
  `CLAUDE.md` y/o `docs/` **proactivamente**, sin que te lo pidan.
- **Seguridad:** hay credenciales de producción en el entorno (service-role key, API keys). No
  las expongas ni las mandes a servicios externos. Desconfiá de herramientas de terceros que
  corran solas (hooks) cerca de este entorno.

## Qué es
Dashboard de marketing de **Drean** (electrodomésticos, Argentina). Monorepo Next.js en
`apps/web` (App Router, pnpm). ~17 dashboards: overview/objetivos, cuadros-basicos, floor-share,
web (GA4), redes (FB/IG), seo-search, performance (pauta), performance-conversion, influencia,
mercado (GFK), salud-marca (Kantar), mkt-canal, funnel, monitoreo, contenido, alerts, campaigns.
Data en Supabase; se alimenta con **cron syncs** (GitHub Actions → API routes `app/api/cron/*`)
y un **Apps Script "Sync Drive Tablero CB"** (Drive → Supabase, para CB/Floor-Share/Planning/
reporte_existencia/cb_homologos).

## Infra / accesos
- **Dos proyectos Supabase:**
  - **Principal** (`dashboard-mkt`, ref `vtcrhyyirqexczycuwhe`): web/GA4, meta (posts/paid),
    pauta, mercado, salud-marca, mkt_canal_acciones, etc. Env: `NEXT_PUBLIC_SUPABASE_URL` +
    `SUPABASE_SERVICE_ROLE_KEY`. Cliente server: `getServerSupabase()` (`lib/supabase-server.ts`).
  - **CB** (`dashboard-cb-fs`, ref `fsvdcpqzchrezkxflyfi`): `cuadro_basico_semanal`,
    `reporte_existencia`, `cb_homologos`, floor_share. Cliente: `getCbSupabase()`
    (`lib/supabase-cb.ts`). Env `CB_SUPABASE_*` con fallback al principal.
  - **Plan Supabase: Pro.** Disco de `dashboard-mkt` subido a 8 GB (era free/2 GB y se llenó —
    ver gotcha de web abajo).
- **IA:** OpenAI **gpt-4o-mini** vía fetch (`OPENAI_API_KEY`). DataForSEO (`DATAFORSEO_AUTH`) para
  trends/search volume. Meta/GA4/DV360 tokens en los crons.
- **Deploy:** push a `main` → Vercel deploya solo. (Rama designada por sesión: pushear con
  `git push origin HEAD:main`, rebasar si `main` avanzó.)
- **Sandbox:** `node_modules` se instala con `pnpm install`. Typecheck real:
  `cd apps/web && pnpm exec tsc --noEmit` (el `tsc` sin deps da miles de errores de entorno —
  no sirve). Acceso directo a la DB solo por REST con la service key (sin conexión DDL: las
  migraciones las corre el usuario en el SQL Editor de Supabase).

## Convenciones que importan
- **Dashboards de datos = siempre frescos:** cada `page.tsx` con data lleva
  `export const dynamic = "force-dynamic"` **y** `export const fetchCache = "force-no-store"`.
  Sin eso, Next cachea los fetch a Supabase y los paneles salen vacíos hasta refrescar.
- **Multi-tenant (Fase 0):** `lib/tenant/` (`getTenant()` devuelve Drean fijo). El código
  consume ese seam, no constantes. Al escalar a varias empresas, se resuelve el tenant ahí.
- **Copiloto de datos (chat):** motor genérico en `lib/chat/` + `components/data-chat.tsx` +
  `components/global-data-chat.tsx` (monta el chat según la URL) + `app/api/chat/route.ts`
  (loop de function-calling OpenAI). Extender a un dashboard = escribir `lib/chat/tools-<dash>.ts`
  (envolver query functions existentes) + registrarlo en `lib/chat/registry.ts` + sumar entrada
  en `global-data-chat.tsx`. El motor NO se toca.
- **Metas por KPI + sistema visual (SEGUIR SIEMPRE, valida ANTES de ejecutar — error recurrente):**
  Cuando se agregan metas a un dashboard NO alcanza con poner el `MetaPanel` (configurador):
  hay que **cablear la meta al gráfico y a los cards**, si no el usuario guarda y no cambia nada.
  Checklist obligatorio por dashboard:
  1. **Leer las metas server-side** en el `page.tsx` con `getMetaKpi(plan, kpi, anio)` de
     `lib/metas-server.ts` (trae valores mensuales `[12]` + config: dirección/umbrales/unidad).
     El `plan` = nombre del menú/catálogo (ej "Web / Ecommerce", "Facebook"). FB va con plan
     propio separado de IG.
  2. **Cards con `MetaKpiCard`** (`components/metas/meta-kpi-card.tsx`): headline = valor del
     **último mes con dato** (no el calendario) + dos filas de comparación **Mes** y **Acum. YTD**,
     cada una con semáforo + barra de avance. Alcance YTD = suma de meses; rate YTD =
     acumulado/acumulado vs promedio de metas.
  3. **Gráfico con meta**: barras reales + **barra de meta gris pizarra** (`IgAlcanceChart`) y/o
     líneas real+meta (`SocialEngagementChart`, componentes por prop). Etiquetas numéricas en las
     series reales. Ejes de ancho fijo (56px) para que los meses queden **alineados** entre
     gráficos apilados.
  4. **Paleta SOBRIA (respetar el sistema de IG):** datos reales en **azul** (`#1e40af`),
     meta en **gris pizarra** (`#cbd5e1`/`#64748b`), líneas en tinta (`#0f172a`); el
     **verde/amarillo/rojo (`SEMAFORO_COLOR`) es SOLO semáforo/estado**, nunca decorativo ni color
     de meta. Interacciones apiladas = rampa azul monocromática (`ENG_COLORS`).
  5. El guardado del `MetaPanel` ya hace **`router.refresh()`** → los server components toman la
     meta nueva sin recargar. El `MetaPanel` arranca **colapsable/cerrado**.
  Referencia canónica = `IgOrganicSection` + `FbOrganicSection`. Replicar SIEMPRE ese sistema
  (cards, gráficos, colores, método) en cada dashboard nuevo. **Validar este checklist antes de
  decir que las metas están "listas".**
- **Seguimiento Objetivos (`/overview`) — Mapa Estratégico → cumplimiento por categoría:**
  el índice se llama **"Seguimiento Objetivos"** y tiene 2 tabs: **"Estado de KPIs"** y **"OKR
  Mkt"** (los objetivos viejos). El tab "Estado de KPIs" trae un **selector interno General /
  Lavado / Refrigeración / Cocción** (`components/objetivos/seguimiento-view.tsx`, cliente): en
  cada vista muestra `ObjetivosHero` (hero-cards) + `KpiScorecard`. Las 4 vistas se precomputan
  server-side en UNA pasada (`objetivos-por-categoria.ts` → `getSeguimientoCompleto`, que junta
  `getSeguimientoObjetivos` (General) + `getSeguimientoPorCategoria` (las 3 cats); `getSeguimientoKpis`
  está memoizado por request con React `cache()` → la parte pesada corre una sola vez), y el selector
  cliente cambia al instante. `ObjetivosHero`/`KpiScorecard` son `"use client"`. **OJO perf:** NO
  envolver `getSeguimientoKpis` en `unstable_cache` — sus queries usan `getServerSupabase()` →
  `cookies()`, que explota fuera del scope del request (una vez rompió el dash: quedaba ~98% con
  cobertura 20%, calculado solo con CB/Floor Share que van por REST). Los `unstable_cache` OK son
  los REST service-key (sin cookies): `getWebIgCatRows`, `getWebMonthlySeguimiento`. **PERF (medido
  sep-2026 con instrumentación en el header del dash — `⏱ real` clic→pantalla + `server` por grupo):
  server bajó de ~50s a ~3s.** Lo dominaban DOS cosas:
  1. **Vistas web lentas** (agregan `web_landing_daily`, tabla enorme): `vw_drean_web_daily_kpis`
     (~6.7s) → reemplazada por `vw_drean_web_monthly` + `..._by_channel` (mensuales, ~10x); y
     `vw_drean_web_by_category` (~8.8s) → **precalculada** en `web_monthly_by_category` (migración
     0101) por el cron `web-cat-agg` (cada 6h); `getWebIgCatRows` la lee al instante (fallback a la
     vista si está vacía).
  2. **CB / Floor Share = EL CUELLO PRINCIPAL (~26s SOLO Floor Share).** `getCbRows({})` y
     `getFloorShareRows({})` **paginaban la tabla CB entera** (proyecto CB, lento, N round-trips
     seriales) **EN CADA render**. **OJO clave:** `unstable_cache` NO lo salvaba porque la página
     `/overview` tiene `fetchCache = "force-no-store"`, que **desactiva la Data Cache de todo lo que
     cuelga de ella** → la cache no persistía nunca (se medía el mismo tiempo en cada visita).
     **Solución (patrón correcto, = web):** el cron `trade-agg` (cada 6h, workflow_dispatch p/backfill)
     calcula el resultado mensual desde CB en background y lo guarda en la tabla `trade_monthly`
     (migración 0102, **proyecto PRINCIPAL**: cb_pct + fs_general/lavado/refri/coccion por mes). El
     render lee esas ~12 filas al instante (`getTradeMonthly` en `lib/trade-monthly.ts`, ~300ms). El
     cómputo lento (`computeTradeMonthlyFromCb`, mismo módulo) vive SOLO en el cron. NO volver a
     paginar CB/Floor Share desde el render del Seguimiento. (El `skipTrade` de `getSeguimientoKpis`
     quedó dormido — se probó un deferral cliente que movía los resultados al llegar; se descartó por
     el precálculo.)
  NO consultar esas vistas lentas ni las tablas CB directo desde el render del Seguimiento. Idea
  central: *si cumplís el 100% de las
  metas de los KPIs, cumplís el 100% de los objetivos estratégicos.* Piezas:
  - **Mapa** (`/mapa-estrategico`): modelo **aplanado** (`mapa-estrategico-config.ts`).
    Objetivo `{id,nombre,color,peso}` (peso estratégico, se normaliza a 100% entre objetivos).
    KPI `{nombre, vinculos:Record<objId,pesoInbound>, mix?:Record<cat,%>}`. Regla: **la suma de
    pesos inbound por objetivo se capa en 100%** (el editor lo fuerza). El **mix** (Brand/Lavado/
    Refrigeración/Cocción, suma 100) desglosa la meta total del KPI por categoría. **Persistido en
    la tabla `mapa_estrategico`** (singleton id=1, jsonb `objetivos`+`planes`) — NO localStorage
    (había un draft localStorage de safety, pero la **fuente de verdad es la DB**; una vez se
    perdió toda la config por guardar solo en localStorage → NUNCA volver a eso). Lee SSR con
    `getMapaConfig()` (`mapa-server.ts`), se pasa como `initial` al editor (sin fetch cliente que
    tarda por cold start). Guardado vía `/api/mapa-estrategico`.
  - **Rollup** (`objetivos-rollup.ts` → `getSeguimientoObjetivos`): `cumpl(KPI)=min(real/meta,100)`;
    `cumpl(objetivo)=Σ pesoInbound×cumpl(KPI)` (renormalizado sobre KPIs con dato → `cobertura`);
    **Salud de Marca** = Σ pesoEstratégico×cumpl(objetivo). Meta de negocio del objetivo =
    Σ (meta por categoría × peso categoría) con mix nov-25 (`categorias.ts`
    `CATEGORIA_PESOS`=Lav62/Ref35/Coc3). Metas de objetivos = plan **"Objetivos Estratégicos"** en
    `kpi_meta_valores` (por categoría Lavado/Refrigeración/Cocción).
  - **Desglose por categoría (reemplazó la capa Kantar):** cada KPI trae `realM` + **`realCatM`**
    (real por Brand/Lav/Refri/Cocc) desde `objetivos-kpis.ts`. SUM (alcance/impr/clicks/usuarios/
    alcance IG) = share de la fuente; Floor Share directo por góndola; **Avg Sesión/Frecuencia/
    VTR/CB/Tasa de conversión/Engagement = total** (mismo valor a las 3 — son KPIs "generales"
    por decisión del usuario). OJO: **Conversión queda total-only** porque
    `vw_drean_web_by_category` trae `conversiones=0` por categoría (el dato de conversión solo
    existe a nivel total en `vw_drean_web_daily_kpis`). El rollup usa el **mix del Mapa**: `meta_cat = metaTotal ×
    (mix[cat]+mix[Brand])` para SUM (meta igual en las 3 para tasas); **Brand suma a las 3
    categorías** (meta y real). `cumpl(objetivo,cat)=Σ peso×cumpl(KPI,cat)` y **`resultado =
    meta × cumpl/100`** → si los KPIs se cumplen al 100%, el resultado iguala la meta. Salud de
    Marca por cat = 0.25·Σ(TOM+SOM+IC+Poder). **Ya NO se usa `getDreanSerie`/Kantar en el rollup.**
  - **Mix cargado (sep-2026):** el usuario definió un mix **único** `Brand 30/Lavado 35/Refri 20/
    Cocción 15` aplicado a los 5 KPIs de suma (Alcance único, Impresiones, Clicks, Tráfico web
    usuarios, Alcance orgánico) — escrito en `mapa_estrategico`. Los demás (engagement, conversión,
    avg sesión, frecuencia, VTR, CB) son **generales** (total, sin mix). Estado DB validado: metas
    de objetivos completas (plan "Objetivos Estratégicos", 4 obj × 3 cat × 12 = 144 filas);
    objetivos = TOM/SOM/Intención/Poder (ids legacy `awareness/poder/impacto/o4` respectivamente,
    los 4 conectados). Shares reales OK (Pauta jul Brand 42/Refri 28/Cocc 22/Lav 7; Web usuarios
    Lav 38/Cocc 28/Refri 28/Brand 5; IG reach Lav 39/Refri 28/Cocc 17/Brand 16). **OJO:** como el
    mix se guarda en la config del Mapa, si el usuario re-guarda desde el editor debe conservarlo.
  - **Ojo:** Inversión (Pauta) NO va en el Mapa (no aporta a ningún objetivo) → se excluye del
    scorecard filtrado del hero. KPIs del scorecard: solo los mapeados en el Mapa. CB queda
    **total-only** (el proyecto CB no es alcanzable desde el sandbox; para CB por categoría hay que
    mapear la división de cada tienda). Componentes: `components/objetivos/{objetivos-hero,
    kpi-scorecard}.tsx`, `components/mapa-estrategico/mapa-editor.tsx`.

## Gotchas / decisiones (lo que costó tiempo — no re-litigar)
- **Pauta Mkt (`/performance`) — inversión: fuente de verdad POR MEDIO (dic-2026).** El dash
  brand **no mezcla ecommerce** (conversión/PMax/shopping va aparte, en `/performance-conversion`
  vía `pauta-conversion-queries`; **Performance Max se EXCLUYE** de Pauta Mkt). Fuente por medio:
  - **API (plataforma = fuente de verdad):** Meta → `meta_paid_creatives`; YouTube + Programmatic
    → `dv360_creatives` (por `canal`: DV360 tiene canales **YouTube / Programmatic / Marketplace**);
    Google Search + Demand Gen → `google_ads_creatives` (campaign_type SEARCH/DEMAND_GEN).
    **Google Ads NO tiene YouTube** (solo Search/DemandGen/PMax) — el YouTube corre por DV360.
  - **Carga manual en `pauta_performance`** (de los reportes mensuales de **OMD**, PDF): medios
    **sin API** → **TikTok, Mercado Ads (=Mercado Libre), Geo Mobile (=TapTap, pauta geolocalizada)**.
    Y los **tradicionales/offline** (TV Cable, OOH, DOOH) = **plan de medios aparte**, también manual.
  - **OJO 1:** en `pauta_performance` hay filas de **Meta manuales que NO coinciden con la API**
    (ej ago: pauta 13,4M vs `meta_paid_creatives` 62,7M). Para "plataforma = fuente de verdad" el
    dash debe leer Meta/Google/DV360 de la **API**, no de pauta → **dedup pendiente** (no sumar
    ambas fuentes para el mismo medio).
  - **OJO 2:** `pauta_performance.tipo_compra` es **NOT NULL** (usar "CPM"). Categorías válidas:
    Brand/Cocción/Lavado/Refrigeración/UGC/Promoción. Objetivos: Awareness/Consideración/Build.
  - **UGC:** el dash de Pauta Mkt **INCLUYE UGC** como una categoría más (`getPautaPerformance(true)`
    + `getMetaPaidCreatives(true)`, param `includeUgc`). UGC **también** sigue en `/influencia`
    (`getInfluenciaPerformance`/`getMetaUgcCreatives`) — se muestra en los dos. `brand-build-queries`
    NO incluye UGC (usa el default `includeUgc=false`) para no cambiar el overview estratégico.
  - Cargado **jun+jul 2026** (TikTok por categoría; Mercado/Geo como total del mes en categoría
    "Brand" — los reportes OMD no los abren por categoría). En jun/jul **no corrieron** DOOH ni
    Geo Mobile (jun) ni TV Cable (offline) — no son huecos de carga, no hubo pauta.
  - **Metas de Pauta Mkt (Impacto Campaña, dic-2026):** los tabs del dash se renombraron
    **Overview → "Impacto Campaña"** y **Por Medio → "Eficiencia Medios"** (las métricas de
    eficiencia se definen después). El tab Impacto Campaña arranca con **6 MetaKpiCards + 6 gráficos
    real vs meta + MetaPanel colapsable** (plan **"Pauta Mkt"**, sistema visual de IG). KPIs (claves
    exactas en `mapa-catalogo.ts` + `page.tsx` `PAUTA_KPIS` + MetaPanel): **Inversión** ($, suma),
    **Alcance único** (suma), **Frecuencia** (x, rate impr÷alc), **Impresiones** (suma), **VTR (≥50%)**
    (%, rate = video_p50/q50 ÷ impresiones de video), **Clicks** (suma). El "real" sale de
    `impactoMensual` en `performance-client.tsx` = **mismo modelo gap-fill que el Embudo/Volumetría**
    (OMD oficial + ejecución real de Meta/DV360/Google SOLO para medios sin plan OMD ese mes; DV360
    USD→ARS por fx del mes). **Año completo, SIN filtros**; solo meses **cerrados** (`i+1 < currentMonth`)
    → así se excluyen las filas plan de sep-nov (frec 7.0, clics 0) que hay cargadas en
    `pauta_performance`. Mes ref = último cerrado con ejecución. VTR≥50% NO se gap-fillea (es tasa de
    calidad). **OJO:** `Alcance único` es **suma de alcance por medio** (no dedup cross-media) — coincide
    con lo que el dash ya mostraba en las MoMStat; si algún día se quiere reach de-duplicado, hay que
    traerlo del consolidado del reporte OMD (hoy no está guardado por mes).
- **Mercado (GfK) — carga mensual:** el share de `mercado_share` se actualiza a mano desde
  exports "Brands Timeseries" de GfK (por REST, es dato no DDL). Set completo = **3 segmentos +
  Total × 3 KPIs**, por agregación (mensual + MAT). **Verificar la matriz completa ANTES de
  escribir** (si falta un KPI de un segmento, el clean-replace deja esa métrica en null y pisa lo
  que había). Mapeos de segmento por categoría + parseo mensual/MAT + gotchas en
  `docs/mercado-gfk-carga.md`. Ago-2026: el High de Cocción estaba con otra definición y se
  corrigió a `Width from 57`.
- **UGC — análisis cualitativo enriquecido:** el cron `app/api/cron/ugc-comments-analysis`
  NO analiza solo el texto de los comentarios: cada pieza entra al prompt con sus señales de
  interacción reales de la pauta (guardados, compartidos, reacciones, VTR, impresiones) de
  `meta_paid_creatives` (join por `instagram_permalink_url`), como **tasas sobre impresiones**
  comparadas contra el **promedio pooled del universo UGC** (ARRIBA/en línea/ABAJO). Esas señales
  **calibran las 3 variables cualitativas que ya existen** (credibilidad, intención, percepción)
  — NO hay score de resonancia ni campo nuevo en `Analysis`/`ugc_piece_analysis`. Regla anti-sesgo
  en el prompt: no marcar percepción negativa por pocos comentarios si guardados/compartidos/VTR
  están sobre el promedio (y sí negativo si la resonancia es genuinamente baja). Reprocesar =
  workflow "UGC comments analysis (LLM)" con `force`.
- **Frecuencia de crons (GitHub Actions):** revisado y bajado lo sobredimensionado (ago-2026,
  validado con data de ejecución): `rehost-thumbs` 3h→12h (miniaturas del CDN caducan en 1-2 días,
  ~1-5 nuevas/día), `ga4-sync` 6h→12h (GA4 llega hasta ayer, no carga el día en curso), `bgt-sync`
  6h→12h (presupuesto, cambia lento). Se dejan en alta frecuencia a propósito: `ig-sync-6h` (Stories
  caducan en 24h) y `watchdog`.
- **Reach orgánico de Facebook:** Meta deprecó el reach viejo (15-jun-2026). Se usa la métrica
  nueva **`post_total_media_view_unique`** (singular, "Total Unique Media Views"). Ojo:
  devuelve `lifetime` Y `day` con el mismo name → **leer lifetime, no day**. Se **excluyen
  posts pagos/boosteados** del gráfico orgánico (firma: reach fuera de escala + engagement casi
  nulo; ver `isPaidOutlier` en `lib/meta-fb-queries.ts`). El mes en curso es acumulativo (arranca
  bajo). Detalle: `docs/meta-fb-reach-deprecation.md`.
- **Redes — el OBJETIVO estratégico se mide solo con Instagram (dic-2026):** el dashboard
  sigue mostrando **todo** (IG orgánico, FB orgánico, el combinado IG+FB y el competitivo), pero
  la **meta del plan Redes en el Mapa** usa **solo valores IG del mes en curso**
  (`igOrganic.monthlyData` + seguidores IG). Motivo: FB deprecó su reach orgánico (15-jun-2026)
  y el reemplazo **no separa pago de orgánico** → no sirve para fijar/medir una meta. El
  `MetaPanel` de `app/redes/page.tsx` recibe `alcanceMes`/`interaccionesMes`/`engRateMes` (IG) y
  `igFollowers`. **No se sacó ninguna sección** del dashboard (el user lo pidió explícito).
- **FB REACH = DATO NO CONFIABLE — dos fuentes de contaminación (LEER antes de tocar el
  gráfico de FB).** El alcance de FB en `lib/meta-fb-queries.ts` se ensucia por DOS lados y
  las dos ya están tapadas — **no las destapes**:
  1. **Posteos pagos/boosteados a nivel post:** Meta cuenta el pago dentro del reach del post
     y NO lo separa del orgánico. Firma: reach fuera de escala (techo orgánico de la Página
     ~8K) con engagement casi nulo. Ej real 11-ago-2026: reach **188.724**, **67.124** video
     views, 23 reacciones (0,01%). Lo filtra `isPaidOutlier` (reach>20k && reac/reach<1%) y
     `getFbOrganicSummary` expone **`topPosts: organicPosts`** (ya filtrado) → no contamina
     cards, totales ni "top posts".
  2. **Tabla `meta_fb_monthly_reach` (reach mensual de la Página) ESTÁ ROTA:** la métrica
     nueva de Meta devuelve valores absurdos — **millones** (jul-2026 10,4M, may 10,1M) o
     inflados por pauta (ago-2026 **144.014** vs suma orgánica real **5.204**). El corte
     `REACH_SANE_MAX=2M` tapa los de millones pero NO los inflados por pauta (144k pasa).
     **Regla definitiva:** el reach ÚNICO de la Página **no puede superar la suma de reach de
     los posts orgánicos** del mes (dedup: page ≤ Σ posts). Si `pageReach > organicSum*1.1`,
     está inflado/roto → se usa la **suma orgánica de posts** (que ya excluye el pago). Los
     meses recientes quedan subestimados por la maduración (ver punto 3). **NO vuelvas a
     confiar en `meta_fb_monthly_reach` sin esa cota.** Al arreglarse: comparar `pageReach` vs
     `organicSum` con data real primero.
  3. **VENTANA DEL SYNC — el reach de posts es LIFETIME y madura por semanas.** El workflow
     `meta-fb-sync.yml` corre 2x/día y refresca solo los posts de los últimos **N días**
     (`?days=N`). Estaba en **3** (el default que quedó al CREAR el workflow, `eeced02`; NO una
     decisión afinada) → cada post se congelaba con el reach inmaduro a los 3 días y los meses
     recientes salían subestimados (ago-2026 daba ~5K cuando lo real es ~30-35K, como jul / jun).
     **Curva de maduración MEDIDA** (posts de jul, reach al 3-ago vs a los ~30 días de vida):
     +25% a +114% por post; jul pasó de 28K→35K solo por madurar. O sea **NO se estabiliza a los
     30 días** (eso fue una suposición equivocada de una sesión previa) — sigue creciendo hasta
     ~50-60. **Ventana en 70 días** para captar la maduración completa. Costo bajo: ~40 posts ×
     (1 insights + 1 HEAD idempotente) por corrida. **OJO:** en runs por
     SCHEDULE `inputs.days` viene vacío → cae al fallback del shell (`${DAYS_INPUT:-50}`), NO al
     `default` del `workflow_dispatch` → hay que tocar **los dos**. Backfill puntual de un hueco:
     Actions → "Meta FB sync" → Run workflow → days=90/200. **Diagnóstico de "mes bajo":** mirar
     `updated_at` de los posts del mes; si están frozen a los ~3 días de `fecha_post`, es la
     ventana (no el contenido).
- **Redes FB vs IG (histórico):** por post rinden parecido; IG usa `reach` (vivo), FB usa Media
  Views. Los gráficos de "total" engañan por volumen de posts (IG suma Stories que FB no expone).
- **CB — sugerencias de tiendas:** `reporte_existencia` (proyecto CB) alimenta `vw_cb_suggestions`.
  El sync del Apps Script hace **clean-replace** (borra e inserta) para que cada "Reporte U3"
  reemplace al anterior (no acumular fantasmas). Baseline = últimas 3 semanas de
  `cuadro_basico_semanal`. "Tiendas relevadas" del card global respeta el filtro (usa
  `totals.tiendas`, no el histórico).
- **Web (GA4) — timeouts:** las vistas derivadas de `web_landing_daily` (~113k filas/mes) hacían
  regex por fila y **timeouteaban** (statement_timeout 8s) → paneles vacíos (`safe()` lo escondía).
  Fix: **columna generada `categoria`/`sku` precomputada** (migración `0087`, corrida en SQL
  Editor) + **chunk semanal** (`splitRangeByWeek` en `lib/web-queries.ts`, no mensual). Causa raíz
  original: disco lleno en free tier → se subió a Pro + 8 GB.
- **Modelo:** el proyecto usa OpenAI (no Anthropic) para las features de IA existentes.
- **Monitoreo (Routine "System health check") — auto-fix POR GITHUB, no por Vercel/Supabase:**
  la tarea programada corre en un entorno cuya **política de red bloquea el egress a
  `dashboard-mkt-seven.vercel.app` (403 en el proxy/CONNECT)** y es poco confiable hacia Supabase;
  agregar el host al allowlist del environment **no surtió efecto** (probable policy server-managed
  de la org que lo pisa). **GitHub SÍ es alcanzable siempre** (proxy aparte). Por eso el Routine
  trabaja **solo por GitHub**: (A) `gh run list` por cada workflow de sync → re-disparar los
  fallados (`gh run rerun --failed` / `gh workflow run`); (B) leer el **Issue abierto del
  watchdog** ("🔴 Watchdog: procesos de datos con desvío") que `watchdog.yml` (cada 6h) arma con
  la frescura calculada server-side vía `/api/cron/health`. Auto-fix = re-disparar workflows o
  abrir+mergear PR (`claude/fix-monitoreo-*`, scope chico); Apps Script/manual (DV360, Planning,
  CB, Floor, GFK) no se pueden tocar desde ahí → anotar en `docs/monitoreo-fix-log.md` como
  pendiente humano. **No** hacer `curl` a Vercel ni Supabase desde el entorno programado.
  El `/api/cron/health` está gated por `CRON_SECRET` (solo si esa env var existe en prod);
  el valor vive en Vercel (proyecto Dashboard-Mkt) + GitHub Actions secrets + el entorno
  programado, y deben coincidir. Config del environment: claude.ai/code → environment del Routine.

## Punteros a docs/
`docs/architecture.md`, `docs/crons-github-actions.md`, `docs/guia-replicacion-y-seguridad.md`,
`docs/meta-fb-reach-deprecation.md`, **`docs/mercado-gfk-carga.md`** (carga mensual de mercado
GfK → `mercado_share`), y varios `*-sync.md` (dv360, google-ads, etc.). Los
`handoff-*.md` son notas de sesiones previas.
</content>
