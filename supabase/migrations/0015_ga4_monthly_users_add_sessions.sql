-- =============================================================================
-- Agrega columna sesiones a ga4_monthly_users — para que el chart de tendencia
-- pueda mostrar barras (sessions) y línea (users) de la MISMA fuente mensual.
-- Más eficiente y consistente que pullear web_traffic completo para 2025.
-- =============================================================================

alter table ga4_monthly_users
  add column if not exists sesiones bigint not null default 0,
  add column if not exists pageviews bigint not null default 0;

comment on column ga4_monthly_users.sesiones is
  'Total sessions del mes (sin dimensión date, valor agregado por GA4).';
comment on column ga4_monthly_users.pageviews is
  'Total pageviews del mes (opcional).';
