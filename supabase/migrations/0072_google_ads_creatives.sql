-- =============================================================================
-- Tabla google_ads_creatives: performance a nivel anuncio (creativo) de las
-- cuentas de Google Ads de OMD (Refrigeración / Lavado / Cocción / Search),
-- traída DIRECTO desde la Google Ads API (no GA4).
--
-- GA4 sólo devuelve costo/impresiones/clicks/CPC a nivel campaña. La Google Ads
-- API expone el embudo de video (cuartiles + VTR) y las interacciones a nivel
-- anuncio, igualando la profundidad que ya tenemos de Meta para Demand Gen y
-- Video. Los thumbnails de los assets se completan en un pase posterior.
--
-- Fuente: apps/web/src/app/api/cron/google-ads-sync/route.ts (GAQL sobre
-- `ad_group_ad`). Alimenta /performance reemplazando las filas pobres de GA4.
-- =============================================================================

create table if not exists google_ads_creatives (
  id                bigint generated always as identity primary key,
  fecha             date   not null,                 -- día (segments.date)
  customer_id       text   not null,                 -- cuenta Google Ads (10 dígitos, sin guiones)
  account_label     text,                            -- etiqueta legible: Refrigeración | Lavado | Cocción | Search
  campaign_id       text   not null,
  campaign_name     text,
  campaign_type     text,                            -- DEMAND_GEN | SEARCH | VIDEO | PERFORMANCE_MAX ...
  ad_group_id       text,
  ad_group_name     text,
  ad_id             text   not null,                 -- ad_group_ad.ad.id
  ad_name           text,
  thumbnail_url     text,                            -- se completa en pase posterior (asset image / YouTube video)
  impressions       bigint,
  clicks            bigint,
  cost              numeric(16,2),                   -- cost_micros / 1e6 (ARS, moneda de la cuenta)
  interactions      bigint,
  video_views       bigint,
  video_view_rate   numeric(8,4),                    -- VTR (metrics.video_view_rate, 0-1)
  vtr_p25           numeric(8,4),                    -- metrics.video_quartile_p25_rate (0-1)
  vtr_p50           numeric(8,4),
  vtr_p75           numeric(8,4),
  vtr_p100          numeric(8,4),
  raw               jsonb,
  updated_at        timestamptz not null default now(),
  constraint uq_google_ads_creatives unique (fecha, ad_id)
);

create index if not exists idx_gads_creatives_fecha on google_ads_creatives(fecha);
create index if not exists idx_gads_creatives_customer on google_ads_creatives(customer_id);
create index if not exists idx_gads_creatives_ctype on google_ads_creatives(campaign_type);

comment on table google_ads_creatives is
  'Performance a nivel anuncio de las cuentas Google Ads de OMD, vía Google Ads API (embudo de video + interacciones). Reemplaza la data pobre de GA4 (ga4_google_ads_daily) en /performance.';
comment on column google_ads_creatives.video_view_rate is 'VTR = metrics.video_view_rate (fracción 0-1).';
comment on column google_ads_creatives.vtr_p25 is 'metrics.video_quartile_p25_rate: fracción de impresiones que llegó al 25% del video (0-1).';

-- Lectura pública (anon/authenticated), consistente con el resto del dashboard.
alter table google_ads_creatives enable row level security;
drop policy if exists "google_ads_creatives_public_read" on google_ads_creatives;
create policy "google_ads_creatives_public_read"
  on google_ads_creatives for select
  to anon, authenticated
  using (true);
