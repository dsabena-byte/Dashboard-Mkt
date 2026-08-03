-- =============================================================================
-- Fix "Paid Search" inflado (225k / 56%) en Análisis Web → Detalle por canal.
--
-- La vista vw_drean_web_by_source (creada fuera de migraciones, con un CASE inline
-- propio — NO usaba classify_channel) clasificaba TODO google+cpc como "Paid
-- Search", sin mirar el nombre de campaña. Así, Demand Gen (~111k usuarios) y
-- PMax (~67k) caían dentro de Paid Search.
--
-- Fix: dos ramas nuevas ANTES del google/cpc, usando utm_campaign:
--   - pmax / performance max / cross-network → Cross-network
--   - demandgen / demangen / demand gen (+ medium cpc) → Demand Gen
-- El resto del CASE queda idéntico. Validado con julio 2026: Paid Search real
-- pasó de 225k a ~52k.
--
-- Correr en Supabase + NOTIFY pgrst 'reload schema'.
-- =============================================================================

CREATE OR REPLACE VIEW vw_drean_web_by_source AS
 SELECT fecha,
    COALESCE(utm_source, '(direct)') AS source,
    COALESCE(utm_medium, '(none)')  AS medium,
    CASE
        WHEN COALESCE(utm_campaign,'') ~* 'pmax|performance.?max|cross.?network' THEN 'Cross-network'
        WHEN COALESCE(utm_campaign,'') ~* 'demandgen|demangen|demand.?gen' AND COALESCE(utm_medium,'') ~~* '%cpc%' THEN 'Demand Gen'
        WHEN utm_source = 'google' AND COALESCE(utm_medium, '') ~~* '%cpc%' THEN 'Paid Search'
        WHEN utm_source = 'bing'   AND COALESCE(utm_medium, '') ~~* '%cpc%' THEN 'Paid Search'
        WHEN utm_source = 'demangen' THEN 'Paid Search'
        WHEN utm_source = ANY (ARRAY['meta','facebook','instagram','fb','ig']) THEN 'Paid Social'
        WHEN utm_source = 'tiktok' THEN 'Paid Social'
        WHEN utm_source = 'youtube' THEN 'Paid Video'
        WHEN utm_source = 'dv360' THEN 'Display / Programmatic'
        WHEN utm_source = 'display' THEN 'Display / Programmatic'
        WHEN utm_medium = 'organic' THEN 'Organic Search'
        WHEN utm_medium = 'referral' THEN 'Referral'
        WHEN utm_medium = 'email' THEN 'Email'
        WHEN utm_medium ~~* '%push%' THEN 'Push'
        WHEN utm_source IS NULL AND utm_medium IS NULL THEN 'Direct'
        WHEN utm_source = '(direct)' THEN 'Direct'
        WHEN utm_source = '(data-not-available)' THEN 'Direct'
        ELSE 'Otros'
    END AS canal,
    sum(sesiones)::bigint    AS sesiones,
    sum(usuarios)::bigint     AS usuarios,
    sum(conversiones)::bigint AS conversiones,
    sum(pageviews)::bigint    AS pageviews
   FROM web_traffic
  GROUP BY 1, 2, 3, 4;
