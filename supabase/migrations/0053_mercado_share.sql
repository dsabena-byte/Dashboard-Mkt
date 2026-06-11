-- =============================================================================
-- 0053_mercado_share: share de mercado (units/value) e índice de precio por
-- MARCA (Drean + competencia), categoría y segmento, en serie mensual (MAT).
--
-- Reemplaza a mercado_categoria (que era solo Drean). Fuente: Euromonitor.
--   - unit_share / value_share : % (0..100).
--   - index_price : base 100 (vs mercado).
--   - mes : mes de cierre de la ventana MAT (rolling 12m).
--   - segmento : High | Mid | Low.
--
-- Carga manual (export Euromonitor → seed SQL en supabase/seed/).
-- Alimenta el dash /mercado (evolución por marca) y el Objetivo 4 (Drean).
-- =============================================================================

create table if not exists mercado_share (
  mes          date not null,
  categoria    text not null,           -- Lavado | Refrigeración | Cocción
  segmento     text not null,           -- High | Mid | Low
  marca        text not null,           -- DREAN | PHILCO | SAMSUNG | ...
  unit_share   numeric,                 -- % (0..100)
  value_share  numeric,                 -- % (0..100)
  index_price  numeric,                 -- base 100
  fuente       text,
  updated_at   timestamptz not null default now(),
  primary key (mes, categoria, segmento, marca)
);

create index if not exists idx_mercado_share on mercado_share (categoria, segmento, mes);

comment on table mercado_share is
  'Share de mercado (units/value en %) e índice de precio (base 100) por marca/categoría/segmento/mes (serie MAT). Fuente Euromonitor. Alimenta /mercado y el Objetivo 4 del Overview.';

-- Reemplaza la tabla vieja (solo Drean, sin marca).
drop table if exists mercado_categoria;
