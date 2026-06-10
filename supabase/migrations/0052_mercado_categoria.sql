-- =============================================================================
-- 0052_mercado_categoria: share de mercado (units + valor) e índice de precio
-- por categoría y SEGMENTO de producto (high / mid / low).
--
-- Señales de equity para el Objetivo de Salud de Marca, por segmento:
--   - share_units_*  : % share de mercado en UNIDADES.
--   - share_value_*  : % share de mercado en VALOR ($).
--   - index_price_*  : índice de precio de Drean vs categoría (base 100).
--   (* = high / mid / low — alta / media / entrada)
--
-- Una fila por (mes, categoría). El Overview toma el último mes disponible.
-- =============================================================================

create table if not exists mercado_categoria (
  mes               date not null,         -- primer día del mes (YYYY-MM-01)
  categoria         text not null,         -- Lavado | Refrigeración | Cocción
  share_units_high  numeric,  share_units_mid  numeric,  share_units_low  numeric,
  share_value_high  numeric,  share_value_mid  numeric,  share_value_low  numeric,
  index_price_high  numeric,  index_price_mid  numeric,  index_price_low  numeric,
  fuente            text,
  updated_at        timestamptz not null default now(),
  primary key (mes, categoria)
);

-- Idempotente: ajustar columnas si la tabla ya existía con otro esquema.
alter table mercado_categoria
  add column if not exists share_units_high  numeric,
  add column if not exists share_units_mid   numeric,
  add column if not exists share_units_low   numeric,
  add column if not exists share_value_high  numeric,
  add column if not exists share_value_mid   numeric,
  add column if not exists share_value_low   numeric,
  add column if not exists index_price_high  numeric,
  add column if not exists index_price_mid   numeric,
  add column if not exists index_price_low   numeric;
alter table mercado_categoria
  drop column if exists share_mercado,
  drop column if exists index_precio,
  drop column if exists share_units,
  drop column if exists share_value;

comment on table mercado_categoria is
  'Share de mercado (units/value) e índice de precio por segmento (high/mid/low) de Drean por categoría/mes. Señales de equity para el Objetivo de Salud de Marca del Overview.';
