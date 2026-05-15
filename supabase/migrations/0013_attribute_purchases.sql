-- =============================================================================
-- Atribución de purchases (de ga4_purchases_daily) a las filas de web_traffic
-- proporcionalmente por sesiones, para que categorías/canales/top tablas
-- muestren conversiones consistentes con el KPI total.
-- =============================================================================

-- Vista auxiliar: web_traffic enriquecido con conversiones atribuidas
create or replace view vw_drean_web_traffic_with_purchases as
with traffic_with_total as (
  select
    wt.*,
    sum(wt.sesiones) over (
      partition by wt.fecha, wt.utm_source, wt.utm_medium, wt.utm_campaign
    ) as total_sesiones_key
  from web_traffic wt
)
select
  tw.fecha,
  tw.utm_source,
  tw.utm_medium,
  tw.utm_campaign,
  tw.utm_content,
  tw.utm_term,
  tw.landing_page,
  tw.sesiones,
  tw.usuarios,
  tw.usuarios_nuevos,
  -- Conversiones: si hay purchases en ga4_purchases_daily, atribuye proporcional;
  -- sino, usa el valor original de web_traffic.
  case
    when dp.purchases is not null and tw.total_sesiones_key > 0
    then round(dp.purchases * (tw.sesiones::numeric / tw.total_sesiones_key))::bigint
    else tw.conversiones
  end as conversiones,
  case
    when dp.purchases is not null and tw.total_sesiones_key > 0
    then round(dp.purchases * (tw.sesiones::numeric / tw.total_sesiones_key))::bigint
    else tw.eventos_clave
  end as eventos_clave,
  tw.bounce_rate,
  tw.avg_session_duration,
  tw.pageviews
from traffic_with_total tw
left join ga4_purchases_daily dp on (
  dp.fecha = tw.fecha and
  coalesce(dp.utm_source, '')  = coalesce(tw.utm_source, '')  and
  coalesce(dp.utm_medium, '')  = coalesce(tw.utm_medium, '')  and
  coalesce(dp.utm_campaign, '')= coalesce(tw.utm_campaign, '')
);

comment on view vw_drean_web_traffic_with_purchases is
  'web_traffic enriquecido: conversiones desde ga4_purchases_daily atribuidas proporcionalmente por sesiones dentro de cada (fecha, source, medium, campaign).';

-- -----------------------------------------------------------------------------
-- Recrear vistas usando la base enriquecida
-- -----------------------------------------------------------------------------

create or replace view vw_drean_web_by_category as
select
  fecha,
  case
    when landing_page ~* '/Lavavajillas(/|$)' then 'Lavavajillas'
    when landing_page ~* '/Lavado(/|$)'        then 'Lavado'
    when landing_page ~* '/Heladeras(/|$)'     then 'Refrigeración'
    when landing_page ~* '/Cocci'              then 'Cocinas'
    when landing_page ~* '^/es_AR/?$'          then 'Home'
    else 'Otros'
  end as categoria,
  sum(sesiones)::bigint as sesiones,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews,
  case
    when sum(sesiones) filter (where bounce_rate is not null) > 0
    then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
       / sum(sesiones) filter (where bounce_rate is not null)
    else null
  end as bounce_rate
from vw_drean_web_traffic_with_purchases
group by fecha, categoria
order by fecha desc, sesiones desc;

create or replace view vw_drean_web_by_source as
with classified as (
  select
    fecha, utm_source, utm_medium, sesiones, conversiones, pageviews,
    lower(coalesce(utm_source, '')) as src,
    lower(coalesce(utm_medium, '')) as med,
    lower(coalesce(utm_campaign,'')) as camp
  from vw_drean_web_traffic_with_purchases
)
select
  fecha,
  coalesce(nullif(utm_source, ''), '(direct)') as source,
  coalesce(nullif(utm_medium, ''), '(none)')  as medium,
  case
    when camp ~ 'cross.?network|crossnetwork|^pmax|performance.?max' then 'Cross-network'
    when (src ~ '(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)' and not src ~ 'shopping')
         and med ~ '(cpc|ppc|paid|paidsearch|paid_search|sem)' then 'Paid Search'
    when src ~ '(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)'
         and (med = 'organic' or med = '') then 'Organic Search'
    when (src ~ '(facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|snapchat|reddit|fb\.com|fb\.me|ig\.com|meta)')
         and med ~ '(cpc|ppc|paid|cpm|cpv|paid_social|paidsocial|paid.social|social.paid)' then 'Paid Social'
    when src ~ '(facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|snapchat|reddit|fb\.com|fb\.me|ig\.com|meta)' then 'Organic Social'
    when med = 'email' or src ~ 'mail|email|mailchimp|sendgrid|hubspot|klaviyo' then 'Email'
    when med ~ '^(display|banner|expandable|interstitial|cpm|cpa)$' then 'Display'
    when src ~ '(youtube|vimeo|twitch)' and med ~ '(cpv|paid|cpc)' then 'Paid Video'
    when src ~ '(youtube|vimeo|twitch)' then 'Organic Video'
    when med = 'referral' then 'Referral'
    when med ~ '^(affiliate|affiliates)$' then 'Affiliates'
    when (src = '' or src = '(direct)') and (med = '' or med = '(none)' or med = '(not set)') then 'Direct'
    when med ~ '(cpc|ppc|paid|cpm|cpa)' then 'Paid Other'
    when med = 'organic' then 'Organic Search'
    else 'Unassigned'
  end as canal,
  sum(sesiones)::bigint as sesiones,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews
from classified
group by fecha, utm_source, utm_medium, canal
order by fecha desc, sesiones desc;

create or replace view vw_drean_web_monthly_by_channel as
with classified as (
  select
    fecha, sesiones, conversiones, pageviews,
    lower(coalesce(utm_source, '')) as src,
    lower(coalesce(utm_medium, '')) as med,
    lower(coalesce(utm_campaign,'')) as camp
  from vw_drean_web_traffic_with_purchases
)
select
  date_trunc('month', fecha)::date as mes,
  case
    when camp ~ 'cross.?network|crossnetwork|^pmax|performance.?max' then 'Cross-network'
    when (src ~ '(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)' and not src ~ 'shopping')
         and med ~ '(cpc|ppc|paid|paidsearch|paid_search|sem)' then 'Paid Search'
    when src ~ '(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)'
         and (med = 'organic' or med = '') then 'Organic Search'
    when (src ~ '(facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|snapchat|reddit|fb\.com|fb\.me|ig\.com|meta)')
         and med ~ '(cpc|ppc|paid|cpm|cpv|paid_social|paidsocial|paid.social|social.paid)' then 'Paid Social'
    when src ~ '(facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|snapchat|reddit|fb\.com|fb\.me|ig\.com|meta)' then 'Organic Social'
    when med = 'email' or src ~ 'mail|email|mailchimp|sendgrid|hubspot|klaviyo' then 'Email'
    when med ~ '^(display|banner|expandable|interstitial|cpm|cpa)$' then 'Display'
    when src ~ '(youtube|vimeo|twitch)' and med ~ '(cpv|paid|cpc)' then 'Paid Video'
    when src ~ '(youtube|vimeo|twitch)' then 'Organic Video'
    when med = 'referral' then 'Referral'
    when med ~ '^(affiliate|affiliates)$' then 'Affiliates'
    when (src = '' or src = '(direct)') and (med = '' or med = '(none)' or med = '(not set)') then 'Direct'
    when med ~ '(cpc|ppc|paid|cpm|cpa)' then 'Paid Other'
    when med = 'organic' then 'Organic Search'
    else 'Unassigned'
  end as canal,
  sum(sesiones)::bigint as sesiones,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews
from classified
group by date_trunc('month', fecha), 2
order by mes desc, sesiones desc;

-- -----------------------------------------------------------------------------
-- RPCs actualizadas para usar la vista enriquecida
-- -----------------------------------------------------------------------------

create or replace function top_landings_in_range(
  p_from date, p_to date, p_limit int default 10
)
returns table (
  landing_page text, sesiones bigint, conversiones bigint, pageviews bigint,
  conversion_rate numeric, bounce_rate numeric
) as $$
  select landing_page,
    sum(sesiones)::bigint, sum(conversiones)::bigint, sum(pageviews)::bigint,
    case when sum(sesiones) > 0 then sum(conversiones)::numeric / sum(sesiones) else null end,
    case
      when sum(sesiones) filter (where bounce_rate is not null) > 0
      then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
         / sum(sesiones) filter (where bounce_rate is not null)
      else null
    end
  from vw_drean_web_traffic_with_purchases
  where landing_page is not null and landing_page != ''
    and fecha between p_from and p_to
  group by landing_page
  order by sum(sesiones) desc
  limit p_limit;
$$ language sql stable;

create or replace function top_products_in_range(
  p_from date, p_to date, p_limit int default 10
)
returns table (
  landing_page text, sku text, producto_slug text, categoria text,
  sesiones bigint, conversiones bigint, pageviews bigint, conversion_rate numeric
) as $$
  select landing_page,
    substring(landing_page from '/p/([^/?#]+)') as sku,
    substring(landing_page from '/([^/]+)/p/') as producto_slug,
    case
      when landing_page ~* '/Lavavajillas(/|$)' then 'Lavavajillas'
      when landing_page ~* '/Lavado(/|$)'        then 'Lavado'
      when landing_page ~* '/Heladeras(/|$)'     then 'Refrigeración'
      when landing_page ~* '/Cocci'              then 'Cocinas'
      else 'Otros'
    end as categoria,
    sum(sesiones)::bigint, sum(conversiones)::bigint, sum(pageviews)::bigint,
    case when sum(sesiones) > 0 then sum(conversiones)::numeric / sum(sesiones) else null end
  from vw_drean_web_traffic_with_purchases
  where landing_page ~ '/p/'
    and fecha between p_from and p_to
  group by landing_page
  order by sum(sesiones) desc
  limit p_limit;
$$ language sql stable;
