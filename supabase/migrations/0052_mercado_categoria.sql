-- =============================================================================
-- 0052_mercado_categoria: share de mercado e índice de precio por categoría.
--
-- Señales fuertes de equity para el Objetivo de Salud de Marca:
--   - share_mercado: % de participación de Drean en la categoría (sell-out).
--     Buen share ⇒ la marca está convirtiendo equity en ventas.
--   - index_precio: precio promedio de Drean vs el promedio de la categoría
--     (base 100). >100 = premium; <100 = por debajo del mercado.
--
-- Una fila por (mes, categoría). Se carga con la data de mercado (sell-out /
-- pricing). El Overview toma el último mes disponible.
-- =============================================================================

create table if not exists mercado_categoria (
  mes           date not null,             -- primer día del mes (YYYY-MM-01)
  categoria     text not null,             -- Lavado | Refrigeración | Cocción
  share_mercado numeric,                   -- % share de mercado (0..100)
  index_precio  numeric,                   -- índice de precio vs categoría (base 100)
  fuente        text,
  updated_at    timestamptz not null default now(),
  primary key (mes, categoria)
);

comment on table mercado_categoria is
  'Share de mercado e índice de precio (vs categoría) de Drean por categoría/mes. Señales de equity para el Objetivo de Salud de Marca del Overview.';
