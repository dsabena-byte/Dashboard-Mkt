-- =============================================================================
-- Excluir tráfico Smartup (agencia TikTok 2025) del cómputo principal.
--
-- Contexto: durante 2025, la agencia "Smartup" compró ~6.5M de sesiones desde
-- TikTok/Google que vinieron con calidad pésima: bounce 0-2%, prácticamente 0
-- transacciones. Probablemente click farms / bot traffic. Estas campañas
-- inflaban el total de sesiones 2-3x vs la demanda real.
--
-- Este migration:
--   1. Filtra utm_campaign ILIKE 'smartup_%' de la vista enriquecida principal.
--   2. Crea una vista auxiliar (vw_drean_web_smartup_traffic) por si después
--      querés analizar ese spend aislado.
--
-- Para revertir: sacar el WHERE de la vista principal y recrearla.
-- =============================================================================

-- Vista principal — sin campañas Smartup
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
  where coalesce(dp.utm_campaign, '') not ilike 'smartup_%'
  group by dp.fecha, dp.utm_source, dp.utm_medium, dp.utm_campaign, dp.purchases
) att on (
  att.fecha = wt.fecha and
  coalesce(att.utm_source, '')   = coalesce(wt.utm_source, '')   and
  coalesce(att.utm_medium, '')   = coalesce(wt.utm_medium, '')   and
  coalesce(att.utm_campaign, '') = coalesce(wt.utm_campaign, '')
)
where coalesce(wt.utm_campaign, '') not ilike 'smartup_%';

comment on view vw_drean_web_traffic_with_purchases is
  'web_traffic enriquecido con conversiones atribuidas. EXCLUYE campañas Smartup (agencia TikTok 2025, tráfico de baja calidad).';

-- Vista auxiliar — SOLO campañas Smartup, por si después querés analizar el spend
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
where coalesce(wt.utm_campaign, '') ilike 'smartup_%';

comment on view vw_drean_web_smartup_traffic is
  'Tráfico de campañas Smartup (agencia TikTok 2025). Aislado del cómputo principal por calidad sospechosa (bounce <2%, casi 0 conversiones).';
