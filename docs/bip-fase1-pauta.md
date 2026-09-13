# BIP — Escalado: ingesta pull→DB (Pauta + Redes + Web) — ESTADO + tu checklist

> Implementación de las primeras fases del plan de `docs/bip-escalado-arquitectura.md` en el
> repo **`bip-platform`**. Patrón "ingesta background → dashboard lee mart" con **snapshot
> JSON** (= `fs_precomputed` de Drean), reutilizando los motores existentes. **Todo con
> fallback a live: no rompe la demo aunque no corras nada.** Los 3 dashboards principales
> (Pauta, Redes, Web) ya leen de snapshot cuando existe.

## Estado (commits en `bip-platform`)
| Pieza | Estado | Commit |
|---|---|---|
| Infra: `sync_runs`, `image-mirror` (rehost a Storage) | ✅ | `366d323` |
| **Fase 1 — Pauta** (snapshot + cron + /performance + workflow) | ✅ | `366d323` |
| **Fase 2 — Redes** (snapshot ig+fb + cron + /redes + workflow) | ✅ | `302c640` |
| Invalidación de snapshots al cambiar de cuenta Meta | ✅ | `0101174` |
| **Fase 2b — Web/GA4** (snapshot de reportes + cron + /web + workflow) | ✅ | `e907ce6` |
| Fase 0 (Supavisor pooling + Upstash) | ⏳ tu infra | — |
| Fase 3 (cola fan-out + watchdog per-tenant) | ⏳ a futuro | — |

## Qué construí (código)
**Común:** `lib/sync-runs.ts` (`logSyncRun`), `lib/image-mirror.ts` (rehost de miniaturas a
Storage bucket `creatives`, idempotente + tolerante a fallas).

**Fase 1 — Pauta:** migr. `0007` (`pauta_snapshot` + `sync_runs`), `lib/marts/pauta-snapshot`,
`app/api/cron/sync-pauta` (reusa `getPautaFull`, rehostea thumbnails), `/performance` lee
snapshot con fallback (filtros MES/PLATAFORMA siguen live), `sync-pauta.yml` (diario 06:30).

**Fase 2 — Redes:** migr. `0008` (`redes_snapshot`), `lib/marts/redes-snapshot`,
`app/api/cron/sync-redes` (reusa `getRedesForTenant` IG+FB, rehostea top posts), `/redes` lee
snapshot con fallback, `sync-redes.yml` (cada 12h).

**Fase 2b — Web/GA4:** migr. `0009` (`web_snapshot`), `lib/ga4-reports` (extrae el fetch de
los 9 reportes GA4 sin tocar la derivación/render de `/web`), `lib/marts/web-snapshot`,
`app/api/cron/sync-web` (guarda los reportes de la vista default), `/web` lee snapshot cuando
no hay filtros de período (con filtros/property → live), `sync-web.yml` (diario 07:30).

**Invalidación:** al cambiar la cuenta en Conexiones (`/api/meta/assets` POST), se borran los
snapshots afectados (página→`redes_snapshot`, ad account→`pauta_snapshot`) → el dashboard cae
a live (cuenta nueva) al instante y el próximo sync repuebla. (Web/property se maneja con el
selector → live.)

## ✅ Ya validado (sep-2026)
Corrieron OK los workflows **Sync Pauta** (tenant `demo`: 48 piezas, 57 campañas) y **Sync
Redes** (3 IG + 3 FB) → snapshots poblados. Aprendizaje: cambiar la cuenta y NO re-sincronizar
mostraba la cuenta anterior (por eso la invalidación automática).

## Tu parte (irreducible — Supabase/GitHub/Vercel)
1. **Migraciones** en el SQL Editor de Supabase (bip-platform): `0007`, `0008` **y** `0009`.
2. **Bucket público `creatives`** en Storage (ya creado). 
3. **`CRON_SECRET`** en Vercel + GitHub Secrets (mismo valor) — hecho. **Redeploy** de Vercel
   para que la env var tome efecto.
4. **Correr los 3 workflows** (Actions → Run workflow): Sync Pauta, Sync Redes, **Sync Web**.
   Verificar `sync_runs` (status `ok`) + `pauta_snapshot`/`redes_snapshot`/`web_snapshot`.

## Próximo
- **Fase 0** (si escala): Supavisor pooling (env) + Upstash (caché compartida + rate-limit).
- **Seguimiento (`/overview`)**: hoy sigue live; se puede apuntar a los snapshots.
- **Fase 3**: cola con fan-out por tenant + watchdog per-tenant sobre `sync_runs` cuando haya
  muchos clientes (el GitHub Action único alcanza para las primeras decenas).
