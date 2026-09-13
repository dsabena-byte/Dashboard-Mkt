# BIP — Escalado Fases 1-2: ingesta Pauta + Redes (pull→DB) — ESTADO + tu checklist

> Fases 1-2 del plan de `docs/bip-escalado-arquitectura.md` implementadas en el repo
> **`bip-platform`** (Pauta commit `366d323`, Redes `302c640`). Patrón "ingesta background
> → dashboard lee mart" reutilizando los motores existentes (`getPautaFull`,
> `getRedesForTenant`) + **snapshot JSON** (= `fs_precomputed` de Drean). **Con fallback a
> live: no rompe la demo.** (Web/GA4 = Fase 2b pendiente: su fetch está inline en `/web`,
> hay que extraerlo a un lib antes de snapshotear — más refactor, no lo hice para no arriesgar.)

## Lo que YA construí (código, en `bip-platform`)
**Infra común (Fase 0 parcial):**
- **`lib/sync-runs.ts`** (`logSyncRun`, nunca rompe el sync) + tabla `sync_runs`.
- **`lib/image-mirror.ts`**: rehost de miniaturas a Supabase Storage (bucket `creatives`),
  idempotente + tolerante a fallas → URLs **permanentes** (fbcdn caduca).

**Fase 1 — Pauta** (`0007_marts_sync.sql`: `pauta_snapshot` + `sync_runs`):
- `lib/marts/pauta-snapshot.ts` (get/save). `app/api/cron/sync-pauta`: itera tenants con Meta
  + ad account, reusa `getPautaFull`, rehostea thumbnails, guarda snapshot, loguea.
- `/performance` lee snapshot con **fallback a live**; filtros MES/PLATAFORMA siguen
  live-scoped; badge "Datos actualizados". Piezas: URL de Storage directa vs proxy `/api/img`.
- `.github/workflows/sync-pauta.yml` (diario 06:30 ART).

**Fase 2 — Redes** (`0008_redes_snapshot.sql`: `redes_snapshot`):
- `lib/marts/redes-snapshot.ts` (get/save). `app/api/cron/sync-redes`: reusa
  `getRedesForTenant` (IG+FB), rehostea miniaturas de top posts, guarda snapshot, loguea.
- `/redes` lee snapshot con **fallback a live** + badge de frescura.
- `.github/workflows/sync-redes.yml` (cada 12h).

## Tu parte (irreducible — necesita tu Supabase/GitHub/Vercel)
1. **Correr las migraciones** en el **SQL Editor de Supabase (proyecto bip-platform)**:
   `supabase/migrations/0007_marts_sync.sql` **y** `0008_redes_snapshot.sql`. (Sin esto, los
   dashboards siguen andando por fallback a live.)
2. **Crear el bucket público `creatives`** en Supabase → Storage → New bucket → *Public*.
   (Sin esto, `mirrorImage` devuelve la URL fbcdn original — funciona igual pero caduca.)
3. **Setear `CRON_SECRET`** (un string secreto) en:
   - **Vercel** (proyecto bip-platform) → Environment Variables.
   - **GitHub** → repo `dsabena-byte/bip-platform` → Settings → Secrets → Actions →
     `CRON_SECRET` (mismo valor).
4. **Probar**: GitHub → Actions → "Sync Pauta" / "Sync Redes" → *Run workflow*. Verificá
   `sync_runs` (status `ok`) y `pauta_snapshot`/`redes_snapshot` (una fila por tenant). Luego
   `/performance` y `/redes` deberían cargar al instante con la fecha de "datos actualizados".

## Notas de diseño (por qué así)
- **Snapshot JSON** (no tablas normalizadas por KPI): el dashboard consume un `PautaFull`
  entero; guardarlo como JSON de 1 fila (patrón `fs_precomputed`) es lo más simple y reusa
  el motor tal cual. Migrar a `fact_*` normalizado se puede después si hace falta cross-tenant.
- **Fallback a live**: si no hay snapshot (tenant nuevo, migración sin correr, primer día),
  el dashboard computa en vivo → la demo nunca se rompe.
- **Filtros live-scoped**: el snapshot es año completo (Impacto + Eficiencia default). Cuando
  el user filtra por MES/PLATAFORMA, se hace un fetch live scopeado (reach correcto) — igual
  que Drean computa la vista filtrada y sirve la default del precálculo.

## Próximo
- **Fase 2b — Web/GA4**: su fetch está inline en `app/(app)/web/page.tsx` (~10 reportes GA4)
  → hay que extraerlo a un lib serializable antes de snapshotear. Más refactor (no lo hice
  para no arriesgar sin validar Fase 1-2). Mismo patrón después.
- **Fase 0 (si escala)**: Supavisor pooling + Upstash (caché compartida) — ver arquitectura.
- **Seguimiento (`/overview`)**: hoy sigue live (objetivos-kpis usa getPautaForTenant +
  getRedesForTenant + GA4); se puede apuntar a los snapshots cuando estén poblados.
- **Fase 3**: cola con fan-out cuando haya muchos tenants + watchdog per-tenant sobre `sync_runs`.
