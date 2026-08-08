-- Interés de búsqueda por PROVINCIA (para el mapa de Argentina en Análisis SEO /
-- Search). De DataForSEO Trends (subregion_interests): índice 0-100 por provincia
-- para cada marca × categoría. marca NULL = demanda genérica de la categoría.
create table if not exists search_region (
  marca       text not null,    -- 'Genérico' = demanda genérica de la categoría
  categoria   text not null,    -- lavarropas | heladeras | cocinas
  provincia   text not null,    -- nombre normalizado al geojson (ej. "Cordoba", "Capital Federal")
  interes     integer,          -- 0-100 (relativo, Google Trends)
  fetched_at  timestamptz not null default now(),
  primary key (marca, categoria, provincia)
);

comment on table search_region is 'Interés de búsqueda por provincia (Google Trends subregion_interests) por marca×categoría. Alimenta el choropleth del dashboard.';
