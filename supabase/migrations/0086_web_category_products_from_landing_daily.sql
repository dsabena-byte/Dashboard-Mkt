-- =============================================================================
-- Fix: "Performance por categoría" y "Top 10 productos (PDPs)" salían VACÍAS.
--
-- Causa raíz: vw_drean_web_by_category y la función top_products_in_range leían
-- de web_traffic.landing_page, pero esa columna quedó SIEMPRE NULL — el REPORT 1
-- del sync ga4-web-traffic (→ web_traffic) trae solo utm_source/medium/campaign,
-- NO landing_page. La data de landings va al REPORT 2 → tabla web_landing_daily.
-- Los KPIs/canales (utm) andaban; categoría/productos (landing_page) no.
--
-- Fix: se repuntan la vista y el RPC a web_landing_daily. Esa tabla no tiene
-- conversiones ni utm_campaign → conversiones = 0 y sin filtro smartup (es data a
-- nivel página, no campaña). Se agrega `usuarios` (web_landing_daily sí lo tiene).
-- =============================================================================

-- ---- Performance por categoría (desde web_landing_daily) --------------------
-- DROP + CREATE (no CREATE OR REPLACE): la vista vieja tiene otras columnas/orden
-- y CREATE OR REPLACE no puede renombrar/reordenar.
DROP VIEW IF EXISTS vw_drean_web_by_category;
CREATE VIEW vw_drean_web_by_category AS
SELECT
  fecha,
  CASE
    WHEN landing_page ~* '/Lavavajillas(/|$)'                                            THEN 'Lavavajillas'
    WHEN landing_page ~* '/Lavado(/|$)'
      OR landing_page ~* '/Lavarropas(/|$)'
      OR landing_page ~* '/Lavasecarropas(/|$)'
      OR landing_page ~* '/Secarropas(/|$)'                                              THEN 'Lavado'
    WHEN landing_page ~* '/Heladeras(/|$)'
      OR landing_page ~* '/Refriger'                                                      THEN 'Refrigeración'
    WHEN landing_page ~* '/Cocci'
      OR landing_page ~* '/Cocinas(/|$)'
      OR landing_page ~* '/Anafes(/|$)'
      OR landing_page ~* '/Hornos(/|$)'                                                   THEN 'Cocinas'
    WHEN landing_page ~* '^/es_AR/?$'
      OR landing_page ~* '^/$'                                                            THEN 'Home'
    ELSE 'Otros'
  END AS categoria,
  sum(sesiones)::bigint AS sesiones,
  0::bigint AS conversiones,           -- web_landing_daily no tiene conversiones
  sum(pageviews)::bigint AS pageviews,
  CASE
    WHEN sum(sesiones) FILTER (WHERE bounce_rate IS NOT NULL) > 0
    THEN sum(sesiones::numeric * bounce_rate) FILTER (WHERE bounce_rate IS NOT NULL)
       / sum(sesiones) FILTER (WHERE bounce_rate IS NOT NULL)
    ELSE NULL
  END AS bounce_rate,
  sum(usuarios)::bigint AS usuarios    -- agregado al final (CREATE OR REPLACE lo permite)
FROM web_landing_daily
WHERE landing_page IS NOT NULL
  AND landing_page <> ''
  AND landing_page <> '(not set)'
GROUP BY fecha, 2
ORDER BY fecha DESC, sum(sesiones) DESC;

COMMENT ON VIEW vw_drean_web_by_category IS
  'Sesiones/usuarios/pageviews por categoria/dia, derivada del path de landing. Fuente: web_landing_daily (web_traffic.landing_page quedo null).';

-- ---- Top productos (PDPs) en rango (desde web_landing_daily) ----------------
DROP FUNCTION IF EXISTS top_products_in_range(date, date, int);
CREATE FUNCTION top_products_in_range(p_from date, p_to date, p_limit int default 10)
RETURNS TABLE (
  landing_page text, sku text, producto_slug text, categoria text,
  sesiones bigint, usuarios bigint, conversiones bigint, pageviews bigint, conversion_rate numeric
) AS $$
  SELECT landing_page,
    substring(landing_page from '/p/([^/?#]+)') AS sku,
    substring(landing_page from '/([^/]+)/p/') AS producto_slug,
    CASE
      WHEN landing_page ~* '/Lavavajillas(/|$)'                                            THEN 'Lavavajillas'
      WHEN landing_page ~* '/Lavado(/|$)'
        OR landing_page ~* '/Lavarropas(/|$)'
        OR landing_page ~* '/Lavasecarropas(/|$)'
        OR landing_page ~* '/Secarropas(/|$)'                                              THEN 'Lavado'
      WHEN landing_page ~* '/Heladeras(/|$)'
        OR landing_page ~* '/Refriger'                                                      THEN 'Refrigeración'
      WHEN landing_page ~* '/Cocci'
        OR landing_page ~* '/Cocinas(/|$)'
        OR landing_page ~* '/Anafes(/|$)'
        OR landing_page ~* '/Hornos(/|$)'                                                   THEN 'Cocinas'
      ELSE 'Otros'
    END AS categoria,
    sum(sesiones)::bigint, sum(usuarios)::bigint, 0::bigint, sum(pageviews)::bigint,
    NULL::numeric
  FROM web_landing_daily
  WHERE landing_page ~ '/p/'
    AND landing_page <> '(not set)'
    AND fecha BETWEEN p_from AND p_to
  GROUP BY landing_page
  ORDER BY sum(sesiones) DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
