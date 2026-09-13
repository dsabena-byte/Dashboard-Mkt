# Know-how de Drean → infra de BIP (replicar / evitar / optimizar)

> Relevamiento profundo del pipeline de datos de Drean (23 crons + 23 workflows +
> patrones de perf) para **reutilizar el know-how** al construir la ingesta multi-tenant
> de BIP, sin reinventar. Complementa `bip-escalado-arquitectura.md` (la arquitectura) con
> el **detalle operativo cron-por-cron** y las **técnicas concretas** ya probadas en Drean.

---

## 1. Inventario de crons Drean → destino en BIP

Drean tiene **23 crons** (`apps/web/src/app/api/cron/*`) orquestados por **23 GitHub
Actions** (`.github/workflows/*.yml`), todos `GET` gateados por `CRON_SECRET`.

### A) Crons con credenciales DEL CLIENTE → retrofit a `getToken(tenant, provider)` (8)
| Cron | Fuente | Escribe | Cadencia Drean | Provider Nango en BIP |
|---|---|---|---|---|
| `meta-paid-sync` | Meta Graph (ads+insights+creativos) | `meta_paid_creatives`, `pauta_performance` | 1x/día, loop 3 meses | `facebook` |
| `meta-fb-sync` | Meta Graph (Página FB) | `meta_page_daily`, `meta_fb_monthly_reach`, `meta_posts` | 12h, `days=70` | `facebook` |
| `ig-sync` | Meta Graph (IG) | `meta_posts`, demographics | **6h** (Stories 24h) | `facebook` |
| `google-ads-sync` | Google Ads API v22 | `google_ads_creatives` | 1x/día | `google` (adwords) |
| `ga4-web-traffic` | GA4 Data API | `web_traffic`, `web_landing_daily`, `ga4_*` | 12h | `google` (analytics) |
| `tiktok-sync` | TikTok Marketing API | `tiktok_creatives` | 1x/día | `tiktok-ads` |
| `ugc-comments-graph` | Meta Graph (comentarios) | `ugc_comments` | 1x/día | `facebook` |
| `publicar-contenido` | Meta Graph (publicar) | `contenido_calendario` | **30 min** | `facebook` (publish scopes) |

> El doc decía "8 crons" listando 7 → el 8º es **`ugc-comments-graph`** (usa el page token
> derivado del cliente). Confirmado en el código.

### B) Crons con servicios PROPIOS de BIP (no cred del cliente) → solo sumar `tenant_id` (15)
`seo-sync`, `trends-sync`, `seo-index-snapshot`, `llmo-sync` (DataForSEO/OpenAI propios);
`clasificar-contenido`, `organic-insights`, `ig-sentiment-analysis`, `ugc-comments-sync`,
`ugc-comments-analysis` (OpenAI/Apify propios); `rehost-thumbs` (Storage); `bgt-sync`
(JSON público); **agregadores internos** `trade-agg`, `web-cat-agg`, `cb-mirror` (solo
Supabase); `health` (monitoreo). El proveedor externo es **cuenta única de la plataforma**;
el aislamiento se logra con `tenant_id` en las tablas + cuotas por plan.

---

## 2. Patrones a REPLICAR (técnicas concretas, ya probadas)

1. **Separar ingesta (background) de servicio (lectura)** — regla madre: el render nunca
   paga una query lenta ni una API externa. Cron computa filas chicas → render lee marts.
2. **Mirror cross-source cuando la fuente es lenta por-query** (patrón `cb-mirror`): copiar a
   Postgres propio, leer por **REST paralelo con `PAGE=10000`** (no 1000 → 136 páginas),
   primera página con `Prefer: count=exact` para el total, resto en tandas de `CONC=6`,
   **fallback a la fuente si el mirror está vacío**.
3. **Precalcular vistas caras a tablas indexadas** (`trade_monthly` ~26s→300ms;
   `web_*_by_category`; `fs_precomputed` guarda una **vista compleja como JSON de 1 fila** para
   la vista default → 12s→1.1s). El cómputo lento vive SOLO en el cron.
4. **Vistas MENSUALES para histórico/YoY**, nunca 24 meses de diario (`vw_drean_web_monthly`
   ~10x más rápido; el YoY diario disparaba ~104 queries concurrentes → contención).
5. **Columnas generadas STORED** para mover regex/derivaciones del runtime a la escritura
   (migración 0087: categoría/sku; ~9s timeout → ms) + índices por esa columna.
6. **Upsert idempotente**: `POST /rest/v1/{t}?on_conflict={claves}` + `Prefer:
   resolution=merge-duplicates,return=minimal`, en **chunks de 500**.
7. **Upsert NO destructivo**: nunca pisar histórico con 0 (fallback `nuevo || existente`)
   cuando la fuente deprecó/omitió una métrica (lección `meta-fb-sync`).
8. **`updated_at` explícito** cuando el watchdog mide frescura (merge-duplicates NO bumpea
   `updated_at` en update); y al revés en `bgt-sync`: usar el `syncedAt` real de la fuente,
   no `now`, para no dar "verde" falso.
9. **Paginación Meta SIEMPRE por `paging.cursors.after`**, nunca reconstruir sobre
   `paging.next` (viene con versión distinta → rompe con cuentas grandes).
10. **Paginación adaptativa Meta** (`meta-paid-sync`): empezar `limit=8` y bajar `8→4→2→1`
    ante error 500 "Please reduce the amount of data"; **NO reintentar** rate-limit `80004`
    (empeora); backoff solo para transitorios (`is_transient`). ← esto explica el fix de
    piezas que ya hicimos en BIP (limit alto fallaba).
11. **`effective_status` explícito** (ACTIVE, PAUSED, ARCHIVED…) porque `/ads` no devuelve
    pausados/archivados por default. ← también ya lo aplicamos en BIP.
12. **Imagen HQ**: jerarquía `image_url > asset_feed_spec > cover video > thumbnail_url(64px) >
    link picture`; para video, **thumbnail HQ** vía `/{video_id}/thumbnails` (mayor width).
13. **Mirror de creativos a Storage** (`meta-image-mirror`): las URLs fbcdn caducan en 1-2
    días → rehostear a bucket público, **key versionada** (`paid/{ad}-hd7.jpg`), idempotente
    (salta si existe, HEAD a la URL pública), **tolerante a fallas** (devuelve la URL original
    si falla → no tumba el cron).
14. **Watchdog de frescura + `sync_runs`** (las fallas de ingest son MUDAS — caso DV360: sync
    sin trigger y `.zip` no parseado → dashboard en $0 sin error).
15. **Auto-fix por GitHub** (Routine health-check): re-disparar workflows fallados + Issue
    auto-gestionado; NO depender de egress a Vercel/Supabase (bloqueado por policy).

---

## 3. Errores a EVITAR (gotchas que costaron tiempo)

1. **`unstable_cache` sobre funciones que tocan `cookies()`/`getServerSupabase()`** → explota
   fuera del request (rompió el Seguimiento: 98% con cobertura 20%). Usar React `cache()` para
   dedup por request; `unstable_cache` SOLO para REST service-key. **En BIP el modelo de marts
   evita esto de raíz** (se lee tabla, no live).
2. **Contar con que `unstable_cache` persista bajo `fetchCache="force-no-store"`** → no persiste
   → la única salida fue el precálculo por cron.
3. **Paginar/agregar tablas enormes en el render**; y creer que **paralelizar salva un cuello de
   throughput** (CB: 23s→21s, casi nada).
4. **Regex/derivaciones por fila en runtime** sobre 100k+ filas → `statement_timeout` 8s
   **silencioso** (tapado por `safe()` → paneles vacíos sin error).
5. **Guardar raw diario sin TTL** → `web_landing_daily` fue **8 GB para UNA marca** (disco free
   2GB se llenó → Pro 8GB). **Driver de costo #1 en multi-tenant.**
6. **Fijar ventanas de sync por suposición** → medir la curva: FB reach (lifetime) crece hasta
   **~50-60 días**, no 30 → ventana **70 días** (con 3 días salía 5K vs 33K real).
7. **Cotas fijas por magnitud** para datos rotos (`REACH_SANE_MAX=2M` no tapaba 144k inflado) →
   usar **invariante lógico del dominio** (reach única ≤ Σ reach de posts).
8. **Medir performance desde el sandbox** (query aislada engaña) → instrumentar en prod con
   contención real (header `⏱ real` + `server` por grupo).
9. **GitHub Action único para N tenants** (serializa, ventana 6h, una falla arrastra el lote)
   → **fan-out con cola**.

---

## 4. Ventanas de sync por maduración de métrica (medidas, no supuestas)

| Fuente/métrica | Ventana incremental | Por qué |
|---|---|---|
| FB reach de posts (`post_total_media_view_unique`) | **70 días** | lifetime, madura ~50-60 días (+25% a +114% medido) |
| Meta ads insights (atribución tardía) | **3 meses** (loop) | `meta-paid-sync` loopea current+2 prior |
| IG Stories | **6h de cadencia** | caducan en 24h |
| GA4 | **hasta ayer** | no carga el día en curso; report mensual pide desde inicio de año (no `days=3`, o el upsert por mes pisa el total) |
| Google Ads (OMD) | **piso 2026-04-01** | antes la MCC rechaza TODO con 401 |

---

## 5. Cadencia recomendada por volatilidad × plan (BIP)

- **Alta (6h):** IG Stories. **Media (12h):** GA4, presupuesto, thumbnails. **Diaria:** Meta
  ads, FB, Google Ads, TikTok, agregadores (trade/web-cat/cb-mirror). **Semanal:** trends.
  **Mensual (costo):** SEO SERP (~$5-7/corrida), LLMO.
- **Modulada por plan:** Insight 1x/día · Optimize 2x/día · Accelerate 6h + on-demand. La
  cadencia es una **palanca de costo** (SEO/LLMO son las caras).

---

## 6. Optimizaciones vs Drean (qué haríamos MEJOR con el know-how)

1. **Orquestación fan-out** (Inngest/Trigger.dev o `pg_cron`+`pgmq`+worker Railway) en vez del
   Action único → escala a cientos, reintentos por job, DLQ, sin ventana de 6h.
2. **Marts genéricos `fact_*_monthly` por tenant** en vez de tablas por-dashboard ad-hoc —
   Drean ya inventó el patrón (trade_monthly, web_*_by_category); BIP lo generaliza con
   `tenant_id`+periodo.
3. **No guardar raw diario de todos** (agregados siempre; raw TTL 30-90d) — la lección del 8GB.
4. **Supavisor pooling** (Drean escribe por REST service-key, evita el pool; BIP con lecturas
   de dashboard desde lambdas SÍ necesita pooler).
5. **Upstash Redis** para caché compartida + **token-buckets de rate-limit por token** →
   formaliza la paginación adaptativa de Meta en un límite compartido entre workers.
6. **Watchdog per-tenant** (extender `PROCS`/`getHealth` con `tenant_id`; alertar por tenant).
7. **RLS + auditoría del scoping en workers** (service-role bypassa RLS → riesgo #1).
8. **Reusar los motores tal cual**: los crons de Drean ya tienen la lógica de fetch/parse/
   idempotencia; el retrofit es cambiar la credencial (`env` → `getToken(tenant,provider)`) y
   el destino (tabla global → mart por tenant). **No reescribir la lógica de negocio.**

---

## 7. Build concreto (Fase 0/1, derivado del know-how)

**Fase 0 — Fundaciones:** Supavisor pooling (env) · Upstash (reemplaza `ttl-cache`) · tabla
`sync_runs` (tenant, fuente, inicio, fin, status, filas, error) + helper de logging.

**Fase 1 — Pauta pull→DB (probar el patrón con el cron más complejo):**
- Migración: `fact_pauta_monthly` (tenant_id, mes, KPIs), `dim_creatives` (tenant_id, ad_id,
  thumbnail rehosteado, permalink, métricas), `sync_runs`.
- Worker `sync-pauta`: por tenant → `getToken(tenant,'facebook')` → reusar `getPautaFull`
  (ya trae paginación adaptativa, effective_status, cursors.after, thumbnail HQ) → **escribir
  marts** (upsert idempotente) + **rehostear thumbnails** a Storage (key `tenant/ad`).
- `/performance` lee `fact_pauta_monthly`/`dim_creatives` con **fallback a live** (no rompe).
- Scheduler: Vercel Cron / GitHub Action (pocos tenants); migrar a cola en Fase 3.

**Fases 2-3:** replicar a Redes/Web/Google Ads/TikTok (reusando cada cron de Drean) + rehost
de creativos + orquestación fan-out cuando crezcan los clientes.
