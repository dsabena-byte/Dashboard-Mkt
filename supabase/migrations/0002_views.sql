-- =============================================================================
-- Vistas: funnel diario y cumplimiento vs planning
-- =============================================================================

-- -----------------------------------------------------------------------------
-- vw_funnel_diario
-- Impresiones → clicks → sesiones web → conversiones, joineado por UTM + fecha.
-- LEFT JOIN para no perder filas si una capa no matchea (ej: ads sin tráfico web
-- aún reportado por GA4).
-- -----------------------------------------------------------------------------
create or replace view vw_funnel_diario as
with ads_agg as (
  select
    fecha,
    coalesce(utm_source, '(no_utm)')   as utm_source,
    coalesce(utm_medium, '(no_utm)')   as utm_medium,
    coalesce(utm_campaign, '(no_utm)') as utm_campaign,
    sum(impresiones)      as impresiones,
    sum(clicks)           as clicks,
    sum(costo)            as costo,
    sum(conversiones)     as conversiones_ads,
    sum(valor_conversion) as valor_conversion_ads
  from ads_performance
  group by 1, 2, 3, 4
),
web_agg as (
  select
    fecha,
    coalesce(utm_source, '(no_utm)')   as utm_source,
    coalesce(utm_medium, '(no_utm)')   as utm_medium,
    coalesce(utm_campaign, '(no_utm)') as utm_campaign,
    sum(sesiones)      as sesiones,
    sum(usuarios)      as usuarios,
    sum(conversiones)  as conversiones_web,
    sum(eventos_clave) as eventos_clave
  from web_traffic
  group by 1, 2, 3, 4
)
select
  coalesce(a.fecha, w.fecha)               as fecha,
  coalesce(a.utm_source, w.utm_source)     as utm_source,
  coalesce(a.utm_medium, w.utm_medium)     as utm_medium,
  coalesce(a.utm_campaign, w.utm_campaign) as utm_campaign,
  coalesce(a.impresiones, 0)               as impresiones,
  coalesce(a.clicks, 0)                    as clicks,
  coalesce(a.costo, 0)                     as costo,
  coalesce(w.sesiones, 0)                  as sesiones,
  coalesce(w.usuarios, 0)                  as usuarios,
  coalesce(w.conversiones_web, a.conversiones_ads, 0) as conversiones,
  coalesce(a.valor_conversion_ads, 0)      as valor_conversion,
  case when coalesce(a.impresiones, 0) > 0
       then round((coalesce(a.clicks, 0)::numeric / a.impresiones) * 100, 4)
       else null end as ctr_pct,
  case when coalesce(a.clicks, 0) > 0
       then round((coalesce(w.sesiones, 0)::numeric / a.clicks) * 100, 4)
       else null end as click_to_session_pct,
  case when coalesce(w.sesiones, 0) > 0
       then round((coalesce(w.conversiones_web, 0)::numeric / w.sesiones) * 100, 4)
       else null end as cvr_pct
from ads_agg a
full outer join web_agg w
  on  a.fecha        = w.fecha
  and a.utm_source   = w.utm_source
  and a.utm_medium   = w.utm_medium
  and a.utm_campaign = w.utm_campaign;

comment on view vw_funnel_diario is
  'Funnel unificado: impresiones → clicks → sesiones → conversiones por UTM y fecha. Full outer join entre ads_performance y web_traffic.';

-- -----------------------------------------------------------------------------
-- vw_cumplimiento_planning
-- Compara inversión planificada vs gasto real, y KPI target vs valor real.
-- "Real" se calcula según el metric_type del planning:
--   impressions/clicks/conversions → de ads_performance
--   sessions/leads/sales/revenue   → de web_traffic
--   cpa / cpc / ctr / roas         → derivados
-- -----------------------------------------------------------------------------
create or replace view vw_cumplimiento_planning as
with ads_real as (
  select
    fecha,
    campania_nombre as campania,
    sum(impresiones)      as impresiones,
    sum(clicks)           as clicks,
    sum(costo)            as costo,
    sum(conversiones)     as conversiones,
    sum(valor_conversion) as valor_conversion
  from ads_performance
  group by 1, 2
),
web_real as (
  select
    fecha,
    coalesce(utm_campaign, '(no_utm)') as campania,
    sum(sesiones)     as sesiones,
    sum(conversiones) as conversiones_web,
    sum(eventos_clave) as eventos_clave
  from web_traffic
  group by 1, 2
)
select
  p.id              as planning_id,
  p.fecha,
  p.canal,
  p.campania,
  p.metric_type,
  p.inversion_plan,
  p.kpi_target,
  coalesce(a.costo, 0) as inversion_real,
  case p.metric_type
    when 'impressions' then coalesce(a.impresiones, 0)::numeric
    when 'clicks'      then coalesce(a.clicks, 0)::numeric
    when 'conversions' then coalesce(a.conversiones, w.conversiones_web, 0)::numeric
    when 'sessions'    then coalesce(w.sesiones, 0)::numeric
    when 'leads'       then coalesce(w.eventos_clave, 0)::numeric
    when 'sales'       then coalesce(w.conversiones_web, 0)::numeric
    when 'revenue'     then coalesce(a.valor_conversion, 0)::numeric
    when 'cpa'         then case when coalesce(a.conversiones, 0) > 0
                                 then round(a.costo / a.conversiones, 2) else 0 end
    when 'cpc'         then case when coalesce(a.clicks, 0) > 0
                                 then round(a.costo / a.clicks, 4) else 0 end
    when 'ctr'         then case when coalesce(a.impresiones, 0) > 0
                                 then round((a.clicks::numeric / a.impresiones) * 100, 4) else 0 end
    when 'roas'        then case when coalesce(a.costo, 0) > 0
                                 then round(a.valor_conversion / a.costo, 4) else 0 end
  end as kpi_actual,
  case when p.inversion_plan > 0
       then round((coalesce(a.costo, 0) / p.inversion_plan) * 100, 2)
       else null end as cumplimiento_inversion_pct,
  case when p.kpi_target > 0 then
    case p.metric_type
      when 'impressions' then round((coalesce(a.impresiones, 0)::numeric / p.kpi_target) * 100, 2)
      when 'clicks'      then round((coalesce(a.clicks, 0)::numeric / p.kpi_target) * 100, 2)
      when 'conversions' then round((coalesce(a.conversiones, w.conversiones_web, 0)::numeric / p.kpi_target) * 100, 2)
      when 'sessions'    then round((coalesce(w.sesiones, 0)::numeric / p.kpi_target) * 100, 2)
      when 'leads'       then round((coalesce(w.eventos_clave, 0)::numeric / p.kpi_target) * 100, 2)
      when 'sales'       then round((coalesce(w.conversiones_web, 0)::numeric / p.kpi_target) * 100, 2)
      when 'revenue'     then round((coalesce(a.valor_conversion, 0) / p.kpi_target) * 100, 2)
      else null
    end
  else null end as cumplimiento_kpi_pct
from planning p
left join ads_real a on a.fecha = p.fecha and a.campania = p.campania
left join web_real w on w.fecha = p.fecha and w.campania = p.campania;

comment on view vw_cumplimiento_planning is
  'Comparativa planning vs real por fecha/canal/campaña. % cumplimiento sobre inversión y KPI target.';
