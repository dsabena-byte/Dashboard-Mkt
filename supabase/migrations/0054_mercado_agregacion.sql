-- =============================================================================
-- 0054_mercado_agregacion: permitir que convivan dos series en mercado_share:
--   - 'MAT'     : acumulado móvil 12 meses (lo ya cargado de GFK).
--   - 'mensual' : valor del mes (nueva carga de GFK, vista mensual).
--
-- No se borra nada de lo existente: las filas actuales quedan como 'MAT'.
-- Se extiende la PK para que un mismo (mes, categoría, segmento, marca) pueda
-- tener ambas agregaciones.
-- =============================================================================

alter table mercado_share
  add column if not exists agregacion text not null default 'MAT';

-- Recrear PK incluyendo la agregación (las filas viejas ya quedaron como 'MAT').
alter table mercado_share drop constraint if exists mercado_share_pkey;
alter table mercado_share add primary key (mes, categoria, segmento, marca, agregacion);

comment on column mercado_share.agregacion is
  'MAT (acumulado móvil 12 meses) | mensual (valor del mes). Permite coexistir ambas series sin pisarse.';
