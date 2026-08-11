-- =============================================================================
-- 0098_web_traffic_updated_at_index: fix del Monitoreo para "Tráfico Web (GA4)"
-- -----------------------------------------------------------------------------
-- El watchdog reportaba ga4 en "Sin dato" (col created_at) de forma permanente
-- aunque /api/cron/ga4-web-traffic corre OK cada 6h y escribe filas nuevas
-- (confirmado en los logs del Action: "1353 filas OK"). Causa raíz:
--
--   1) monitoreo-config.ts medía frescura con `created_at`, que solo cambia
--      cuando aparece una fila realmente nueva (una vez por día calendario,
--      cuando el rolling window de `days` corre a una fecha nueva). El resto
--      de los syncs del día son UPDATEs sobre filas existentes: el trigger
--      `trg_web_updated` sí pisa `updated_at` en cada uno, pero `created_at`
--      queda fijo desde el insert original.
--   2) web_traffic no tenía índice en ninguna de las dos columnas de timestamp
--      (solo idx_web_traffic_fecha / idx_web_traffic_utm_key), así que un
--      `order by updated_at desc limit 1` sobre ~130k filas fuerza un seq
--      scan + sort completo — el mismo patrón de statement timeout que ya se
--      había resuelto para otras vistas de esta tabla en 0016 y 0025.
--
-- Este migration agrega el índice que falta; monitoreo-config.ts (mismo PR)
-- pasa `col` de "created_at" a "updated_at" para que la frescura refleje el
-- último sync real, igual que el resto de los procesos "GitHub Action".
-- =============================================================================

create index if not exists idx_web_traffic_updated_at
  on web_traffic (updated_at desc);
