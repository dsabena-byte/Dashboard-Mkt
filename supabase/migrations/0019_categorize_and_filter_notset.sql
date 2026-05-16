-- =============================================================================
-- 1. Filtra landings (not set) y vacíos de las vistas/RPCs principales — son
--    "ruido" de GA4 que infla "Otros" y aparece como landing fantasma.
-- 2. Expande la categorización para que más URLs caigan en categorías reales
--    en vez de "Otros" (Lavarropas, Secarropas, etc.).
-- =============================================================================

create or replace view vw_drean_web_by_category as
select
  fecha,
  case
    when landing_page ~* '/Lavavajillas(/|$)'                                            then 'Lavavajillas'
    when landing_page ~* '/Lavado(/|$)'
      or landing_page ~* '/Lavarropas(/|$)'
      or landing_page ~* '/Lavasecarropas(/|$)'
      or landing_page ~* '/Secarropas(/|$)'                                              then 'Lavado'
    when landing_page ~* '/Heladeras(/|$)'
      or landing_page ~* '/Refriger'                                                      then 'Refrigeración'
    when landing_page ~* '/Cocci'
      or landing_page ~* '/Cocinas(/|$)'
      or landing_page ~* '/Anafes(/|$)'
      or landing_page ~* '/Hornos(/|$)'                                                   then 'Cocinas'
    when landing_page ~* '^/es_AR/?$'
      or landing_page ~* '^/$'                                                            then 'Home'
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
where landing_page is not null
  and landing_page <> ''
  and landing_page <> '(not set)'
group by fecha, categoria
order by fecha desc, sesiones desc;

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
  where landing_page is not null
    and landing_page <> ''
    and landing_page <> '(not set)'
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
      when landing_page ~* '/Lavavajillas(/|$)'                                            then 'Lavavajillas'
      when landing_page ~* '/Lavado(/|$)'
        or landing_page ~* '/Lavarropas(/|$)'
        or landing_page ~* '/Lavasecarropas(/|$)'
        or landing_page ~* '/Secarropas(/|$)'                                              then 'Lavado'
      when landing_page ~* '/Heladeras(/|$)'
        or landing_page ~* '/Refriger'                                                      then 'Refrigeración'
      when landing_page ~* '/Cocci'
        or landing_page ~* '/Cocinas(/|$)'
        or landing_page ~* '/Anafes(/|$)'
        or landing_page ~* '/Hornos(/|$)'                                                   then 'Cocinas'
      else 'Otros'
    end as categoria,
    sum(sesiones)::bigint, sum(conversiones)::bigint, sum(pageviews)::bigint,
    case when sum(sesiones) > 0 then sum(conversiones)::numeric / sum(sesiones) else null end
  from vw_drean_web_traffic_with_purchases
  where landing_page ~ '/p/'
    and landing_page <> '(not set)'
    and fecha between p_from and p_to
  group by landing_page
  order by sum(sesiones) desc
  limit p_limit;
$$ language sql stable;
