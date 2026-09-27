-- Web mensual POR CANAL, PRECALCULADA (sep-2026).
-- Motivo: vw_drean_web_monthly_by_channel agrega web_traffic ENTERA (regex de canal por fila + join de
-- compras) y el filtro por `mes` no baja a la tabla (date_trunc) → ~4,7-5,9 s aislada y mucho más bajo
-- carga. Era la query más lenta del motor de señales (cruces → loadWeb) y del Seguimiento (conversiones).
-- El cron web-cat-agg (cada 6h) la llena desde la vista UNA vez, en background; los lectores
-- (lib/web-monthly-channel.ts) leen esta tabla al instante y caen a la vista si está vacía.
-- Idempotente.

create table if not exists web_monthly_by_channel (
  mes date not null,
  canal text not null,
  sesiones bigint not null default 0,
  conversiones bigint not null default 0,
  pageviews bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (mes, canal)
);
create index if not exists web_monthly_by_channel_mes_idx on web_monthly_by_channel (mes);

alter table web_monthly_by_channel enable row level security;
drop policy if exists "web_monthly_by_channel_read" on web_monthly_by_channel;
create policy "web_monthly_by_channel_read" on web_monthly_by_channel for select to authenticated using (true);
