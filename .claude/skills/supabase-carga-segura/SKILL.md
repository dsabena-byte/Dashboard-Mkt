---
name: supabase-carga-segura
description: >-
  Patrón seguro para CUALQUIER escritura (INSERT / UPDATE / DELETE) en Supabase del proyecto Drean
  (pauta_performance, mercado_share, dv360_creatives, trade_monthly, mapa_estrategico, etc.). Usalo
  siempre que vayas a cargar, corregir, migrar o borrar datos por REST con la service key. Fuerza:
  leer el esquema, hacer un SELECT del estado actual, GUARDAR un backup de las filas antes de
  borrarlas, MOSTRAR la tabla de carga para que el usuario la apruebe ANTES de escribir, usar
  PATCH/upsert por clave compuesta en vez de delete+insert cuando alcance, y verificar los totales
  después de escribir. Nace de un DELETE que borró meses de pauta_performance sin backup.
---

# Supabase — carga/edición segura

Un borrado sin red de seguridad ya destruyó datos en este proyecto (DELETE de `pauta_performance`
abril–agosto sin guardar las filas). Regla del usuario: **"pasame la tabla antes de ejecutar"**.
Seguí este patrón para toda escritura.

## Conexión (REST, service key)
Solo nombres de env vars — NUNCA pongas valores/secretos en archivos ni en el chat:
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (proyecto principal). Para el proyecto CB:
`CB_SUPABASE_*` con fallback al principal. Se leen desde `apps/web/.env.local`/`.env`. No hay
conexión DDL: las migraciones las corre el usuario en el SQL Editor.

## Procedimiento (en orden)
1. **Leé el esquema** de la tabla (columnas + clave única) antes de armar nada.
2. **SELECT del estado actual** del scope que vas a tocar (por mes/categoría/etc.). Guardá esos
   números para comparar después.
3. **Armá la tabla de carga y MOSTRÁSELA al usuario** (qué filas, qué valores, qué totales quedan)
   **antes** de escribir. Esperá el OK. Esto no es opcional.
4. **Preferí `PATCH`/upsert por clave compuesta** sobre delete+insert cuando solo cambian campos de
   filas existentes. Menos riesgo de perder filas.
5. **Si SÍ o SÍ tenés que borrar**: hacé el DELETE con `Prefer: return=representation` y **guardá
   las filas devueltas** en un archivo/variable ANTES de insertar. Así podés restaurar si el INSERT
   falla (ej. 409 por clave duplicada).
6. **Verificá después**: volvé a hacer el SELECT y confirmá filas y totales contra lo esperado.
   Reportá el total final.

## Claves compuestas de las tablas frecuentes
- `pauta_performance`: **(mes, categoria, medio, objetivo, tipo_compra)** — `uq_pauta_perf`.
  `tipo_compra` es NOT NULL (usar "CPM"/"CPC"/"CPA").
- `mercado_share`: **(mes, categoria, segmento, marca, agregacion)**.
- `dv360_creatives`: **(mes, canal, categoria, rol, creative)**.
- `mapa_estrategico`: singleton `id=1` (jsonb `objetivos`+`planes`) — la fuente de verdad es la DB,
  NUNCA solo localStorage (ya se perdió toda la config una vez por guardar solo en localStorage).

## Gotchas
- El "clean-replace" acotado: cuando reemplaces un mes, acotá el DELETE al scope cargado
  (categoria/agregacion/mes) para no pisar meses previos ni proyecciones (ej. `mercado_share` fila
  proy `2026-11-01`).
- Filas con `semana` NULL: el DELETE debe matchearlas (`or=(semana.gte.0,semana.is.null)`) o se
  acumulan.
- Antes de un clean-replace en `mercado_share`, verificá la matriz completa (3 KPIs × segmento): si
  falta uno, el replace deja esa métrica en null y pisa lo que había.
