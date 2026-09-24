-- "Mis tableros" (motor de tableros de planilla portado de BIP, sep-2026). Single-tenant (Drean).
--   tableros_datasets: planillas subidas (Excel/CSV) o leídas de Google Sheets. columns = encabezados
--                      (fila 1), rows = filas como arrays (jsonb), source = {type, file|spreadsheetId}.
--   tableros:          config v2 de cada tablero ({ v: 2, title, datasetId, datasets, widgets, filters }).
--                      Slugs reservados que NO son tableros: 'cfg-kantar' (Kantar por planilla → /salud-marca).
-- La app es fail-safe: si estas tablas no existen, /tableros muestra qué migración correr y
-- /salud-marca sigue con los valores Kantar fijos del código.
create extension if not exists pgcrypto;

create table if not exists tableros_datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  row_count integer not null default 0,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tableros_datasets_updated_idx on tableros_datasets (updated_at desc);

create table if not exists tableros (
  slug text primary key,
  title text not null default '',
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Solo la service key (API server-side) lee/escribe.
alter table tableros_datasets enable row level security;
alter table tableros enable row level security;
