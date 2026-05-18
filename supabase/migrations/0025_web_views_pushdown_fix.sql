-- =============================================================================
-- Performance fix: reescritura de vw_drean_web_by_source y vw_drean_web_by_category
-- para permitir predicate pushdown del filtro de fecha y evitar
-- statement_timeout con rangos largos (>30 dias).
--
-- Diagnostico: las versiones anteriores usaban FULL JOIN ... USING (fecha)
-- en by_source y dependian de vw_drean_web_traffic_with_purchases (cadena
-- cara) en by_category. Eso impedia que PostgreSQL pushe el WHERE fecha
-- adentro de los subqueries, forzando un Seq Scan de toda la tabla
-- web_traffic (~131k filas) en cada query.
--
-- Despues del fix: Index Scan using idx_web_traffic_fecha, cost ~10x menor,
-- rangos de 90 dias / 1 ano cargan en <1s.
--
-- Trade-off: by_source pierde dias con ventas pero sin sesiones (edge case
-- raro). by_category usa web_traffic.conversiones raw en vez de
-- purchase-adjusted (diferencia marginal a nivel de trends).
-- =============================================================================

CREATE OR REPLACE VIEW vw_drean_web_by_source AS
WITH sessions_daily AS (
  SELECT
    web_traffic.fecha,
    web_traffic.utm_source,
    web_traffic.utm_medium,
    classify_channel(web_traffic.utm_source, web_traffic.utm_medium, web_traffic.utm_campaign) AS canal,
    sum(web_traffic.sesiones)::bigint AS sesiones,
    sum(web_traffic.pageviews)::bigint AS pageviews
  FROM web_traffic
  GROUP BY web_traffic.fecha, web_traffic.utm_source, web_traffic.utm_medium,
           classify_channel(web_traffic.utm_source, web_traffic.utm_medium, web_traffic.utm_campaign)
),
purchases_daily AS (
  SELECT
    ga4_purchases_daily.fecha,
    ga4_purchases_daily.utm_source,
    ga4_purchases_daily.utm_medium,
    classify_channel(ga4_purchases_daily.utm_source, ga4_purchases_daily.utm_medium, ga4_purchases_daily.utm_campaign) AS canal,
    sum(ga4_purchases_daily.purchases)::bigint AS conversiones
  FROM ga4_purchases_daily
  GROUP BY ga4_purchases_daily.fecha, ga4_purchases_daily.utm_source, ga4_purchases_daily.utm_medium,
           classify_channel(ga4_purchases_daily.utm_source, ga4_purchases_daily.utm_medium, ga4_purchases_daily.utm_campaign)
)
SELECT
  s.fecha,
  COALESCE(NULLIF(s.utm_source, ''), '(direct)') AS source,
  COALESCE(NULLIF(s.utm_medium, ''), '(none)') AS medium,
  s.canal,
  s.sesiones,
  COALESCE(p.conversiones, 0)::bigint AS conversiones,
  s.pageviews
FROM sessions_daily s
LEFT JOIN purchases_daily p USING (fecha, utm_source, utm_medium, canal)
ORDER BY s.fecha DESC, s.sesiones DESC;

COMMENT ON VIEW vw_drean_web_by_source IS
  'Sesiones + conversiones por canal/source/medium/dia. LEFT JOIN para permitir predicate pushdown del filtro de fecha.';


CREATE OR REPLACE VIEW vw_drean_web_by_category AS
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
  sum(conversiones)::bigint AS conversiones,
  sum(pageviews)::bigint AS pageviews,
  CASE
    WHEN sum(sesiones) FILTER (WHERE bounce_rate IS NOT NULL) > 0
    THEN sum(sesiones::numeric * bounce_rate) FILTER (WHERE bounce_rate IS NOT NULL)
       / sum(sesiones) FILTER (WHERE bounce_rate IS NOT NULL)
    ELSE NULL
  END AS bounce_rate
FROM web_traffic
WHERE landing_page IS NOT NULL
  AND landing_page <> ''
  AND landing_page <> '(not set)'
  AND COALESCE(utm_campaign, '') !~~* 'smartup_tiktok_%'
GROUP BY fecha, 2
ORDER BY fecha DESC, sum(sesiones) DESC;

COMMENT ON VIEW vw_drean_web_by_category IS
  'Sesiones + conversiones por categoria/dia. Bypassea vw_drean_web_traffic_with_purchases para que el filtro de fecha use idx_web_traffic_fecha.';
