-- Plan de Medios anual (pestaña "Plan anual" de /performance, oct-2026): una fila por año con la
-- configuración editable (BGT mensual, reparto por medio, rol, mix por categoría). Los cambios quedan en
-- bgt_auditoria (entidad 'plan_medios'). Idempotente.
create table if not exists public.plan_medios_anual (
  anio int primary key,
  config jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.plan_medios_anual enable row level security;
grant select, insert, update, delete on public.plan_medios_anual to service_role;
notify pgrst, 'reload schema';
