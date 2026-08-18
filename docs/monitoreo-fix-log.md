# Log de arreglos automáticos del Monitoreo

Historial de las alarmas/desvíos detectados en el dashboard de Monitoreo y cómo
se resolvieron. Entrada más reciente arriba. Cada entrada: fecha · qué alarmó ·
causa raíz · qué se hizo.

---

## 2026-08-18 · UGC comentarios — "atrasado", rate limit transitorio de Graph API

- **Chequeo de rutina:** corrida automática del monitoreo (18/8, ~12:20 UTC).
  Igual que el 14/8, esta sesión no puede llamar directo a
  `dashboard-mkt-seven.vercel.app` ni a Supabase (egress bloqueado por política
  de red), así que reconstruí el estado leyendo el log de la corrida más
  reciente del watchdog (`watchdog.yml`, run del 18/8 07:05 UTC, que sí tiene
  red completa). Snapshot real (`/api/cron/health`, 18/8 07:05:13 UTC): 16 de
  17 procesos `ok`, 0 críticos — **`ugc` (UGC comentarios) en `atrasado`**
  (`ageH: 44`, `cadenciaH: 24` → 1.83×, dentro del rango 1.5×-3×).
  `lastUpdate` real: 2026-08-16T11:14:39Z.
- **Diagnóstico:** NO es un cron caído — `ugc-comments-graph.yml` corre a
  diario (11:xx UTC) y termina en `success` todos los días, incluido el 17/8.
  Tampoco es un bug de `updated_at` (la columna que mide frescura es
  `fetched_at`, que sí se toca en cada upsert exitoso). La causa real: en la
  corrida del **17/8 11:19 UTC**, el endpoint devolvió `HTTP 200` /
  `"ok":true` (por eso GitHub Actions no lo marca como falla), pero los 20
  ítems procesados fallaron **todos** con el mismo error de Meta Graph API:
  `"There have been too many calls to this ad-account. Wait a bit and try
  again"` (rate limit de la cuenta publicitaria) → `comments:0` en todos,
  ninguna fila de `ugc_comments` se actualizó ese día, así que `fetched_at`
  quedó congelado en el 16/8. Es un rate-limit transitorio de Meta, no un bug
  de nuestro código ni un cron roto.
- **Estado al momento de este chequeo:** ya auto-recuperado. La corrida
  programada del **18/8 11:19 UTC** (posterior a la alarma, antes de esta
  verificación) volvió a tener cupo en la API y procesó los 20 ítems
  normalmente (`"via":"ig_media"`, comentarios reales devueltos, sin errores
  de rate limit) → `fetched_at` de `ugc_comments` ya debería estar en ~18/8
  11:19 UTC, lo que deja `ugc` en `ok` (ageH ~1h vs cadenciaH 24h). No se
  re-disparó el cron (ya había corrido solo) ni se aplicó ningún PATCH de
  datos — no hacía falta.
- **Sin acción de código:** no se abrió PR. El endpoint ya reporta `ok:true`
  incluso cuando todos los ítems individuales fallan (por diseño, para no
  marcar el Action en rojo por un rate-limit externo transitorio); eso está
  bien porque el monitoreo de frescura (`fetched_at`) es justamente lo que
  detecta este caso, y el retry natural del día siguiente ya lo resolvió sin
  intervención.
- **Estado:** resuelto solo, por el próximo ciclo programado. Sin pendientes.

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
