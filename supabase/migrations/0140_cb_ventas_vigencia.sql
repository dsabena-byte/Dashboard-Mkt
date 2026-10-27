-- 0140 · CB Ventas: vigencia del cuadro básico (27-oct-2026). Editar el cuadro básico desde el tablero NO cambia la historia:
--   cada renglón de vt_cb_catalogo vale desde vigente_desde hasta vigente_hasta (null = vigente). Una edición cierra el
--   renglón viejo al fin del mes anterior y crea el nuevo desde el 1º del mes en curso; lo que valió en un mes pasado
--   nunca se borra. El mes M del tablero usa los renglones que valían en M; los KPIs de "ahora", los de hoy.
-- Los renglones existentes quedan vigentes desde 2026-01-01 → los números de hoy no cambian.
-- vt_clientes NO lleva vigencia: vendedor/gerencia/peso son de atribución (cartera actual, como la app vieja).
-- Idempotente. Sin columnas/tablas nuevas → los grants de 0139 siguen valiendo.

alter table public.vt_cb_catalogo add column if not exists vigente_desde date not null default '2026-01-01';
alter table public.vt_cb_catalogo add column if not exists vigente_hasta date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vt_cb_catalogo_vigencia_chk') then
    alter table public.vt_cb_catalogo add constraint vt_cb_catalogo_vigencia_chk
      check (vigente_hasta is null or vigente_hasta >= vigente_desde);
  end if;
end $$;

create index if not exists vt_cb_catalogo_vigente_idx on public.vt_cb_catalogo (vigente_hasta);
