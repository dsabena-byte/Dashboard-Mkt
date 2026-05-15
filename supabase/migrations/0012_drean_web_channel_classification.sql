-- =============================================================================
-- Mejora de la clasificación de canales para mimetizar el "Default Channel
-- Grouping" de GA4. Antes: regex chico sobre utm_medium → mucho caía en "Otros".
-- Ahora: combina utm_source + utm_medium + utm_campaign con reglas más cercanas
-- al algoritmo de GA4 (Paid Search, Paid Social, Cross-network, Paid Video, etc).
-- =============================================================================

create or replace view vw_drean_web_by_source as
with classified as (
  select
    fecha,
    utm_source,
    utm_medium,
    sesiones,
    conversiones,
    pageviews,
    lower(coalesce(utm_source, ''))   as src,
    lower(coalesce(utm_medium, ''))   as med,
    lower(coalesce(utm_campaign, '')) as camp
  from web_traffic
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

-- Misma clasificación para la vista mensual
create or replace view vw_drean_web_monthly_by_channel as
with classified as (
  select
    fecha,
    sesiones,
    conversiones,
    pageviews,
    lower(coalesce(utm_source, ''))   as src,
    lower(coalesce(utm_medium, ''))   as med,
    lower(coalesce(utm_campaign, '')) as camp
  from web_traffic
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
