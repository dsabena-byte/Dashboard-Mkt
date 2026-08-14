-- 0098_web_traffic_created_at_index: index de soporte para la query de
-- frescura del watchdog de monitoreo.
--
-- apps/web/src/lib/monitoreo-config.ts define el proceso "ga4" (Tráfico Web)
-- con col: "created_at" sobre esta tabla. apps/web/src/lib/freshness-queries.ts
-- (maxUpdatedAt) hace `order(created_at, desc).limit(1)` para sacar el último
-- timestamp de sync. web_traffic ya tiene >130k filas (crece ~1.5k filas cada
-- 6h) y NO tenía ningún índice sobre created_at (solo idx_web_traffic_fecha e
-- idx_web_traffic_utm_key, ninguno cubre el ORDER BY created_at). El resultado
-- observado en producción: el health-check para "ga4" vuelve consistentemente
-- "sindato"/ageH=null en /api/cron/health pese a que ga4-sync.yml corre OK
-- cada 6h y upsertea >1000 filas por corrida (confirmado en logs del Action).
-- maxUpdatedAt() traga el error/timeout de esa query y devuelve null, así que
-- el proceso queda invisible para el watchdog (no se clasifica ni Atrasado ni
-- Crítico, directamente no se puede medir).
--
-- Fix: agregar el índice que falta para que el ORDER BY ... LIMIT 1 use un
-- Index Scan Backward en vez de un sort completo de la tabla.

create index if not exists idx_web_traffic_created_at
  on web_traffic (created_at desc);
