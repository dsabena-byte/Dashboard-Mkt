-- =============================================================================
-- Top productos (PDPs) — landings que contienen /p/ son páginas de producto
-- =============================================================================

create or replace view vw_drean_web_top_products as
select
  landing_page,
  -- SKU = segmento después de /p/ (ej: LFDR0710ISG0)
  substring(landing_page from '/p/([^/?#]+)') as sku,
  -- Nombre del producto = slug antes de /p/
  substring(landing_page from '/([^/]+)/p/') as producto_slug,
  case
    when landing_page ~* '/Lavavajillas(/|$)' then 'Lavavajillas'
    when landing_page ~* '/Lavado(/|$)'        then 'Lavado'
    when landing_page ~* '/Heladeras(/|$)'     then 'Refrigeración'
    when landing_page ~* '/Cocci'              then 'Cocinas'
    else 'Otros'
  end as categoria,
  sum(sesiones)::bigint as sesiones,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews,
  case when sum(sesiones) > 0 then sum(conversiones)::numeric / sum(sesiones) else null end as conversion_rate,
  max(fecha) as ultima_fecha
from web_traffic
where landing_page ~ '/p/'
group by landing_page
order by sesiones desc
limit 100;

comment on view vw_drean_web_top_products is
  'Top 100 PDPs (páginas de producto) por sesiones — landings con /p/.';
