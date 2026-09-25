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
  **Si tocás la frontera server/client (nuevo client component, imports cruzados), validá con
  `pnpm build` — NO solo `tsc`.** `tsc` NO detecta que un client component importe un módulo
  `server-only` (rompió el deploy de `/funnel`: el cliente importaba de `bgt-queries`). Regla:
  un `"use client"` solo puede importar de módulos server-only cosas de **tipo** (`import type`,
  se borran); las constantes/funciones puras compartidas van en un módulo client-safe.
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
- **Inteligencia (señales + Diagnóstico IA), portado de BIP (sep-2026):**
  - **Motor de señales** `lib/signals/` (determinístico, sin IA, sin tabla): reglas de BIP casi literales
    (`pauta/redes/web/seo/overview/cruces.ts`, entrada = `model.ts`) + reglas propias de Drean (`drean.ts`:
    CB, Floor Share, UGC, GfK, Kantar con cruce share↔TOM, Mkt Canal, ecommerce, BGT). `adapters.ts` (puro,
    testeado) arma las formas BIP desde las tablas de Drean; `sources.ts` (server) lee SOLO fuentes baratas/
    precalculadas (trade_monthly, fs_precomputed, vistas web mensuales, web_daily_by_category, …). Entrada:
    `computeSignals(dash?)` / `signalsSummaryForChat(dash, limit)` / `isSignalScope` en `lib/signals/index.ts`.
  - **Pauta = mismo modelo que el Seguimiento:** el gap-fill por medio se extrajo a `lib/pauta-medios-model.ts`
    (`buildPautaMediosMensual`); `computePautaImpacto` (objetivos-kpis) lo usa y da totales IDÉNTICOS (test).
    Señales: PMax fuera, OOH/TV/DOOH/radio = offline (contactos aparte), CPM mensual solo con medios con
    impresiones (`invConImpr`), filas OMD con inversión y sin impresiones → aviso `pauta_omd_sin_performance`.
    Validado con data real: ago-2026 Meta = $62,72M (API), la fila OMD $13,4M se ignora.
  - **Redes:** IG por pieza sin Stories; **FB solo posts ≥60 días** (reach lifetime inmaduro/no confiable).
  - **Diagnóstico IA** `/api/insights` (GET última versión / `?list=1` / `?version=id`; POST genera): pack por
    tablero (`lib/insights/datapack.ts`, tope 16k) + Seguimiento real vs meta + señales como "HALLAZGOS
    PRE-CALCULADOS" → JSON (diagnóstico, evolución, metas, correlaciones, hallazgos, plan, oportunidades). Una
    sola llamada, sin tools. Modelo env **`OPENAI_INSIGHTS_MODEL`** (default `gpt-4o-mini`). Señales:
    `/api/insights/signals?dash=`. Versiones en **`insights_report`** → **correr migración
    `0106_insights_report.sql`** (sin ella funciona pero no guarda historial).
  - **MENÚ ESTÁNDAR (pedido del user, sep-2026 — "que no haya tantas opciones de menú, arriba/abajo"):** en TODOS los
    tableros el orden es **título → "Cómo leer" → UN solo renglón de pestañas → contenido**. `<DashTabs dash=…>` envuelve
    la página (estado tablero|diagnóstico, `?vista=diagnostico`) y `<DashTabBar items=… active=… after=… diagBadge=…/>`
    (`components/diagnostico/dash-tabs.tsx`) es el renglón: vistas propias + **"Diagnóstico e Inteligencia"** (absorbe
    los viejos "Insights": Redes pasa su TopContent+Insights por `diagExtra`; `?tab=insights` abre Diagnóstico). Estilo
    = subrayado ámbar (el de Plan de Medios). En Diagnóstico se oculta por CSS todo lo que está DESPUÉS del renglón
    (`[data-dash-bar] ~ …` en globals.css), sin desmontar. Plan de Medios: su renglón interno = Impacto Campaña ·
    Eficiencia Medios · Diagnóstico e Inteligencia (reemplazó "Insights Pauta", el motor viejo se borró) · Pauta
    Competencia · Simulador (`PlanMediosSubnav` en las sub-rutas, mismo renglón; `/performance?tab=impacto|eficiencia|
    diagnostico`). CB (Overview/Sugerencias) y Salud de Marca (Lavado/Refri/Cocción/Marca) usan el mismo renglón.
    Pauta Ecommerce y Mkt Canal (iframe en un recuadro) también tienen Tablero · Diagnóstico; Contenido = título →
    Cómo leer → RRSS · UGC · Biblioteca UGC · Adaptación (mismo estilo). Monitoreo = una sola vista, sin pestañas.
    NO volver a poner barras de tabs arriba del título ni un segundo nivel de pestañas.
  - Test: `cd apps/web && npx tsx scripts/signals-drean.test.ts`.
- **Simulador, Pauta de la competencia, Alertas (portado de BIP, sep-2026):**
  - **Plan de Medios con sub-rutas** (`components/pauta/plan-medios-subnav.tsx`): `/performance` (Tablero, sin
    cambios) · `/performance/simulador` · `/performance/competencia`. El sidebar y `isPathAllowed` ya matchean
    por prefijo → quien ve `/performance` ve las sub-rutas.
  - **Simulador** (`lib/simulador.ts` puro + `lib/simulador-server.ts` + `components/simulador/`): curva
    `a·inversión^b` por MEDIO (log-log con ≥4 meses y R²≥0,3; si no, eficiencia promedio con b=0,8), calibrada al
    promedio de los últimos 3 meses cerrados; optimización greedy por retorno marginal con topes 50–200% (los
    medios sin la métrica quedan FIJOS). Meses por medio = `buildPautaMediosMensual` (año actual + anterior,
    PMax fuera, UGC dentro). Offline (TV/OOH/DOOH/radio, `OFFLINE_RE` de señales) = solo contactos. Alcance =
    suma por medio. "Geo Mobile" + "Medios directos" = un medio ("Geo Mobile (Tap Tap)"). Demanda: `search_volume`
    genérico → `forecastDemand`. Data real (sep-26): hay pauta solo desde abr-2026; ago trae muchas filas OMD con
    inversión y sin performance → esos medios se proyectan con su eficiencia de meses con dato (nota en la UI).
    Test: `npx tsx scripts/simulador.test.ts`.
  - **Pauta de la competencia** (`lib/ad-library{,-shared}.ts`, `lib/apify.ts`, `components/competencia-pauta/`):
    Biblioteca de anuncios de Meta vía Apify (`APIFY_API_TOKEN` + `APIFY_ACTOR_AD_LIBRARY`, default
    `apify~facebook-ads-scraper`). Marcas = propia + socialAccounts del tenant + `MARCAS` de competitive-config (sin
    emergentes, máx 10). Match por PALABRA completa del nombre de página ("LG" ≠ "algo"); Florencia/Orbis exigen
    contexto (cocinas/electro…). Tabla `competitor_ads_snapshot` = UNA FILA POR MARCA; cron
    `/api/cron/ad-library` (`?list=1` / `?marca=`) + workflow `ad-library.yml` (lunes 06:00 ART, fan-out por marca).
    Miniaturas espejadas con `mirrorMetaImage` (`adlib/<marca>/<id>.jpg`). **Primera corrida real (24-sep-2026): Apify 403
    "Monthly usage hard limit exceeded"** → la cuenta de Apify de Drean está al tope mensual; hay que subir el límite/plan
    en Apify y re-correr el workflow. La página muestra el motivo (`motivoError` en `lib/ad-library.ts`) en vez de "vacío".
    **Performance estimada (sep-2026, `lib/ad-intensity.ts` puro + `scripts/ad-intensity.test.ts`, MISMO archivo en BIP):** índice de
    intensidad por marca (activos 35% · mensajes distintos 20% · lanzados 30d 20% · sostenidos 30+ días 15% · plataformas 10%, 100 = máx del
    set), "avisos que más sostienen" (días al aire + versiones) y cruce aviso↔posteo orgánico (`social_posts` IG con `copy`, similitud de
    texto ≥0,5) → me gusta/comentarios/views reales (`getAdEngagement`). Validado 24-sep: 17 avisos cruzados. Meta NO publica alcance/
    inversión de anuncios comerciales en AR (verificado: el actor no trae métricas).
    Ambas pantallas (Simulador y Competencia) tienen un bloque **"Cómo funciona"** (`components/knowledge/como-funciona.tsx`).
  - **Alertas y reportes** (`/alerts`, reemplazó el placeholder; sidebar "Alertas y reportes"): `lib/alerts.ts`
    (server) + `lib/alerts-shared.ts` (puro) + `lib/notify.ts` (Resend REST). Candidatas = `computeSignals()` +
    KPIs del Seguimiento bajo `umbralAmarillo` (solo meses CERRADOS) + anuncios nuevos 7d de la competencia.
    Frecuencia (`alert_prefs`): `auto` = resumen semanal los lunes + diario SOLO si hay algo nuevo de prioridad alta.
    Reporte ejecutivo el 1er día hábil (mes cerrado: objetivos, KPIs con brecha, share of search Drean promedio de
    categorías, top alertas, Diagnóstico IA de `overview` si tiene <40 días). Crons `/api/cron/alertas` +
    `/api/cron/reporte-ejecutivo` (`?dry=1`, `?force=1`) + workflow `alertas.yml` (08:00 ART). "Qué te avisaríamos
    hoy" se pide por API al abrir (no en el render). Latido de crons en `alert_log` canal `cron` → `/monitoreo`.
    Validado con data real (dry-run): 12 alertas en ~10s; reporte ago-26 con 4 objetivos, 13 KPIs, SoS 21,5%.
  - **Pendiente para activar:** (1) correr **`supabase/migrations/0108_alertas.sql`** (competitor_ads_snapshot,
    alert_log, alert_prefs) — sin ella: snapshot vacío con aviso, prefs no se guardan, el diario no se envía;
    (2) env vars en **Vercel, proyecto Dashboard-Mkt** (`dashboard-mkt-seven.vercel.app`): **`RESEND_API_KEY`**,
    **`NOTIFY_FROM`** (remitente con dominio verificado en Resend; default `onboarding@resend.dev` solo entrega a la
    casilla de la cuenta Resend), **`ALERT_RECIPIENTS`** (CSV, fallback si /alerts no tiene destinatarios),
    **`APIFY_ACTOR_AD_LIBRARY`** (opcional) + `APIFY_API_TOKEN` (ya existe) + `NEXT_PUBLIC_APP_URL` (opcional, links).
    Test puro: `npx tsx scripts/alertas-adlib.test.ts`.
- **Copiloto v2 (motor de BIP) — sep-2026 ("Preguntale a tus datos"):** `app/api/chat/route.ts`
  responde **NDJSON** (`{"type":"step"}` en vivo "Consultando X…" + `{"type":"final",text,charts,
  tables,posts,steps}`), hasta **10 pasos**, tools **en paralelo**, rate limit 30/10min por usuario
  (`lib/chat/rate-limit.ts`, en memoria). Modelo por env **`OPENAI_CHAT_MODEL`** (default
  `gpt-4o-mini` por costo; se permite `gpt-4o`). **Cross-dashboard:** en cualquier dash el modelo ve
  TODOS los sets permitidos por `dashboard_access` (el de la página primero); `get_cruce_mensual`
  (series mensuales alineadas pauta/web/IG/SoS/demanda/trade/facturación/GfK/ecommerce) y
  `get_senales` solo para usuarios sin restricción. Piezas: `registry.ts` (sets por dash →
  `buildChatTools`), `copiloto.ts` (system prompt con método de cruce + `render_chart/table/posts`),
  `contexto.ts` (client-safe: ruta → label/foco/**sugerencias**; también define en qué rutas aparece
  el chat), `calc.ts` (copia pura de BIP: correlación/elasticidad/variación/participación/
  proyección a cierre/CPA/ROAS/reasignación), `pauta-model.ts` (mismo gap-fill del dash: Meta=API vía
  `lib/pauta-medios.ts` `esMedioApi`, OMD solo meses cerrados, PMax excluido), `tools-senales.ts`
  (contrato `signalsSummaryForChat`/`isSignalScope` de `@/lib/signals`; hoy `lib/signals/index.ts`
  es PLACEHOLDER vacío). UI: `components/data-chat.tsx` (lee NDJSON) + `components/chat/{mini-markdown,
  post-cards}.tsx`; `render_posts` recibe solo `ref`s (la tarjeta la arma el server). **No se perdió
  ninguna tool:** mismos nombres v1, ahora parametrizados (período/nivel/medio/categoría/top) y
  compactos; CB/FS leen mirror/`fs_precomputed`/`trade_monthly` (antes paginaban el proyecto CB). Se
  sumaron `get_seguimiento`, `get_mapa_estrategico`, `get_web_mensual/detalle`, `get_pauta_creativos`,
  `get_redes_competencia`, `get_ugc_piezas`, `get_inversion_mkt` (funnel) y chat en `/funnel` y
  `/mapa-estrategico`. Agregar un dash = `tools-<dash>.ts` + entrada en `registry.ts` + contexto en
  `contexto.ts`. **Gotchas de data vistos al validar:** `trade_monthly` trae un "Dic" del año en curso
  (semanas de dic del año anterior) y `mercado_share` tiene filas con mes futuro (2026-11) → las tools
  ignoran meses > hoy; `getIgOrganicSummary` corta en 200 posts (YTD subestimado).
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
- **KPIs de mercado con metas + Search Console (sep-2026, portado de BIP):**
  - **Plan del Mapa "Mercado y competencia"** (`mapa-catalogo.ts`; claves exactas = `MERCADO_KPIS` en
    `lib/mercado-kpis.ts`, puro/client-safe): **Share of Search** (Σvol Drean ÷ Σvol set, `vw_share_of_search`;
    por cat lavarropas→Lavado/heladeras→Refri/cocinas→Cocción; meses cerrados), **Share of engagement**
    (likes+coment. de `dreanargentina` ÷ set en `social_posts` IG+FB, ventana común — `shareOfEngagement` de
    `lib/signals/model`, total-only), **Visibilidad en IA** (`seo_llmo`, ignora corridas con 0 prompts: **sep-2026
    vino todo en 0** → usa ago y la card lo avisa), **Índice de posición SEO** (`seo_index_history`, **dirección
    "down"**). IA e índice: total = Σcat × `CATEGORIA_PESOS` renormalizado; son fotos (cuentan en el mes del
    relevamiento, incluso el en curso). Unidad del índice = `KpiUnit "pts"`. Real cableado en `getSeguimientoKpis`
    (con `realCatM` salvo SoE) vía `lib/mercado-kpis-server.ts` (REST service key + React `cache()`, ~1s). Solo
    suman al rollup si el usuario los conecta en el Mapa (hoy NO están conectados ni tienen metas).
  - **UI:** `/seo-search` arriba = `MercadoMetasSection` (MetaKpiCard con gráfico real vs meta DENTRO — prop
    `children` nueva — + MetaPanel plan "Mercado y competencia"); `/redes` = `ShareEngagementSection` antes del
    competitivo. `getMetaKpi(..., defaults)` y `MetaPanel` `KpiSpec.direccion` = dirección por defecto sin config.
    Valores reales (24-sep-2026): SoS ago 23,8% (Lav 41,8/Refri 9,7/Cocc 12,9); SoE ~1% (Gafa se lleva ~89%);
    IA ago 12,4%; índice ago 15,8 → sep 12,3.
  - **Search Console** (`lib/search-console.ts`): OAuth de env (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, el de
    GA4), propiedad `sc-domain:drean.com.ar` o URL-prefix (`pickSite`). Snapshot en **`search_console_snapshot`**
    (id=1) → **correr migración `0107_search_console.sql`**. Cron `/api/cron/search-console` + workflow
    `search-console-sync.yml` (martes 06:40 UTC + manual), registrado en `PROCS` (monitoreo/watchdog). UI al final
    de `/seo-search` con estados `no_table / empty / no_creds / no_scope / api_disabled / no_site`. Señales
    `cruce_sc_*` ya leen el snapshot (`loadCruces`). Error transitorio NO pisa un snapshot bueno.
  - **HABILITADO 24-sep-2026:** refresh token regenerado con 4 scopes (analytics.readonly + adwords + webmasters.readonly + spreadsheets.readonly) y pegado en Vercel. Validado en prod: SC `estado ok` (site `https://www.drean.com.ar/`, 13 meses, 250 queries, 25 páginas); GA4 y Google Ads siguen `auth OK`. Alertas: tablas 0106-0109 corridas, destinatarios cargados en `/alerts` (dry-run 12 alertas → 1 destinatario). Pasos de referencia (por si hay que regenerar): (1) Google Cloud del
    cliente OAuth (proyecto `994976985`) → habilitar **Google Search Console API**. (2) OAuth Playground
    (developers.google.com/oauthplayground) → ⚙ "Use your own OAuth credentials" con `GOOGLE_CLIENT_ID/SECRET`
    (el cliente debe tener `https://developers.google.com/oauthplayground` como redirect URI) → scopes
    **los 3**: `https://www.googleapis.com/auth/analytics.readonly` + `https://www.googleapis.com/auth/adwords` +
    `https://www.googleapis.com/auth/webmasters.readonly` (si falta uno se rompe GA4 o Google Ads) → autorizar
    con la cuenta Google que ve GA4, las cuentas de Ads **y** la propiedad drean.com.ar en Search Console (si no,
    darle acceso en SC → Configuración → Usuarios y permisos) → "Exchange authorization code for tokens".
    (3) Pegar el refresh token en Vercel `GOOGLE_REFRESH_TOKEN` (Production) + redeploy (si también está en
    GitHub secrets, actualizarlo). (4) Actions → "Search Console sync" → Run workflow. Validar: `ga4-sync` y
    `google-ads-sync` siguen OK.

## Proceso Estratégico (capa de aprendizaje, ex "Método BIP") — portado sep-2026
- **Marca: en Drean NO aparece "BIP"** (BIP es un proyecto aparte). La capa se llama **"Proceso Estratégico"** (sidebar, `/guia`, 🎓, copiloto). Ids de módulo sin `bip-`: `proceso-estrategico`, `conectar-fuentes`, `mapa-estrategico`, `insights-chat`, `tableros-planilla`. El test `guia-integridad` falla si un módulo dice "BIP". Solo quedan comentarios de código e identificadores internos (`.bip-viz`, evento `bip:learn`) y la landing `public/bip.html` (es de BIP, no del dash).
- `/guia` ("Proceso Estratégico", último ítem del sidebar) + `/guia/[id]`: 45 módulos estáticos en `lib/guia/*`
  (estratégico/táctico/operativo, atados a etapa Construir/Aprender/Optimizar/Acelerar, funnel, tableros y
  KPIs). Contenido de BIP **adaptado a Drean**: sin planes (Insight/Optimize/Accelerate), sin "Fuentes de
  datos"/Nango/planillas; "pestaña Insights" → **Diagnóstico IA**; los 4 módulos `bip-*` y `medios-offline`
  reescritos (Monitoreo conexiones, regla API vs OMD, Mapa TOM/SOM/Intención/Poder, BGT/GfK/CB). Ids
  heredados (`bip-*`, slugs `trade/inversion/resultados/conexiones`) se mapean en `DASH_HREF`/`dashLinks`
  (`lib/guia/index.ts`) a rutas reales de Drean. **`lib/guia/titulos.ts` es espejo manual** de títulos.
- `lib/knowledge.ts` (client-safe): `DASH_KNOW` por **slug de ruta de Drean** (16 tableros, incl. CB, Floor
  Share, Influencia, Mercado, Salud de Marca, Mkt Canal, Performance Conversión, Contenido, Monitoreo) +
  `KPI_KNOW` (54 KPIs; suma share valor/unidades, índice de precio, salud de marca, UGC credibilidad/
  intención/percepción) + `kpiKnowFor` por alias exacto.
- UI: `components/knowledge/` → `HowToRead` (franja `<details>` bajo el título de 14 dashboards; sin
  "use client", sirve en server y client), `LearnButton` (🎓; prop opcional **`learnKey`** en `MetaKpiCard`,
  cableado en Redes IG/FB, Plan de Medios y Web), `KnowledgePanel` (drawer, montado una vez en el layout,
  evento `bip:learn`). Todos los tableros tienen HowToRead (Mkt Canal y Contenido desde sep-2026).
- Acceso: `/guia` está en `ALWAYS_ALLOWED_PATHS` (`lib/dashboard-access.ts`) → visible aunque el usuario
  tenga `dashboard_access` restringido (no expone datos).
- Copiloto: tool `get_guia` (`lib/chat/tools-guia.ts`, buscar por texto/KPI/tablero o traer por id) en
  TODOS los dashboards y usuarios (`buildChatTools`); el prompt la usa para citar `[Título](/guia/<id>)` y
  `mini-markdown` renderiza links internos `/guia/...`.
- Test: `cd apps/web && npx tsx scripts/guia-integridad.test.ts` (ids, títulos espejo, KPIs, rutas, términos
  BIP-only). Pendiente (igual que BIP): pasar el contenido a tabla para editar sin deploy.

- **Mis tableros (motor de planillas) + Kantar por planilla — sep-2026 (portado de BIP, ADITIVO):**
  - **Qué es:** `/tableros` (lista + "Nuevo tablero" + Planillas + Kantar), `/tableros/[slug]` (vista: filtros de
    tablero, filtros cruzados, "Modo reporte" → imprimir/PDF, "Descargar datos" → Excel) y `/tableros/[slug]/editar`
    (builder 3 pasos: planilla → armar con **Tablero automático / Armalo con IA / + Gráfico** → guardar). Entrada
    "Mis tableros" en el sidebar (respeta `dashboard_access` vía `/tableros`). **No reemplaza** ningún dash nativo.
  - **Piezas:** motor PURO `lib/viz/*` (copia de BIP, client-safe; único cambio: `!` por `noUncheckedIndexedAccess`,
    solo tipos) · UI `components/viz/*` + `components/viz-builder/*` (recharts 2.12 OK; `ExportMenu` solo Excel, sin
    PNG porque Drean no tiene html-to-image) · persistencia `lib/tableros-server.ts` (REST service key) · API
    `app/api/tableros/{route,dataset,datasets,datasets/google-sheet,ai,kantar,kantar/plantilla}`. IA = OpenAI por
    fetch, modelo `OPENAI_INSIGHTS_MODEL` (default gpt-4o-mini), rate limit compartido del chat.
  - **CSS:** los componentes de BIP usan variables `--line/--ink/--navy/--muted…` → definidas SOLO bajo `.bip-viz`
    en `globals.css` (wrapper de las páginas; el portal del Modo reporte también lleva la clase). NO sacar el
    scope: `--muted`/`--card` de shadcn son HSL y se romperían en el resto del dash.
  - **DB:** migración **`0109_tableros.sql`** (principal): `tableros_datasets` (id uuid, name, columns/rows jsonb,
    row_count, source, updated_at) + `tableros` (slug pk, title, config jsonb v2). **Correrla en el SQL Editor**; sin
    ella las páginas muestran el aviso y todo lo demás sigue igual (validado: PostgREST da 404/PGRST205 →
    `TablerosMissingError`). Subida: 1ª hoja, fila 1 = encabezados, tope 20k filas / 4 MB. Dep nueva **`xlsx`**.
  - **Google Sheets:** usa el OAuth de GA4 (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`). Ese token se generó con
    `analytics.readonly` (+`adwords`) → la UI muestra **`no_scope`** y ofrece solo archivo. Habilitarlo: regenerar
    el refresh token en OAuth Playground con el client propio sumando `https://www.googleapis.com/auth/spreadsheets.readonly`
    (conservando los scopes actuales), pegarlo en `GOOGLE_REFRESH_TOKEN` de Vercel + redeploy, y compartir cada
    planilla con esa cuenta Google. No verificado desde el sandbox (no hay env de Google acá).
  - **Kantar por planilla (opcional):** config en la fila reservada `tableros.slug='cfg-kantar'` (mapeo de columnas
    con `lib/research-core.ts` de BIP + categorías). `lib/kantar-sheet.ts` → `getKantarData()`: sin config (o
    cualquier error) = **constantes de `salud-marca-model.ts` sin tocar**; con config = constantes + planilla **celda
    por celda** (solo pisa lo que la planilla trae). Solo olas medidas del eje actual (nov-23…nov-25 + jun);
    **nov-26 (proyección) y olas nuevas NO se aplican** (se informan) → para una ola nueva hay que extender el eje en
    el código. Aplica a `/salud-marca` (tabs por categoría + Marca vía `computeDreanConsolidado(series, true, kantar)`);
    **`/overview` Obj.4, el chat y las señales siguen con las constantes.** Plantilla: `/api/tableros/kantar/plantilla`.
  - **Copiloto:** `lib/chat/tools-archivos.ts` (`list_tableros_datasets` / `query_dataset`, como `list_archivos`/
    `query_archivo` de BIP), set `tableros` en `registry.ts` + contexto `/tableros` en `contexto.ts`.
  - **Tests:** `cd apps/web && npx tsx scripts/viz-engine.test.ts` (110 OK) · `npx tsx scripts/kantar-sheet.test.ts`
    (sin planilla = mismos números) · `npx tsx scripts/tableros-smoke.ts` (solo lectura contra la DB).

## Gotchas / decisiones (lo que costó tiempo — no re-litigar)
- **Inversión de Marketing (`/funnel`) — dash NATIVO (dic-2026, reemplazó el iframe).** Antes era
  un iframe a un HTML estático (`public/bgt-mkt/index.html`, Chart.js, cargaba `data.json` de
  GitHub). Ahora es React nativo con el sistema visual de la app: `app/funnel/page.tsx` (server) +
  `components/inversion/inversion-comparador.tsx` (client, Recharts) + `lib/bgt-dashboard.ts`
  (clasificación de cuentas EQUITY/VISIBILITY/… + lógica de cuatrimestres). Datos por `getBgtData()`
  (tabla `bgt_marketing`) + `getFacturacionMensual()`. Dos secciones: (1) **Ejecución del Presupuesto**
  = el ex-OKR Obj.1 (3 cuatrimestres con comparación FIJA Real 2026 vs BGT vigente: **T1·BGT, T2·4+8,
  T3·8+4**, desvío <5%, Inv/Fact ≤1,3%); (2) **Comparador libre A vs B** (selects de versión/período/
  cuenta/moneda, KPI cards, evolución + acumulado, distribución, árbol por concepto). Paleta: **A
  (REAL) azul `#1e40af`, B (comparación) gris pizarra `#94a3b8`**, verde/rojo solo desvíos. Nota:
  `8+4 2026` todavía NO está cargado en `bgt_marketing` → T3 sale "no cargada". **PENDIENTE:** el
  usuario quiere **borrar el tab "OKR Mkt" de `/overview`** una vez que valide este dash (Obj.1 ya
  vive acá; Obj.2/3/4 = Floor Share/CB/Salud de Marca ya están en sus dashboards). El iframe viejo
  (`public/bgt-mkt/`) quedó sin uso — se puede borrar.
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
  - **OJO 1 — RESUELTO (dic-2026): Meta = fuente de verdad SIEMPRE la API, nunca OMD.** En
    `pauta_performance` OMD cargaba una fila de **Meta que subcontaba** (ej ago-26 OMD **$13,4M** =
    solo awareness+tráfico, vs API `meta_paid_creatives` **$62,7M** → dejaba afuera **$49,3M de
    video-views/ThruPlay**; ese hueco era el burst de 3 días de las campañas `_Diario`). El dash
    priorizaba OMD si el medio tenía fila OMD, así que el gap-fill de la API quedaba bloqueado
    **solo para Meta** (YouTube/Programmatic/Google ya venían por API porque OMD no los carga).
    **Fix (`performance-client.tsx`): `const API_MEDIOS = new Set(["Meta"])` + `esMedioApi()` →
    Meta se EXCLUYE de todas las agregaciones OMD** (`rows`, `rowsNoMes`, `impactoMensual`, modelo
    de ejecución de presupuesto, `catDonutData`) y entra por el gap-fill de la API en TODOS los
    modelos (medioModel/catModel/rolModel/monthTotals/impacto/cuatrimestres) → inversión,
    impresiones, alcance, clicks y VTR de Meta salen de la API. `data` cruda queda intacta (Meta
    sigue como opción de filtro). Regla general: **medio con API conectada → volumen de la API;
    OMD solo para medios SIN API** (OOH, TV, DOOH, TikTok, Mercado Ads, Geo). Si algún día OMD
    carga otro medio-API (ej Google), sumarlo al set `API_MEDIOS`.
  - **Regla compartida (sep-2026):** `API_MEDIOS`/`esMedioApi` viven en `lib/pauta-medios.ts` y los usan
    `performance-client.tsx` **y** `objetivos-kpis.ts` (Seguimiento). Antes el Seguimiento NO excluía la fila
    OMD de Meta → **ago-2026 subcontaba $49,3M** (OMD $13,4M vs API $62,7M, validado por REST). No duplicar la regla.
  - **OJO 2:** `pauta_performance.tipo_compra` es **NOT NULL** (usar "CPM"). Categorías válidas:
    Brand/Cocción/Lavado/Refrigeración/UGC/Promoción. Objetivos: Awareness/Consideración/Build.
  - **UGC:** el dash de Pauta Mkt **INCLUYE UGC** como una categoría más (`getPautaPerformance(true)`
    + `getMetaPaidCreatives(true)`, param `includeUgc`). UGC **también** sigue en `/influencia`
    (`getInfluenciaPerformance`/`getMetaUgcCreatives`) — se muestra en los dos. `brand-build-queries`
    NO incluye UGC (usa el default `includeUgc=false`) para no cambiar el overview estratégico.
  - Cargado **jun+jul 2026** desde los **reportes OMD mensuales** (PDF "Drean Report"): inversión +
    **performance** (impresiones/alcance/frecuencia/clics/views) por categoría. TikTok abre por
    categoría (Cocción/Lavado/UGC/Refri); Mercado Ads y Geo Mobile (="Medios directos"/Tap Tap)
    reparten impr/clics proporcional a la inversión ya cargada (el reporte da el total, no lo abre
    por categoría). Jul Medios directos (Tap Tap) = **$9.189.124,60** (valor oficial de la planilla
    OMD digital; NO el "MEDIA COST" $9,62M del PDF, que es bruto/con fee). Jun no tiene Tap Tap en el
    reporte. **OJO fuentes jun/jul:** `meta_paid_creatives` trae SOLO `meta` y `dv360_creatives` solo
    YouTube+Programmatic → TikTok/Mercado Ads/Geo NO tienen contraparte API, son 100% OMD-manual (sin
    riesgo de doble conteo en el gap-fill). El `views` de `pauta_performance` es **inerte para el VTR**
    (el VTR≥50% de las cards sale de `video_p50`/`q50` de Meta+DV360, no de esta columna). **OOH = dato
    fijo (gran formato), no cambia** ($10M jun / $35,5M jul) — no tocar.
  - **Reconciliación vs planilla OMD (solo digital, sep-2026): dash < OMD por DATA FALTANTE en JUNIO,
    no por cálculo.** OMD digital jun $44,17M / jul $109,86M. **Meta matchea al peso** (API) y los
    manuales también. El hueco es 100% API/DV360 de junio: (1) **DV360 YouTube jun cargó PARCIAL**
    (`dv360_creatives` jun = 6 creativos, US$3.475 ≈ $5,15M ARS vs OMD $16,5M → faltan ~$11,4M; jul
    está完整); (2) **Google jun SIN sincronizar** (`google_ads_creatives`/`ga4_google_ads_daily`
    vacíos en junio → $0 vs $4,02M); (3) Programmatic jun −$0,8M. Julio, al revés, queda **+$3,4M por
    ARRIBA**: DV360 se convierte `revenue_usd × fx` del mes y da ~5-8% más que el costo booked de OMD
    (approach aproximado). Google jun → re-disparar `google-ads-sync.yml` con `days≥120`
    (workflow_dispatch, aditivo). No cargar DV360/Google a mano en `pauta_performance` (rompe la regla
    "medio con API → volumen de la API").
  - **DV360 junio VOLVIÓ a quedar truncado (validado REST 24-sep-2026):** `dv360_creatives` jun-26 = **US$4.514**
  (Programmatic 2.557 + YouTube 1.957) vs la recarga completa de US$17.108 → el `syncDv360` diario lo re-pisó con
  CSV parcial (el pendiente de "recurrencia" se materializó). Ago-26 también sospechoso (US$9.081 vs jul US$39.073).
  Fix de fondo = rango fijo/largo en el reporte "DV360 Video Drean" o que `syncDv360` no reescriba un mes con CSV parcial.
- **DV360 subcuenta meses viejos — CONFIRMADO con el CSV real (sep-2026).** DV360 NO se carga
    manual: el Apps Script "Sync Drive Tablero CB" (`syncDv360`) lee el CSV del reporte "DV360 Video
    Drean" desde Gmail (`.zip`) y hace `delete WHERE mes IN (meses del CSV) + insert` → solo toca los
    meses presentes en el CSV. **Validado bajando un export ad-hoc de junio COMPLETO (01→30) de DV360
    (Advertiser Drean Argentina):** junio real = **US$17.108 (YouTube US$11.722 + Programmatic
    US$5.386) = $25,35M ARS** (≈ OMD $23,8M). La base tenía solo **US$7.868 ($11,66M)** → subcontaba
    ~$13,7M (sobre todo YouTube: real US$11.722 vs base US$3.475). O sea el undercount es REAL, no
    diferencia de definición. **CORREGIDO:** se cargó junio en `dv360_creatives` desde ese CSV
    (agregando `mes|canal|categoría|rol|creative` como el Apps Script; delete jun + insert 46 filas) →
    junio quedó en US$17.108/$25,35M. Google junio también estaba vacío → se re-disparó
    `google-ads-sync` (days=150) y cargó ($4,02M = OMD). **Meta (API) siempre matcheó OMD al peso** —
    el bug es solo del pipeline DV360. **PENDIENTES:** (1) **abril ($578K) y mayo ($1,48M) siguen
    truncados** — mismo fix: bajar su CSV mensual completo de DV360 y recargar igual. (2) **Recurrencia:
    el reporte "DV360 Video Drean" (ID 1693465149) entrega junio PARCIAL en la corrida diaria** (por
    eso la base quedaba baja) → hay que **revisar/ampliar el Date Range del reporte** (fijo/largo) o
    endurecer `syncDv360` para no reescribir un mes con CSV parcial. El export ad-hoc de mes completo
    SÍ trae todo, así que el fix es el rango del reporte programado. **DV360 se ve en
    displayvideo.google.com → Insights → Reports.**
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
- **CB / Floor Share (`/cuadros-basicos`, `/floor-share`) — PERF: MIRROR al principal (cron).**
  `getCbRows`/`getFloorShareRows` leen el **proyecto CB, que es lento POR QUERY** (throughput, no
  round-trips: paginar en paralelo NO alcanzó, 23s→21s). Floor Share tenía **~135k filas** → CB 5.9s,
  FS 21s EN CADA visita. Fix (patrón definitivo): el cron **`cb-mirror`** (1x/día, `workflow_dispatch`)
  copia `cuadro_basico_semanal` + `floor_share` (últimas 30 sem) + tienda→cliente a tablas **mirror
  del proyecto PRINCIPAL** (`cb_semanal_mirror`, `floor_share_mirror`, `cb_tienda_cliente_mirror` —
  migración 0104). Los dashboards leen el mirror por REST **paralelo con PAGE=10000** (`getCbRowsFast`/
  `getFloorShareRowsFast` en `lib/cb-mirror.ts`), fallback al proyecto CB si el mirror está vacío. CB
  quedó ~2.9s. **Floor Share (135k filas) además PRECALCULA la vista default** (agregar 135k en JS
  costaba ~6s): `computeFsView` (`lib/fs-view.ts`, función pura) se corre en el cron y se guarda como
  JSON en `fs_precomputed` (migración 0105); el dash lee esa fila al instante en la vista default
  (**12s→1.1s**), y con filtros activos computa sobre el mirror. **OJO cron:** derivar las semanas de
  los propios datos (getAvailableWeeks al CB daba vacío → vista vacía); y el DELETE del clean-replace
  debe matchear filas `semana` NULL (`or=(semana.gte.0,semana.is.null)`) o se acumulan. Ambos usan el
  card sobrio `KpiObjCard` (semáforo).
- **Web (GA4) — timeouts:** las vistas derivadas de `web_landing_daily` (~113k filas/mes) hacían
  regex por fila y **timeouteaban** (statement_timeout 8s) → paneles vacíos (`safe()` lo escondía).
  Fix: **columna generada `categoria`/`sku` precomputada** (migración `0087`, corrida en SQL
  Editor) + **chunk semanal** (`splitRangeByWeek` en `lib/web-queries.ts`, no mensual). Causa raíz
  original: disco lleno en free tier → se subió a Pro + 8 GB.
- **Web (`/web`) — PERF: de 27.9s a 3.3s (medido con `⏱ real` + instrumentación por query).**
  El dash disparaba ~25 queries en paralelo y el cuello NO era una query sola sino **CONTENCIÓN**:
  el YoY traía **24 meses de datos DIARIOS** → `getWebDailyKpis` partía en **~104 queries
  semanales concurrentes** contra las vistas pesadas de `web_landing_daily`, ahogando Postgres →
  `byCategory` saltaba a **26.8s** (vs 2.9s aislada) y `latestWebDate` a 18.8s. OJO: en el sandbox
  cada query va sola y es rápida → el problema SOLO se ve en Vercel con todo junto; medir con la
  instrumentación en el header, no desde el sandbox. Fixes (mismo patrón que Seguimiento): (1)
  **YoY desde vistas MENSUALES** (`getWebMonthlyKpis`: `vw_drean_web_monthly` + `..._by_channel`,
  2 queries) en vez de 24 meses diarios → mata las ~104 concurrentes; (2) **`getLatestWebDate` a la
  tabla base** `web_landing_daily` (indexada) en vez de la vista; (3) **`byCategory` PRECALCULADA**:
  el cron `web-cat-agg` ahora llena también `web_daily_by_category` (diario×categoría, año actual+
  anterior, con pageviews+bounce — migración 0103), y `getWebByCategory` lee esa tabla al instante
  (fallback a la vista si el rango no está). Al sacar byCategory + la contención, topProducts/
  demographics/ecom cayeron solos. Techo actual = `getWebMonthlyKpis` ~2.8s (se puede precalcular si
  hace falta). NO volver a traer 24 meses de datos diarios ni pegarle a las vistas `web_landing_daily`
  para agregados históricos.
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

## Assets de marketing
- **Video demo 50s (`marketing/video-demo/`):** video de producto 16:9 sin personas que recorre el
  ciclo del modelo estratégico (objetivos → KPIs y pesos → metas mensuales → seguimiento real vs
  meta y GAPs → insights → optimización → recalibración anual), con cursor y escritura real en los
  formularios. Cierre: "Learn what matters. Drive results." **NO es un screen recording:** es una
  animación HTML determinística (`index.html` + `app.js`, todo el estado sale de `window.__seek(t)`)
  que `render.mjs` captura frame a frame con Chromium y pipea a ffmpeg → reproducible al frame.
  Salida versionada en `marketing/video-demo/export/demo-50s.mp4` (1920x1080, 30fps, ~3 MB).
  Re-render: `cd marketing/video-demo && node render.mjs` (necesita playwright + ffmpeg con libx264;
  fuente Inter para que los textos rendericen igual). El ritmo se ajusta con `DUR` en `app.js` (los sub-tiempos están escritos en escala
  de 30s y el motor los estira con `SPEED`; era de 30s y el user lo pidió más pausado, a 50s). Números ilustrativos (no salen de Supabase): para una versión con data real se
  reemplazan `TOM_META`/`TOM_REAL`/`ALC_*` y la matriz `MX` en `app.js`. Detalle: su `README.md`.

- **Video TOUR de la plataforma (`marketing/video-tour/`, dic-2026 · v4 scroll ~61s):** recorrido
  **dashboard por dashboard** (walkthrough del producto; complementa al video-demo que explica el
  *modelo*). **Sin marca Drean ni data real:** marca ficticia **"Novara"** + competidores inventados
  (Vanté/Kova/Areté/Belmar/Aurex), pill "Datos ilustrativos". Misma técnica que video-demo (HTML
  determinístico `index.html`+`app.js`, `window.__seek(t)`, `render.mjs`→ffmpeg libx264). **Réplica
  FIEL** del sistema visual real de cada dash (se relevó el código real con agentes Explore + una
  tanda grande de screenshots del user): MetaKpiCards con filas Mes/YTD + semáforo, scorecard con
  desvío + sparkline, tabla maestra por medio, piezas con métricas de pauta (`pieceCard`), ranking de
  marcas, sentimiento stacked, donut, combo dual-axis, KpiObjCard, cuatri Real-vs-BGT, comparador A/B.
  Escenas (en **segundos reales**, `SPEED=1`, `DUR=61`): intro · **Mapa Estratégico** (KPI→objetivo
  con pesos, la tesis) · Seguimiento (obj TOM/SOM/Intención/Poder, 25% c/u) · Plan de Medios · Redes
  IG · Redes competitivo · Web · Trade · **Copiloto** (insight cross-dash Pauta→VTR→Intención→Fact.) ·
  Inversión · cierre. **v4 (reescritura sobre v2, pedidos del user):** (1) **scroll por dash** — cada
  escena muestra la parte principal arriba y **escrolea hacia abajo** para revelar tablas/gráficos
  (contenido más alto que el viewport en `.scrollinner`, animado por `pageScroll` con `translateY` +
  barra `.sbar`) → da profundidad y conexión KPI↔objetivo dentro de un mismo dash; (2) **gráficos con
  ejes y leyendas, no "volando"** — helpers SVG `svgBars`/`svgLine`/`svgCombo` (ticks, gridlines,
  labels de valor, meses, doble eje real/meta); (3) **más ágil** (~117s→~61s, transiciones rápidas);
  (4) **Copiloto IA SACADO del menú lateral** (pedido: "eso no va") → `NAV` tiene **8 ítems** (Seguim.,
  Mapa, Plan de Medios, Redes, Web, Trade, Salud de Marca, Inversión); la escena Copiloto sigue en el
  video pero monta `shell('web')` (no resalta ítem). **GOTCHA clave:** un SVG `<path>` creado con
  `mk('<path/>')` NO se parsea como SVG (queda HTMLUnknownElement, sin `getTotalLength` y no
  renderiza) → los paths van SIEMPRE dentro del `<svg>` del template. **PENDIENTE:** el MP4 commiteado
  (d7cfd97) aún muestra Copiloto en el menú → **re-render pendiente** (se difirió para batchear con
  los próximos cambios); **Trade** se armó desde memoria (falta screenshot del user para calibrar); el
  user seguirá con más ajustes. Detalle y plan en `marketing/video-tour/HANDOFF.md` + `README.md`.

- **Video "Primeros pasos en BIP" (`marketing/video-primeros-pasos/`, sep-2026, 108s):** para quien YA creó su cuenta:
  sign in → "Contanos de tu marca" → modelo de impacto → "Antes de conectar" → réplicas de las pantallas REALES de
  Meta (Facebook Login for Business + Nango) y Google (selector de cuenta + consentimiento) → elegir Página/cuenta/
  sitio → "Listo" → tableros → cierre "Listo. Así de simple." (termina en los tableros: SIN objetivos/metas/Ayuda).
  Reglas de copy: sin TikTok ni Planillas; nada de miedo ("nunca publica/edita/gasta") → solo lo que hace BIP
  ("solo lee tus datos para mostrártelos en tus tableros"). Marca ficticia "Aurora". Espejo de
  `lib/access-requirements.ts` de BIP. Detalle en su README.

- **Video "Sumá tus planillas a BIP" (`marketing/video-planillas/`, sep-2026, 80s):** Google Sheets (Picker) /
  Excel OneDrive-SharePoint (Nango + ventanas reales de Microsoft) / archivo → columnas → tablero. Mismo motor.
- **Videos "Armá tu Mapa Estratégico" (`marketing/video-objetivos/`, 35s) y "Cargá tus metas" (`marketing/video-metas/`,
  39s), sep-2026:** separados a pedido del user (el mapa por un lado, las metas por otro). Ritmo ÁGIL (la v1 de 78s fue
  "lentísima": en estos videos, escenas de 4-12s). El del mapa muestra agregar objetivo → agregar PLAN → agregar KPIs.
- **Video "Seguimiento de objetivos" (`marketing/video-seguimiento/`, 41s):** qué tiene que estar cargado antes → cómo se
  arma → cómo se lee. En BIP en /overview. Las metas del video de metas se cargan **de enero a diciembre** (pedido del user).
- **Videos en BIP (momentos de verdad):** se copian a `bip-platform/public/videos/<id>.mp4` + `<id>-poster.jpg` y se
  muestran con `components/video-guide.tsx` (`VIDEOS`); el de primeros pasos está en Fuentes de datos, `/empezar`
  (Conectar) y el mail de bienvenida (miniatura → `/video/primeros-pasos`, pública). Regla del user: **video en
  cada momento de verdad de los primeros minutos**.
- **Mails del recorrido con video (BIP, sep-2026):** si falta un paso de configuración, el mail del CRM lleva la
  miniatura del video (▶ → `/video/<id>`, pública): `activar_conexion` (sin fuentes, 1+ día) → primeros-pasos ·
  `activar_mapa` → objetivos · `activar_metas` → metas · `sumar_fuente` → planillas · `inactivo_7d` (con mapa y
  metas) → seguimiento. Catálogo único en `bip-platform/lib/videos.ts`; `journeyHtml(lines, cta, video)` arma todos los
  mails con el tono (saludo, gracias, un botón, cierre cálido + info@roque-in.com).
- **TONO de toda comunicación al cliente de BIP (mails, pantallas; pedido del user sep-2026):** minimalista, cálida,
  que empuje a avanzar. Siempre **saludar, agradecer, UN paso claro, cerrar con un mensaje lindo** (cliente
  "mimado", acompañado, foco en mejorar su negocio). Nada de listas largas ni de "lo que no hacemos"; el detalle va
  plegado en la app. Sin "gratis". TikTok = "muy pronto" (landing y Fuentes de datos).

- **Web BIP para la agencia Roque (`marketing/web-roque/bip/`, sep-2026):** copia de `bip.html` para que Roque la
  suba en SU web (NO toca bip-go.com): WhatsApp **+54 9 11 2188-0437** (botón flotante + link en el cierre y el pie),
  email info@roque-in.com, rutas de assets relativas (`bip/hero.png`, `bip/demo.mp4`). Se entrega como zip.
- **Web comercial BIP (`apps/web/public/bip.html` + artifact):** landing de venta. Los 3 planes
  (Insight/Optimize/Accelerate) se arman por JS (arrays `PLANS`/`MODULES`/`FULL`). El artifact
  compartible **`bip-web.html`** (id `f98ddfbe-b163-4a01-84bc-9dfde6456c6b`) es self-contained: se
  **regenera desde `bip.html`** swapeando `src="/bip/hero.png"` y `src="/bip/demo.mp4"` a base64
  (script python, ~6.3MB) y se republica con `url`. `/bip.html` es público por Vercel (middleware
  `BYPASS_PATHS` incluye `/bip`) y **siempre está al día**; el artifact muestra a terceros una versión
  *pinneada* (re-pinear al actualizar). **Fix dic-2026:** el recuadro `.spec` (usuarios·categorías)
  hacía wrap a 2 líneas en Optimize y desalineaba el "Incluye" → se forzó a 1 línea (`white-space:nowrap`
  + `min-height:44px`) y se igualaron alturas de `.pitch` (min-height) y `.sr-k` (nowrap). `pricing.html`
  (racional de precios) es otra estructura, no tiene esas tarjetas.
  **Reescritura de venta (sep-2026):** contenido alineado a `lib/plan.ts` de BIP (FUENTE ÚNICA: usuarios 1/4/10,
  historial 6/12/24, cat 1/2/3, competidores —/5/10+retailers, alertas in-app / +semanal email / +diarias+reporte
  ejecutivo; SEO/Search Console/Trade desde Optimize; Simulador/Ad Library/Salud de Marca en Accelerate). **Share de mercado =
  dato de Resultados Comerciales (ventas, share, índice de precio, cobertura) en TODOS los planes, no es Research** (pedido del user). Escalera de preguntas
  **(se revirtió a pedido del user: NO tocar portada/storytelling/mensajes madre ni usar la palabra "gratis" — el
  concepto central es "Tener una estrategia no te asegura lograr tus resultados"; solo se retrabajan los planes)**,
  tarjetas con "Todo X, más:" + teaser del plan siguiente, Optimize
  "Recomendado", módulos con badge de plan, FAQ nueva. Se sacó "Consultoría estratégica" (no está en plan.ts), el
  WhatsApp (número placeholder) y `hola@bip.com` (dominio ajeno → `info@roque-in.com`, pedido del user). Se agregó doctype +
  `<meta charset>` (había mojibake). bip-go.com (Netlify) NO se actualiza solo: re-subir `bip.html`.

- **Generador de Contenido — Calendario + publicación IG/FB (dic-2026):** `/contenido` →
  `/contenido/calendario` (tabs: RRSS, UGC, Biblioteca UGC, Adaptación de piezas). Las piezas viven en
  `contenido_calendario` (migs 0075-0090); flujo Generar→Diseñar→Biblioteca→**Distribuir** (fecha/hora/
  redes). **Grilla mensual restaurada** (`MonthGrid` en `contenido/calendario/page.tsx`: piezas por día
  por estado; tocar un día lo selecciona). **Publicación a Meta** (orgánica) por `lib/meta-publish.ts`
  (Graph v22): manual (`api/contenido/calendario/publicar|retirar`) y **automática** (`api/cron/
  publicar-contenido`, workflow `publicar-contenido.yml` **cron */30 ACTIVO** — publica las **aprobadas**
  cuya fecha/hora llegó). **Permisos Meta validados sep-2026:** token system-user sin vencimiento; Página
  **Drean** + IG **@dreanargentina** vinculados; scopes `pages_manage_posts` + `instagram_content_publish`
  OK → **publicar a IG+FB funciona**. **Falta `instagram_manage_contents`** → borrar de IG por API NO
  (FB sí; IG se borra a mano). **OJO seguridad:** el diag `api/diag/meta-publish-access` devuelve un Page
  token real — no compartirlo. **Adaptación de piezas** (reframe IA, `lib/pauta-formatos.ts`): imagen
  1:1/4:5/9:16/1.91:1, video 9:16/1:1/16:9 (Meta, Demand Gen, YouTube/DV360, TikTok). Detalle completo en
  `docs/calendario-publicacion-meta.md`.

## Entorno de trabajo y herramientas (setup sep-2026)
> Skills, plugins y Setup script se cargan al **INICIAR la sesión**. Si algo no aparece, abrí una
> sesión nueva. Al dar pasos de setup/tooling: **leer la doc oficial** (`code.claude.com/docs`, tool
> `read_documentation`) ANTES — no adivinar la UI (error recurrente).
- **MarkItDown** instalado por el **Setup script del environment** (`pip install 'markitdown[all]'`
  **+ `pip install --force-reinstall cffi`**). OJO: `cffi`/`_cffi_backend` viene **roto** en el
  contenedor base → markitdown/pypdf crashean sin ese reinstall. Convierte PDF/Office/imágenes →
  Markdown (ahorra tokens; usar para leer reportes OMD y demás).
- **Perplexity** = MCP en claude.ai (OAuth; Sonar API paga, ~US$10 cargados). Tools
  `perplexity_search/ask/reason/research`.
- **Plugins (cuenta):** instalados y activos en claude.ai → Settings → Plugins → "Yours" (**14** al
  23-sep-2026, incl. Data, Marketing, Engineering, Design, Productivity, Finance…), **activados ANTES de
  abrir la sesión**. Pero en la sesión cloud de Claude Code **NO llegan**: `ListPlugins` vacío y el
  directorio de sync del contenedor (`~/.claude/plugins/synced/<org>/`) vacío. O sea, no es un tema
  de timing. **Evidencia (log de diagnóstico del contenedor, `$CLAUDE_CODE_DIAGNOSTICS_FILE`):** al
  arrancar corre `plugins_sync_starting` → `plugins_sync_no_changes` con **`count:0`** → el servidor
  de Anthropic devuelve **0 plugins** para la cuenta/org de la sesión, mientras los skills sí se
  sincronizan (`~/.claude/skills/synced/`). La doc oficial (code.claude.com/docs/en/plugins-reference
  "Plugins synced from claude.ai" + cloud-environments) dice que en cloud sessions SÍ deberían
  descargarse al iniciar → es del lado del servidor/cuenta, no del repo ni del environment (sin
  `syncClaudeAiPlugins:false`). `/plugin` no existe en cloud y el `enabledPlugins` del repo NO se
  aplica en cloud (doc). **WORKAROUND (23-sep-2026):** los skills de los 6 plugins oficiales
  (Marketing, Data, Engineering, Design, Productivity, Finance — repo público
  `anthropics/knowledge-work-plugins`, Apache 2.0) se copiaron a **`.claude/skills/<plugin>-<skill>/`**
  (47 skills; `CONNECTORS.md`/LICENSE en `.claude/vendor/<plugin>/`) → cargan en toda sesión de este
  repo. NO traen los conectores MCP. Solo Dashboard-Mkt (no BIP). **`addyosmani/agent-skills` NO se
  copió** (el filtro del modo auto lo bloquea como código de terceros). Actualizar = re-clonar y
  re-copiar. No afirmar que un plugin está disponible sin chequear `ListPlugins` en la sesión.
- **Skills:** `safe-changes` (backup + mostrar plan/aprobación + verificar, antes de toda acción
  irreversible) + `pauta-omd-reconciliacion` (runbook), en `.claude/skills/`.
- **Gotchas del entorno:** (1) un proyecto **multi-repo** NO lee el `.claude/settings.json` (hooks)
  de ningún repo → las deps van en el **Setup script del environment**, no en un hook del repo (las
  `.claude/skills/` sí cargan). (2) Editar el Setup script: **selector de environment en la pantalla
  de sesión NUEVA → hover sobre "Default" → engranaje** (el dropdown del título de la sesión es solo
  indicador, no edita). (3) Muchos MCP por API key (Perplexity Sonar) requieren **billing** en la
  consola del vendor; no van con cuenta gratis.

## BIP — base de conocimiento (vault Obsidian en git)
Todo lo generado para **BIP** se guarda en el repo privado **`bip-knowledge`** (= vault Obsidian),
con estructura **raw → wiki → output por cliente** + `wiki/frameworks/` (reutilizable) + `_templates/`;
reglas en su `CONVENCIONES.md`. Claude escribe por GitHub; el usuario lo ve en Obsidian (compu
personal/celular) con el plugin **Obsidian Git** (no instala nada en la compu del laburo). **Regla:**
al trabajar algo de un cliente de BIP, guardarlo ahí siguiendo esas convenciones, sin que lo pidan.
(El usuario es cloud-only y no puede instalar apps en el laburo → por eso el vault vive en git, no
en Obsidian local ni en Obsidian Sync.)

## Salud de Marca — metodología y correlaciones (mockup, dic-2026)
Dashboard nuevo (mockup artifact, réplica del estilo real de `/salud-marca`, fondo blanco, **tono
técnico SIN relleno marketinero**): tab **Metodología y correlaciones** (modelo share→equity: scatter
driver→equity con recta MCO + R²/p, co-movimiento temporal, tabla de estadísticos α/β/SE/t/p/R²) +
tab **Datos y Proyecciones** (tabla Kantar por marca con hélice y desvíos + **proyección nov-26 POR
MARCA** con su ecuación propia; tabla GfK por segmento). El vínculo share→equity ya existe en el
código (`dreanEstNov26` + `EST_LAVADO/REFRI/COCCION` en `app/salud-marca/page.tsx`); el mockup lo
expone, no inventa nada (el R² y los estadísticos se calcularon sobre esos mismos datos). Artifact:
`https://claude.ai/artifact/6bNygQqm1Nsjcuhu28H2rC`. **PENDIENTE:** decidir si se cablea como dashboard
real (ruta nueva, leyendo `mercado_share` + `salud-marca-model.ts` en vivo).

## Punteros a docs/
`docs/architecture.md`, `docs/crons-github-actions.md`, `docs/guia-replicacion-y-seguridad.md`,
`docs/meta-fb-reach-deprecation.md`, **`docs/mercado-gfk-carga.md`** (carga mensual de mercado
GfK → `mercado_share`), **`docs/calendario-publicacion-meta.md`** (calendario de contenidos +
publicación orgánica IG/FB + estado de permisos Meta), y varios `*-sync.md` (dv360, google-ads, etc.).
Los `handoff-*.md` son notas de sesiones previas.

**Proyecto APARTE — BIP (SaaS self-serve multi-tenant):** convertir este dashboard en un producto
multi-cliente (fork + capa de conexiones OAuth vía Nango + planes/upgrade/add-ons + billing). **NO
toca Drean.** Estado, decisiones, identidad (`bip.explore@gmail.com`, dominio `bip-go.com`) y pasos
pendientes en **`docs/bip-platform-handoff.md`**. El código se entregó al user como zips.
</content>
