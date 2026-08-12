# Log de arreglos automáticos del Monitoreo

Historial de las alarmas/desvíos detectados en el dashboard de Monitoreo y cómo
se resolvieron. Entrada más reciente arriba. Cada entrada: fecha · qué alarmó ·
causa raíz · qué se hizo.

---

## 2026-08-12 · Chequeo de rutina — sin desvíos Atrasado/Crítico, pero 2 hallazgos proactivos

- **Chequeo:** corrida automática sobre los 17 procesos de `monitoreo-config.ts`.
  Fuente: `/api/cron/health` vía los últimos runs del watchdog (07:53, 02:45 y
  corridas previas del 8/10-8/11 UTC) — no se tuvo acceso directo a Supabase
  desde este entorno (red bloqueada al dominio de Vercel y a Supabase, y sin
  las env vars de servicio), así que se leyó el resultado ya calculado por el
  propio endpoint de salud en las corridas reales del watchdog en vez de
  recalcularlo. `ok:true`, `criticos:0`, `desvios:[]` en todas las corridas
  revisadas — **ningún proceso está Atrasado o Crítico**. Por regla, esto no
  ameritaría tocar el log, pero se encontraron dos problemas reales de forma
  proactiva:

  1. **GA4 (Tráfico Web) — "sin dato" permanente, falso negativo de monitoreo.**
     El proceso `ga4` (tabla `web_traffic`, columna `created_at`) devuelve
     `estado:"sindato", ageH:null` en **todas** las corridas revisadas de los
     últimos ~2 días (cadencia esperada: 6h). Se confirmó que el cron
     **sí está corriendo bien**: `ga4-sync.yml` corre cada ~4-6h y el último
     run (2026-08-12 07:57 UTC, 4 min después del chequeo del watchdog) devolvió
     `"ok":true` con `"trafficUpsert":"1330 filas OK"`. También se confirmó que
     la columna existe (`web_traffic.created_at timestamptz not null default
     now()`, migration `0001_initial_schema.sql`, sin `ALTER TABLE` posterior).
     O sea: hay cron corriendo bien y columna con datos, pero la consulta de
     frescura (`maxUpdatedAt` en `apps/web/src/lib/freshness-queries.ts`, vía
     el cliente anon de `getServerSupabase()`) devuelve 0 filas/error
     específicamente para esta tabla — las otras 13 tablas del proyecto
     principal consultadas con el mismo cliente sí devuelven fecha OK. No se
     pudo confirmar la causa raíz exacta (¿falta un GRANT SELECT para `anon`
     en `web_traffic` puntualmente? ¿algo del PostgREST schema cache?) porque
     este entorno no tiene acceso de red a Supabase ni al dominio de
     producción, y el token de GitHub Actions disponible no tiene permiso para
     disparar `db-inspect.yml` (`workflow_dispatch` → 403 "Resource not
     accessible by integration"). **No resuelto — queda pendiente que alguien
     con acceso directo a Supabase corra
     `select count(*), max(created_at) from web_traffic;` y revise los
     privilegios de `anon` sobre esa tabla.** Importante: como `sindato` no
     cuenta como `crítico` para el watchdog (por diseño, ver comentario en
     `route.ts`: "sindato es no medible"), si el sync de GA4 se rompiera de
     verdad hoy, el watchdog no lo detectaría — es un punto ciego real.
  2. **Watchdog — el auto-retry de Actions nunca encontró runs (probable bug,
     no crítico).** La sección 1 del script de `watchdog.yml` (`gh run list
     --workflow "$wf"`) devolvió `-> none` para los 11 workflows monitoreados
     (ga4-sync, bgt-sync, meta-paid-sync, organic-insights, clasificar-
     contenido, meta-fb-sync, ig-sync-6h, ig-sentiment-sync, ugc-comments-
     graph/sync/analysis) en **todas** las corridas revisadas del watchdog
     (8/10 a 8/12), pese a que esos workflows tienen cientos de runs exitosos.
     Efecto: el re-intento automático de syncs fallidos nunca se activó en
     este período (no es grave ahora porque los syncs vienen corriendo bien
     solos, pero la salvaguarda no está funcionando). No se investigó a fondo
     ni se tocó el workflow en esta corrida — requiere poder disparar/depurar
     `watchdog.yml` manualmente, algo que este entorno tampoco pudo hacer
     (mismo bloqueo de permisos de `workflow_dispatch`).
  - **Otros procesos revisados sin issues:** DV360 piezas/reach, Floor Share y
    Cuadros Básicos (Apps Script, proyecto CB) — todos con `ageH` dentro de
    tolerancia en el snapshot más reciente. Mercado (GFK) y SEO · Interés por
    provincia (cargas manuales, cadencia trimestral) también OK. No hay nada
    para marcar como "no resuelto" en el sentido del punto 4 del checklist
    (fuentes manuales/Apps Script que no se pueden auto-arreglar) porque
    ninguno está atrasado — el único pendiente real es el punto 1 de arriba.

---

## 2026-08-10 · SEO índice histórico — mismo bug de updated_at (preventivo)

- **Detectado (proactivo):** el cron `seo-index-snapshot` upserteaba el índice sin
  setear `updated_at`, así que al reescribir el mismo mes no lo bumpeaba → el
  Monitoreo iba a dar un falso "SEO índice atrasado" (mismo patrón que insights).
- **Arreglo:** se agrega `updated_at` al payload del snapshot + se recomputó y
  guardó el índice del mes con `updated_at` fresco.
- **Nota de dato:** al recomputar con la corrida de hoy, cocinas Drean saltó de
  ~30 a ~71. Verificado: Drean perdió ~5 keywords de cocinas (rankea en 45 vs 50);
  como el índice pondera por volumen, pocas pérdidas de alto volumen lo mueven
  mucho. Parte real, parte ruido de snapshot SERP. No es alarma; el índice de
  cocinas es volátil con snapshots únicos → observar la tendencia mensual.

---

## 2026-08-10 · SEO sync — proceso caro y lento (optimización de costo)

- **Detectado:** el sync de SEO (SERP matrix) corría **semanal** y cada corrida
  completa (489 keywords, SERP live depth-100 a ~$0.0138 c/u) cuesta **$5-7** →
  ~$25-30/mes. Además tardaba ~12 min. Desproporcionado para un índice de
  posición que se mueve lento.
- **Arreglo:** cadencia **semanal → mensual** (`cron: 40 6 1 * *`). El histórico
  del índice ya es mensual, así que es la cadencia natural. Corta el costo ~4x
  (~$6/mes). Antes se había paralelizado el SERP (8 concurrentes) para evitar el
  timeout de 300s.
- **Pendiente opcional (si se quiere aún más barato):** pasar de SERP `live` a
  task-based (standard, ~3x más barato, async), bajar `depth`, o recortar el
  universo a las keywords de mayor volumen.

---

## 2026-08-10 · Insights orgánicos — "crítico (hace 3d)"

- **Alarma:** `Insights orgánicos` en crítico — última actualización hace 3 días
  (esperado 1x/día).
- **Diagnóstico:** el cron `organic-insights` **corría bien y a diario** (runs en
  "success", y `insights_log.fecha_generado` = hoy). El problema era de medición:
  el Monitoreo mide frescura por la columna `updated_at`, y el upsert
  `merge-duplicates` **no bumpea `updated_at`** cuando se re-emiten las mismas
  señales (sólo actualiza las columnas del payload, que no incluía `updated_at`).
  Desde el 7/8 no aparecieron señales nuevas → sólo hubo UPDATEs → `updated_at`
  quedó congelado en el 7/8, aunque los insights estaban frescos. Falso positivo.
- **Arreglo:**
  1. Código (`api/cron/organic-insights/route.ts`): se agrega `updated_at` al
     payload del upsert, así cada corrida diaria lo bumpea. (PR de este commit.)
  2. Datos: se hizo un PATCH puntual seteando `updated_at = now()` en las 18 filas
     de `categoria = organico_drean` (la data ya estaba fresca vía
     `fecha_generado`), para limpiar la alarma sin esperar el próximo deploy+cron.
- **Estado:** resuelto. El semáforo vuelve a OK; el fix de código evita que se
  repita.
