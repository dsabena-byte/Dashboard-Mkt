# Log de arreglos automáticos del Monitoreo

Historial de las alarmas/desvíos detectados en el dashboard de Monitoreo y cómo
se resolvieron. Entrada más reciente arriba. Cada entrada: fecha · qué alarmó ·
causa raíz · qué se hizo.

---

## 2026-08-24 · SEO · Posición (SERP matrix) e Índice — "atrasado" persistente por cadencia desactualizada

- **Chequeo de rutina:** corrida automática del monitoreo (24/8). Esta sesión (entorno
  de rutina programada) no tiene `SUPABASE_SERVICE_ROLE_KEY` ni acceso de red al
  endpoint `/api/cron/health` (el proxy de salida bloquea `dashboard-mkt-seven.vercel.app`
  con 403). Reconstruí el estado real leyendo el log de la corrida más reciente del
  GitHub Action `watchdog.yml` (run #138, 24/8 07:29 UTC, que sí llama al health-check
  con red completa): 17 procesos, **0 críticos**, pero **`seo_serp` y `seo_indice` en
  `atrasado`** (`ageH: 331`, última data del 10/8 12:32-12:35 UTC).
- **Diagnóstico:** NO es un cron caído. `seo-sync.yml` (dispara tanto `seo_rankings`
  como el snapshot de `seo_index_history`) corre **mensual** (`cron: "40 6 1 * *"`,
  cambiado de semanal a mensual el 10/8 por costo — ver entrada de esa fecha más abajo).
  Pero `monitoreo-config.ts` **nunca actualizó `cadenciaH`** de `seo_serp`/`seo_indice`
  al cambiar el cron: seguían en `168` (semanal) mientras la cadencia real pasó a
  ~720h (mensual). Mismo patrón exacto que el bug de `ga4`/`bgt` corregido hoy mismo
  en el commit anterior (`9a96e60`) — la config de cadencia queda desalineada del
  cron real y genera alarma falsa que no se resuelve sola (con `cadenciaH=168`,
  `ageH=331` cae en el rango atrasado `252-504h`; con `720` cae bien dentro de OK
  `≤1080h`). El propio campo `nota` de `seo_indice` ya decía "Snapshot mensual del
  índice" — contradecía su propio `cadenciaH: 168`.
- **Arreglo (código):** `monitoreo-config.ts` — `cadenciaH` de `seo_serp` y
  `seo_indice` de `168` → `720`, y `detalle` de `seo_serp` de "semanal" → "mensual"
  para que coincida con el cron real. PR creado y mergeado a `main` en esta corrida
  (typecheck limpio, `pnpm exec tsc --noEmit`).
- **Estado:** resuelto. El semáforo debería volver a `OK` en la próxima lectura de
  `/monitoreo`; los datos subyacentes ya estaban sanos (el sync mensual nunca dejó
  de correr, solo faltaba la corrida de setiembre).

---

## 2026-08-14 · Tráfico Web (GA4) — "sin dato" persistente pese a syncs OK

- **Chequeo de rutina:** corrida automática del monitoreo (14/8, ~13:44 UTC).
  No pude leer Supabase/el endpoint `/api/cron/health` directo desde esta sesión
  (el egress de red de este entorno bloquea `dashboard-mkt-seven.vercel.app` y
  Supabase), así que reconstruí el estado real leyendo los logs de las últimas
  corridas del GitHub Action `watchdog.yml` (que sí llama al health-check con
  red completa). Snapshot real más reciente (`/api/cron/health`, 14/8 13:44 UTC):
  16 de 17 procesos `ok`, 0 críticos — **`ga4` (Tráfico Web) en `sindato`**
  (`ageH: null`, `lastUpdate: null`). Mismo patrón confirmado en los 2 watchdog
  runs anteriores (12/8 y 13/8) → no es un blip, es persistente desde al menos
  hace 3 días.
- **Diagnóstico:** NO es un cron caído — `ga4-sync.yml` corre cada 6h y termina
  en éxito (confirmado en el log de la corrida de las 13:50 UTC del 14/8:
  `HTTP 200`, `"ok":true`, `"trafficUpsert":"1503 filas OK"`). El bug es de
  performance/medición: `monitoreo-config.ts` mide frescura de `ga4` ordenando
  `web_traffic` por `created_at` (`maxUpdatedAt` → `order(created_at, desc).limit(1)`),
  pero `web_traffic` es la tabla más grande del proyecto (>130k filas, crece
  ~1.5k filas cada 6h) y no tenía **ningún índice sobre `created_at`** (sólo
  `idx_web_traffic_fecha` e `idx_web_traffic_utm_key`, ninguno sirve para ese
  ORDER BY). La query de frescura falla/tarda de más contra la tabla sin
  índice; `maxUpdatedAt()` traga el error y devuelve `null` → el proceso queda
  invisible para el watchdog (ni Atrasado ni Crítico: directamente no medible).
  No es falso positivo de `updated_at` (patrón de la entrada del 10/8) ni un
  problema de datos — el timestamp existe en cada fila desde el insert
  (`created_at timestamptz not null default now()`, sin triggers que lo toquen).
- **Arreglo (código):** migración `supabase/migrations/0098_web_traffic_created_at_index.sql`
  agrega `create index if not exists idx_web_traffic_created_at on web_traffic (created_at desc)`.
  PR creado y mergeado a `main` en esta corrida.
- **Pendiente (manual):** este repo no auto-aplica migraciones al mergear (ver
  `docs/supabase-setup.md` — se aplican con `supabase db push` o pegando el SQL
  en el SQL Editor). **Falta aplicar la migración 0098 contra el proyecto
  Supabase principal** para que el fix tome efecto. Hasta entonces, `ga4`
  seguirá viéndose `sindato` en `/monitoreo` aunque el sync esté sano.
- **Estado:** código arreglado y mergeado; dato subyacente sano (el sync nunca
  dejó de correr); **acción humana pendiente** para aplicar la migración en
  Supabase.

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
