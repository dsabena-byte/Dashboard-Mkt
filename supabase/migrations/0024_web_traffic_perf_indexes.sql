-- =============================================================================
-- Performance: indexes para evitar statement_timeout en vw_drean_web_by_source
-- y vistas relacionadas con rangos largos (>30 dias).
--
-- Diagnostico:
-- - vw_drean_web_by_source agrega web_traffic via vw_drean_web_traffic_with_purchases
-- - vw_drean_web_traffic_with_purchases hace LEFT JOIN web_traffic <-> ga4_purchases_daily
-- - Sin indices, cada query con WHERE fecha BETWEEN ... hace seq scan completo
-- - Para 90 dias supera el budget de 8s y revienta con "canceling statement"
--
-- Fix: indices btree en (fecha) para filtrado rapido + indices compuestos para
-- el JOIN. PostgreSQL los va a usar automaticamente.
-- =============================================================================

create index if not exists idx_web_traffic_fecha
  on web_traffic (fecha);

create index if not exists idx_web_traffic_fecha_utm
  on web_traffic (fecha, utm_source, utm_medium, utm_campaign);

create index if not exists idx_ga4_purchases_daily_fecha
  on ga4_purchases_daily (fecha);

create index if not exists idx_ga4_purchases_daily_fecha_utm
  on ga4_purchases_daily (fecha, utm_source, utm_medium, utm_campaign);

-- Refrescar estadisticas para que el planner use los indices nuevos
analyze web_traffic;
analyze ga4_purchases_daily;
