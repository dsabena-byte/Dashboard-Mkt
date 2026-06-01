-- 0036: Vista de funnel GA4 — clasifica cada landing en (etapa, categoria_funnel)
-- para alimentar el funnel del Overview alineado al slide de estrategia Drean.
--
-- Etapas:
--   awareness     → home (`/es_AR` o root)
--   interes       → páginas de categoría/subcategoría (sin `/p/<SKU>`)
--   consideracion → páginas de producto (`/p/<SKU>`)
--
-- Categorías funnel (6):
--   Lavado        → Lavado y secado (lavarropas, secarropas)
--   Refrigeración → Heladeras y Freezers
--   Cocinas       → Cocción (cocinas, hornos, anafes)
--   Lavavajillas  → Lavavajillas (categoría propia)
--   Brand         → Landing / home + Combos + Servicio + multi-categoría
--   Otros         → No clasificado

create or replace view vw_ga4_funnel as
with classified as (
  select
    fecha,
    landing_page,
    case
      when landing_page ~* '/p/[A-Z0-9-]+' then 'consideracion'
      when landing_page ~* '^/?(es_AR)?/?$' then 'awareness'
      when landing_page ~* '(lavado|lavarropas|lavavajilla|secarrop|heladera|refriger|freezer|cocci|cocina|horno|anafe|combo|servicio)' then 'interes'
      else 'awareness'
    end as etapa,
    case
      when landing_page ~* '^/?(es_AR)?/?$'                                                            then 'Brand'
      when landing_page ~* '(combo|servicio)'                                                          then 'Brand'
      when landing_page ~* '(lavavajilla)'                                                             then 'Lavavajillas'
      when landing_page ~* '(lavarropas|secarrop|/Lavado(/|$))'                                        then 'Lavado'
      when landing_page ~* '(heladera|refriger|freezer|/Heladeras|/Freezers)'                          then 'Refrigeración'
      when landing_page ~* '(cocci|/Coccion|horno|anafe|/Cocina(s)?(/|$))'                             then 'Cocinas'
      else 'Otros'
    end as categoria,
    sesiones,
    usuarios,
    conversiones,
    pageviews,
    bounce_rate
  from web_traffic
)
select
  fecha,
  etapa,
  categoria,
  sum(sesiones)::bigint as sesiones,
  sum(usuarios)::bigint as usuarios,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews,
  case
    when sum(sesiones) filter (where bounce_rate is not null) > 0
    then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
       / sum(sesiones) filter (where bounce_rate is not null)
    else null
  end as bounce_rate
from classified
group by fecha, etapa, categoria;

comment on view vw_ga4_funnel is
  'Clasificación de GA4 por etapa de funnel (awareness/interes/consideracion) y categoría (Lavado/Refrigeración/Cocinas/Brand). Usado por el widget Funnel del Overview.';
