-- Cotización USD→ARS (BCRA promedio mensual). Idempotente.
insert into fx_rates (mes, usd_ars, fuente) values
  ('2026-04-01', 1390, 'BCRA promedio mensual'),
  ('2026-05-01', 1402, 'BCRA promedio mensual'),
  ('2026-06-01', 1440, 'BCRA promedio mensual')
on conflict (mes) do update set
  usd_ars = excluded.usd_ars,
  fuente  = excluded.fuente,
  updated_at = now();
