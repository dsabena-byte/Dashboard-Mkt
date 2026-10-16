-- =============================================================================
-- 0126_facturacion_mensual_carga: deja lista la tabla facturacion_mensual para cargarla desde
-- /funnel/carga → Facturación (16-oct-2026). Idempotente y SIN datos (no pisa lo cargado):
-- crea la tabla si la 0049 no corrió y agrega las columnas que falten.
-- =============================================================================
create table if not exists facturacion_mensual (
  mes          date primary key,
  facturacion  numeric not null
);
alter table facturacion_mensual add column if not exists moneda     text not null default 'USD';
alter table facturacion_mensual add column if not exists fuente     text;
alter table facturacion_mensual add column if not exists updated_at timestamptz not null default now();

-- La API (service key) recarga el esquema al toque.
notify pgrst, 'reload schema';

select count(*) as meses_cargados from facturacion_mensual;
