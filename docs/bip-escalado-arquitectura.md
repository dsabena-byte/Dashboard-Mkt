# BIP — Arquitectura de escalado a cientos de clientes

> Análisis de infraestructura para llevar BIP del modelo actual (fetch en vivo, 1-2
> clientes / demo) a un SaaS multi-tenant que sirva **cientos de clientes** con la
> profundidad de dashboards de Drean. Cubre diagnóstico, ingesta de datos,
> almacenamiento, seguridad, eficiencia, costos, UX, observabilidad, stack y plan
> por fases. Escrito para decidir e implementar, no para leer una vez.
>
> Stack actual: **Next.js (App Router) en Vercel** · **Supabase** (Postgres + Auth +
> Storage) · **Nango self-host en Railway** (OAuth/tokens) · OpenAI (features IA).
> Fuentes por cliente: Meta (ads + orgánico), GA4, TikTok, Google Ads (pendiente).

---

## 1. Diagnóstico del estado actual

**Cómo funciona hoy:** cada dashboard (server component, `dynamic="force-dynamic"`)
consulta las APIs de la plataforma **en vivo en cada request**, con un **caché en
memoria de 5 min** (`lib/ttl-cache.ts`). Motores: `getPautaFull` (Meta ads),
`getRedesForTenant` (IG/FB orgánico), GA4 inline. Multi-tenant por `tenant_id` + RLS;
tokens en Nango; selección de cuentas en `connections.config`.

**Por qué NO escala a cientos de clientes (cuellos reales):**

1. **Rate limits de las plataformas.** Cada carga pega a Meta/GA4 con el token del
   cliente. Ya vimos el `Application request limit reached` con UNA cuenta grande
   (Mabe, 202 ads). Con muchos usuarios activos = throttling constante. Meta aplica
   límites por app **y** por usuario (BUC — Business Use Case).
2. **Caché en memoria = no compartida.** Vive por instancia serverless (lambda). Con
   Vercel escalando horizontalmente, cada instancia tiene su propio caché → hit-rate
   bajo, y en frío se recomputa todo. No sirve como caché real multi-instancia.
3. **Cómputo pesado en el request.** `getPautaFull` tardó ~14,5s midiéndolo (insights
   + campañas + ads edge paginada + thumbnails de video). Eso NO puede vivir en el
   camino del usuario a escala: mata la UX y consume duración de función (costo).
4. **Sin histórico.** Si Meta borra/archiva un ad, se pierde su dato. No hay serie
   temporal propia → no se puede hacer YoY real, ni auditar, ni recalcular.
5. **Miniaturas efímeras.** Las URLs de fbcdn caducan (por eso el proxy `/api/img`).
   A escala hay que rehostearlas (como Drean con `meta-image-mirror`).
6. **Conexiones a Postgres.** Serverless + Postgres = explosión de conexiones. Sin
   pooler, cientos de lambdas concurrentes agotan el pool de Supabase.

**Conclusión:** el modelo *live* es correcto para demo. Para cientos de clientes hay
que separar **ingesta (background)** de **servicio (lectura)** — el patrón de Drean,
pero orquestado para N tenants.

---

## 2. Arquitectura objetivo (visión)

Tres planos desacoplados:

```
┌─────────────────────────────────────────────────────────────────────┐
│  INGESTA (background, por tenant)                                     │
│  Scheduler → Cola de jobs (fan-out por tenant×fuente) → Workers       │
│    workers: getToken(Nango) → fetch API → transform → UPSERT DB       │
│    + mirror de thumbnails a Object Storage/CDN                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ALMACENAMIENTO                                                       │
│  Postgres (Supabase): raw landing (TTL corto) + marts agregados      │
│    por tenant (fact_*_daily / *_monthly) · Object Storage (creativos)│
│  Cache compartido (Redis/Upstash) para lecturas calientes + rate lim │
└───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICIO (Next.js/Vercel)                                            │
│  Dashboards LEEN los marts (rápido, con histórico) · sin pegar a las  │
│  APIs en el render · fallback a live solo si el mart está vacío       │
└─────────────────────────────────────────────────────────────────────┘
```

**Principio rector:** el usuario nunca espera una llamada a Meta/GA4. Lee tablas
pre-computadas. La data se refresca en background con una cadencia por plan.

---

## 3. Ingesta / sync (el corazón del escalado)

Un **cron de GitHub Actions único** (como Drean) **no alcanza** para cientos de
tenants: serializa, tiene ventana de 6h, y una falla arrastra el lote. Se necesita
**orquestación con fan-out**.

### 3.1 Orquestación
- **Scheduler**: dispara N veces/día. Enumera tenants activos (`connections` con
  `status='active'`) y **encola un job por (tenant × fuente)**.
- **Cola + workers**: procesan con **concurrencia controlada** (ej. 10-25 jobs en
  paralelo), reintentos con backoff, y **dead-letter** para los que fallan repetido.
- **Opciones de stack** (ver §10): Inngest / Trigger.dev (managed, fan-out + retries
  + observabilidad, integra con Next/Vercel) — recomendado; o Supabase `pg_cron` +
  `pgmq` (cola en Postgres) + worker en Railway. Evitar depender de un solo Action.

### 3.2 Incrementalidad (clave de costo y velocidad)
- **Backfill** al conectar (una vez): traer 13-25 meses.
- **Sync diario incremental**: solo ventana reciente (Meta ads: últimos ~7-14 días
  porque las métricas maduran; IG Stories: 24-48h; GA4: hasta ayer). **Upsert** por
  clave natural (tenant, fecha, entidad).
- **Idempotencia**: cada job puede reintentarse sin duplicar (upsert + `if_version` /
  clave única).

### 3.3 Rate limits (por proveedor)
- El límite de Meta es **por token de usuario** (cada cliente el suyo) **y** por app.
  Aun así, escalonar: token-bucket **por token** + leer los headers
  `X-Business-Use-Case-Usage` de Meta y **backoff** cuando se acerca al 100%.
- Batch donde se pueda (Meta batch API, GA4 `batchRunReports`).
- Concurrencia global tope para no saturar la app-level rate limit de Meta.

### 3.4 Cadencia por plan (palanca de costo y UX)
- Insight (básico): 1x/día. Optimize: 2x/día. Accelerate: cada 6h + on-demand.
- Volátiles (IG Stories) más seguido solo en planes altos.
- Botón "actualizar ahora" con throttle (1 cada X min) para no abusar.

### 3.5 Creativos / thumbnails
- Rehostear a Object Storage (Supabase Storage o R2) con key estable por ad, +
  thumbnail HQ de video (`/{video_id}/thumbnails`). Sirve por CDN. Igual que Drean
  (`meta-image-mirror`). Elimina el proxy en vivo y la caducidad.

---

## 4. Almacenamiento y modelo de datos

### 4.1 Esquema (marts por tenant)
- **Marts agregados** para los dashboards (lecturas chicas y rápidas):
  `fact_pauta_monthly`, `fact_web_monthly`, `fact_redes_monthly`, `dim_creatives`,
  etc. — todo con `tenant_id` + periodo. Los KPIs mensuales son **pocas filas por
  cliente** (12/año × KPIs) → baratísimo de guardar y leer.
- **Raw landing** (opcional, TTL corto 30-90 días) para recomputar sin re-pegar a la
  API. **OJO:** la data **diaria cruda** es el gran driver de storage — la web de
  Drean (GA4 `web_landing_daily`) fue **8 GB para UNA marca**. A cientos de clientes,
  guardar raw diario de todos es caro. Regla: **guardar agregados siempre; raw solo
  con TTL, o directamente no guardar raw y recomputar desde la API en el backfill**.

### 4.2 Escala de Postgres
- **Pooling obligatorio**: Supabase **Supavisor** (transaction mode). Sin él, las
  lambdas de Vercel agotan conexiones. Es EL problema #1 de serverless+Postgres.
- **Particionado**: `fact_*_daily` particionadas por rango de fecha (mensual) y/o por
  `tenant_id` (hash) cuando el volumen crezca. Índices `(tenant_id, periodo)`.
- **Retención**: mensuales para siempre; diarios 13-25 meses; raw 30-90 días.
- **Read replica** si las lecturas de dashboards crecen (Supabase lo ofrece en tiers
  altos). En general los marts son tan chicos que no hará falta pronto.

### 4.3 Object storage + CDN
- Creativos/miniaturas en bucket público con CDN (Supabase Storage ya trae CDN, o
  Cloudflare R2 — egress gratis, más barato a escala). Key por `tenant/ad`.

### 4.4 Cache compartido
- **Upstash Redis** (serverless, pago por request): resultados calientes de
  dashboards + **token buckets** de rate limit compartidos entre instancias. Reemplaza
  el `ttl-cache` en memoria (que no comparte entre lambdas).

---

## 5. Seguridad (multi-tenant serio)

1. **Tokens OAuth**: SIEMPRE en Nango (cifrados), nunca en la DB de la app en claro.
   Nango refresca. El worker pide el token al momento de usarlo.
2. **Aislamiento de tenant** — el riesgo #1 de un SaaS multi-tenant:
   - **RLS en todas las tablas** por `tenant_id` (defensa en profundidad) — pero los
     **workers usan service-role (bypass RLS)**, así que el scoping por `tenant_id`
     en el código del worker debe ser **auditado** (un bug filtra data cruzada).
   - Tests automáticos que verifiquen que ninguna query devuelve otro tenant.
   - Las lecturas del dashboard van con el cliente SSR (RLS on) → doble red.
3. **Secretos**: App Secret Meta, Nango secret, developer tokens, service-role key →
   env vars server-only, rotación periódica. Nunca al cliente ni a repos. (El diag
   `/api/diag/*` devuelve tokens en URLs → protegerlo detrás de auth/rol, no público.)
4. **PII / compliance**: hay datos personales — usernames de comentarios, y sobre
   todo **leads de Lead Ads** (`leads_retrieval`). Implica:
   - **Borrado por tenant** (right to be forgotten): un job que borra TODO lo de un
     tenant (marts + raw + storage + conexión Nango) al dar de baja.
   - Política de privacidad + DPA; minimizar retención de PII.
   - Considerar residencia de datos si hay clientes UE (región Supabase).
5. **App Review / verificación** por plataforma (Meta, Google, TikTok) — **requisito
   legal para producción multi-cliente**, no opcional. (Meta: Business Verification +
   App Review; Google: brand/OAuth verification + acceso; TikTok: review.)
6. **Webhooks firmados** (Nango, Meta) + verificación de firma; endpoints cron detrás
   de `CRON_SECRET`; rate-limit del "actualizar ahora".
7. **Least privilege**: scopes mínimos por feature; separar lectura de escritura.

---

## 6. Eficiencia y performance

- **Dashboards O(filas-mart)**: leer decenas de filas, no recomputar. Objetivo <300ms.
- **Sync incremental + batch**: no re-bajar el año entero cada día; batch de la API.
- **Concurrencia tuneada** al límite de cada proveedor; sin N+1 en el sync.
- **Pre-agregación** (summary tables / vistas materializadas refrescadas por el cron)
  para lo caro (agregaciones por categoría/canal), como ya hizo Drean con
  `web_monthly_by_category`, `trade_monthly`, `fs_precomputed`.
- **CDN** para estáticos y creativos.
- **Fluid compute / duración de función**: al sacar el fetch del request, la función
  del dashboard es liviana → menos costo y cold-starts.

---

## 7. Costos (modelo y control)

**Drivers de costo:**
- **Storage** (Supabase): dominado por **raw diario** si se guarda. Agregados = centavos.
- **Cómputo de sync** (workers): proporcional a nº de tenants × fuentes × cadencia.
- **Duración de función Vercel**: baja mucho al no hacer fetch en el render.
- **APIs**: Meta/GA4/TikTok son gratis (pagás en cuota/rate limit, no en $). **OpenAI**
  sí cuesta por token (features IA — copiloto, análisis UGC) → el gasto variable real.
- **Infra fija**: Vercel Pro (~US$20) + Supabase Pro (~US$25 + add-ons) + Railway
  (Nango, ~US$5-20) + Upstash (pago por uso, bajo) + cola managed (Inngest/Trigger
  free tier y luego uso).

**Estimación gruesa por cliente/mes** (guardando **solo agregados**): storage ~centavos,
sync ~1-3 min de worker/día, egress mínimo. El costo marginal por cliente es **muy bajo**
(orden de centavos a ~US$1), salvo el uso de **OpenAI** (depende de cuánto IA consuma).
El costo se vuelve relevante si se guarda **raw diario de todos** → por eso la regla de
agregados + TTL.

**Controles:** cadencia por plan (planes altos pagan más frecuencia), retención/TTL
agresivo en raw, batch, y cuotas de IA por plan.

---

## 8. UX

- **Frescura visible**: "Actualizado hace 3 h" en cada dash; badge si está atrasado.
- **Onboarding / primer backfill**: al conectar una fuente, el backfill tarda → estado
  **"Sincronizando tus últimos 12 meses…"** con progreso, y ir mostrando lo que llega.
  Nunca una pantalla vacía sin explicación.
- **Fallos elegantes**: si un sync falla, mostrar la data anterior + banner
  ("no pudimos actualizar, reintentando") en vez de romper.
- **Velocidad**: dashboards instantáneos (leen marts) → percepción de producto sólido.
- **"Actualizar ahora"** con throttle para el usuario impaciente.
- **Plan gating**: qué dashboards y qué frecuencia según plan (ya está el seam en
  `lib/plan.ts`).
- **Multi-cuenta / multi-marca** por tenant (varios ad accounts / propiedades).

---

## 9. Observabilidad y confiabilidad

- **Estado de sync por tenant/fuente**: tabla `sync_runs` (tenant, fuente, inicio, fin,
  status, filas, error). Dashboard interno de salud.
- **Watchdog de frescura**: si un tenant no actualizó en > SLA (ej. 36h), alerta
  (Slack/email) — Drean ya tiene ese patrón (`watchdog.yml` + Issue).
- **Errores**: Sentry (app + workers) con `tenant_id` en el scope.
- **Reintentos idempotentes + dead-letter**; alertar cuando algo cae al DLQ.
- **Backups**: Supabase PITR (point-in-time recovery) en tier Pro.
- **Runbooks**: qué hacer si un proveedor cambia su API / caduca un token / se revoca
  un permiso (re-consent del cliente).

---

## 10. Stack recomendado (decisiones concretas)

| Necesidad | Recomendación | Por qué |
|---|---|---|
| Orquestación de sync | **Inngest** o **Trigger.dev** (managed) | fan-out por tenant, reintentos, concurrencia, observabilidad, DX con Next/Vercel. Alternativa self-host: `pg_cron` + `pgmq` + worker Railway. |
| Base de datos | **Supabase Postgres + Supavisor** (pooling) | ya en uso; pooling es imprescindible con serverless. Particionar marts a futuro. |
| Cache compartido / rate-limit | **Upstash Redis** | serverless, compartido entre lambdas; reemplaza el caché en memoria. |
| Object storage + CDN | **Supabase Storage** (o **Cloudflare R2**) | creativos/miniaturas rehosteados; R2 gana en egress a escala. |
| Tokens OAuth | **Nango** (ya) | cifrado + refresh + multi-provider. |
| Observabilidad | **Sentry** + tabla `sync_runs` + watchdog | errores + frescura por tenant. |
| Hosting app | **Vercel** (ya) | con la ingesta afuera, la app queda liviana. |

---

## 11. Plan de migración por fases (incremental, sin romper la demo)

**Fase 0 — Fundaciones (1-2 días).** Supavisor pooling; Upstash para caché compartido
(reemplaza `ttl-cache`); tabla `sync_runs`. Sin cambiar UX.

**Fase 1 — Pauta al modelo pull→DB (2-3 días).** Tablas `fact_pauta_monthly` +
`dim_creatives` (con thumbnail mirroreado). Endpoint `/api/cron/sync-pauta` que, por
tenant, corre `getPautaFull` y **escribe** (reusa el motor). Dashboard `/performance`
lee la tabla con **fallback a live**. Scheduler diario (1 fuente, pocos tenants = 1
Action alcanza para arrancar).

**Fase 2 — Todas las fuentes + mirror (3-4 días).** Redes, Web (GA4), y Google
Ads/TikTok cuando estén. Rehost de creativos a Storage/CDN. Marts + pre-agregados.

**Fase 3 — Orquestación a escala (2-3 días).** Migrar el scheduler a cola con fan-out
(Inngest/Trigger.dev): un job por tenant×fuente, concurrencia + reintentos + DLQ.
Cadencia por plan. Watchdog de frescura + Sentry.

**Fase 4 — Hardening (continuo).** Particionado + retención, borrado por tenant
(compliance), tests de aislamiento, App Reviews de las 3 plataformas, read replica si
hace falta, residencia de datos.

---

## 12. Riesgos y mitigaciones

- **Aislamiento de tenant** (workers en service-role) → tests automáticos + code review
  estricto del scoping por `tenant_id`.
- **Cambios de API de las plataformas** → capa de adaptadores por proveedor + monitoreo.
- **Caducidad/revocación de tokens** → Nango refresh + estado "reconectar" en UX.
- **Explosión de storage por raw** → agregados + TTL, no guardar raw de todos.
- **Costo de IA (OpenAI)** → cuotas por plan, caché de resultados.
- **Rate limits** → token-bucket por token + backoff con headers de Meta.
- **Trámites de producción** (Meta/Google/TikTok verificación) → arrancarlos YA, son
  el camino crítico externo (semanas), no de código.

---

## TL;DR para decidir

El código de los **motores ya existe**; lo que falta es **separar ingesta de servicio**:
mover el fetch a **background (cola con fan-out por tenant)**, guardar **agregados por
tenant** en Postgres (con pooling), **rehostear creativos**, y que los dashboards **lean
tablas**. Con eso: dashboards instantáneos, sin rate limits, con histórico, costo marginal
por cliente muy bajo, y listo para cientos de clientes. El camino crítico NO es técnico
(son ~2-3 semanas de build por fases) sino los **trámites de verificación** de Meta/
Google/TikTok para operar con clientes externos — conviene largarlos en paralelo ya.
