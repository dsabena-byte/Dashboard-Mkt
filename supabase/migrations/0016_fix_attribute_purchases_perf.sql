-- =============================================================================
-- Fix: vw_drean_web_traffic_with_purchases tira statement timeout porque la
-- window function `sum() over (partition by …)` recorre toda web_traffic
-- antes de aplicar el filtro de fecha que viene del query de afuera.
--
-- Reescribimos para que el total de sesiones por key (fecha, src, med, camp)
-- se calcule por GROUP BY desde el lado de ga4_purchases_daily (mucho más
-- chico). Así el filtro de fecha pushdown llega a web_traffic y solo se
-- agregan totals para los keys que TIENEN purchases.
--
-- Además agregamos índices necesarios.
-- =============================================================================

-- Índices que permiten que el join key sea rápido
create index if not exists idx_web_traffic_fecha
  on web_traffic(fecha);

create index if not exists idx_web_traffic_utm_key
  on web_traffic(fecha, utm_source, utm_medium, utm_campaign);

create index if not exists idx_ga4_purchases_daily_key
  on ga4_purchases_daily(fecha, utm_source, utm_medium, utm_campaign);

-- Vista enriquecida — version sin window function
create or replace view vw_drean_web_traffic_with_purchases as
select
  wt.fecha,
  wt.utm_source,
  wt.utm_medium,
  wt.utm_campaign,
  wt.utm_content,
  wt.utm_term,
  wt.landing_page,
  wt.sesiones,
  wt.usuarios,
  wt.usuarios_nuevos,
  case
    when att.purchases is not null and att.total_sesiones > 0
    then round(att.purchases * (wt.sesiones::numeric / att.total_sesiones))::bigint
    else wt.conversiones
  end as conversiones,
  case
    when att.purchases is not null and att.total_sesiones > 0
    then round(att.purchases * (wt.sesiones::numeric / att.total_sesiones))::bigint
    else wt.eventos_clave
  end as eventos_clave,
  wt.bounce_rate,
  wt.avg_session_duration,
  wt.pageviews
from web_traffic wt
left join (
  -- Solo para las keys que tienen purchases, precalculamos total de sesiones.
  -- ga4_purchases_daily es ~1000s de rows, web_traffic es 100k+.
  select
    dp.fecha,
    dp.utm_source,
    dp.utm_medium,
    dp.utm_campaign,
    dp.purchases,
    coalesce(sum(wt2.sesiones), 0) as total_sesiones
  from ga4_purchases_daily dp
  left join web_traffic wt2 on (
    wt2.fecha = dp.fecha and
    coalesce(wt2.utm_source, '')   = coalesce(dp.utm_source, '')   and
    coalesce(wt2.utm_medium, '')   = coalesce(dp.utm_medium, '')   and
    coalesce(wt2.utm_campaign, '') = coalesce(dp.utm_campaign, '')
  )
  group by dp.fecha, dp.utm_source, dp.utm_medium, dp.utm_campaign, dp.purchases
) att on (
  att.fecha = wt.fecha and
  coalesce(att.utm_source, '')   = coalesce(wt.utm_source, '')   and
  coalesce(att.utm_medium, '')   = coalesce(wt.utm_medium, '')   and
  coalesce(att.utm_campaign, '') = coalesce(wt.utm_campaign, '')
);

comment on view vw_drean_web_traffic_with_purchases is
  'web_traffic enriquecido: conversiones atribuidas proporcionalmente por sesiones a las keys (fecha, src, med, camp) que tienen purchases en ga4_purchases_daily. Optimizado para que el filtro de fecha pushdown.';
