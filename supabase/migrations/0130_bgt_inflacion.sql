-- =============================================================================
-- 0130_bgt_inflacion: inflación mensual (%) POR VERSIÓN, igual que el tipo de cambio (bgt_tc): BGT, 4+8, 8+4 y REAL
-- de cada año (21-oct-2026, pedido del user: "existe la inflación BGT y luego la real", para compararlas). REAL la carga
-- sola el cron inflacion-indec (INDEC, IPC nivel general nacional). Reemplaza a inflacion_mensual (0128), que queda sin
-- uso; lo cargado ahí se copia: fuente INDEC → REAL <año>, el resto → BGT <año>. Solo para planificar; no deflacta
-- tableros. RLS sin policies (service key). Idempotente.
-- =============================================================================
create table if not exists bgt_inflacion (
  version     text not null references bgt_versiones(nombre) on update cascade on delete cascade,
  mes         smallint not null check (mes between 1 and 12),
  pct         numeric not null check (pct > -50 and pct < 100),   -- % del mes, ej. 2.0
  fuente      text,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (version, mes)
);
alter table bgt_inflacion enable row level security;
grant select, insert, update, delete on public.bgt_inflacion to service_role;

do $$
begin
  if to_regclass('public.inflacion_mensual') is not null then
    insert into bgt_versiones (nombre, tipo, anio, created_by)
      select distinct (case when fuente = 'INDEC' then 'REAL ' else 'BGT ' end) || extract(year from mes)::int,
             case when fuente = 'INDEC' then 'REAL' else 'BGT' end, extract(year from mes)::int, 'migración 0130'
        from inflacion_mensual
      on conflict (nombre) do nothing;
    insert into bgt_inflacion (version, mes, pct, fuente, updated_by)
      select (case when fuente = 'INDEC' then 'REAL ' else 'BGT ' end) || extract(year from mes)::int,
             extract(month from mes)::int, pct, fuente, 'migración 0130'
        from inflacion_mensual
      on conflict (version, mes) do nothing;
  end if;
end $$;

notify pgrst, 'reload schema';
