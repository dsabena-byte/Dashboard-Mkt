-- =============================================================================
-- 0128_inflacion_mensual: inflación mensual (%) que carga finanzas en /funnel → Cargar datos → Inflación
-- (21-oct-2026, pedido del user). Se usa para planificar el presupuesto (ej. ajuste trimestral de OOH);
-- NO deflacta ningún tablero. Idempotente.
-- =============================================================================
create table if not exists inflacion_mensual (
  mes         date primary key,          -- YYYY-MM-01
  pct         numeric not null,          -- inflación del mes en %, ej. 2.0
  fuente      text,
  updated_at  timestamptz not null default now()
);
alter table inflacion_mensual enable row level security;

grant select, insert, update, delete on public.inflacion_mensual to service_role;

notify pgrst, 'reload schema';
