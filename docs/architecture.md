# Arquitectura

## Capas

### 1. Fuentes de datos

| Fuente              | Tipo                | Cómo se ingesta                                  |
|---------------------|---------------------|--------------------------------------------------|
| Google Ads          | API oficial         | N8N → Supabase (`ads_performance`)               |
| Meta Ads            | API oficial         | N8N → Supabase (`ads_performance`)               |
| GA4                 | Reporting API       | N8N → Supabase (`web_traffic`)                   |
| Planning Excel      | Google Drive        | N8N (Google Sheets node) → Supabase (`planning`) |
| Scraping RRSS       | Google Sheet existente | N8N → Supabase (`social_metrics`, `social_competitor`) |
| Competidores web    | Apify (SimilarWeb)  | N8N → Supabase (`competitor_web`) — fase 2       |
| Offline (TV/Radio…) | Carga manual / Sheets | N8N o UI admin → Supabase (`planning` + ad-hoc) |

### 2. Storage (Supabase)

8 tablas + 2 vistas SQL. Ver `supabase/migrations/0001_initial_schema.sql` y
`supabase/migrations/0002_views.sql`.

**Joins clave** — todo el modelo se enhebra por:

- `(fecha, utm_source, utm_medium, utm_campaign)` → para el funnel
- `(fecha, canal, campania)` → para cumplimiento vs planning

### 3. Orquestación (N8N)

Workflows scheduled (cada hora / diario) que:

1. Llaman a las APIs de cada plataforma.
2. Normalizan (lowercase UTMs, parseo de fechas, etc.).
3. UPSERT a Supabase usando los `UNIQUE` constraints del schema (idempotente).

Cada workflow se exporta como JSON y se versiona en `n8n-workflows/`.

### 4. Frontend (Next.js 14)

- **Server Components** leen directo de Supabase con `createServerClient`.
- **Client Components** usan `createBrowserClient` para interactividad (filtros,
  charts dinámicos).
- **Service role** se usa solo en route handlers / scripts (jobs de alertas,
  no en RSC).
- **Charts**: Recharts (ya en `package.json`).

### 5. Alertas

Cron job (N8N o Vercel cron) que:

1. Lee `vw_cumplimiento_planning` filtrado por las reglas activas en `alerts_config`.
2. Para cada regla, evalúa `desvio_pct` vs `threshold_pct`.
3. Si dispara: inserta en `alerts_log` y manda notificación según `canal_notif`.

## Decisiones de diseño

- **Single-tenant**: no hay `account_id`. Pensado para una sola marca. Si se
  necesita multi-tenant, migración nueva agrega `account_id` + RLS por account.
- **`UNIQUE NULLS NOT DISTINCT`** en `ads_performance` y `web_traffic` para
  que los UPSERTs de N8N sean idempotentes incluso cuando hay UTMs nulas.
- **Columna `raw jsonb`** en tablas de ingesta: guarda el payload original de
  la API para poder reprocesar sin volver a llamarla.
- **Vistas SQL** (no materializadas en fase 1) para que el frontend siempre
  vea data fresca. Si la performance pincha, se materializan.
- **Enums Postgres** para `channel_type`, `metric_type`, etc. Más rápido y
  consistente que strings libres.

## Lo que NO está en fase 1

- Auth (Supabase Auth con magic link → fase 2).
- RLS policies (RLS off mientras sea uso interno + repo privado).
- Cache de queries (agregar React Query si la UX lo pide).
- Internacionalización (todo en español).
- Tests E2E (Playwright cuando estabilicemos UI).
