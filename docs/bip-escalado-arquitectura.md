# BIP — Arquitectura de escalado (fuente de verdad)

> **Documento único de arquitectura** para llevar BIP a un SaaS multi-tenant que sirva
> de **decenas a cientos de clientes** con la profundidad de dashboards de Drean.
> Unifica (a) lo **ya decidido/ejecutado** (que vivía disperso en `bip-platform-handoff.md`)
> y (b) el **análisis de escalado** (ingesta, storage, seguridad, costos, UX, stack, fases).
> El handoff sigue siendo la memoria de **producto/pricing/features y estado de trámites**;
> este doc es la **arquitectura técnica**. Ante conflicto sobre arquitectura, manda este.
>
> Stack: **Next.js (App Router) en Vercel** · **Supabase** (Postgres + Auth + Storage) ·
> **Nango self-host en Railway** (OAuth/tokens) · OpenAI (IA). Fuentes por cliente: Meta
> (ads + orgánico), GA4, TikTok, Google Ads, uploads Excel/CSV, (DV360/SharePoint asistidas).

---

## 0. Estado actual — lo YA hecho / decidido (no re-litigar)

Estas piezas ya existen y funcionan; el escalado se construye ENCIMA de ellas.

- **Multi-tenant single-DB + RLS por `tenant_id`** (aislamiento físico → Supabase dedicado
  solo para enterprise que lo exija). Seam `lib/tenant/` (`getCurrentTenant`). ✅
- **Control plane**: migración `0001` (`tenants`, `tenant_users`, `connections`,
  `connection_events`, `billing_events`) + RLS `is_member`/`is_owner`. ✅
- **Conexiones/tokens = Nango self-host en Railway** (`nango.bip-go.com`): OAuth +
  auto-refresh, **$0 hasta 1000 conexiones, ilimitadas**. Deployado y probado end-to-end
  (Supabase → `getToken(tenant, provider)` → Nango → API real). ✅ Resolvió costo **y**
  verificación de dominio a la vez.
- **Patrón de pipeline**: el único cambio vs Drean es `process.env.TOKEN` →
  **`getToken(tenant, provider)`**. Validado. ✅
- **Billing**: Stripe (evaluar Paddle/Lemon Squeezy por USD desde AR); webhook firmado →
  actualiza `tenants` → **gating cambia sin deploy**. (Pendiente de cablear.)
- **Gating por capacidades** (no por dashboard): `ia` (todos), `alertsReports` (todos),
  `competitive` (Optimize+), `research`/Salud de Marca (Accelerate), `consultingHours`.
- **Scopes sensibles pero NO restringidos** → evita el CASA de Google ($500-4500/año).
- **Verificación (camino crítico externo, en progreso):** Google marca verificada ✅
  (falta verificación de scopes + video); Meta falta App Review + Business Verification de
  ROQUÉ; TikTok falta armar la app. Legales listos (`privacy`/`terms`: Google Limited Use +
  Meta Platform Data + borrado).
- **Storage actual**: Supabase proyecto `bip-platform`; tablas `tenant_datasets` (uploads),
  `web_metas`, `dash_metas`, `mapa_estrategico`. Dashboards HOY consultan las APIs **en vivo**
  con caché en memoria 5 min (`lib/ttl-cache.ts`).
- **Ingesta ya planeada** como "retrofit de los crons de Drean per-tenant": los 8 crons que
  tocan credenciales (`meta-paid-sync, meta-fb-sync, ig-sync, publicar-contenido,
  google-ads-sync, ga4-web-traffic, tiktok-sync`) al patrón `getToken(tenant, provider)`.

> Objetivo original del handoff: **50 clientes simultáneos**. Este doc extiende el diseño a
> **cientos**, que es donde el modelo "cron único + fetch en vivo" deja de alcanzar (ver §2-3).

---

## 1. Diagnóstico: por qué el modelo *live* actual no escala

Hoy cada dashboard (server component) consulta Meta/GA4 **en vivo en cada request**, con
caché en memoria de 5 min. Sirve para demo. Cuellos reales a escala:

1. **Rate limits** de las plataformas (ya visto: `Application request limit reached` con UNA
   cuenta grande). Meta limita por token de usuario **y** por app.
2. **Caché en memoria = no compartida** entre instancias serverless → hit-rate bajo, recomputa
   en frío. No es una caché real multi-instancia.
3. **Cómputo pesado en el request** (`getPautaFull` ~14,5s medido). Mata UX y quema duración
   de función (costo).
4. **Sin histórico** (si Meta borra/archiva un ad, se pierde el dato; no hay YoY real).
5. **Miniaturas efímeras** (fbcdn caduca; hoy tapado con proxy `/api/img`).
6. **Conexiones a Postgres**: serverless + Postgres sin pooler = explosión de conexiones.

**Conclusión:** separar **ingesta (background)** de **servicio (lectura)** — el patrón de
Drean, pero orquestado para N tenants.

---

## 2. Arquitectura objetivo

```
┌─ INGESTA (background, por tenant) ────────────────────────────────────┐
│  Scheduler → Cola (fan-out por tenant×fuente) → Workers                │
│    getToken(Nango) → fetch API → transform → UPSERT marts             │
│    + mirror de creativos a Object Storage/CDN                         │
└───────────────────────────────┬──────────────────────────────────────┘
                                 ▼
┌─ ALMACENAMIENTO ──────────────────────────────────────────────────────┐
│  Postgres (Supabase): raw landing (TTL corto) + marts agregados por    │
│  tenant · Object Storage (creativos) · Redis (caché caliente + rate)  │
└───────────────────────────────┬──────────────────────────────────────┘
                                 ▼
┌─ SERVICIO (Next.js/Vercel) ───────────────────────────────────────────┐
│  Dashboards LEEN los marts (instantáneo, con histórico) · sin pegar a  │
│  las APIs en el render · fallback a live solo si el mart está vacío    │
└───────────────────────────────────────────────────────────────────────┘
```

**Principio rector:** el usuario nunca espera una llamada a Meta/GA4. Lee tablas
pre-computadas que el background refresca por una cadencia según plan.

---

## 3. Ingesta / sync (el corazón del escalado)

El plan previo (retrofit de crons de Drean per-tenant) es correcto en el **qué**; para
**cientos** de tenants falta el **cómo orquestar**: un **GitHub Action único NO alcanza**
(serializa, ventana 6h, una falla arrastra el lote). Hace falta **fan-out**.

### 3.1 Orquestación
- **Scheduler** dispara N veces/día → enumera `connections` activas → **encola un job por
  (tenant × fuente)**.
- **Cola + workers**: concurrencia controlada (10-25 en paralelo), reintentos con backoff,
  **dead-letter**. Recomendado: **Inngest** o **Trigger.dev** (managed, fan-out + retries +
  observabilidad, integra con Next/Vercel). Alternativa self-host: `pg_cron` + `pgmq` (cola
  en Postgres) + worker en Railway (donde ya vive Nango).

### 3.2 Incrementalidad (clave de costo y velocidad)
- **Backfill** al conectar (una vez): 13-25 meses.
- **Sync diario incremental**: solo ventana reciente (Meta ads: ~7-14 días porque las
  métricas maduran; IG Stories: 24-48h; GA4: hasta ayer). **Upsert idempotente** por clave
  natural (tenant, fecha, entidad) → reintentos sin duplicar.

### 3.3 Rate limits (por proveedor)
- Límite Meta = **por token de cliente** (cada uno el suyo) **y** por app. Aun así:
  **token-bucket por token** + leer headers `X-Business-Use-Case-Usage` y **backoff** al
  acercarse al 100%. Batch donde se pueda (Meta batch, GA4 `batchRunReports`). Tope de
  concurrencia global para no saturar el límite app-level de Meta.

### 3.4 Cadencia por plan (palanca de costo + UX)
- Insight 1x/día · Optimize 2x/día · Accelerate cada 6h + on-demand. Volátiles (IG Stories)
  más seguido solo en planes altos. Botón "actualizar ahora" con throttle.

### 3.5 Creativos / thumbnails
- Rehostear a Object Storage con key estable por ad + **thumbnail HQ de video**
  (`/{video_id}/thumbnails`), servir por CDN — como Drean (`meta-image-mirror`). Elimina el
  proxy en vivo y la caducidad.

---

## 4. Almacenamiento y modelo de datos

- **Marts agregados por tenant** (lecturas chicas y rápidas): `fact_pauta_monthly`,
  `fact_web_monthly`, `fact_redes_monthly`, `dim_creatives`, etc. — con `tenant_id` + periodo.
  Los KPIs mensuales son **pocas filas por cliente** → baratísimo de guardar y leer.
- **Raw landing** opcional con **TTL corto (30-90 días)**. **OJO — driver de costo #1:** la
  data **diaria cruda** pesa (la web de Drean, GA4 `web_landing_daily`, fue **8 GB para UNA
  marca**). A cientos de clientes: **guardar agregados siempre; raw solo con TTL, o no
  guardar raw y recomputar desde la API en el backfill**.
- **Pooling obligatorio**: Supabase **Supavisor** (transaction mode) — sin él las lambdas de
  Vercel agotan conexiones (el problema #1 de serverless+Postgres).
- **Particionado**: `fact_*_daily` por rango de fecha (mensual) y/o por `tenant_id` (hash)
  cuando crezca; índices `(tenant_id, periodo)`. **Retención**: mensuales para siempre;
  diarios 13-25 meses; raw 30-90 días.
- **Object storage + CDN**: creativos/miniaturas en bucket con CDN (Supabase Storage trae
  CDN; o **Cloudflare R2**, egress gratis, mejor a escala). Key por `tenant/ad`.
- **Cache compartido**: **Upstash Redis** (serverless) para resultados calientes de
  dashboards + **token-buckets** de rate limit compartidos entre instancias → reemplaza el
  `ttl-cache` en memoria.

---

## 5. Seguridad (multi-tenant serio)

1. **Tokens OAuth** siempre en Nango (cifrados), nunca en la DB en claro. Nango refresca.
2. **Aislamiento de tenant** — riesgo #1:
   - **RLS en todas las tablas** por `tenant_id` (defensa en profundidad). Los **workers usan
     service-role (bypass RLS)** → el scoping por `tenant_id` en el worker debe **auditarse**
     (un bug filtra data cruzada). Tests que verifiquen que ninguna query devuelve otro tenant.
   - Lecturas del dashboard con cliente SSR (RLS on) → doble red.
3. **Secretos**: App Secret Meta, `NANGO_SECRET_KEY`, `NANGO_ENCRYPTION_KEY` (inmutable, backup
   en gestor de contraseñas — si se pierde, se pierden todas las credenciales), developer
   tokens, service-role key → env server-only, rotación. Los diag `/api/diag/*` devuelven
   tokens en URLs → protegerlos detrás de auth/rol, nunca públicos.
4. **PII / compliance**: hay datos personales (usernames de comentarios, y sobre todo **leads
   de Lead Ads**). Implica: **borrado por tenant** (right to be forgotten: marts + raw +
   storage + conexión Nango al dar de baja), DPA, minimizar retención de PII, y considerar
   **residencia de datos** (región Supabase) si hay clientes UE.
5. **App Review / verificación** por plataforma (Meta, Google, TikTok) — **requisito legal**
   para operar con clientes externos. Estado y runbooks en `bip-platform-handoff.md`.
6. **Webhooks firmados** (Nango, Meta) + verificación de firma; crons detrás de `CRON_SECRET`.
7. **Least privilege**: scopes mínimos por feature; separar lectura de escritura.

---

## 6. Eficiencia y performance

- **Dashboards O(filas-mart)**: leer decenas de filas, no recomputar (objetivo <300ms).
- **Sync incremental + batch**; sin N+1 en el sync.
- **Pre-agregación** (summary tables / vistas materializadas refrescadas por el sync) para lo
  caro — como ya hizo Drean con `web_monthly_by_category`, `trade_monthly`, `fs_precomputed`.
- **CDN** para estáticos y creativos. **Fluid compute**: al sacar el fetch del request, la
  función del dashboard queda liviana → menos costo y cold-starts.

---

## 7. Costos (drivers, estimación, control)

**Drivers:** (1) **Storage** — dominado por raw diario si se guarda; agregados = centavos.
(2) **Cómputo de sync** — nº tenants × fuentes × cadencia. (3) **Duración de función Vercel**
— baja mucho al no hacer fetch en el render. (4) **APIs** Meta/GA4/TikTok gratis (pagás en
cuota, no en $); **OpenAI** SÍ cuesta por token (features IA — el gasto variable real).

**Infra fija:** Vercel Pro (~US$20) + Supabase Pro (~US$25 + add-ons) + Railway (Nango,
~US$5-20) + Upstash (uso, bajo) + cola managed (Inngest/Trigger free tier → uso).

**Marginal por cliente/mes** (guardando **solo agregados**): storage centavos, sync ~1-3 min
worker/día, egress mínimo → **centavos a ~US$1**, salvo el uso de **OpenAI** (según cuánta
IA consuma). Se dispara si se guarda **raw diario de todos** → por eso la regla agregados+TTL.

**Controles:** cadencia por plan (planes altos pagan más frecuencia), retención/TTL agresivo
en raw, batch, cuotas de IA por plan.

---

## 8. UX

- **Frescura visible** ("Actualizado hace 3 h") + badge si está atrasado.
- **Onboarding / primer backfill**: al conectar una fuente el backfill tarda → estado
  **"Sincronizando tus últimos 12 meses…"** con progreso, mostrando lo que llega. Nunca
  pantalla vacía sin explicación.
- **Fallos elegantes**: si un sync falla, mostrar la data anterior + banner en vez de romper.
- **Dashboards instantáneos** (leen marts) → percepción de producto sólido.
- **"Actualizar ahora"** con throttle. **Plan gating** por capacidades (seam en `lib/plan.ts`).
- **Multi-cuenta / multi-marca** por tenant.

---

## 9. Observabilidad y confiabilidad

- **`sync_runs`** (tenant, fuente, inicio, fin, status, filas, error) + dashboard interno.
- **Watchdog de frescura** por tenant (si no actualizó en > SLA, alerta) — patrón de Drean
  (`watchdog.yml` + Issue).
- **Sentry** (app + workers) con `tenant_id` en el scope. Reintentos idempotentes + DLQ.
- **Backups**: Supabase PITR. Runbooks: API que cambia, token vencido/revocado (re-consent).

---

## 10. Stack recomendado (decisiones)

| Necesidad | Recomendación | Estado |
|---|---|---|
| OAuth/tokens | **Nango self-host (Railway)** | ✅ hecho |
| Control plane / DB | **Supabase Postgres + Supavisor (pooling)** | DB ✅ · pooling **falta** |
| Orquestación de sync | **Inngest / Trigger.dev** (o `pg_cron`+`pgmq`+worker Railway) | falta |
| Cache / rate-limit | **Upstash Redis** | falta (hoy in-memory) |
| Object storage + CDN | **Supabase Storage** (o **Cloudflare R2**) | falta (hoy proxy) |
| Billing | **Stripe** (o Paddle/Lemon Squeezy) | falta cablear |
| Observabilidad | **Sentry** + `sync_runs` + watchdog | falta |
| Hosting app | **Vercel** | ✅ |

---

## 11. Plan de migración por fases (incremental, sin romper la demo)

**Fase 0 — Fundaciones (1-2 días).** Supavisor pooling · Upstash (reemplaza `ttl-cache`) ·
tabla `sync_runs`. Sin cambiar UX.

**Fase 1 — Pauta pull→DB (2-3 días).** Tablas `fact_pauta_monthly` + `dim_creatives` (con
thumbnail mirroreado). Endpoint/worker `sync-pauta` que por tenant corre `getPautaFull` y
**escribe** (reusa el motor). `/performance` lee la tabla con **fallback a live**. Scheduler
diario (1 fuente, pocos tenants = 1 Action alcanza para arrancar).

**Fase 2 — Todas las fuentes + mirror (3-4 días).** Redes, Web (GA4), Google Ads/TikTok
cuando estén. Rehost de creativos a Storage/CDN. Marts + pre-agregados.

**Fase 3 — Orquestación a escala (2-3 días).** Migrar el scheduler a **cola con fan-out**
(Inngest/Trigger.dev): un job por tenant×fuente + concurrencia + reintentos + DLQ. Cadencia
por plan. Watchdog de frescura + Sentry.

**Fase 4 — Hardening (continuo).** Particionado + retención · **borrado por tenant**
(compliance) · tests de aislamiento · App Reviews (Meta/Google/TikTok) · read replica si hace
falta · residencia de datos.

---

## 12. Riesgos y mitigaciones

- **Aislamiento de tenant** (workers en service-role) → tests automáticos + review estricto.
- **Cambios de API** → adaptadores por proveedor + monitoreo.
- **Caducidad/revocación de tokens** → Nango refresh + estado "reconectar" en UX.
- **Explosión de storage por raw** → agregados + TTL.
- **Costo de IA (OpenAI)** → cuotas por plan + caché de resultados.
- **Rate limits** → token-bucket por token + backoff con headers de Meta.
- **Trámites de producción** (verificación Meta/Google/TikTok) → **camino crítico externo**
  (semanas), arrancarlos en paralelo YA.

---

## TL;DR

El plan previo resolvió **cómo conectar** (Nango self-host ✅) y **cómo cobrar/gatear**
(Stripe + capabilities). Falta el **cómo ingerir y servir a escala**: mover el fetch a
**background con cola fan-out por tenant**, guardar **agregados por tenant** (con Supavisor
pooling), **rehostear creativos**, **caché compartida (Redis)**, y que los dashboards **lean
marts**. Con eso: dashboards instantáneos, sin rate limits, con histórico, costo marginal por
cliente muy bajo, listo para cientos. El camino crítico NO es técnico (~2-3 semanas por fases)
sino las **verificaciones** de Meta/Google/TikTok — largarlas en paralelo ya.
