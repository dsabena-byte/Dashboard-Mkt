-- 0110 · Moneda constante (portado de BIP, sep-2026). Idempotente. PROYECTO PRINCIPAL (dashboard-mkt).
-- Índices macro para leer los montos en pesos corrientes / pesos constantes / USD:
--   mes         = primer día del mes (YYYY-MM-01)
--   ipc         = IPC nivel general nacional, INDEC, base dic-2016 = 100
--                 (serie 148.3_INIVELNAL_DICI_M_26 de la API de Series de Tiempo de datos.gob.ar)
--   usd_oficial = dólar oficial, PROMEDIO de las cotizaciones diarias del mes (API del BCRA,
--                 Estadísticas Cambiarias v1.0 /Cotizaciones/USD; fallback argentinadatos.com)
--   usd_mep     = dólar MEP (bolsa), promedio del mes (argentinadatos.com) — opcional
-- Lo llena el cron /api/cron/sync-macro (workflow sync-macro.yml, días 2 y 16 de cada mes).
-- La app es FAIL-SAFE: sin esta tabla (o vacía) /performance y /funnel siguen en pesos corrientes
-- con un aviso. NO reemplaza a fx_rates (tipo de cambio que usa Pauta para convertir DV360).
create table if not exists public.indices_macro (
  mes          date primary key,
  ipc          numeric,
  usd_oficial  numeric,
  usd_mep      numeric,
  updated_at   timestamptz not null default now(),
  constraint indices_macro_mes_primer_dia check (extract(day from mes) = 1)
);
alter table public.indices_macro enable row level security;  -- sin policies: solo service role
revoke all on public.indices_macro from anon, authenticated;

-- SEED: VACÍO A PROPÓSITO. Desde el sandbox donde se escribió esta migración la red bloquea
-- apis.datos.gob.ar, api.bcra.gob.ar y argentinadatos.com, así que no se verificó ningún valor
-- contra la fuente oficial y NO se cargan números sin verificar. Después de correr esta migración:
-- GitHub → Actions → "Sync índices macro (IPC + dólar)" → Run workflow con desde = 2023-01-01
-- (backfill). Después corre solo los días 2 y 16.
