# BIP · Plan profundo — Competencia (social+web) + SEO + Chat IA transversal

> Análisis para NO iterar (sep-2026). Hecho con 5 investigaciones: competencia social de
> Drean, competencia web + SEO de Drean, motor de chat de Drean, arquitectura de datos de
> BIP, y proveedores de data. **Restricción dura del user: ELIMINAR n8n** (Apify u otro
> proveedor está OK, llamado por REST desde el cron). Todo corre sobre la infra que ya existe:
> **GitHub Actions cron → `/api/cron/*` (Vercel) → Supabase**, gateado por `CRON_SECRET`.

## 0. Lo que YA existe en BIP (ahorra trabajo — NO reconstruir)
- **Formulario de competidores YA HECHO:** `tenant_profile.competitors jsonb` =
  `[{name, instagram, facebook, tiktok, website}]` (hasta 4), capturado en el alta/perfil
  (`components/welcome-profile.tsx`). Falta solo sumarle **`categoria`** por marca propia (para keywords).
- **Gating por plan YA scaffolded** (`lib/plan.ts`): feature `competencia` (min tier `optimize`
  o addon `competitivo`) y feature/addon `ia` (min `insight` o addon `ia`, $250/mo, descrito como
  "Chat de datos cross-dashboard + insights"). `hasFeature(plan, addons, f)` ya resuelve esto.
- **Nav stub `/seo-search`** ya existe (`min:optimize`, `soon:true` → flip cuando esté).
- **OpenAI ya integrado** (`lib/meta-comments.ts`, `analyzeSentiment`, gpt-4o-mini, fetch sin SDK).
- **Patrón snapshot+cron** probado (`*_snapshot` + `lib/marts/*` + `sync_runs`).
- **DataForSEO: ya hay cuenta** (`DATAFORSEO_AUTH`) → cubre TODA la parte web+SEO.

## 1. TECHO DE DATOS de competencia (leer primero — condiciona el diseño)
La Graph API de Meta NO expone cuentas de competidores. Para competidores el máximo dato
público es: **followers, posts, likes, comments, y view_count de reels/videos**. **NO hay
reach ni impresiones reales de competidores por ninguna vía** (ni scraping ni API paga).
→ En BIP: engagement de competidor = `(likes+comments)/followers`; el proxy de alcance es
`view_count` de reels; la cadencia sale de los timestamps. **No prometer "reach de competencia".**

---

## FEATURE 1 — Competencia SOCIAL (IG + FB, idem Drean, sin n8n)

### Arquitectura (reemplaza el n8n de Drean)
```
GitHub Actions (sync-competitors.yml, ~1x/día)
  → /api/cron/sync-competitors  (Vercel, CRON_SECRET, maxDuration=300, ?tenant= por lote)
      para cada tenant con feature 'competencia' y competitors cargados:
        → fetch REST al proveedor social (por marca: IG + FB)   [síncrono, GET+api-key]
        → OpenAI clasifica pilar + sentimiento (analyzeSentiment ya existe)
        → upsert a competitor_social_snapshot (o filas normalizadas)
        → rehost de thumbnails a Supabase Storage (CDN de IG caduca 1-2 días)
        → logSyncRun()
  → el dashboard lee el snapshot (instantáneo)
```
**Ojo timeout Vercel:** con 4 competidores × N clientes el loop puede pasar el límite → el
GitHub Action llama al route **por lote/cliente** (`?tenant=`), o se pagina. Loop pesado en el
Action, el route solo persiste.

### Proveedor de data (el user acepta Apify u otro)
- **Recomendado primario: ScrapeCreators** — GET autenticado → JSON, cubre **IG + FB**,
  `like_count/comment_count/view_count`, ~**$1,88/1k requests**, encaja directo en el API route.
  Riesgo: negocio unipersonal (bus factor) → diseñar el fetch **con proveedor conmutable**.
- **Fallback IG: HikerAPI** ($0,60/1k) para redundancia.
- **Apify** (lo que usa Drean hoy) también sirve por **REST** (`run-sync-get-dataset-items`) —
  si se prefiere reusar los actors ya conocidos, va por fetch desde el cron igual, sin n8n.
- **NO** self-hostear Playwright en GitHub Actions: IP de datacenter → IG bloquea al instante
  (requeriría proxies residenciales, anula el ahorro).
- **Decisión pendiente del user:** ScrapeCreators (más barato, nuevo) vs Apify-por-REST (ya
  conocido). Recomiendo ScrapeCreators con capa conmutable; Apify como segunda opción.

### Storage (patrón snapshot, RLS-on sin policies, service-role)
`competitor_social_snapshot` PK `(tenant_id, anio)`, `data jsonb` = por marca: followers,
posts[{url, red, fecha, likes, comments, view_count, pilar, sentimiento, thumbnail, copy}],
agregados (engagement, cadencia). (Alternativa normalizada: tabla `competitor_posts` estilo
`social_posts` de Drean si se quiere filtrar server-side; el snapshot alcanza para el dash.)

### Dashboard
Sección "Análisis Competitivo" en `/redes` (idem Drean): benchmark table (followers, posts/sem,
engagement, sentimiento), trend chart, pilar chart, sentiment chart, grilla de posts de
competidores. Componentes reutilizan `components/social/*`. Gate: feature `competencia`.

---

## FEATURE 2 — Competencia WEB (estilo SimilarWeb, SIN Apify, con DataForSEO)

### ⚠️ ACLARADO (validado en código Drean): SimilarWeb en Drean = APIFY, no DataForSEO
La data de SimilarWeb en Drean viene de **Apify** (actors `tri_angle/similar-web-scraper` +
`radeance/similarweb-scraper`, `source:'apify_similarweb'`), NO de DataForSEO Traffic Analytics.
La cuenta DataForSEO se usa para **SEO** (volumen/SERP/keywords). **Decisión tomada:** como Apify
está OK (solo se saca n8n), la competencia WEB reusa el **actor SimilarWeb de Apify por REST desde
el cron** (probado) → NO hace falta verificar precio de DataForSEO Traffic Analytics. DataForSEO
queda para SEO. (La opción DataForSEO Traffic Analytics queda documentada abajo como alternativa futura.)

### Fuente: DataForSEO (YA hay cuenta) — dos capas, misma credencial
1. **DataForSEO Labs** (barato, POST `live` síncrono): Domain Rank Overview (tráfico orgánico
   estimado + rank + nº keywords + tráfico por país), Ranked Keywords ($0,132/1k), Competitors
   Domain (competidores por overlap SERP), Bulk Traffic Estimation. **LIMITACIÓN:** ETV = solo
   tráfico de **búsqueda** (organic+paid). NO da "total visits" ni el mix de canales.
2. **DataForSEO Traffic Analytics (SimilarWeb)**: `traffic_analytics/similarweb/overview` →
   **total visits + mix de canales (direct/social/referral/email/display) + engagement**, con la
   MISMA cuenta DataForSEO, pay-as-you-go, **sin contrato SimilarWeb**. Es data licenciada (sin
   riesgo de scraping). **⚠️ PENDIENTE: verificar el precio por request** (dataforseo.com estaba
   bloqueado desde el sandbox; se chequea logueado en su pricing calculator) ANTES de comprometerlo.
- **Descartar:** SimilarWeb API directa (enterprise $500-16k), Semrush ($549/mo), Ahrefs (otra sub).

### Arquitectura
`/api/cron/sync-competitor-web` (cron ~semanal) → por tenant, por dominio de `competitors[].website`
→ DataForSEO Labs + Traffic Analytics → upsert `competitor_web_snapshot (tenant_id, anio, data jsonb)`.

### Dashboard
Sección "Competencia web" en `/web` (idem Drean): benchmark de dominios (visitas, Δ MoM, bounce,
pages/visit), historia mensual de visitas, mix de fuentes de tráfico, keywords top. Gate: `competencia`.

---

## FEATURE 3 — Optimización SEO (`/seo-search`, DataForSEO + LLMO)

### Fuentes (todo DataForSEO + OpenAI, ya disponibles)
- **Demand / Share of Search:** `keywords_data/google_ads/search_volume/live` (volúmenes) +
  `keywords_data/google_trends/explore/live` (interés) → tablas `search_volume`, `trends_interest`.
- **SERP matrix:** `serp/google/organic/live/advanced` (depth 100) por keyword → posición de cada
  dominio trackeado → `seo_rankings`. Chunked (`?offset=&limit=`) por el timeout de Vercel.
- **LLMO (visibilidad en IA / Share of Model):** OpenAI `gpt-4o-search-preview` con
  `web_search_options.user_location` → cuenta menciones de marca → `seo_llmo`.
- **Región:** DataForSEO Trends `subregion_interests` → `search_region` (Drean lo tenía sin cron;
  en BIP se automatiza).
- **GSC (Search Console): NO integrado en Drean.** Opcional futuro en BIP (dato propio real).

### KEYWORDS por tenant (el cambio clave vs Drean)
Drean tiene keywords **hardcodeadas** (config + archivo estático de ~490 kw). En BIP deben ser
**por tenant**, derivadas de la **categoría** del cliente:
- Sumar `categoria` (+ términos base) al perfil/competidores del tenant.
- **Generación:** `categoria → término base → keywords` = `"{término} {marca}"` por cada marca
  (propia + 4 competidores del form) — igual que `buildKeywordUniverse()` de Drean, pero
  parametrizado por tenant. Opcional: **enriquecer con IA** (OpenAI genera variantes de keyword
  desde la categoría) + validar volumen con DataForSEO (descartar las de volumen ~0).
- Guardar el universo de keywords en una **tabla `seo_keywords (tenant_id, keyword, categoria,
  marca, volume)`** (no archivo estático).

### Storage + dashboard
Tablas `search_volume`, `trends_interest`, `seo_rankings`, `seo_llmo`, `search_region`,
`seo_keywords` — todas con `tenant_id`. Dashboard `/seo-search`: Share of Search, Trends,
matriz SERP competitiva (índice de posición por categoría, faltantes/débiles/fuertes), mapa
provincial, LLMO. Gate: `min:optimize` (+ `competencia` para la capa competitiva).

---

## FEATURE 4 — Chat IA TRANSVERSAL + insights (la decisión de arquitectura)

### Motor (reusar el de Drean, es genérico)
Loop de function-calling OpenAI (`gpt-4o-mini`, temp 0.2, loop ≤6 pasos) + tools + `render_chart`
(→ Recharts `DynamicChart`) + `render_posts`. El motor NO cambia. **Sumar `render_table`** +
componente para tablas (Drean solo hace markdown). BIP no tiene chat aún, pero OpenAI ya está y
el addon `ia` ya está en el catálogo.

### El requisito nuevo: TRANSVERSAL (toda la DB del cliente, no por-dashboard)
Drean scopea el chat a UN dashboard por URL (registry por-dash). El user quiere **consultar y
generar análisis/gráficos/tablas de TODA la base del cliente**. Esto es un cambio de arquitectura.

### 🔴 SEGURIDAD (el punto crítico — decisión de diseño)
En BIP las tablas de datos del tenant son **RLS-on SIN policies = deny-all**, accesibles **solo
por service-role** (que BYPASSEA RLS). Consecuencia:
- **PROHIBIDO dar text-to-SQL crudo al LLM sobre el service client:** una query generada sin
  `WHERE tenant_id = <actual>` leería **datos de TODOS los tenants**. RLS no te salva acá.
- **Enfoque recomendado (seguro): capa de TOOLS genéricas**, NO SQL libre. Cada tool envuelve un
  accessor tipado que YA hardcodea `.eq("tenant_id", tenant.id)`: `getWebSnapshot`,
  `getRedesSnapshot`, `getPautaSnapshot`, `getTikTok*`, `getDataset`/`listDatasets` (archivos
  subidos), `getDashMetas`/`getWebMetas`, `getMapaConfig`, `getStoredCommentSentiment`,
  `getStoredTikTokSentiment`, competencia snapshots. **El `tenant_id` sale de `getCurrentTenant()`
  server-side, NUNCA es argumento del LLM.**
- Como los snapshots son **JSON blobs** (no filas), el chat lee+resume esos documentos (mete el
  `data jsonb` relevante en el contexto) en vez de agregar por SQL. Para los datasets subidos
  (filas), una tool genérica `query_dataset(datasetId, filtros, agg)` acotada (SELECT-only, límite
  de filas) sobre `tenant_datasets`.
- **Si en el futuro se quiere text-to-SQL de verdad:** correrlo con un **rol Postgres per-tenant
  CON policies RLS** (o vistas `SECURITY INVOKER` filtradas por una GUC de sesión con el tenant),
  NUNCA el service role, + allowlist SELECT + statement_timeout + row caps.

### Costo / guardrails (Drean casi no tiene)
Row/col caps en cada tool, truncado del resultado antes de re-entrar al modelo, prompt-caching del
contexto (que ahora es grande: catálogo de la DB del tenant), rate-limit por tenant, y accounting
de uso. Gate: feature `ia` **enforced server-side en la route del chat** (el nav gating es cosmético).

### UI
`GlobalDataChat` montado una vez (ya hay patrón en Drean). En BIP transversal: un solo contexto
"toda tu data" (no por URL). Botón flotante → drawer, historia stateless (se manda completa),
render de texto (markdown mínimo) + charts + tables + post cards.

### Insights (además del chat)
Capa de **insights proactivos**: un cron (`/api/cron/insights`) que corre el LLM sobre los
snapshots del tenant y guarda observaciones (`tenant_insights` tabla) → se muestran en el
overview/dashboards sin que el user pregunte. Mismo motor, disparado por cron (no en render).

---

## ORDEN DE CONSTRUCCIÓN sugerido (para no iterar)
1. **Competencia social** (mayor valor, form ya existe): proveedor conmutable + cron + snapshot +
   sección `/redes`. (Decidir proveedor: ScrapeCreators vs Apify-REST.)
2. **Competencia web + SEO** (comparten DataForSEO): keywords per-tenant + crons + `/seo-search` +
   sección `/web`. (Verificar precio Traffic Analytics antes.)
3. **Chat IA transversal + insights** (mayor complejidad + seguridad): capa de tools genéricas
   sobre accessors tenant-scopeados + `render_table` + guardrails + gate server-side.

## DECISIONES QUE NECESITO DEL USER antes de construir
1. **Proveedor social:** ¿ScrapeCreators (barato, conmutable) o reusar Apify por REST?
2. **DataForSEO Traffic Analytics:** validar su precio por request (yo no pude, dominio bloqueado)
   — ¿lo chequeás en tu cuenta, o arrancamos solo con Labs (SEO/organic) y sumamos SimilarWeb después?
3. **Chat transversal:** ¿confirmás el enfoque de **tools genéricas tenant-scopeadas** (seguro) en
   vez de text-to-SQL? (Fuerte recomendación: sí.)
4. **Categoría por cliente:** sumar `categoria` al form de perfil (para generar keywords) — ¿ok?
