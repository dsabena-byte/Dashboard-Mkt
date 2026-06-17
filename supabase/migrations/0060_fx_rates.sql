-- =============================================================================
-- 0060_fx_rates: cotización USD→ARS por mes (BCRA promedio mensual) para mostrar
-- la inversión de DV360 (que viene en USD) en pesos. La conversión se aplica
-- por mes en el dashboard. Una fila por mes; se va agregando hacia adelante.
-- =============================================================================

create table if not exists fx_rates (
  mes        date primary key,        -- primer día del mes (YYYY-MM-01)
  usd_ars    numeric not null,        -- pesos por dólar (promedio del mes)
  fuente     text not null default 'BCRA promedio mensual',
  updated_at timestamptz not null default now()
);

comment on table fx_rates is 'Cotización USD→ARS por mes (BCRA promedio mensual). Para convertir inversión de DV360 a pesos.';
