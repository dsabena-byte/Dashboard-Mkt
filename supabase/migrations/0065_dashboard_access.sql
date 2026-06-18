-- =============================================================================
-- 0065_dashboard_access: control de acceso por dashboard.
--
-- Modelo: una fila por (email, dashboard) que ese usuario PUEDE ver.
--   - Si un email NO tiene ninguna fila acá → ve TODOS los dashboards (default,
--     no rompe nada para el equipo actual).
--   - Si tiene al menos una fila → queda RESTRINGIDO solo a esos dashboards
--     (en el menú y por acceso directo a la URL).
--
-- Para dar acceso limitado a alguien, insertar las filas de los dashboards que
-- puede ver. Paths válidos (dashboard_path):
--   /overview              Objetivos Marketing
--   /salud-marca           Salud de Marca
--   /mercado               Análisis de Mercado
--   /funnel                BGT Inversión
--   /planning              Planning Pauta Mkt
--   /performance           Pauta Mkt
--   /performance-conversion Pauta Ecommerce
--   /influencia            Mkt de Influencia
--   /web                   Análisis Web
--   /redes                 Análisis Redes
--   /mkt-canal             Mkt de Canal
--   /cuadros-basicos       Cuadros Básicos
--   /floor-share           Floor Share
--
-- Ejemplo (dar a juan@drean.com solo las dos de pauta):
--   insert into dashboard_access (user_email, dashboard_path) values
--     ('juan@drean.com', '/performance'),
--     ('juan@drean.com', '/performance-conversion');
-- =============================================================================

create table if not exists dashboard_access (
  id             uuid primary key default uuid_generate_v4(),
  user_email     text not null,
  dashboard_path text not null,
  created_at     timestamptz not null default now(),
  constraint uq_dashboard_access unique (user_email, dashboard_path)
);

create index if not exists idx_dashboard_access_email on dashboard_access (lower(user_email));

comment on table dashboard_access is
  'Acceso por dashboard. Email sin filas = ve todo; con filas = solo esos paths. La app filtra el menú y bloquea el acceso directo por URL.';

-- RLS: cada usuario autenticado lee SOLO sus propias filas (por email del JWT).
-- Las escrituras se hacen desde el panel de Supabase (service_role, saltea RLS).
alter table dashboard_access enable row level security;
drop policy if exists dashboard_access_self_read on dashboard_access;
create policy dashboard_access_self_read on dashboard_access
  for select to authenticated
  using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
