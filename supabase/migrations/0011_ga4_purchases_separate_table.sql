-- =============================================================================
-- Tabla separada para purchases de GA4 — permite backfill independiente del
-- workflow principal sin tocar web_traffic (que ya tiene la data correcta de
-- sessions / users / pageviews para Ene-Abr).
-- =============================================================================

create table if not exists ga4_purchases_daily (
  id            uuid primary key default uuid_generate_v4(),
  fecha         date not null,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  purchases     bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_ga4_purchases unique nulls not distinct (fecha, utm_source, utm_medium, utm_campaign)
);

create index if not exists idx_ga4_purchases_fecha on ga4_purchases_daily (fecha);

comment on table ga4_purchases_daily is
  'Purchases diarios por UTM source/medium/campaign — capturados independientemente del workflow web_traffic.';

-- -----------------------------------------------------------------------------
-- Vista vw_drean_web_daily_kpis actualizada: conversiones vienen de
-- ga4_purchases_daily cuando hay datos ahí; si no, usa web_traffic.conversiones.
-- -----------------------------------------------------------------------------

create or replace view vw_drean_web_daily_kpis as
with daily_traffic as (
  select
    fecha,
    sum(sesiones)::bigint as sesiones,
    sum(usuarios)::bigint as usuarios,
    sum(usuarios_nuevos)::bigint as usuarios_nuevos,
    sum(eventos_clave)::bigint as eventos_clave_traffic,
    sum(conversiones)::bigint as conversiones_traffic,
    sum(pageviews)::bigint as pageviews,
    case
      when sum(sesiones) filter (where bounce_rate is not null) > 0
      then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
         / sum(sesiones) filter (where bounce_rate is not null)
      else null
    end as bounce_rate,
    case
      when sum(sesiones) filter (where avg_session_duration is not null) > 0
      then sum(sesiones * avg_session_duration) filter (where avg_session_duration is not null)
         / sum(sesiones) filter (where avg_session_duration is not null)
      else null
    end as avg_session_duration
  from web_traffic
  group by fecha
),
daily_purchases as (
  select fecha, sum(purchases)::bigint as purchases
  from ga4_purchases_daily
  group by fecha
)
select
  dt.fecha,
  dt.sesiones,
  dt.usuarios,
  dt.usuarios_nuevos,
  -- Prioridad: tabla nueva > columna en web_traffic
  coalesce(dp.purchases, dt.conversiones_traffic, 0)::bigint as conversiones,
  coalesce(dp.purchases, dt.eventos_clave_traffic, 0)::bigint as eventos_clave,
  dt.pageviews,
  dt.bounce_rate,
  dt.avg_session_duration
from daily_traffic dt
left join daily_purchases dp using (fecha)
order by dt.fecha;

comment on view vw_drean_web_daily_kpis is
  'KPIs diarios de drean.com.ar (GA4). Conversiones priorizan ga4_purchases_daily; fallback a web_traffic.conversiones.';
