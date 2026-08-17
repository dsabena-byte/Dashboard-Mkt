-- =============================================================================
-- Fix DEFINITIVO del statement_timeout en /web (Performance por categoría,
-- Tendencia por categoría, Top productos).
--
-- Causa raíz (validada): vw_drean_web_by_category y top_products_in_range aplican
-- regex (~*) POR FILA sobre ~113.000 filas/mes de web_landing_daily y, bajo la
-- carga concurrente del dashboard, TIMEOUTEAN (canceling statement due to
-- statement timeout). El wrapper safe() lo esconde → paneles vacíos.
--
-- Fix: precomputar categoria/sku/producto_slug como COLUMNAS GENERADAS STORED
-- (el regex corre UNA vez al insertar, no en cada query) + índices, y reescribir
-- la vista y el RPC para agrupar por la columna indexada (sin regex en runtime).
-- Resultado: las queries pasan de ~9s (timeout) a milisegundos.
--
-- Aplicar en el proyecto Supabase principal (donde vive web_landing_daily).
-- Idempotente: se puede correr más de una vez.
-- =============================================================================

-- 1) Columnas generadas. Expresiones IMMUTABLE (lower + ~ / substring) para que
--    Postgres permita la columna generada. lower(patrón) replica el ~* original.
ALTER TABLE web_landing_daily
  ADD COLUMN IF NOT EXISTS categoria text GENERATED ALWAYS AS (
    CASE
      WHEN lower(landing_page) ~ '/lavavajillas(/|$)'                                     THEN 'Lavavajillas'
      WHEN lower(landing_page) ~ '/lavado(/|$)'
        OR lower(landing_page) ~ '/lavarropas(/|$)'
        OR lower(landing_page) ~ '/lavasecarropas(/|$)'
        OR lower(landing_page) ~ '/secarropas(/|$)'                                       THEN 'Lavado'
      WHEN lower(landing_page) ~ '/heladeras(/|$)'
        OR lower(landing_page) ~ '/refriger'                                              THEN 'Refrigeración'
      WHEN lower(landing_page) ~ '/cocci'
        OR lower(landing_page) ~ '/cocinas(/|$)'
        OR lower(landing_page) ~ '/anafes(/|$)'
        OR lower(landing_page) ~ '/hornos(/|$)'                                           THEN 'Cocinas'
      WHEN lower(landing_page) ~ '^/es_ar/?$'
        OR lower(landing_page) ~ '^/$'                                                    THEN 'Home'
      ELSE 'Otros'
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS sku text GENERATED ALWAYS AS (
    substring(landing_page from '/p/([^/?#]+)')
  ) STORED,
  ADD COLUMN IF NOT EXISTS producto_slug text GENERATED ALWAYS AS (
    substring(landing_page from '/([^/]+)/p/')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_wld_fecha_categoria ON web_landing_daily (fecha, categoria);
CREATE INDEX IF NOT EXISTS idx_wld_fecha_sku       ON web_landing_daily (fecha) WHERE sku IS NOT NULL;

-- 2) Vista de categoría: agrupa por la columna pre-computada (sin regex en runtime).
DROP VIEW IF EXISTS vw_drean_web_by_category;
CREATE VIEW vw_drean_web_by_category AS
SELECT
  fecha,
  categoria,
  sum(sesiones)::bigint  AS sesiones,
  0::bigint              AS conversiones,          -- web_landing_daily no tiene conversiones
  sum(pageviews)::bigint AS pageviews,
  CASE
    WHEN sum(sesiones) FILTER (WHERE bounce_rate IS NOT NULL) > 0
    THEN sum(sesiones::numeric * bounce_rate) FILTER (WHERE bounce_rate IS NOT NULL)
       / sum(sesiones) FILTER (WHERE bounce_rate IS NOT NULL)
    ELSE NULL
  END AS bounce_rate,
  sum(usuarios)::bigint  AS usuarios
FROM web_landing_daily
WHERE landing_page IS NOT NULL AND landing_page <> '' AND landing_page <> '(not set)'
GROUP BY fecha, categoria;

COMMENT ON VIEW vw_drean_web_by_category IS
  'Sesiones/usuarios/pageviews por categoria/dia. Agrupa por la columna generada web_landing_daily.categoria (sin regex en runtime).';

-- 3) RPC de top productos: usa las columnas pre-computadas (sin substring/regex en runtime).
DROP FUNCTION IF EXISTS top_products_in_range(date, date, int);
CREATE FUNCTION top_products_in_range(p_from date, p_to date, p_limit int default 10)
RETURNS TABLE (
  landing_page text, sku text, producto_slug text, categoria text,
  sesiones bigint, usuarios bigint, conversiones bigint, pageviews bigint, conversion_rate numeric
) AS $$
  SELECT
    landing_page,
    max(sku), max(producto_slug), max(categoria),
    sum(sesiones)::bigint, sum(usuarios)::bigint, 0::bigint, sum(pageviews)::bigint, NULL::numeric
  FROM web_landing_daily
  WHERE sku IS NOT NULL
    AND landing_page <> '(not set)'
    AND fecha BETWEEN p_from AND p_to
  GROUP BY landing_page
  ORDER BY sum(sesiones) DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
