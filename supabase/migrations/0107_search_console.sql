-- Google Search Console de drean.com.ar (clicks, impresiones, CTR y posición por
-- búsqueda y por página) como SNAPSHOT JSON single-tenant (una fila, id=1).
-- Lo llena el cron /api/cron/search-console (workflow search-console-sync.yml, semanal);
-- /seo-search lo lee al instante y las señales cruce_sc_* lo usan.
-- Sin esta tabla el dashboard funciona igual (la sección explica que falta la migración).
create table if not exists search_console_snapshot (
  id smallint primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint search_console_snapshot_singleton check (id = 1)
);

alter table search_console_snapshot enable row level security;
-- Sin policies: solo la service key (server) lee/escribe.
