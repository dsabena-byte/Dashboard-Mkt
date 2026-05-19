-- =============================================================================
-- Dashboard Mkt — GA4 demographics
-- =============================================================================
-- Tres tablas separadas, una por "vista" demografica. Las separamos porque
-- cruzar todas las dimensiones en una sola tabla dispara thresholding en GA4
-- (muchas filas terminan como "(other)"). Tres reports chicos preservan
-- mucho mejor la resolucion de cada dimension.
--
--   ga4_demo_age_gender → edad × genero × device
--   ga4_demo_geo        → pais × region × ciudad × device
--   ga4_demo_interest   → categorias de interes "in-market"
-- =============================================================================

create table ga4_demo_age_gender (
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

create index idx_ga4_demo_age_gender_fecha on ga4_demo_age_gender (fecha);

create table ga4_demo_geo (
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

create index idx_ga4_demo_geo_fecha on ga4_demo_geo (fecha);
create index idx_ga4_demo_geo_country on ga4_demo_geo (country);

create table ga4_demo_interest (
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

create index idx_ga4_demo_interest_fecha on ga4_demo_interest (fecha);

create trigger trg_ga4_demo_age_gender_updated before update on ga4_demo_age_gender
  for each row execute function set_updated_at();
create trigger trg_ga4_demo_geo_updated before update on ga4_demo_geo
  for each row execute function set_updated_at();
create trigger trg_ga4_demo_interest_updated before update on ga4_demo_interest
  for each row execute function set_updated_at();
