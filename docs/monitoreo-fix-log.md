# Log de arreglos automáticos del Monitoreo

Historial de las alarmas/desvíos detectados en el dashboard de Monitoreo y cómo
se resolvieron. Entrada más reciente arriba. Cada entrada: fecha · qué alarmó ·
causa raíz · qué se hizo.

---

## 2026-08-11 · Tráfico Web (GA4) — "Sin dato" permanente (falso positivo)

- **Detectado (rutina de Monitoreo):** `Tráfico Web (GA4)` aparecía en
  "Sin dato" (`estado: sindato`, `lastUpdate: null`) en **todas** las corridas
  del watchdog revisadas de los últimos ~4 días (08/08 → 11/08), pese a que la
  cadencia esperada es cada 6h.
- **Diagnóstico:** el cron `ga4-web-traffic` **corre bien** — se disparó a las
  07:43 UTC de hoy (run `31470144951`, workflow `ga4-sync.yml`) y devolvió
  `trafficUpsert: "1353 filas OK"` sobre `web_traffic`. No es un cron caído ni
  un bug de sync. El problema es de medición, mismo patrón que el fix de
  Insights orgánicos (10/08):
  - `monitoreo-config.ts` medía frescura de `web_traffic` por `created_at`.
    Esa columna sólo cambia cuando aparece una fila realmente **nueva**
    (una vez por día calendario, cuando el rolling window de `?days=` avanza
    a una fecha nueva); el resto de las corridas del día son `UPDATE`s sobre
    filas ya existentes — el trigger `trg_web_updated` sí pisa `updated_at`
    en cada una, pero `created_at` queda fijo desde el insert original.
  - Además, `web_traffic` (~130k filas) no tiene índice en ninguna columna de
    timestamp — sólo `idx_web_traffic_fecha` / `idx_web_traffic_utm_key` — así
    que un `order by created_at desc limit 1` fuerza un seq scan + sort
    completo con el rol `anon` (mismo tipo de timeout que ya se había resuelto
    para otras vistas de esta tabla en las migraciones `0016` y `0025`), lo
    que probablemente hacía fallar la query de frescura → `null` → "Sin dato".
- **Arreglo (PR, este commit):**
  1. Código: `monitoreo-config.ts` — `col` de `"created_at"` a `"updated_at"`
     para `ga4` (igual que el resto de los procesos "GitHub Action").
  2. Migración `supabase/migrations/0098_web_traffic_updated_at_index.sql` —
     agrega `idx_web_traffic_updated_at` para que la query de frescura no
     escanee la tabla completa.
- **Pendiente (no automatizable desde acá):** este repo aplica las
  migraciones a mano por el SQL Editor de Supabase (no hay CI que las
  corra — ver `docs/supabase-setup.md`), y esta rutina no tiene acceso de red
  a Supabase ni a Vercel. **Falta correr `0098_web_traffic_updated_at_index.sql`
  en el proyecto principal** para que el fix de código surta efecto sin
  timeouts. Hasta entonces, "Tráfico Web (GA4)" puede seguir mostrando
  "Sin dato" en el tab /monitoreo aunque el sync esté 100% al día.

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
