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

## Fixes/hardening (sesión sep-2026) — aplicar aprendizajes de Drean, no solo inventariarlos
- **FB reach = 0 (bug):** el motor de redes de BIP arrastró la métrica vieja
  `post_impressions_unique`, que Meta **deprecó el 15-jun-2026**. Mezclar una métrica inválida en
  `/insights` tira la llamada ENTERA → alcance, clicks y video views salían 0 (engagement no,
  porque viene de fields del post). Fix en `lib/meta-social.ts` `getFbOrganicLive`: **sondear** qué
  métricas acepta la cuenta (probe con el 1er post) y usar `post_total_media_view_unique` **leyendo
  lifetime, no day**. Réplica del `meta-fb-sync` de Drean. **Orgánico vs pautado ya estaba portado
  bien:** `isPaidOutlier(reach>20k && reacc/reach<1%)` aplicado a totales/mensual/topPosts (idéntico
  a Drean). IG usa reach vivo sin filtro pago (= Drean).
- **Seguimiento (`/overview`) lento (~decenas de s por click):** `getSeguimientoKpis` pegaba EN VIVO
  a Meta (Pauta) + Meta (Redes IG+FB) + GA4 en cada render. Fix: lee de los **snapshots**
  pre-computados (Pauta/Redes) con fallback a live, y se memoiza con **React `cache()`** (NO
  `unstable_cache`: usa fuentes que dependen del request — Drean se quemó con eso por `cookies()`).
  Patrón Drean: el render lee marts, nunca en vivo. (Web mensual sigue por 1 report GA4 cacheado.)
- **Crons — resiliencia + frecuencia con fundamento:** los 3 workflows (`sync-pauta/redes/web.yml`)
  ahora **reintentan 4× con backoff** (5/20/45/80s) en vez de perder la corrida 12-24h si un curl
  falla. **Pauta y Web 2×/día** (GA4 llega hasta ayer → 1×/día alcanza; el 2º pase = autocura una
  corrida fallida; Meta madura atribución ~7-14 días). **Redes 12h** (FB reach madura 50-60 días y
  cada corrida re-lee lifetime → avanza maduración; **sin bug de ventana congelada porque BIP
  recomputa, no persiste por-post** — a escala migrar a incremental + ventana 70d, Fase 3; IG no
  trae Stories → no aplica el 6h de Drean). Cada YAML documenta qué resuelve y cómo.
- **Sidebar:** el tilde verde de Mapa/Seguimiento usaba un OR (objetivos O algún plan c/kpis) →
  quedaba verde tras borrar planes/KPIs si sobraba un objetivo. Ahora exige la MISMA condición que
  hace disponible al Seguimiento: objetivos + ≥1 KPI vinculado a un objetivo (peso>0), si no ámbar.
- **UI:** botones `.btn` con fondo pleno (sin degradé); isotipo oficial de Meta (era un garabato
  tipo Nango); glifos reales de IG/FB en los headers de sus secciones.

## Próximo
- **Conector SharePoint/Excel + planillas (PEDIDO EN CURSO):** el código de BIP ya está
  (tarjeta en Conexiones, `lib/ms-graph.ts` lectura por Graph solo-lectura con link para
  compartir, `/api/diag/sharepoint` para probar). **Falta para que funcione:**
  1. **Tu setup (irreducible):** registrar la **app en Azure AD** (Graph, `Files.Read.All` +
     `offline_access`, solo lectura) + crear la **integración `sharepoint` en Nango** con ese
     client_id/secret. Sin esto el botón Conectar no tiene contra qué autenticar (no se pudo
     probar con archivo real todavía).
  2. **Mi parte (bloqueada por decisión del user):** el **mart + dónde se muestran** los datos.
     Los archivos (subidos/SharePoint/Sheets) alimentan **tableros ESPECÍFICOS que se desarrollan
     con el cliente** (no es self-serve genérico); una vez configurado, queda conectado y
     automatizado. **Decisión pendiente:** ¿(a) dashboard nuevo dedicado, o (b) alimentar un
     KPI/dashboard existente? Con eso se define la estructura del mart + el cron de refresco.
- **Rango histórico por plan (PEDIDO PENDIENTE):** Insight = ene del año en curso→hoy; Optimize y
  Accelerate = ene-2025→hoy (2 años). Requiere: `from` según `tenant.plan`; snapshots por año
  (marts ya son (tenant, anio)); crons que escriben 1 fila por año del rango; y render multi-año
  (hoy los charts son 12 meses de 1 año → selector de año o 24 meses). Confirmar UX antes de armar.
- **Fase 0** (si escala): Supavisor pooling (env) + Upstash (caché compartida + rate-limit).
- **Fase 3**: cola con fan-out por tenant + watchdog per-tenant sobre `sync_runs` cuando haya
  muchos clientes (el GitHub Action único alcanza para las primeras decenas).
