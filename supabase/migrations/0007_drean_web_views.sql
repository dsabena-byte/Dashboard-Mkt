-- =============================================================================
-- Vistas para el dashboard /web — agregaciones de web_traffic (GA4)
-- Necesarias porque web_traffic tiene miles de filas (1 por UTM combination por día)
-- y PostgREST cap = 1000 rows por query.
-- =============================================================================

-- KPIs diarios totales
create or replace view vw_drean_web_daily_kpis as
select
  fecha,
  sum(sesiones)::bigint as sesiones,
  sum(usuarios)::bigint as usuarios,
  sum(usuarios_nuevos)::bigint as usuarios_nuevos,
  sum(conversiones)::bigint as conversiones,
  sum(eventos_clave)::bigint as eventos_clave,
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
order by fecha;

comment on view vw_drean_web_daily_kpis is
  'KPIs diarios de drean.com.ar (GA4) — sesiones, conversiones, métricas ponderadas.';

-- Sesiones/conversiones por canal (utm_source + utm_medium)
create or replace view vw_drean_web_by_source as
select
  fecha,
  coalesce(nullif(utm_source, ''), '(direct)') as source,
  coalesce(nullif(utm_medium, ''), '(none)')  as medium,
  -- Clasificación de canal "amigable"
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
group by fecha, utm_source, utm_medium
order by fecha desc, sesiones desc;

comment on view vw_drean_web_by_source is
  'Tráfico por canal (utm_source/medium + clasificación amigable).';

-- Por categoría (derivada del landing_page)
create or replace view vw_drean_web_by_category as
select
  fecha,
  case
    when landing_page ~* '(lavado|lavarropas|/c/15)'           then 'Lavado'
    when landing_page ~* '(heladera|refriger|freezer|/c/9)'    then 'Refrigeración'
    when landing_page ~* '(cocci|cocina|/c/1$|/c/1/|/c/1\?)'   then 'Cocinas'
    else 'Otros / Home'
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
from web_traffic
group by fecha, categoria
order by fecha desc, sesiones desc;

comment on view vw_drean_web_by_category is
  'Tráfico por categoría — derivado de landing_page (Lavado/Refrigeración/Cocinas/Otros).';

-- Top landing pages (agregado total — sin fecha)
create or replace view vw_drean_web_top_landing as
select
  landing_page,
  sum(sesiones)::bigint as sesiones,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews,
  case
    when sum(sesiones) > 0 then sum(conversiones)::numeric / sum(sesiones)
    else null
  end as conversion_rate,
  case
    when sum(sesiones) filter (where bounce_rate is not null) > 0
    then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
       / sum(sesiones) filter (where bounce_rate is not null)
    else null
  end as bounce_rate,
  max(fecha) as ultima_fecha
from web_traffic
where landing_page is not null and landing_page != ''
group by landing_page
order by sesiones desc
limit 500;

comment on view vw_drean_web_top_landing is
  'Top landing pages por sesiones totales (cap 500).';
