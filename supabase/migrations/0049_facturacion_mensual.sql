-- =============================================================================
-- 0049_facturacion_mensual: facturación mensual real de la empresa.
--
-- Alimenta el indicador "Inversión Mkt / Facturación" del Objetivo 1 del
-- Overview (ejecución del presupuesto de marketing). La inversión real sale
-- del dash de BGT Mkt (versión REAL 2026, en USD); la facturación se carga
-- acá, en la MISMA moneda (USD), para que el cociente Inv / Fact sea válido.
--
-- Una fila por mes (primer día del mes, YYYY-MM-01). Para cargar nuevos meses,
-- usar el mismo INSERT ... ON CONFLICT de abajo.
-- =============================================================================

create table if not exists facturacion_mensual (
  mes          date primary key,             -- primer día del mes (YYYY-MM-01)
  facturacion  numeric not null,             -- facturación real de la empresa en el mes
  moneda       text    not null default 'USD', -- moneda de la cifra
  fuente       text,                         -- de dónde salió el dato (ej. 'carga manual')
  updated_at   timestamptz not null default now()
);

comment on table facturacion_mensual is
  'Facturación mensual real de la empresa. Usada por el Objetivo 1 del Overview para el indicador Inversión Mkt / Facturación (Inv real USD / Facturación USD ≤ 1,3%).';

-- Carga inicial: facturación real 2026 (USD). Ampliar a medida que cierran meses.
insert into facturacion_mensual (mes, facturacion, moneda, fuente) values
  ('2026-01-01', 17603000, 'USD', 'carga manual'),
  ('2026-02-01', 15500000, 'USD', 'carga manual'),
  ('2026-03-01', 19299000, 'USD', 'carga manual'),
  ('2026-04-01', 23423000, 'USD', 'carga manual')
on conflict (mes) do update
  set facturacion = excluded.facturacion,
      moneda      = excluded.moneda,
      fuente      = excluded.fuente,
      updated_at  = now();
