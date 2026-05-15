-- =============================================================================
-- Agregación mensual de web_traffic — vista para evitar el límite de 1000 filas
-- de Supabase PostgREST. web_traffic tiene muchas filas por día (1 por
-- combinación de UTM), así que agregar en SQL es indispensable.
-- =============================================================================

create or replace view vw_drean_web_monthly as
select
  date_trunc('month', fecha)::date as mes,
  sum(sesiones)::bigint as sesiones,
  sum(pageviews)::bigint as pageviews,
  -- Bounce rate ponderado por sesiones (solo donde hay valor)
  case
    when sum(sesiones) filter (where bounce_rate is not null) > 0
    then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
       / sum(sesiones) filter (where bounce_rate is not null)
    else null
  end as bounce_rate,
  -- Duration ponderado por sesiones (solo donde hay valor)
  case
    when sum(sesiones) filter (where avg_session_duration is not null) > 0
    then sum(sesiones * avg_session_duration) filter (where avg_session_duration is not null)
       / sum(sesiones) filter (where avg_session_duration is not null)
    else null
  end as avg_session_duration
from web_traffic
group by date_trunc('month', fecha)
order by mes;

comment on view vw_drean_web_monthly is
  'Agregación mensual de web_traffic (GA4) — usada por /competitors para Drean.';
