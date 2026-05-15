-- =============================================================================
-- RPC functions para Top Landings y Top Products filtrables por date range.
-- Las vistas pre-agregadas all-time no permiten filtrar por fecha; estas
-- funciones agregan en SQL respetando el rango y devuelven top N.
-- =============================================================================

create or replace function top_landings_in_range(
  p_from date,
  p_to date,
  p_limit int default 10
)
returns table (
  landing_page text,
  sesiones bigint,
  conversiones bigint,
  pageviews bigint,
  conversion_rate numeric,
  bounce_rate numeric
) as $$
  select
    landing_page,
    sum(sesiones)::bigint as sesiones,
    sum(conversiones)::bigint as conversiones,
    sum(pageviews)::bigint as pageviews,
    case when sum(sesiones) > 0 then sum(conversiones)::numeric / sum(sesiones) else null end as conversion_rate,
    case
      when sum(sesiones) filter (where bounce_rate is not null) > 0
      then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
         / sum(sesiones) filter (where bounce_rate is not null)
      else null
    end as bounce_rate
  from web_traffic
  where landing_page is not null
    and landing_page != ''
    and fecha between p_from and p_to
  group by landing_page
  order by sum(sesiones) desc
  limit p_limit;
$$ language sql stable;

comment on function top_landings_in_range is
  'Top N landing pages por sesiones en el date range.';

create or replace function top_products_in_range(
  p_from date,
  p_to date,
  p_limit int default 10
)
returns table (
  landing_page text,
  sku text,
  producto_slug text,
  categoria text,
  sesiones bigint,
  conversiones bigint,
  pageviews bigint,
  conversion_rate numeric
) as $$
  select
    landing_page,
    substring(landing_page from '/p/([^/?#]+)') as sku,
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
    case when sum(sesiones) > 0 then sum(conversiones)::numeric / sum(sesiones) else null end as conversion_rate
  from web_traffic
  where landing_page ~ '/p/'
    and fecha between p_from and p_to
  group by landing_page
  order by sum(sesiones) desc
  limit p_limit;
$$ language sql stable;

comment on function top_products_in_range is
  'Top N PDPs por sesiones en el date range. SKU extraído del path.';
