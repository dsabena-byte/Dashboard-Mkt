-- =============================================================================
-- Acotar el filtro de "Smartup" a SOLO Smartup TikTok (las campañas tipo bot
-- claras, bounce <0.5%). Smartup Google/Meta son tráfico de demanda real
-- aunque de baja calidad y deben quedarse.
--
-- Cambia `smartup_%` → `smartup_tiktok_%` en todas las views afectadas.
-- =============================================================================

-- vw_drean_web_traffic_with_purchases — versión final con filtro narrow
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
  select
    dp.fecha, dp.utm_source, dp.utm_medium, dp.utm_campaign, dp.purchases,
    coalesce(sum(wt2.sesiones), 0) as total_sesiones
  from ga4_purchases_daily dp
  left join web_traffic wt2 on (
    wt2.fecha = dp.fecha and
    coalesce(wt2.utm_source, '')   = coalesce(dp.utm_source, '')   and
    coalesce(wt2.utm_medium, '')   = coalesce(dp.utm_medium, '')   and
    coalesce(wt2.utm_campaign, '') = coalesce(dp.utm_campaign, '')
  )
  where coalesce(dp.utm_campaign, '') not ilike 'smartup_tiktok_%'
  group by dp.fecha, dp.utm_source, dp.utm_medium, dp.utm_campaign, dp.purchases
) att on (
  att.fecha = wt.fecha and
  coalesce(att.utm_source, '')   = coalesce(wt.utm_source, '')   and
  coalesce(att.utm_medium, '')   = coalesce(wt.utm_medium, '')   and
  coalesce(att.utm_campaign, '') = coalesce(wt.utm_campaign, '')
)
where coalesce(wt.utm_campaign, '') not ilike 'smartup_tiktok_%';

comment on view vw_drean_web_traffic_with_purchases is
  'web_traffic enriquecido. EXCLUYE campañas Smartup TikTok (bot traffic, bounce <0.5%). Smartup Google/Meta quedan dentro como tráfico de demanda real.';

-- vw_drean_web_smartup_traffic — ahora sólo TikTok (lo que efectivamente sacamos)
create or replace view vw_drean_web_smartup_traffic as
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
  wt.conversiones,
  wt.eventos_clave,
  wt.bounce_rate,
  wt.avg_session_duration,
  wt.pageviews
from web_traffic wt
where coalesce(wt.utm_campaign, '') ilike 'smartup_tiktok_%';

comment on view vw_drean_web_smartup_traffic is
  'Tráfico aislado de campañas Smartup TikTok (bot-like, bounce <0.5%, casi 0 conversiones).';

-- vw_drean_web_daily_kpis — mismo filtro narrow
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
  where coalesce(utm_campaign, '') not ilike 'smartup_tiktok_%'
  group by fecha
),
daily_purchases as (
  select fecha, sum(purchases)::bigint as purchases
  from ga4_purchases_daily
  where coalesce(utm_campaign, '') not ilike 'smartup_tiktok_%'
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
  'KPIs diarios de drean.com.ar (GA4). EXCLUYE Smartup TikTok (bot traffic). Conversiones priorizan ga4_purchases_daily; fallback a web_traffic.conversiones.';
