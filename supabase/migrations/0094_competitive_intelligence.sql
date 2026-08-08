-- Inteligencia Competitiva: Módulo A (demanda / Share of Search) + Módulo B (SEO).
-- Fuente: DataForSEO (keywords_data + dataforseo_labs). Estructuras diseñadas
-- contra la respuesta REAL de la API (validada para el Módulo A; el Módulo B se
-- confirma contra la primera corrida real). Pipeline: GitHub Actions → route
-- Vercel → estas tablas.

-- ============ MÓDULO A · Demanda ============

-- Volúmenes absolutos por keyword y mes (histórico de 12 meses que trae
-- google_ads/search_volume). Base del Share of Search.
create table if not exists search_volume (
  keyword          text not null,
  marca            text,            -- null = keyword genérica de categoría
  categoria        text not null,   -- lavarropas | heladeras | cocinas
  generico         boolean not null default false,
  mes              date not null,   -- primer día del mes (year-month-01)
  search_volume    integer,
  cpc              numeric,
  competition      text,            -- LOW | MEDIUM | HIGH
  competition_index integer,
  fetched_at       timestamptz not null default now(),
  primary key (keyword, mes)
);
create index if not exists idx_search_volume_cat_mes on search_volume (categoria, mes);

-- Interés relativo de Google Trends (índice 0-100), serie semanal por keyword.
create table if not exists trends_interest (
  keyword     text not null,
  marca       text,
  categoria   text not null,
  fecha       date not null,   -- inicio de semana (date_from del punto)
  interes     integer,         -- 0-100
  fetched_at  timestamptz not null default now(),
  primary key (keyword, fecha)
);
create index if not exists idx_trends_interest_cat_fecha on trends_interest (categoria, fecha);

-- Share of Search: participación de cada marca en el volumen absoluto de su
-- categoría, por mes. ~83% de correlación con market share (Binet/Hankins) y lo
-- lidera. Excluye genéricas. Se cruza en el dash con mercado_share.
create or replace view vw_share_of_search as
with brand_vol as (
  select categoria, marca, mes, sum(coalesce(search_volume, 0)) as vol
  from search_volume
  where marca is not null and generico = false
  group by categoria, marca, mes
),
tot as (
  select categoria, mes, sum(vol) as total
  from brand_vol
  group by categoria, mes
)
select b.categoria, b.marca, b.mes, b.vol,
       case when t.total > 0 then round((b.vol::numeric / t.total) * 100, 2) else 0 end as share_pct
from brand_vol b
join tot t using (categoria, mes);

-- ============ MÓDULO B · SEO (tablas listas; parser se cierra con data real) ============

-- Keywords por las que rankea cada dominio (dataforseo_labs/ranked_keywords).
create table if not exists seo_rankings (
  dominio        text not null,
  marca          text,
  keyword        text not null,
  categoria      text,            -- clasificada por término (filtro category-pure)
  posicion       integer,
  search_volume  integer,
  url            text,
  fecha          date not null,
  fetched_at     timestamptz not null default now(),
  primary key (dominio, keyword, fecha)
);
create index if not exists idx_seo_rankings_marca_fecha on seo_rankings (marca, fecha);

-- Métricas agregadas de visibilidad por dominio (domain_rank_overview).
create table if not exists seo_domain_overview (
  dominio        text not null,
  marca          text,
  fecha          date not null,
  keywords_count integer,
  pos_1_3        integer,
  pos_4_10       integer,
  etv            numeric,         -- estimated traffic value / volume
  fetched_at     timestamptz not null default now(),
  primary key (dominio, fecha)
);

-- Keyword gap: keywords donde un competidor rankea y Drean no (domain_intersection).
create table if not exists seo_keyword_gap (
  keyword          text not null,
  competidor       text not null,
  categoria        text,
  pos_competidor   integer,
  search_volume    integer,
  fecha            date not null,
  fetched_at       timestamptz not null default now(),
  primary key (keyword, competidor, fecha)
);

comment on table search_volume is 'Volúmenes absolutos de búsqueda (DataForSEO google_ads/search_volume), histórico mensual. Base del Share of Search.';
comment on view vw_share_of_search is 'Share of Search por categoría/marca/mes = vol_marca / SUM(vol_todas_las_marcas). Leading indicator del market share.';
