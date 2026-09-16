# BIP · Handoff — Competencia + SEO + Chat IA + TikTok (sep-2026)

> Estado de todo lo construido en `bip-platform` esta sesión. Repo: `dsabena-byte/bip-platform`,
> deploy `git push origin HEAD:main` → Vercel. Tenant de prueba: **bip.explore@gmail.com**.
> Migraciones se corren a mano en el SQL Editor de Supabase de BIP.

## Decisiones de arquitectura (transversales)
- **SIN n8n.** La adquisición de datos externa (Apify, DataForSEO, OpenAI) se llama por **REST
  desde `/api/cron/*`** (Vercel), gateado por `CRON_SECRET`. Patrón = los syncs existentes.
- **Patrón snapshot:** el cron hace el trabajo pesado (scraping + LLM) y guarda un **JSON en
  Supabase** (`*_snapshot`). El dashboard **solo lee** (instantáneo, sin costo). Las agregaciones
  corren client-side sobre los posts ya guardados (JS puro). Esto lo pidió el user explícito.
- **Apify por REST:** `lib/apify.ts` → `runActor(actorId, input)` (`run-sync-get-dataset-items`).
  Actor IDs **configurables por env** (con `~` no `/`). Defaults = los que la cuenta corrió:
  `apify~instagram-scraper`, `apify~instagram-profile-scraper`, `apify~facebook-posts-scraper`
  (env lo tiene en `facebook-pages-scraper`), `clockworks~free-tiktok-scraper`,
  `radeance~similarweb-scraper`. Overrides: `APIFY_ACTOR_IG/IG_PROFILE/FB/TIKTOK/SIMILARWEB`.
  **OJO inputs reales (del n8n de Drean):** IG `{directUrls,resultsLimit,onlyPostsNewerThan,
  scrapePosts,scrapeComments:true,commentsLimit}`; FB `{startUrls:[{url}],resultsLimit,
  onlyPostsNewerThan,captionText,comments:true}`; SimilarWeb radeance `{urls:[URLs COMPLETAS
  https://.../]}` (NO `websites`); TikTok `{profiles:[@handle],resultsPerPage,scrapeType:'videos'}`.
  radeance devuelve mes como "June 2026" → parsear (`parseMes` en competitor-web.ts). Fuentes de
  tráfico = campos sueltos (`searchTraffic`/`directTraffic`/...); duración = `timeOnSite`.

## Migraciones corridas (0016-0022)
- 0016 `meta_comment_sentiment` (network IG/FB/TT, sin CHECK → TT libre).
- 0017 RLS en `billing_events`.
- 0018 `competitor_social_snapshot` + `tenant_profile.categoria`.
- 0019 `competitor_web_snapshot`.
- 0020 `seo_snapshot`.
- 0021 `tenant_profile.own_website`.
- 0022 `tenant_profile.own_instagram/own_facebook/own_tiktok`.
- Datos de prueba (NO migración): `update tenant_profile` con own_website/handles + TikTok de
  competidores (Drean+Philco+Electrolux+Whirlpool+Gafa) — ver comandos abajo.

## Features construidas

### 1. TikTok — apps "BIP Connector" (pauta) + "BIP Organic" (orgánico), ambas PENDING approval
- **Pauta** (`lib/tiktok-pauta.ts`): reader Marketing API (advertiser/get + advertiser/info +
  report/integrated/get), picker en Conexiones, sección en `/performance`, diag `/api/diag/tiktok`.
  Scopes: Ad account info + Reporting (read-only). Gate `TIKTOK_APP_ID/SECRET`.
- **Orgánico** (`lib/tiktok-organic.ts`): Accounts API (business/get, business/video/list,
  business/comment/list), sentimiento reusa Meta → `meta_comment_sentiment` net=TT, sección en
  `/redes`, diag `/api/diag/tiktok-organic`. Gate `TIKTOK_ORGANIC_ENABLED=1`. Provider Nango
  `tiktok-accounts`. **Pendiente sandbox:** connect + captura de `business_id` (== open_id).
- Detalle: `docs/bip-tiktok-app-plan.md`.

### 2. Competencia SOCIAL (`/redes`) — RÉPLICA 100% de Drean ✅ validado con data real
- `lib/competitor-social.ts`: scrapea IG+FB+TikTok de **marca propia + 4 competidores** (own_*
  handles + tenant_profile.competitors), OpenAI clasifica pilar + sentimiento (comentarios IG+FB
  → pos/neg/neu + resumen), tipo de contenido, orgánico/pautado (sponsored), followers (profile
  scraper). **Sync en 2 FASES** (posts→guarda, después sentimiento→re-guarda) para no perder por
  timeout. Fetch de marcas en **PARALELO**. Límites: 18 posts, 6 sentimiento/marca.
- `lib/competitor-social-agg.ts`: port client-safe de las agregaciones de Drean (kpis, brand
  stats, net stats, trend, weekly, pilar, content-type, sentiment-by-brand).
- `components/social/competitor-social-full.tsx`: filtros marca/red, cards por red (IG/FB/TT),
  KPI cards, 3 gráficos (posteos/sem, tendencia eng, eng por pilar), benchmark table POS/NEG/NEU,
  donut tipo contenido, sentimiento por marca (IG+FB), análisis cualitativo, grilla con barra de
  sentimiento por post + "Ver más" de a 6. Cron `sync-competitors`. Diag `/api/diag/competitors`.
- **VALIDADO:** Drean★ aparece, FB sentiment anda, TikTok trae posts. Tipografía alineada al dash.

### 3. Competencia WEB (`/web`) — RÉPLICA de Drean ✅ validado
- `lib/competitor-web.ts`: SimilarWeb (radeance Apify por REST), incluye marca propia (own_website).
  Benchmark con Δ MoM + badge 🔥 pico, historia mensual, fuentes, keywords. Componente
  `components/web/competitor-web-section.tsx`: benchmark + line chart histórico + 3 rankings
  (bounce/pages/duración verde-rojo). Mismo cron `sync-competitors`.

### 4. SEO (`/seo-search`) — RÉPLICA de Drean (falta mapa provincial)
- `lib/dataforseo.ts` + `lib/seo.ts`: Share of Search (search_volume mensual) + demanda genérica
  + Trends (google_trends) + **matriz SERP** (serp/organic, keywords generadas con IA desde la
  categoría, posición de cada dominio de marca) + **LLMO** (OpenAI menciones → share of model).
  SERP **paralelizado** (conc 6, 14 keywords) para no timeoutear. Cron `sync-seo` + workflow.
- `components/seo/seo-full.tsx`: Share of Search (barras+evolución), Trends, SEO competitivo
  (índice de posición + buckets fuertes/débiles/faltantes + matriz keyword×marca), LLMO. Diag
  `/api/diag/seo`. Gate feature `competencia`. **PENDIENTE:** RegionSection (mapa AR, SVG grande).

### 5. Chat IA transversal (`Preguntá a tus datos`) ✅
- `lib/chat/tools.ts`: **tools tenant-scopeadas** (tenantId FIJO server-side, NUNCA del LLM →
  imposible cruzar tenants). Cubre redes/pauta/web/seo/competencia social+web/sentimiento/archivos.
- `app/api/chat/route.ts`: loop function-calling gpt-4o-mini + render_chart + render_table, gate
  server-side feature `ia`. `components/chat/data-chat.tsx` (drawer) + `dynamic-chart.tsx`.
  Montado global en el layout con feature `ia`. **Sin preguntas guía** (se sacaron). **PENDIENTE:**
  capa de insights proactivos (cron que corre el LLM sobre snapshots).

### 6. Nav / sidebar
- Grupos **colapsables (acordeón)**; abrir un grupo esconde la parte de abajo (Conexiones, Mi
  cuenta…) y muestra todos los dashboards; cerrarlo la devuelve. Título "Planes de Acción"
  (title case, tipografía = ítems de primer nivel). Estrella ★ (capa competencia) alineada con el
  icono de status. "Optimización SEO" arriba de "Mkt de Influencia", con icono de status.
- `google-ads-account-picker.tsx`: botón **"Cambiar"** para reelegir cuenta sin reconectar.

## Env vars (Vercel bip-platform)
`APIFY_API_TOKEN` ✅ · `DATAFORSEO_AUTH` ✅ (rotar: se expuso en chat) · `OPENAI_API_KEY` ✅ ·
`CRON_SECRET` ✅ · pendientes TikTok: `TIKTOK_APP_ID/SECRET` (pauta), `TIKTOK_ORGANIC_ENABLED=1`.
Overrides Apify seteados por el user: `APIFY_ACTOR_FB=apify~facebook-pages-scraper`,
`APIFY_ACTOR_SIMILARWEB` se borró (usa radeance default).

## Diags (owner/admin, en el navegador)
- `/api/diag/competitors?only=social|web` — corre el sync social/web + muestra output.
- `/api/diag/seo` — corre el sync SEO + muestra output.
- `/api/diag/google-ads` — accounts + selected + campaigns_count.
- `/api/diag/tiktok` y `/api/diag/tiktok-organic`.

## SQL de datos de prueba (bip.explore)
```sql
-- feature competencia + ia
update public.tenants set plan='optimize', addons=array['competitivo','ia']::text[]
from public.tenant_users tu join auth.users u on u.id=tu.user_id
where public.tenants.id=tu.tenant_id and u.email='bip.explore@gmail.com';
-- own + competidores (con TikTok + web)
update public.tenant_profile p set
  categoria='lavarropas', own_website='drean.com.ar', own_instagram='dreanargentina',
  own_facebook='dreanargentina', own_tiktok='@drean.argentina',
  competitors='[{"name":"Philco","instagram":"philco.arg","facebook":"PhilcoArgentinaOk","tiktok":"@philco.argentina","website":"philco.com.ar"},{"name":"Electrolux","instagram":"electroluxar","facebook":"ElectroluxArgentina","tiktok":"@electrolux.arg","website":"tienda.electrolux.com.ar"},{"name":"Whirlpool","instagram":"whirlpoolarg","facebook":"Whirlpool.Argentina","tiktok":"@whirlpool.argentina","website":"whirlpool.com.ar"},{"name":"Gafa","instagram":"gafaargentina","facebook":"gafaargentina","tiktok":"@gafa.argentina","website":"gafa.com.ar"}]'::jsonb
from public.tenant_users tu join auth.users u on u.id=tu.user_id
where p.tenant_id=tu.tenant_id and u.email='bip.explore@gmail.com';
```

## PENDIENTES para retomar
1. **Google Ads:** "Mabe Argentina" seleccionada probablemente es la **MCC (sin campañas)** → no
   se ve la campaña. Correr `/api/diag/google-ads`, y con el botón "Cambiar" elegir una sub-cuenta
   con campañas (o la de BIP `8320768997`) para que el revisor de Google vea la pauta.
2. **Validaciones de sync:** confirmar SEO (share/trends/serp/llmo) y que /redes muestre todo.
3. **SEO mapa provincial** (RegionSection AR) — falta.
4. **Chat IA insights proactivos** — falta.
5. **TikTok:** esperar approvals de las 2 apps → cargar creds → wiring orgánico + sandbox.
6. **Meta App Review** (9 permisos, enviado) + no perseguir "Access Verification" (WhatsApp-only).
7. **Google Ads Ronda 2 (adwords)** verificación — enviada, esperar.
8. Portar la barra de sentimiento a redes/pauta de Drean (pedido viejo).
9. Rotar el API password de DataForSEO (se expuso en chat).

## Docs relacionados
`docs/bip-competencia-seo-chat-plan.md` (plan), `docs/bip-tiktok-app-plan.md`,
`docs/bip-google-oauth-verificacion.md`, `docs/meta-app-review-plan.md`.
</content>

---

## SEO v2 — RÉPLICA COMPLETA DE DREAN, AUTOMÁTICA POR TENANT (sesión sep-2026)

Reescritura total del SEO de BIP para igualar el `/seo-search` de Drean pero **sin nada
hardcodeado** (Drean tenía 490 keywords fijas + lista fija de retailers/marcas). Todo por tenant.

### Decisiones del usuario (definiciones cerradas)
- **Retailers = INPUT del cliente, hasta 5** (además de las 4 marcas competidoras). Se cargan en el
  form **después** de los competidores. No auto-harvest del SERP (se descartó): el cliente elige.
- **Multi-categoría**: hasta el tope del plan (`PLANS[].categorias`: insight 1 / optimize 2 /
  accelerate 3, + addon "categoria"). Helper `maxCategorias(plan, addons)` en `lib/plan.ts`.
  El dash muestra **tabs de categoría** cuando hay >1; todo (share, YoY, mapa, matriz, buckets,
  LLMO) se calcula y filtra por categoría.
- **Keywords automáticas**: se generan en vivo con DataForSEO `keywords_for_keywords/live`
  (misma familia Google Ads que `search_volume`, mismo crédito) desde el término de la categoría →
  top 45 por volumen, piso 70/mes. Fallback: OpenAI genera + `search_volume` real. (Reemplaza el
  "OpenAI inventa 12" viejo.)
- **Mapa por provincia**: geometría propia sin librerías (`lib/argentina-provinces.ts`, 24 paths
  pre-proyectados copiados de Drean, viewBox 0 0 520 1107) + `components/seo/argentina-map.tsx`
  (choropleth azul monocromático, hover, leyenda). Data por Google Trends `explore/live` leyendo
  el bloque de **subregiones** (`type` incluye "map"). **OJO: sin validar en vivo** (el sandbox no
  tiene DATAFORSEO_AUTH; en Drean la carga por provincia era MANUAL, sin cron). Parseo defensivo +
  estado vacío elegante. Si no viene, plan B = carga manual. `provinciaAlias()` normaliza nombres
  de Trends → names de AR_PROVINCES (CABA→"Capital Federal", saca " Province").

### Archivos tocados (bip-platform)
- `lib/seo.ts` — reescrito. `SeoData` multi-categoría: cada fila (`share/demanda/trends/serp/
  regions/llmo`) lleva `categoria`. `serp` lleva `tipo: propio|marca|retail` + `own`. Campos compat
  (`categoria`, `brands`, `generic_volume`, `monthly` = 1ª categoría) para no romper chat/diag/page.
  `syncSeo` loopea categorías; por cada una: universo (keyword-ideas) → SERP (dominios propio+marca+
  retail, CONC 8) → share/demanda (search_volume) → trends+regiones (explore) → LLMO. Snapshot único
  en `seo_snapshot` (json, sin tablas nuevas).
- `components/seo/seo-full.tsx` — reescrito. Tabs categoría + KPI row + Share of Search (barras+evol)
  + **Crecimiento YoY** (barras divergentes) + **mapa provincia** (RegionSection: selector Genérico/
  marca + mapa + ranking) + Trends + **SEO competitivo** (KPIs + índice conglomerado con filtro
  Todos/Marcas/Retail, colores propio #1e40af/marca #94a3b8/retail #a855f7 + buckets Faltantes/
  Débiles/Fuertes con "Líder" + matriz keyword×dominio) + LLMO. ExportMenu en cada card. Tipografía
  unificada (h2 16/700, h3 14/600, no-uppercase salvo KPI labels).
- `components/seo/argentina-map.tsx` + `lib/argentina-provinces.ts` — nuevos.
- **Perfil (gap tapado):** el form NO guardaba categoría ni web/redes propias (se seteaban a mano).
  Ahora sí. `lib/profile.ts` (+ `categorias: string[]`, `retailers: Retailer[]`, compat `categoria`
  =categorias[0]). `app/api/profile/route.ts` valida+guarda todo (categorías 1..cap, own_website
  obligatorio en optimize, retailers hasta 5). `components/welcome-profile.tsx` reescrito (web/redes
  propias + categorías dinámicas 1..cap + competidores + retailers, con pre-fill + modo "settings").
  **Página nueva `/cuenta/perfil`** (editable) + link en el sidebar (`Perfil del negocio`).
- `app/api/cron/sync-seo/route.ts` (rows=r.serp) y `app/api/diag/seo/route.ts` (multi-cat + retailers).

### Migración 0023 (corrida por el usuario en SQL Editor de BIP)
`supabase/migrations/0023_categorias_retailers.sql`: agrega `categorias jsonb` + `retailers jsonb`
a `tenant_profile` + backfill de `categoria` singular al array. El usuario ya la corrió + cargó los
5 retailers de Drean (Mercado Libre, Frávega, Oncity, Cetrogar, Naldo) por SQL directo.

### PENDIENTE de validar (con DataForSEO real, corriendo `/api/diag/seo` en bip-go.com)
- que `keywords_for_keywords` devuelva keywords+volumen (mirar largo de `data.serp`),
- que el mapa traiga data (`data.regions` no vacío) — si vacío, plan B carga manual.
- Costo: SERP = N keywords × llamada. maxDuration 300; con 2 categorías ~60-90s. OK por ahora.
Commit: `cd3a928` (bip-platform).
