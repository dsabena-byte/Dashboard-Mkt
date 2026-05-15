-- =============================================================================
-- Usuarios únicos por mes — query GA4 sin dimensión 'date' devuelve total unique
-- users del período. Sin esto, sumar usuarios diarios sobre-cuenta a quienes
-- visitan varios días.
-- =============================================================================

create table if not exists ga4_monthly_users (
  id            uuid primary key default uuid_generate_v4(),
  mes           date not null,
  total_users   bigint not null default 0,
  new_users     bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (mes)
);

create index if not exists idx_ga4_monthly_users_mes on ga4_monthly_users (mes);

comment on table ga4_monthly_users is
  'Usuarios únicos por mes — obtenidos de GA4 sin dimensión date (total real, no sumatoria diaria).';
