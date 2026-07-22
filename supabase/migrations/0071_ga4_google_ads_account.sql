-- =============================================================================
-- 0071_ga4_google_ads_account: agrega identidad de CUENTA a ga4_google_ads_daily
-- y limpia la data de terceros.
--
-- El vínculo GA4↔Google Ads apunta al MCC de OMD (agencia), que contiene muchas
-- marcas. La ingesta ahora se filtra por Customer ID de Drean (allowlist en el
-- endpoint). Estas columnas guardan a qué cuenta pertenece cada campaña.
--
-- El TRUNCATE borra las ~29k filas de OTRAS marcas cargadas en el backfill
-- inicial (Nike, BK, Farmaonline, etc.). Con la allowlist se recargan sólo las
-- de Drean en el próximo sync.
-- =============================================================================

alter table ga4_google_ads_daily
  add column if not exists customer_id  text,
  add column if not exists account_name text;

comment on column ga4_google_ads_daily.customer_id is
  'Google Ads Customer ID (googleAdsCustomerId, sin guiones). Identifica la subcuenta dentro del MCC de OMD.';

-- Limpiar la data de terceros del backfill inicial.
truncate table ga4_google_ads_daily;
