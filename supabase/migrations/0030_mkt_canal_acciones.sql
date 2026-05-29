-- =============================================================================
-- Tabla mkt_canal_acciones: cada fila = una acción de Mkt de Canal de Drean en
-- un retailer, abierta por plataforma (cliente · acción · mes · plataforma).
-- Alimenta el dashboard estático /mkt-canal (antes hardcodeado en el HTML).
-- Datos extraídos de los reportes/evidencias del Drive (OCR + planillas).
-- =============================================================================

create table if not exists mkt_canal_acciones (
  id            bigint generated always as identity primary key,
  cliente       text not null,                   -- Cetrogar | Jumbo | La Anónima | Oncity | Naldo | Megatone
  accion        text not null,                   -- AO Verano | Hot Sale | Drean Week | Cobranding mensual ...
  mes           text not null,                   -- 'YYYY-MM'
  periodo       text not null,                   -- label legible: 'Enero 2026'
  plataforma    text not null,                   -- Meta | Google | YouTube | Email | On-site | Evidencia
  impresiones   bigint not null default 0,
  clics         bigint not null default 0,
  conversiones  numeric(12,2),                   -- reportadas en Google (compras)
  ingresos      numeric(14,2),                   -- revenue atribuido
  entregados    bigint,                          -- emails entregados (newsletter)
  aperturas     bigint,                          -- aperturas de email
  inversion     numeric(14,2),                   -- pauta del período (null = pendiente)
  evidencia_url text,                            -- link al reporte/evidencia en Drive
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_mkt_canal_accion unique (cliente, accion, mes, plataforma)
);

create index if not exists idx_mkt_canal_cliente on mkt_canal_acciones(cliente);
create index if not exists idx_mkt_canal_mes on mkt_canal_acciones(mes);
create index if not exists idx_mkt_canal_plataforma on mkt_canal_acciones(plataforma);

comment on table mkt_canal_acciones is
  'Acciones digitales de Drean en retailers (Mkt de Canal). Una fila por cliente/acción/mes/plataforma. Fuente: reportes y evidencias del Drive.';
comment on column mkt_canal_acciones.plataforma is 'Meta, Google, YouTube, Email, On-site o Evidencia (sin métricas en texto).';
comment on column mkt_canal_acciones.inversion is 'Pauta del período en ARS; null = pendiente de cargar.';

-- El dashboard /mkt-canal es HTML estático y consulta esta tabla desde el browser
-- con la anon key (PostgREST). Habilitamos RLS con lectura pública (solo SELECT).
alter table mkt_canal_acciones enable row level security;
drop policy if exists "mkt_canal_public_read" on mkt_canal_acciones;
create policy "mkt_canal_public_read"
  on mkt_canal_acciones for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Seed inicial (idempotente). Re-correr este bloque actualiza las métricas.
-- ---------------------------------------------------------------------------
insert into mkt_canal_acciones
  (cliente, accion, mes, periodo, plataforma, impresiones, clics, conversiones, ingresos, entregados, aperturas, inversion, evidencia_url)
values
  ('Cetrogar', 'AO Verano', '2026-01', 'Enero 2026', 'Meta', 1799224, 31183, null, null, null, null, null, 'https://drive.google.com/file/d/1whjnPfDmVhHdHYh7l_tTJSddZ_puFHZq/view'),
  ('Cetrogar', 'AO Verano', '2026-01', 'Enero 2026', 'Google', 277564, 13830, null, null, null, null, null, 'https://drive.google.com/file/d/1whjnPfDmVhHdHYh7l_tTJSddZ_puFHZq/view'),
  ('Cetrogar', 'AO Verano', '2026-01', 'Enero 2026', 'YouTube', 374025, 1529, null, null, null, null, null, 'https://drive.google.com/file/d/1whjnPfDmVhHdHYh7l_tTJSddZ_puFHZq/view'),
  ('Cetrogar', 'CetroSale', '2026-02', 'Febrero 2026', 'Meta', 1799220, 32695, null, null, null, null, null, 'https://drive.google.com/file/d/1928N680A3kTaNvAvqcCqAYz92fw1263n/view'),
  ('Cetrogar', 'CetroSale', '2026-02', 'Febrero 2026', 'Google', 277572, 12398, null, null, null, null, null, 'https://drive.google.com/file/d/1928N680A3kTaNvAvqcCqAYz92fw1263n/view'),
  ('Cetrogar', 'CetroSale', '2026-02', 'Febrero 2026', 'YouTube', 374025, 1550, null, null, null, null, null, 'https://drive.google.com/file/d/1928N680A3kTaNvAvqcCqAYz92fw1263n/view'),
  ('Cetrogar', 'Electrofans', '2026-03', 'Marzo 2026', 'Meta', 2541859, 44226, null, null, null, null, null, 'https://drive.google.com/file/d/1dPgYPthRJtwbn65HM56Moe9O_SFSLI5G/view'),
  ('Cetrogar', 'Electrofans', '2026-03', 'Marzo 2026', 'Google', 342500, 18431, null, null, null, null, null, 'https://drive.google.com/file/d/1dPgYPthRJtwbn65HM56Moe9O_SFSLI5G/view'),
  ('Cetrogar', 'Electrofans', '2026-03', 'Marzo 2026', 'YouTube', 374025, 1476, null, null, null, null, null, 'https://drive.google.com/file/d/1dPgYPthRJtwbn65HM56Moe9O_SFSLI5G/view'),
  ('Jumbo', 'Hot Sale', '2026-05', 'Mayo 2026', 'On-site', 33235, 303, null, null, null, null, null, 'https://drive.google.com/file/d/1wlV8cjxgpFrM7zNm2XJEyDkrlxdh2YFf/view'),
  ('La Anónima', 'Hot Sale', '2026-05', 'Mayo 2026', 'On-site', 4184345, 122421, null, null, null, null, null, 'https://drive.google.com/file/d/1oG3dUGiAZecrMjv3xgc5gOVxkS2H92Oq/view'),
  ('La Anónima', 'Hot Sale', '2026-05', 'Mayo 2026', 'Email', 0, 1688, null, null, 425110, 55157, null, 'https://drive.google.com/file/d/1oG3dUGiAZecrMjv3xgc5gOVxkS2H92Oq/view'),
  ('Oncity', 'Drean Week', '2026-04', 'Abril 2026', 'Meta', 4978, 113, null, null, null, null, null, 'https://drive.google.com/file/d/1IlHVQHtHZUyUY34fCcHlqLqITyM9N1jR/view'),
  ('Oncity', 'Drean Week', '2026-04', 'Abril 2026', 'Google', 29579, 957, 5.99, 3645469, null, null, null, 'https://drive.google.com/file/d/1IlHVQHtHZUyUY34fCcHlqLqITyM9N1jR/view'),
  ('Oncity', 'Drean Week', '2026-04', 'Abril 2026', 'Email', 0, 3920, null, null, 580850, 59467, null, 'https://drive.google.com/file/d/1IlHVQHtHZUyUY34fCcHlqLqITyM9N1jR/view'),
  ('Oncity', 'Drean Week', '2026-04', 'Abril 2026', 'On-site', 236921, 230, null, null, null, null, null, 'https://drive.google.com/file/d/1IlHVQHtHZUyUY34fCcHlqLqITyM9N1jR/view'),
  ('Oncity', 'Electrofans', '2026-03', 'Marzo 2026', 'Meta', 9390, 110, null, null, null, null, null, 'https://drive.google.com/file/d/1eZJ2XAe_fv2OzFESSn8CLyuIVAYHO9N1/view'),
  ('Oncity', 'Electrofans', '2026-03', 'Marzo 2026', 'Google', 22674, 770, 5.05, 4283084, null, null, null, 'https://drive.google.com/file/d/1eZJ2XAe_fv2OzFESSn8CLyuIVAYHO9N1/view'),
  ('Oncity', 'Electrofans', '2026-03', 'Marzo 2026', 'Email', 0, 4576, null, null, 291338, 34487, null, 'https://drive.google.com/file/d/1eZJ2XAe_fv2OzFESSn8CLyuIVAYHO9N1/view'),
  ('Naldo', 'Cobranding mensual', '2026-01', 'Enero 2026', 'Meta', 44586, 542, null, null, null, null, 99621, 'https://drive.google.com/file/d/1qDIKKjP4-qn4XKYVleYi1m2uShIRC6xh/view'),
  ('Naldo', 'Cobranding mensual', '2026-01', 'Enero 2026', 'Email', 0, 1080, null, null, 62620, 25061, null, 'https://drive.google.com/file/d/1qDIKKjP4-qn4XKYVleYi1m2uShIRC6xh/view'),
  ('Naldo', 'Cobranding mensual', '2026-02', 'Febrero 2026', 'Meta', 44087, 1003, null, null, null, null, 99414, 'https://drive.google.com/file/d/1ebj_krobplMXZklDcfKZkF1jJ67IBcgd/view'),
  ('Naldo', 'Cobranding mensual', '2026-02', 'Febrero 2026', 'Email', 0, 875, null, null, 65341, 22168, null, 'https://drive.google.com/file/d/1ebj_krobplMXZklDcfKZkF1jJ67IBcgd/view'),
  ('Naldo', 'Cobranding mensual', '2026-03', 'Marzo 2026', 'Evidencia', 0, 0, null, null, null, null, null, 'https://drive.google.com/file/d/1cYII5u_0kVImWXAvS9k_f2ljoXqu1Yg8/view'),
  ('Naldo', 'Cobranding mensual', '2026-04', 'Abril 2026', 'Meta', 38607, 1017, null, null, null, null, 99206, 'https://drive.google.com/file/d/1LRdAV9N-X1A8KgflRvxKB1EXkLy6zyGO/view'),
  ('Naldo', 'Cobranding mensual', '2026-04', 'Abril 2026', 'Email', 0, 1155, null, null, 63819, 29472, null, 'https://drive.google.com/file/d/1LRdAV9N-X1A8KgflRvxKB1EXkLy6zyGO/view'),
  ('Megatone', 'Hot Sale', '2026-05', 'Mayo 2026', 'Evidencia', 0, 0, null, null, null, null, null, 'https://drive.google.com/file/d/1pkqUH0OGgTzv9KcOPYLZvl7N65ptqCal/view')
on conflict (cliente, accion, mes, plataforma) do update set
  periodo       = excluded.periodo,
  impresiones   = excluded.impresiones,
  clics         = excluded.clics,
  conversiones  = excluded.conversiones,
  ingresos      = excluded.ingresos,
  entregados    = excluded.entregados,
  aperturas     = excluded.aperturas,
  inversion     = excluded.inversion,
  evidencia_url = excluded.evidencia_url,
  updated_at    = now();
