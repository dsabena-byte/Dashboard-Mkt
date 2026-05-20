-- =============================================================================
-- Dashboard Mkt — Meta organic insights (Facebook Page + Instagram Business)
-- =============================================================================
-- Tres tablas para data de Meta SIN ads (la API de ads requiere acceso a la
-- Ad Account, que en el setup actual de Drean no está concedido al usuario
-- que corre el workflow).
--
--   meta_page_daily   → metricas diarias de la Page de FB (impresiones,
--                        reach, engaged_users, fans, post_engagements, etc.)
--   meta_ig_daily     → metricas diarias de la cuenta de IG Business
--                        (reach, impressions, follower_count, etc.)
--   meta_posts        → posts individuales (FB + IG) con metricas point-in-time
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- meta_page_daily — Facebook Page insights
-- -----------------------------------------------------------------------------
create table if not exists meta_page_daily (
  id                       uuid primary key default uuid_generate_v4(),
  fecha                    date not null,
  page_id                  text not null,
  impressions              bigint not null default 0,
  impressions_unique       bigint not null default 0,
  engaged_users            bigint not null default 0,
  post_engagements         bigint not null default 0,
  page_views               bigint not null default 0,
  fans_total               bigint,
  consumptions             bigint not null default 0,
  video_views              bigint not null default 0,
  raw                      jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint uq_meta_page_daily unique (fecha, page_id)
);

create index if not exists idx_meta_page_daily_fecha on meta_page_daily (fecha);

-- -----------------------------------------------------------------------------
-- meta_ig_daily — Instagram Business insights
-- -----------------------------------------------------------------------------
create table if not exists meta_ig_daily (
  id                  uuid primary key default uuid_generate_v4(),
  fecha               date not null,
  ig_user_id          text not null,
  reach               bigint not null default 0,
  impressions         bigint not null default 0,
  follower_count      bigint,
  profile_views       bigint not null default 0,
  website_clicks      bigint not null default 0,
  email_contacts      bigint not null default 0,
  phone_call_clicks   bigint not null default 0,
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint uq_meta_ig_daily unique (fecha, ig_user_id)
);

create index if not exists idx_meta_ig_daily_fecha on meta_ig_daily (fecha);

-- -----------------------------------------------------------------------------
-- meta_posts — posts FB + IG con métricas snapshot
-- -----------------------------------------------------------------------------
create table if not exists meta_posts (
  id                uuid primary key default uuid_generate_v4(),
  platform          text not null check (platform in ('facebook', 'instagram')),
  post_id           text not null,
  cuenta_id         text not null,
  fecha_post        timestamptz not null,
  permalink         text,
  message           text,
  media_type        text,
  thumbnail_url     text,
  impressions       bigint not null default 0,
  reach             bigint not null default 0,
  engagement        bigint not null default 0,
  reactions         bigint not null default 0,
  saved             bigint not null default 0,
  video_views       bigint not null default 0,
  clicks            bigint not null default 0,
  fetched_at        timestamptz not null default now(),
  raw               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_meta_posts unique (platform, post_id)
);

create index if not exists idx_meta_posts_fecha on meta_posts (fecha_post desc);
create index if not exists idx_meta_posts_platform on meta_posts (platform);
create index if not exists idx_meta_posts_cuenta on meta_posts (cuenta_id);

-- Triggers updated_at (la función set_updated_at ya existe en 0001).
do $$ begin
  create trigger trg_meta_page_daily_updated before update on meta_page_daily
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_meta_ig_daily_updated before update on meta_ig_daily
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_meta_posts_updated before update on meta_posts
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;
