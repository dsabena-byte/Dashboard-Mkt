-- =============================================================================
-- Dashboard Mkt — Initial schema
-- =============================================================================
-- Tablas core:
--   planning            → inversión y KPIs planificados por canal/campaña
--   ads_performance     → métricas reales de Google Ads, Meta Ads, etc.
--   web_traffic         → tráfico web (GA4) agregado por UTM
--   competitor_web      → scraping de webs de competidores (Apify)
--   social_metrics      → métricas de RRSS propias y competencia (Sheet existente)
--   social_competitor   → posts/comentarios de competencia (Sheet existente)
--   alerts_config       → reglas de alertas sobre desvío vs planning
--   alerts_log          → historial de alertas disparadas
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type channel_type as enum (
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'linkedin_ads',
  'youtube_ads',
  'programmatic',
  'tv',
  'radio',
  'ooh',
  'print',
  'influencer',
  'email',
  'other'
);

create type metric_type as enum (
  'impressions',
  'clicks',
  'sessions',
  'conversions',
  'leads',
  'sales',
  'revenue',
  'cpa',
  'cpc',
  'ctr',
  'roas'
);

create type platform_type as enum (
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'linkedin_ads',
  'youtube_ads',
  'ga4',
  'other'
);

create type social_platform as enum (
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'twitter',
  'linkedin',
  'other'
);

create type notif_channel as enum (
  'email',
  'slack',
  'webhook',
  'in_app'
);

-- -----------------------------------------------------------------------------
-- planning
-- -----------------------------------------------------------------------------
create table planning (
  id              uuid primary key default uuid_generate_v4(),
  fecha           date not null,
  canal           channel_type not null,
  campania        text not null,
  inversion_plan  numeric(14,2) not null default 0,
  kpi_target      numeric(14,2) not null default 0,
  metric_type     metric_type not null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (fecha, canal, campania, metric_type)
);

create index idx_planning_fecha on planning (fecha);
create index idx_planning_canal on planning (canal);
create index idx_planning_campania on planning (campania);

-- -----------------------------------------------------------------------------
-- ads_performance
-- -----------------------------------------------------------------------------
create table ads_performance (
  id                uuid primary key default uuid_generate_v4(),
  fecha             date not null,
  plataforma        platform_type not null,
  campania_id       text not null,
  campania_nombre   text not null,
  adset_id          text,
  adset_nombre      text,
  ad_id             text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  impresiones       bigint not null default 0,
  clicks            bigint not null default 0,
  costo             numeric(14,2) not null default 0,
  conversiones      bigint not null default 0,
  valor_conversion  numeric(14,2) not null default 0,
  raw               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_ads_performance unique nulls not distinct (fecha, plataforma, campania_id, adset_id, ad_id)
);

create index idx_ads_fecha on ads_performance (fecha);
create index idx_ads_plataforma on ads_performance (plataforma);
create index idx_ads_utm on ads_performance (utm_source, utm_medium, utm_campaign);
create index idx_ads_campania on ads_performance (campania_nombre);

-- -----------------------------------------------------------------------------
-- web_traffic
-- -----------------------------------------------------------------------------
create table web_traffic (
  id                    uuid primary key default uuid_generate_v4(),
  fecha                 date not null,
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_content           text,
  utm_term              text,
  landing_page          text,
  sesiones              bigint not null default 0,
  usuarios              bigint not null default 0,
  usuarios_nuevos       bigint not null default 0,
  conversiones          bigint not null default 0,
  eventos_clave         bigint not null default 0,
  bounce_rate           numeric(5,4),
  avg_session_duration  numeric(10,2),
  pageviews             bigint not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint uq_web_traffic unique nulls not distinct (fecha, utm_source, utm_medium, utm_campaign, utm_content, landing_page)
);

create index idx_web_fecha on web_traffic (fecha);
create index idx_web_utm on web_traffic (utm_source, utm_medium, utm_campaign);

-- -----------------------------------------------------------------------------
-- competitor_web (Apify, fase 2)
-- -----------------------------------------------------------------------------
create table competitor_web (
  id                   uuid primary key default uuid_generate_v4(),
  fecha                date not null,
  competidor           text not null,
  dominio              text not null,
  visitas_estimadas    bigint,
  visitantes_unicos    bigint,
  bounce_rate          numeric(5,4),
  pages_per_visit      numeric(8,2),
  avg_visit_duration   numeric(10,2),
  fuentes_trafico      jsonb,
  paginas_top          jsonb,
  paises_top           jsonb,
  keywords_top         jsonb,
  source               text not null default 'apify_similarweb',
  raw                  jsonb,
  created_at           timestamptz not null default now(),
  unique (fecha, competidor, source)
);

create index idx_competitor_fecha on competitor_web (fecha);
create index idx_competitor_nombre on competitor_web (competidor);

-- -----------------------------------------------------------------------------
-- social_metrics (data ya existente del Sheet)
-- -----------------------------------------------------------------------------
create table social_metrics (
  id               uuid primary key default uuid_generate_v4(),
  fecha            date not null,
  plataforma       social_platform not null,
  cuenta           text not null,
  es_competidor    boolean not null default false,
  seguidores       bigint not null default 0,
  engagement_rate  numeric(6,4),
  posts            integer not null default 0,
  alcance          bigint,
  impresiones      bigint,
  interacciones    bigint,
  source           text not null default 'google_sheet',
  raw              jsonb,
  created_at       timestamptz not null default now(),
  unique (fecha, plataforma, cuenta)
);

create index idx_social_fecha on social_metrics (fecha);
create index idx_social_cuenta on social_metrics (cuenta);
create index idx_social_competidor on social_metrics (es_competidor);

-- -----------------------------------------------------------------------------
-- social_competitor (posts y comentarios públicos del scraper existente)
-- -----------------------------------------------------------------------------
create table social_competitor (
  id              uuid primary key default uuid_generate_v4(),
  fecha_post      timestamptz not null,
  plataforma      social_platform not null,
  cuenta          text not null,
  post_id         text not null,
  post_url        text,
  contenido       text,
  likes           bigint,
  comentarios     bigint,
  shares          bigint,
  vistas          bigint,
  comentarios_json jsonb,
  raw             jsonb,
  source          text not null default 'google_sheet',
  created_at      timestamptz not null default now(),
  unique (plataforma, cuenta, post_id)
);

create index idx_social_comp_fecha on social_competitor (fecha_post);
create index idx_social_comp_cuenta on social_competitor (cuenta);

-- -----------------------------------------------------------------------------
-- alerts_config
-- -----------------------------------------------------------------------------
create table alerts_config (
  id              uuid primary key default uuid_generate_v4(),
  nombre          text not null,
  kpi             metric_type not null,
  canal           channel_type,
  campania        text,
  threshold_pct   numeric(6,2) not null,
  comparison      text not null check (comparison in ('below','above','either')),
  canal_notif     notif_channel not null default 'in_app',
  destino_notif   text,
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_alerts_activa on alerts_config (activa);

-- -----------------------------------------------------------------------------
-- alerts_log
-- -----------------------------------------------------------------------------
create table alerts_log (
  id              uuid primary key default uuid_generate_v4(),
  alert_id        uuid not null references alerts_config(id) on delete cascade,
  fecha           date not null,
  kpi             metric_type not null,
  valor_plan      numeric(14,2),
  valor_actual    numeric(14,2),
  desvio_pct      numeric(8,2),
  mensaje         text,
  notificado      boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_alerts_log_fecha on alerts_log (fecha);
create index idx_alerts_log_alert on alerts_log (alert_id);

-- -----------------------------------------------------------------------------
-- Trigger: updated_at
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_planning_updated before update on planning
  for each row execute function set_updated_at();
create trigger trg_ads_updated before update on ads_performance
  for each row execute function set_updated_at();
create trigger trg_web_updated before update on web_traffic
  for each row execute function set_updated_at();
create trigger trg_alerts_cfg_updated before update on alerts_config
  for each row execute function set_updated_at();
