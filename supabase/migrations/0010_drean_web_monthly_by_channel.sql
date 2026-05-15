-- =============================================================================
-- Vista pre-agregada mensual por canal — evita el cap 1000 de PostgREST cuando
-- queremos serie de 12 meses para el gráfico /web "Evolución mensual por canal".
-- =============================================================================

create or replace view vw_drean_web_monthly_by_channel as
select
  date_trunc('month', fecha)::date as mes,
  case
    when (utm_source is null or utm_source = '') and (utm_medium is null or utm_medium = '') then 'Direct'
    when utm_medium = 'organic' then 'Organic Search'
    when utm_medium in ('cpc','paid','ppc') then 'Paid Search'
    when utm_medium in ('social','social-network','sm','social-organic') then 'Organic Social'
    when utm_medium in ('paid-social','paid_social','social-paid','paidsocial') then 'Paid Social'
    when utm_medium = 'email' or utm_source = 'email' then 'Email'
    when utm_medium = 'referral' then 'Referral'
    when utm_medium = 'display' then 'Display'
    else 'Otros'
  end as canal,
  sum(sesiones)::bigint as sesiones,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews
from web_traffic
group by date_trunc('month', fecha), 2
order by mes desc, sesiones desc;

comment on view vw_drean_web_monthly_by_channel is
  'Sesiones/conversiones/pageviews mensuales por canal (clasificación amigable). 9 canales × N meses → manejable para PostgREST.';
