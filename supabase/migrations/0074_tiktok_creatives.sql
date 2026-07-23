-- =============================================================================
-- Tabla tiktok_creatives: performance a nivel anuncio de la cuenta de TikTok
-- Ads de Drean, traída DIRECTO de la TikTok Marketing API (reporting integrado,
-- data_level = AUCTION_AD).
--
-- Hoy TikTok se carga a mano (exports OMD/Looker) dentro de meta_paid_creatives
-- con plataforma='tiktok'. Esta tabla lo automatiza a nivel creativo con el
-- embudo de video completo + interacciones, igualando la profundidad de Meta.
-- Los thumbnails (cover del video) se completan en un pase posterior.
--
-- Fuente: apps/web/src/app/api/cron/tiktok-sync/route.ts. Alimenta /performance.
-- =============================================================================

create table if not exists tiktok_creatives (
  id                bigint generated always as identity primary key,
  fecha             date   not null,                 -- stat_time_day
  advertiser_id     text   not null,
  campaign_id       text,
  campaign_name     text,
  adgroup_id        text,
  adgroup_name      text,
  ad_id             text   not null,
  ad_name           text,
  thumbnail_url     text,                            -- cover del video (pase posterior vía /file/video/ad/info/)
  impressions       bigint,
  clicks            bigint,
  spend             numeric(16,2),                   -- moneda de la cuenta (ARS)
  reach             bigint,
  frequency         numeric(8,2),
  video_views       bigint,                          -- video_play_actions
  video_watched_2s  bigint,
  video_watched_6s  bigint,
  video_p25         bigint,                          -- video_views_p25 (conteo)
  video_p50         bigint,
  video_p75         bigint,
  video_p100        bigint,
  likes             bigint,
  comments          bigint,
  shares            bigint,
  follows           bigint,
  profile_visits    bigint,
  raw               jsonb,
  updated_at        timestamptz not null default now(),
  constraint uq_tiktok_creatives unique (fecha, ad_id)
);

create index if not exists idx_tiktok_creatives_fecha on tiktok_creatives(fecha);
create index if not exists idx_tiktok_creatives_adv on tiktok_creatives(advertiser_id);
create index if not exists idx_tiktok_creatives_camp on tiktok_creatives(campaign_id);

comment on table tiktok_creatives is
  'Performance a nivel anuncio de TikTok Ads (Drean) vía TikTok Marketing API (embudo de video + interacciones). Automatiza lo que hoy se carga a mano en meta_paid_creatives (plataforma=tiktok).';
comment on column tiktok_creatives.video_views is 'video_play_actions: reproducciones iniciadas.';
comment on column tiktok_creatives.video_p100 is 'video_views_p100: veces que el video se reprodujo completo (conteo, no %).';

-- Lectura pública (anon/authenticated), consistente con el resto del dashboard.
alter table tiktok_creatives enable row level security;
drop policy if exists "tiktok_creatives_public_read" on tiktok_creatives;
create policy "tiktok_creatives_public_read"
  on tiktok_creatives for select
  to anon, authenticated
  using (true);
