-- /web lento (23-nov-2026, medido con EXPLAIN ANALYZE en prod):
--  · vw_drean_web_monthly (YoY de /web): 6,2 s — agrega web_traffic entera (el filtro por mes no baja a la
--    tabla: date_trunc) y ordena en disco.
--  · top_products_in_range: 5,8 s POR SEMANA (el tablero pide 5 semanas en paralelo) — ordena en disco.
-- Se precalculan en el cron web-cat-agg (cada 6 h). Los lectores (lib/web-queries.ts) leen estas tablas y
-- caen a la vista / RPC si están vacías o no cubren el rango. Idempotente.

create table if not exists web_monthly_kpis (
  mes date primary key,
  sesiones bigint not null default 0,
  pageviews bigint not null default 0,
  bounce_rate numeric,
  avg_session_duration numeric,
  updated_at timestamptz not null default now()
);

create table if not exists web_top_products_monthly (
  mes date not null,
  landing_page text not null,
  sku text,
  producto_slug text,
  categoria text,
  sesiones bigint not null default 0,
  usuarios bigint not null default 0,
  conversiones bigint not null default 0,
  pageviews bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (mes, landing_page)
);
create index if not exists web_top_products_monthly_mes_idx on web_top_products_monthly (mes);

alter table web_monthly_kpis enable row level security;
alter table web_top_products_monthly enable row level security;
drop policy if exists "web_monthly_kpis_read" on web_monthly_kpis;
create policy "web_monthly_kpis_read" on web_monthly_kpis for select to authenticated using (true);
drop policy if exists "web_top_products_monthly_read" on web_top_products_monthly;
create policy "web_top_products_monthly_read" on web_top_products_monthly for select to authenticated using (true);

grant select on web_monthly_kpis, web_top_products_monthly to authenticated;
grant select, insert, update, delete on web_monthly_kpis, web_top_products_monthly to service_role;
