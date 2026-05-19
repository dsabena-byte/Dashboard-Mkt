-- =============================================================================
-- Dashboard Mkt — GA4 demographics
-- =============================================================================
-- Tres tablas separadas, una por "vista" demografica. Las separamos porque
-- cruzar todas las dimensiones en una sola tabla dispara thresholding en GA4
-- (muchas filas terminan como "(other)"). Tres reports chicos preservan
-- mucho mejor la resolucion de cada dimension.
--
--   ga4_demo_age_gender → device (en la propiedad de Drean, age/gender vienen
--                          siempre como "unknown" por thresholding; las
--                          columnas se mantienen NULL pero el schema queda
--                          listo si en el futuro GA4 los expone).
--   ga4_demo_geo        → country × region (sin city para evitar combinatoria
--                          explosiva que tira out-of-memory en n8n.cloud).
--   ga4_demo_interest   → brandingInterest (la rama del workflow puede estar
--                          deshabilitada hoy; la tabla queda lista por si se
--                          activa despues).
--
-- Usa CREATE TABLE IF NOT EXISTS porque las tablas ya existen en algunos
-- entornos (creadas por una migration previa fuera del orden de main).
-- =============================================================================

create extension if not exists "uuid-ossp";

create table if not exists ga4_demo_age_gender (
  id                uuid primary key default uuid_generate_v4(),
  fecha             date not null,
  age_bracket       text,
  gender            text,
  device_category   text,
  sessions          bigint not null default 0,
  total_users       bigint not null default 0,
  new_users         bigint not null default 0,
  engaged_sessions  bigint not null default 0,
  conversions       bigint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_ga4_demo_age_gender unique nulls not distinct
    (fecha, age_bracket, gender, device_category)
);

create index if not exists idx_ga4_demo_age_gender_fecha on ga4_demo_age_gender (fecha);

create table if not exists ga4_demo_geo (
  id                uuid primary key default uuid_generate_v4(),
  fecha             date not null,
  country           text,
  region            text,
  city              text,
  device_category   text,
  sessions          bigint not null default 0,
  total_users       bigint not null default 0,
  new_users         bigint not null default 0,
  engaged_sessions  bigint not null default 0,
  conversions       bigint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_ga4_demo_geo unique nulls not distinct
    (fecha, country, region, city, device_category)
);

create index if not exists idx_ga4_demo_geo_fecha on ga4_demo_geo (fecha);
create index if not exists idx_ga4_demo_geo_country on ga4_demo_geo (country);

create table if not exists ga4_demo_interest (
  id                 uuid primary key default uuid_generate_v4(),
  fecha              date not null,
  interest_category  text,
  sessions           bigint not null default 0,
  total_users        bigint not null default 0,
  conversions        bigint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint uq_ga4_demo_interest unique nulls not distinct
    (fecha, interest_category)
);

create index if not exists idx_ga4_demo_interest_fecha on ga4_demo_interest (fecha);

do $$ begin
  create trigger trg_ga4_demo_age_gender_updated before update on ga4_demo_age_gender
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_ga4_demo_geo_updated before update on ga4_demo_geo
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_ga4_demo_interest_updated before update on ga4_demo_interest
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;
