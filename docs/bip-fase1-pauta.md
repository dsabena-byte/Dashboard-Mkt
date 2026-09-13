# BIP — Fase 1 del escalado: ingesta de Pauta (pull→DB) — ESTADO + tu checklist

> Primera fase del plan de `docs/bip-escalado-arquitectura.md` implementada en el repo
> **`bip-platform`** (commit `366d323`). Prueba el patrón "ingesta background → dashboard
> lee mart" con el cron más complejo (Pauta/Meta), reutilizando `getPautaFull` y el patrón
> **snapshot JSON** (= `fs_precomputed` de Drean). **Con fallback a live: no rompe la demo.**

## Lo que YA construí (código, en `bip-platform`)
- **Migración `0007_marts_sync.sql`**: `pauta_snapshot` (JSON PautaFull por tenant/año) +
  `sync_runs` (observabilidad de corridas).
- **`lib/marts/pauta-snapshot.ts`**: `getPautaSnapshot` / `savePautaSnapshot`.
- **`lib/sync-runs.ts`**: `logSyncRun` (nunca rompe el sync por un log).
- **`lib/image-mirror.ts`**: rehost de miniaturas a Supabase Storage (bucket `creatives`),
  idempotente + tolerante a fallas → URLs **permanentes** en el snapshot (fbcdn caduca).
- **`app/api/cron/sync-pauta/route.ts`**: gateado por `CRON_SECRET`; itera tenants con Meta
  activo + cuenta de anuncios elegida; reusa `getPautaFull`; rehostea thumbnails; guarda el
  snapshot; loguea en `sync_runs`. `?tenant=<id>` para uno solo. `maxDuration=300`.
- **`/performance`**: lee el snapshot (instantáneo, sin pegarle a Meta) con **fallback a
  live**; los filtros MES/PLATAFORMA siguen live-scoped; badge "Datos actualizados: …".
  Las piezas usan la URL de Storage directa (snapshot) o el proxy `/api/img` (fallback live).
- **`.github/workflows/sync-pauta.yml`**: schedule diario 06:30 ART + `workflow_dispatch`.

## Tu parte (irreducible — necesita tu Supabase/GitHub/Vercel)
1. **Correr la migración** `supabase/migrations/0007_marts_sync.sql` en el **SQL Editor de
   Supabase (proyecto bip-platform)**. (Sin esto, el dashboard sigue andando por fallback a live.)
2. **Crear el bucket público `creatives`** en Supabase → Storage → New bucket → *Public*.
   (Sin esto, `mirrorImage` devuelve la URL fbcdn original — funciona igual pero caduca.)
3. **Setear `CRON_SECRET`** (un string secreto) en:
   - **Vercel** (proyecto bip-platform) → Environment Variables.
   - **GitHub** → repo `dsabena-byte/bip-platform` → Settings → Secrets → Actions →
     `CRON_SECRET` (mismo valor).
4. **Probar**: en GitHub → Actions → "Sync Pauta" → *Run workflow* (o esperar al schedule).
   Verificá en Supabase la tabla `sync_runs` (status `ok`) y `pauta_snapshot` (una fila por
   tenant). Luego abrí `/performance` → debería cargar al instante con "Datos actualizados".

## Notas de diseño (por qué así)
- **Snapshot JSON** (no tablas normalizadas por KPI): el dashboard consume un `PautaFull`
  entero; guardarlo como JSON de 1 fila (patrón `fs_precomputed`) es lo más simple y reusa
  el motor tal cual. Migrar a `fact_*` normalizado se puede después si hace falta cross-tenant.
- **Fallback a live**: si no hay snapshot (tenant nuevo, migración sin correr, primer día),
  el dashboard computa en vivo → la demo nunca se rompe.
- **Filtros live-scoped**: el snapshot es año completo (Impacto + Eficiencia default). Cuando
  el user filtra por MES/PLATAFORMA, se hace un fetch live scopeado (reach correcto) — igual
  que Drean computa la vista filtrada y sirve la default del precálculo.

## Próximo (cuando corras tu parte)
- **Fase 0** (si escala): Supavisor pooling + Upstash (caché compartida) — ver arquitectura.
- **Fase 2**: replicar el patrón a Redes (`getRedesForTenant`) y Web (GA4) → sus snapshots.
- **Fase 3**: cola con fan-out cuando haya muchos tenants + watchdog per-tenant sobre `sync_runs`.
