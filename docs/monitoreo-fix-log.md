# Log de arreglos automáticos del Monitoreo

Historial de las alarmas/desvíos detectados en el dashboard de Monitoreo y cómo
se resolvieron. Entrada más reciente arriba. Cada entrada: fecha · qué alarmó ·
causa raíz · qué se hizo.

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
