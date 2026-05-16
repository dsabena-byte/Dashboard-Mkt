-- =============================================================================
-- Filtra Smartup también en vw_drean_web_daily_kpis (KPIs principales y monthly
-- fallback). Sin esto, 2025 sigue inflado en los KPI cards y en el chart YoY
-- (que usa monthlyDailyKpis para el fallback de monthlyAll).
--
-- Después de 0017 sólo quedaba este "agujero". Esta migración cierra todo.
-- =============================================================================

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
  where coalesce(utm_campaign, '') not ilike 'smartup_%'
  group by fecha
),
daily_purchases as (
  select fecha, sum(purchases)::bigint as purchases
  from ga4_purchases_daily
  where coalesce(utm_campaign, '') not ilike 'smartup_%'
  group by fecha
)
select
  dt.fecha,
  dt.sesiones,
  dt.usuarios,
  dt.usuarios_nuevos,
  coalesce(dp.purchases, dt.conversiones_traffic, 0)::bigint as conversiones,
  coalesce(dp.purchases, dt.eventos_clave_traffic, 0)::bigint as eventos_clave,
  dt.pageviews,
  dt.bounce_rate,
  dt.avg_session_duration
from daily_traffic dt
left join daily_purchases dp using (fecha)
order by dt.fecha;

comment on view vw_drean_web_daily_kpis is
  'KPIs diarios de drean.com.ar (GA4). EXCLUYE campañas Smartup. Conversiones priorizan ga4_purchases_daily; fallback a web_traffic.conversiones.';
