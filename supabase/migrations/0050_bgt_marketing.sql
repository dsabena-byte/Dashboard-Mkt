-- =============================================================================
-- 0050_bgt_marketing: presupuesto y ejecución real de Marketing (ex data.json).
--
-- Unifica en Supabase la data del dash de BGT Mkt, que hasta ahora vivía en un
-- data.json externo (sincronizado desde SharePoint). La ruta /api/cron/bgt-sync
-- baja ese data.json, agrega por clave y hace upsert acá. El Overview lee de
-- esta tabla (con fallback al data.json mientras el primer sync no corrió).
--
-- Grano: una fila por (versión de presupuesto, año, mes, cuenta, concepto).
-- El data.json trae múltiples líneas por concepto → el cron las SUMA antes de
-- insertar, así que cada fila acá es el total de ese concepto en ese mes.
--
-- Versiones (presupuesto): 'BGT 2026', '4+8 2026', '8+4 2026', 'REAL 2026', y
-- equivalentes de años anteriores.
-- =============================================================================

create table if not exists bgt_marketing (
  presupuesto  text    not null,           -- versión: "BGT 2026", "REAL 2026", "4+8 2026", ...
  anio         int     not null,           -- 2026, 2025, ...
  mes          text    not null,           -- "ENERO" … "DICIEMBRE" (uppercase, como el data.json)
  cuenta       text    not null default '',-- cuenta contable (puede venir vacía)
  concepto     text    not null default '',-- línea / concepto
  ars          numeric not null default 0, -- monto en ARS
  usd          numeric not null default 0, -- monto en USD
  updated_at   timestamptz not null default now(),
  constraint uq_bgt_marketing unique (presupuesto, anio, mes, cuenta, concepto)
);

comment on table bgt_marketing is
  'Presupuesto (BGT/4+8/8+4) y ejecución real (REAL) de Marketing por mes/cuenta/concepto, en ARS y USD. Sincronizado desde el data.json de BGT Mkt (origen SharePoint) vía /api/cron/bgt-sync. Alimenta el Objetivo 1 del Overview.';

create index if not exists idx_bgt_marketing_lookup
  on bgt_marketing (anio, presupuesto, mes);
