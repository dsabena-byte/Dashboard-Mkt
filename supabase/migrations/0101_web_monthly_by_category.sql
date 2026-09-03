-- Distribución mensual de usuarios web por categoría, PRECALCULADA.
-- Motivo: la vista vw_drean_web_by_category agrega web_landing_daily (tabla enorme)
-- y tarda ~8.8s por consulta, lo que hacía lento el ingreso a Seguimiento Objetivos.
-- El cron web-cat-agg llena esta tabla (paga el costo en background); la app la lee
-- al instante. Solo tiene el dato que el Seguimiento necesita: usuarios por mes×categoría.

create table if not exists web_monthly_by_category (
  mes date not null,
  categoria text not null,
  usuarios integer not null default 0,
  sesiones integer not null default 0,
  conversiones integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (mes, categoria)
);
