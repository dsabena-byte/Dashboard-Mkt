-- =============================================================================
-- Dashboard Mkt — Facebook Page comprehensive: KPIs adicionales + demografía
-- =============================================================================
-- Extiende meta_page_daily (de 0027) con campos detallados de engagement
-- y crea meta_fb_audience_demographics para el público de la Page.
--
-- A diferencia de IG, en FB la demografía SÍ está disponible vía Graph API
-- (no requiere ownership especial), tanto para fans (lifetime) como para
-- público alcanzado (período diario).
-- =============================================================================

-- Page daily: agregamos columnas para fans delta, reactions tipadas y
-- partición organic/paid del reach. Idempotente.
alter table meta_page_daily
  add column if not exists fan_adds              bigint not null default 0,
  add column if not exists fan_removes           bigint not null default 0,
  add column if not exists impressions_organic   bigint not null default 0,
  add column if not exists reach_organic         bigint not null default 0,
  add column if not exists reactions_like        bigint not null default 0,
  add column if not exists reactions_love        bigint not null default 0,
  add column if not exists reactions_wow         bigint not null default 0,
  add column if not exists reactions_haha        bigint not null default 0,
  add column if not exists reactions_sorry       bigint not null default 0,
  add column if not exists reactions_anger       bigint not null default 0;

-- Demografía formato long, paralela a la de IG
create table if not exists meta_fb_audience_demographics (
  id              uuid primary key default uuid_generate_v4(),
  fecha           date not null,
  page_id         text not null,
  audience_type   text not null
    check (audience_type in ('fan', 'reached', 'viewer')),
  dimension       text not null
    check (dimension in ('age_gender', 'country', 'city', 'locale')),
  category        text not null,
  value           bigint not null default 0,
  raw             jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_meta_fb_audience_demographics unique
    (fecha, page_id, audience_type, dimension, category)
);

create index if not exists idx_meta_fb_aud_fecha on meta_fb_audience_demographics (fecha desc);
create index if not exists idx_meta_fb_aud_type on meta_fb_audience_demographics (audience_type, dimension);

do $$ begin
  create trigger trg_meta_fb_aud_updated before update on meta_fb_audience_demographics
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;
