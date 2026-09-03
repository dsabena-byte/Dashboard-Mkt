-- Resultado MENSUAL de Trade (Cuadros Básicos + Floor Share) PRECALCULADO.
-- Motivo: getCbRows({})/getFloorShareRows({}) paginan la tabla CB entera (~26s
-- contra el proyecto CB, lento) → el Seguimiento Objetivos tardaba 30s+ EN CADA
-- visita. El cron trade-agg calcula esto en background (paga el costo 1 vez cada
-- pocas horas) y el dash lee estas ~12 filas al instante desde el proyecto principal.
-- Vive en el proyecto PRINCIPAL (dashboard-mkt), no en el CB.

create table if not exists trade_monthly (
  anio integer not null,
  mes integer not null,               -- 1..12
  cb_pct numeric,                     -- % Cumplimiento CB (total)
  fs_general numeric,                 -- Floor Share Drean ponderado (Σ cat × peso)
  fs_lavado numeric,
  fs_refri numeric,
  fs_coccion numeric,
  updated_at timestamptz not null default now(),
  primary key (anio, mes)
);
