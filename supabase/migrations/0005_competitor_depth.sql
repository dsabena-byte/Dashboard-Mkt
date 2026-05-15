-- =============================================================================
-- Análisis competitivo profundo: tráfico por categoría + Google Trends
-- =============================================================================
-- competitor_categoria_web: scrapea URL paths de cada competidor por categoría
--   (ej: tienda.electrolux.com.ar/lavarropas) para tener tráfico segmentado.
--
-- google_trends: interés de búsqueda en Argentina por keyword (marca + categoría)
--   capturado vía SerpApi/pytrends en N8N.
-- =============================================================================

create table competitor_categoria_web (
  id                  uuid primary key default uuid_generate_v4(),
  fecha               date not null,
  competidor          text not null,                       -- "Drean", "Electrolux", etc.
  categoria           text not null,                       -- "Lavado", "Refrigeración", "Cocinas"
  url                 text not null,                       -- "tienda.electrolux.com.ar/lavarropas"
  visitas_estimadas   bigint,
  bounce_rate         numeric(5,4),
  pages_per_visit     numeric(8,2),
  avg_visit_duration  numeric(10,2),
  raw                 jsonb,
  source              text not null default 'apify_similarweb',
  created_at          timestamptz not null default now(),
  unique (fecha, competidor, categoria, source)
);

create index idx_cat_web_fecha     on competitor_categoria_web (fecha);
create index idx_cat_web_competidor on competitor_categoria_web (competidor);
create index idx_cat_web_categoria  on competitor_categoria_web (categoria);

comment on table competitor_categoria_web is
  'Tráfico por URL path (categoría) de competidores — scrapeado vía Apify SimilarWeb.';

-- -----------------------------------------------------------------------------

create table google_trends (
  id           uuid primary key default uuid_generate_v4(),
  fecha        date not null,
  keyword      text not null,                              -- "lavarropas drean", "heladera electrolux"
  marca        text,                                       -- "Drean" / "Electrolux" / null si genérico
  categoria    text,                                       -- "Lavado" / "Refrigeración" / "Cocinas"
  geo          text not null default 'AR',
  interes      smallint not null,                          -- 0-100 (escala Google Trends)
  source       text not null default 'serpapi',
  raw          jsonb,
  created_at   timestamptz not null default now(),
  unique (fecha, keyword, geo, source)
);

create index idx_gt_fecha     on google_trends (fecha);
create index idx_gt_keyword   on google_trends (keyword);
create index idx_gt_marca     on google_trends (marca);
create index idx_gt_categoria on google_trends (categoria);

comment on table google_trends is
  'Interés de búsqueda Google Trends en AR por keyword (marca/categoría) — diario o semanal.';
