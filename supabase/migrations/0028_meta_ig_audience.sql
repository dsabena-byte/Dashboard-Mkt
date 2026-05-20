-- =============================================================================
-- Dashboard Mkt — IG comprehensive: post engagement aggregates + audience demo
-- =============================================================================
-- Extiende el schema base de Meta organic (0027) para soportar:
--   1) KPIs orgánicos completos a nivel cuenta IG (likes, comments, saves,
--      shares, total_interactions, accounts_engaged).
--   2) Métricas full por post IG (likes, comments, shares además de los
--      ya existentes impressions/reach/engagement/saved).
--   3) Demografía del público — tabla en formato long flexible que aguanta
--      breakdowns por edad, género, país, ciudad para audiencias
--      'follower' (lifetime) y 'reached' (rango).
-- =============================================================================

-- Cuenta IG: agregados de engagement (suma de posts del día)
alter table meta_ig_daily
  add column if not exists likes              bigint not null default 0,
  add column if not exists comments           bigint not null default 0,
  add column if not exists saves              bigint not null default 0,
  add column if not exists shares             bigint not null default 0,
  add column if not exists total_interactions bigint not null default 0,
  add column if not exists accounts_engaged   bigint;

-- Posts: agregar likes/comments/shares explicitos (los IG no entran en
-- reactions como FB, vienen como metricas dedicadas).
alter table meta_posts
  add column if not exists likes    bigint not null default 0,
  add column if not exists comments bigint not null default 0,
  add column if not exists shares   bigint not null default 0;

-- Demografía: formato long para escalar con varios breakdowns sin migrar
create table if not exists meta_ig_audience_demographics (
  id              uuid primary key default uuid_generate_v4(),
  fecha           date not null,
  ig_user_id      text not null,
  audience_type   text not null
    check (audience_type in ('follower', 'reached', 'engaged')),
  dimension       text not null
    check (dimension in ('age', 'gender', 'age_gender', 'country', 'city', 'locale')),
  category        text not null,
  value           bigint not null default 0,
  raw             jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_meta_ig_audience_demographics unique
    (fecha, ig_user_id, audience_type, dimension, category)
);

create index if not exists idx_meta_ig_aud_fecha on meta_ig_audience_demographics (fecha desc);
create index if not exists idx_meta_ig_aud_type on meta_ig_audience_demographics (audience_type, dimension);

do $$ begin
  create trigger trg_meta_ig_aud_updated before update on meta_ig_audience_demographics
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;
