-- Vista DEFAULT de Floor Share (últimas 26 semanas, sin filtro) PRECALCULADA como
-- JSON. Motivo: el dash agregaba 135k filas en JS en cada visita (~6s) además de
-- leerlas (~4s). El cron cb-mirror computa la vista default una vez y la guarda acá;
-- el dash la lee al instante (una fila). Con filtros activos, computa sobre el mirror.
create table if not exists fs_precomputed (
  id integer primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
