# Esquema de Supabase — referencia rápida

Todas las tablas y vistas que usa el dashboard, con sus columnas reales
y las queries de diagnóstico más comunes. **Mirá acá antes de tirar SQL
para no equivocarte con nombres de columna.**

## Proyecto principal (`NEXT_PUBLIC_SUPABASE_URL`)

### `social_posts` — scraping de marcas en redes (propia + competencia)

Fuente: N8n + Apify scrapers. Una fila por (red_social, url).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `red_social` | text | `INSTAGRAM`, `FACEBOOK`, `TIKTOK` (mayúsculas) |
| `url` | text | URL del post (unique → dedup key) |
| `pilar` | text | Branding / Promo / Producto / Educacional |
| `positivo` | smallint | 0-100 (% sentiment positivo) |
| `negativo` | smallint | 0-100 |
| `neutro` | smallint | 0-100 |
| `likes` | integer | -1 si IG no expone, 0 si FB sin reactions |
| `comentarios` | integer | |
| `engagement` | numeric(6,3) | engagement rate (%) |
| **`fecha`** | date | **fecha de publicación (NO `fecha_post`)** |
| `tipo` | text | `ORGÁNICO` / `PAUTA` |
| `marca` | text | `dreanargentina`, `philco.arg`, `gafaargentina`, `electroluxar`, `whirlpoolarg` |
| `views` | integer | |
| `content_type` | text | `IMAGE`, `VIDEO`, `SIDECAR`, `REEL` |
| `sponsored` | boolean | true si es ad |
| `hashtags` | text | comma-separated o JSON string |
| `followers` | integer | snapshot al momento del scrape |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `resumen_sentimiento` | text | output del cron de sentiment |

### `meta_posts` — posts propios de Drean vía Graph API

Fuente: cron `/api/cron/meta-fb-sync` y `/api/cron/ig-sync`. Una fila por (platform, post_id).

| Columna | Tipo | Notas |
|---|---|---|
| `platform` | text | `instagram` o `facebook` (minúsculas, ojo) |
| `post_id` | text | ID nativo de Meta |
| `cuenta_id` | text | `257587170945975` (Page FB) o `17841404990509161` (IG) |
| **`fecha_post`** | timestamptz | timestamp de publicación |
| `permalink` | text | link al post |
| `message` / `caption` | text | copy |
| `media_type` | text | FB: `photo`/`video`/`album`. IG: `FEED`/`REELS`/`STORY` |
| `thumbnail_url` | text | URL pública (mirroreada a Supabase Storage `meta-thumbs`) |
| `impressions` | bigint | |
| `reach` | bigint | |
| `reach_followers` | bigint | solo IG (a veces null) |
| `reach_non_followers` | bigint | solo IG |
| `engagement` | bigint | sum de comments + shares (FB) o totalInteractions (IG) |
| `reactions` | bigint | likes/love/etc — 0 para stories |
| `video_views` | bigint | |
| `clicks` | bigint | en stories IG: replies + profile_visits |

> ⚠️ **NO confundir con `social_posts`**:
> - `meta_posts` = solo Drean, vía Graph API oficial (datos completos)
> - `social_posts` = Drean + competencia vía Apify scraping (datos más limitados)

### `social_followers` — followers por marca/red en el tiempo

| Columna | Tipo | Notas |
|---|---|---|
| `marca` | text | mismo set que social_posts |
| `red_social` | text | `INSTAGRAM` / `FACEBOOK` / `TIKTOK` |
| `fecha` | date | snapshot date |
| `followers` | integer | conteo |

### `meta_paid_creatives` — pauta Meta (paid)

Fuente: `/api/cron/meta-paid-sync` (espera acceso de OMD). Mientras tanto cargado vía CSV manual.

Cols clave: `ad_id`, `mes`, `categoria`, `tipo_compra`, `spend`, `impresiones`, `alcance`, `clicks`, `cpm`, `cpc`, `ctr`, `thumbnail_url`, `body`, `permalink_url`.

### `web_traffic` — GA4 raw

Fuente: cron `/api/cron/ga4-web-traffic`. Una fila por (fecha × utm_source × utm_medium × utm_campaign × utm_content × landing_page).

Cols clave: `fecha`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `landing_page`, `sesiones`, `usuarios`, `usuarios_nuevos`, `conversiones`, `eventos_clave`, `pageviews`, `bounce_rate`, `avg_session_duration`.

### `ga4_monthly_users` — agregado mensual

Fuente: mismo cron. Una fila por `mes` (YYYY-MM-01).

⚠️ Bug histórico: el cron usaba `?days=N` para este reporte. Si N era chico, sobreescribía meses con datos parciales. Fixed en commit `f89ef90` — ahora siempre va desde Enero del año actual.

### `pauta_performance` y `planning_media` — Pauta

Ver `docs/architecture.md`. Migrations `0031_pauta_performance.sql` y `0004_planning_media.sql`.

⚠️ Después del rename `Build → Awareness` y `Consider → Consideración` (migration 0035), los valores en `objetivo` (pauta_performance) y `rol` (planning_media) usan los nombres nuevos. Hay un trigger en planning_media para normalizar nuevos inserts.

### `facturacion_mensual` — facturación real de la empresa

Migration `0049_facturacion_mensual.sql`. Una fila por mes (`mes` = primer día, `YYYY-MM-01`), con `facturacion` (numeric) y `moneda` (default `USD`). Alimenta el indicador **Inv. Mkt / Facturación** del Objetivo 1 del Overview. La inversión real sale del dash de BGT Mkt (versión `REAL 2026`, USD), así que la facturación se carga en la misma moneda.

Carga / actualización de un mes:
```sql
insert into facturacion_mensual (mes, facturacion, moneda, fuente)
values ('2026-05-01', 0, 'USD', 'carga manual')
on conflict (mes) do update set facturacion = excluded.facturacion, updated_at = now();
```

> ℹ️ El presupuesto (`BGT 2026`, `4+8 2026`, `8+4 2026`) y el `REAL 2026` todavía **no** viven en Supabase: se leen del `data.json` del dash de BGT Mkt (ver `BGT_DATA_JSON_URL`). Migrarlos a Supabase está pendiente (ver TODO en el README).

### Tablas GA4 demo

`ga4_demo_age_gender`, `ga4_demo_geo`, `ga4_demo_interest` — sync vía cron N8n.

### Vistas SQL

- `vw_drean_web_by_source` — clasificación de canal (Direct, Paid Search, etc.)
- `vw_drean_web_by_category` — clasificación por landing (Lavado, Refri, etc.)
- `vw_ga4_funnel` — etapa (interes / consideracion) × categoría para el funnel del Overview
- `vw_planning_media_por_categoria` — Awareness / Consideración por campaña

## Proyecto CB (`CB_SUPABASE_URL`)

Es un Supabase separado para Cuadros Básicos + Floor Share.

### `cuadro_basico_semanal`

| Columna | Tipo |
|---|---|
| `semana` | int (ISO week) |
| `tienda` | text — "74 - ALAYIAN LA PLATA CALLE 12" |
| `sku` | text |
| `cliente` | text |
| `division` | text — `COCCIÓN` / `LAVADO Y SECADO` / `REFRIGERACIÓN` |
| `target_cb` / `real_cb` | int (0 o 1) |
| `target_inf` / `real_inf` | int (0 o 1) |
| `tipo_sku` | text — `Estratégico` / `Infaltable` |
| `updated_at` | timestamptz |

### `floor_share`

| Columna | Tipo |
|---|---|
| `periodo` | text — `2026-W14` |
| `semana` | int |
| `categoria` | text (lowercase) — `coccion` / `lavado` / `refrigeracion` |
| `numero_tienda` | text |
| `nombre_tienda` | text |
| `marca` | text — `Drean`, `Whirlpool`, `Electrolux`, etc. |
| `unidades` | int |
| `pct_raw` | float (0..1) |
| `updated_at` | timestamptz |

## Queries diagnósticas comunes

### ¿Está corriendo el sync de competencia (social_posts)?
```sql
select marca, red_social, count(*) as posts,
       max(fecha) as ultimo_post,
       max(updated_at) as ultimo_sync
from social_posts
where fecha >= current_date - 30
group by marca, red_social
order by marca, red_social;
```

Si `ultimo_sync` es de hace > 7 días → revisar N8n Executions.

### ¿Está corriendo el sync de Drean (meta_posts)?
```sql
select platform, count(*) as posts,
       max(fecha_post) as ultimo_post,
       max(fetched_at) as ultimo_sync
from meta_posts
where fecha_post >= now() - interval '30 days'
group by platform;
```

### ¿Cuántas thumbnails están espejadas a Storage vs Meta CDN?
```sql
select
  case
    when thumbnail_url is null then 'sin thumb'
    when thumbnail_url like '%/storage/v1/object/public/meta-thumbs/%' then 'mirroreada'
    when thumbnail_url like '%fbcdn.net%' or thumbnail_url like '%cdninstagram%' then 'meta-cdn (caduca)'
    else 'otra'
  end as estado,
  platform, count(*) as posts
from meta_posts
group by 1, 2 order by platform, estado;
```

### ¿Qué env vars está usando el diag de CB?
GET `/api/diag/cb-tables` → mirar campo `using_env`.

### Verificar que el GA4 cron generó el reporte mensual correctamente
```sql
select mes, total_users, new_users, sesiones, pageviews
from ga4_monthly_users
order by mes desc
limit 12;
```

Si algún mes tiene valores 10× menores que los vecinos → el cron corrió con `days` chico y sobreescribió. Re-disparar el workflow GA4 para que regenere desde Jan 1.
