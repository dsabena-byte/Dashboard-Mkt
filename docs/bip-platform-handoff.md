# BIP Platform — Handoff (proyecto APARTE de Drean)

> **Nombre de la empresa (24-sep-2026):** la empresa detrás de BIP hoy es **ROQUÉ Research Solutions**.
> "ROQUÉ Marketing Insights" era el nombre de fantasía / razón social **anterior** (así figura todavía en el
> portfolio de Meta que hospeda la app y en textos legales viejos). Al actualizar docs legales / Meta Business,
> usar el nombre nuevo y cuidar que coincida con la documentación de la verificación del negocio.


> Proyecto NUEVO: convertir el dashboard de Drean en un **SaaS self-serve multi-tenant**
> (BIP). **NO se toca nada de Drean.** Este doc es la memoria para retomar en cualquier
> sesión. El código se entregó al user como zips (ver abajo); el scratchpad es efímero.

## Qué es
Plataforma donde **el cliente se autogestiona**: conecta sus fuentes de un clic (OAuth),
elige/sube de plan pagando, suma add-ons, maneja usuarios — con mínima participación del
consultor. Segura, escalable (objetivo: 50 clientes en simultáneo), sin perder funcionalidad.

## MODELO DE PLANES v2 (sep-2026 — REEMPLAZA la matriz vieja de bip.html)
> Nuevo eje de valor definido por el user: **el salto entre planes NO es "más dashboards"
> sino MÁS CAPAS DE INFORMACIÓN + la CONSULTORÍA que se apoya en esa info.**

**Transversal a TODOS los planes (nuevo):**
- **Capa de IA incluida en todos** — ya no es add-on pago (no se puede cobrar aparte). El add-on
  "Copiloto IA" se ELIMINA como cobro; va incluido en Insight/Optimize/Accelerate.
- **Alertas + reportes automatizados incluidos en todos** — funcionalidad NUEVA (aún NO existe en
  la plataforma, hay que construirla): (a) insights inteligentes con IA dentro de los informes;
  (b) alertas de rendimiento sobre Metas y Objetivos; (c) envío recurrente automático de informes
  por **email o WhatsApp**. (Ejemplos que dio el user en imágenes.)

**Insight** (base) — solo data que provee el cliente, sin competencia ni research:
- **Todos los dashboards operativos** (incluye Trade Mkt y **Resultados Comerciales** =
  facturación/share, que es data del cliente → va en TODOS los planes) + IA + alertas/reportes.
- **SIN capa de competencia** y sin research de mercado.

**Optimize** (= Insight + bloque de competencia):
- Agrega la **capa de competencia**, que aplica a **Redes, Web (vía SimilarWeb) y SEO** (esos 3
  tienen data competitiva).
- Con esa info: **diagnósticos y planes de acción específicos** basados en el competitivo.
- Incluye **4 horas de consultoría mensual**. Es "un bloque adicional".

**Accelerate** (= Optimize + bloque de research de mercado):
- Tiene todo lo de Optimize (incl. competencia).
- Agrega **research de mercado**: **Top of Mind, Share of Mind, intención de compra, funnel de
  decisión de compra** (capa tipo Kantar = **Salud de Marca**).
- Incluye **8 horas de consultoría mensual** → diagnóstico TOTAL de estrategia, negocio y planes.

**Correcciones del user (sep-2026):**
- **GfK / "Mercado" SE SACA del modelo** — es específico, fuera de la oferta estándar de planes.
- **Resultados Comerciales** (facturación, share) = data del cliente → **TODOS los planes** (NO es
  research). OJO: en la nav de Drean el ítem "Resultados Comerciales" apuntaba a `/mercado` (GfK);
  en BIP es OTRO contenido (facturación/share) — hay que separar/relabelar.
- **Competencia = Redes + Web (SimilarWeb) + SEO** (no es solo Redes).
- **Research (Accelerate) = Salud de Marca** (TOM/SOM/intención/funnel), NO GfK.
- **SE SACAN los add-ons de contenido:** "Generación de contenidos" ($490) y "Adaptación de
  piezas a pauta" salen de la oferta. Sumado a que `ia` va incluido y `competitivo` pasa a Optimize
  → **el modelo de add-ons prácticamente desaparece** (queda por confirmar si sobrevive
  "Categoría extra" o algún otro). El eje de monetización pasa a ser **plan + horas de consultoría**.

**Free trial (sep-2026):** **Insight = 1 semana gratis** (free trial de entrada; "seguros de que
lo contratan"). **Optimize/Accelerate NO tienen prueba inicial.** Los **clientes que pagan Insight
desbloquean 15 días gratis de Optimize a partir del mes 4** (upsell). (El brief original decía
"todos los planes tienen semana gratis" pero enseguida "los otros no" → se interpretó así; confirmar.)
Ya reflejado en `bip.html` (badge en card Insight + nota bajo los tiers + FAQ).
**PRECIOS VIGENTES (sep-2026, REEMPLAZAN 490/990/1690):** Insight **USD 190/mes** (set-up 250),
Optimize **USD 390/mes** (set-up 350), Accelerate **USD 690/mes** (set-up 450). Set-up bonificado
(sin cargo) en plan de 12 meses. Ya en `bip.html` + `bip/pricing.html`. **Sincronizar
`lib/plan.ts` de la plataforma (`priceUsd`) cuando se redeploye bip-platform.**

**CRITERIO DE COMUNICACIÓN (clave, sep-2026):** **NUNCA comunicar "gratis"** — liderar con
"gratis" ancla el valor para abajo y le saca jerarquía a una plataforma premium. La prueba se
comunica desde la **confianza y la comprobación**: "Comprobalo una semana", "acceso completo sobre
tu propia operación", "estamos tan seguros del valor que te dejamos verlo antes de decidir". El
substrato comercial (sin cargo esa semana) se explica en la venta, NO se grita en la página. Igual
para Optimize: "accedés a Optimize para comprobar su impacto competitivo" (no "15 días gratis").

**Storytelling de conocimiento/expertise (sep-2026):** el user quiere reencuadrar BIP de
"plataforma de reporting" a **"plataforma de conocimiento y expertise"**. Puntos: cada dashboard,
indicador, plan cargado y definición de objetivo trae **contenido embebido que guía según las
mejores prácticas de ejecución del mercado**; detrás está **ROQUÉ Marketing Insights**, consultora
experta en investigación y marketing que trabaja con las marcas más importantes del mundo; "no
accedés solo a tecnología, accedés a un universo de conocimiento, know-how y expertise world-class".
Ya en `bip.html`: sección nueva **#expertise** (fondo navy) + hero + FAQ + link de menú "Conocimiento".
**OJO tensión:** antes el user quería BIP separado de la agencia; ahora pide **nombrar ROQUÉ** como
la credibilidad detrás (decisión explícita suya — es un "powered by", la separación de marca/dominio/
datos se mantiene). La funcionalidad de "contenido guía embebido por KPI/objetivo" **NO existe aún
en la plataforma** — hay que construirla (además de alertas/reportes).

**PENDIENTE (implementación, cuando el user confirme la tabla):**
- Reescribir `lib/plan.ts`: gating por **capacidades**, no solo por dashboard. Flags de plan:
  `ia` (todos), `alertsReports` (todos), `competitive` (Optimize+, afecta vistas de Redes/Web/SEO),
  `research`/Salud de Marca (Accelerate), `consultingHours` (0/4/8). Quitar addon `ia`; `competitivo`
  deja de ser add-on (pasa a feature de Optimize). Sacar Mercado(GfK) de la nav estándar.
- Construir la **funcionalidad de alertas + reportes automatizados** (email/WhatsApp) — NO existe aún.
- Actualizar `public/bip.html` (pricing + propuesta de valor) con este modelo.

## Arquitectura de identidades y conexiones (Google + Meta → Nango → BIP)
> Diagrama de referencia — cómo se vincula cada pieza. Google y Meta son ramas
> INDEPENDIENTES entre sí; solo se juntan en Nango + la plataforma.

```
RAMA GOOGLE (limpia, sin terceros):
  bip.explore@gmail.com  → dueña de → Google Cloud "BIP-GO"
     → OAuth Client (Client ID + Secret), consent verificado en bip-go.com
     → Client ID/Secret ─┐
                         │
RAMA META (via agencia): │
  Tu Facebook PERSONAL (admin, invisible al cliente)
     → miembro/Admin del Business "ROQUÉ Marketing Insights" (hospeda la app)
     → App "BIP Connector" (App ID + Secret) ─┐
                                              │
             ambos App-ID/Secret ────────────┴──► NANGO (guarda TODAS las llaves)
                                                     → PLATAFORMA BIP (bip-go.com)
                                                     → cada CLIENTE conecta SUS
                                                       propias cuentas (Google/Meta/…)
```
- **Google**: se posee TODO con solo el email (`bip.explore`) → sin agencia, sin persona-FB.
  Por eso fue limpio y ya está casi verificado (dominio bip-go.com verificado en Search Console).
- **Meta**: Meta OBLIGA a una persona + un Business. Se usa el **FB personal del user como admin**
  (ya administra Drean y otros — un FB puede administrar muchos Business sin riesgo; lo prohibido
  es tener DOS cuentas personales, no gestionar varios negocios) y el **Business de ROQUÉ como
  "casa" de la app** (atajo para saltear Business Verification). La invitación de Meta hay que
  aceptarla con el FB personal → pedirle a Diego (Diego Passamonte) que la reenvíe al **email del
  FB personal** con rol **Admin**. NO crear una 2da cuenta de FB (riesgo de ban por duplicada).
- **Único acoplamiento con la agencia**: el *registro* de la app "BIP Connector" vive en el Business
  de ROQUÉ. Todo lo operativo (Nango, plataforma, dominio, datos, clientes, facturación) es de BIP.
  **Reversible**: migrar la app a un Business propio de BIP (haciendo la Business Verification) el
  día que se quiera independencia total en Meta; Google ni se entera.
- **Comparten**: Nango + plataforma BIP + `bip-go.com` (homepage/privacy/terms del consent de las
  dos ramas). **NO comparten**: la infra de cada proveedor.
- Para el **cliente** es transparente: entra a BIP y ve "Conectar Google / Meta / TikTok"; cada
  botón usa la app que corresponde por detrás.

## Arquitectura técnica / escalado → ver `docs/bip-escalado-arquitectura.md`
> **Fuente de verdad de la arquitectura** (ingesta background + marts por tenant, Supavisor
> pooling, cola con fan-out, caché Redis, storage/costos, seguridad multi-tenant, UX, plan por
> fases para escalar a cientos de clientes). Este handoff queda como memoria de
> **producto/pricing/features y estado de trámites**; el detalle de arquitectura vive allá.

## Decisiones tomadas (no re-litigar)
- **Base = fork del dashboard de Drean** (trae los ~17 dashboards). Lo único nuevo es la
  capa de plataforma; Drean queda intacto.
- **Conexiones self-serve = Nango self-hosted** (OAuth + refresh de tokens, $0 hasta 1.000
  conexiones). La ÚNICA capa que cambia del pipeline: `process.env.TOKEN` → `getToken(tenant, provider)`.
- **Billing = Stripe** (MVP) — evaluar **Paddle/Lemon Squeezy** (merchant of record) por
  vender USD desde Argentina. Upgrade = cambio de price con prorrateo; add-on = subscription item;
  webhook firmado actualiza `tenants` → el gating cambia sin deploy.
- **Multi-tenant single-DB + RLS por `tenant_id`** (a escala; para clientes que exijan
  aislamiento físico → Supabase dedicado). Usa el seam `lib/tenant/` ya sembrado.
- **Planes (validados contra `public/bip.html`):** Insight $490 / Optimize $990 /
  Accelerate $1.690. Matriz de gating en `lib/plan.ts`. Add-ons: IA $250, competitivo,
  categoría extra, asesoramiento.
- **Scopes OAuth = SENSIBLES, no restringidos** (GA4 `analytics.readonly`, Ads `adwords`,
  Sheets `spreadsheets.readonly`) → **evita el CASA de Google ($500-4.500/año)**. NO usar
  `drive.readonly`.
- **DV360 NO tiene OAuth self-serve** → queda manual (reporte programado). SharePoint = app
  registration Azure. Research/facturación = manual. Esas se marcan "asistidas" en la UI.
- **Un solo "Conectar Google"** cubre Ads + GA4 + Sheets.

## Identidad y activos de BIP (creados)
- **Email/identidad:** `bip.explore@gmail.com` (Gmail dedicado, **2FA activada**). NO usar el
  personal ni el del trabajo. A futuro migrar a Workspace sobre el dominio.
- **Dominio:** **`bip-go.com`** (registrado en DonWeb). Nameservers ya apuntados a **Netlify**
  (`dns1..dns4.p02.nsone.net`) — **propagando** al momento del corte.
- **Meta:** la app irá bajo el **Business de la agencia del SOCIO** (el socio es socio de BIP →
  ahorra la Business Verification). Se pidió que agregue a `bip.explore@gmail.com` como **Admin
  del Business** (esperando). La app se llamará `BIP Connector`.
- **Sitio comercial:** deployado en **Netlify** (`ornate-sable-fff94e.netlify.app`), custom
  domain `bip-go.com` pendiente de propagación. Contenido: landing (de `public/bip.html`) +
  `/privacy` + `/terms`. Emails ya seteados a `bip.explore@gmail.com`. **Pendiente:** número de
  WhatsApp real (hoy placeholder `5491100000000`).

## Código entregado (zips que tiene el user — el scratchpad se pierde)
- **`bip-platform.zip`** (sep-2026, NUEVO — la capa de plataforma, **build validado**: `npm run
  build` OK en Next 16.3.4, TSC exit 0, todas las rutas compilan). Contenido (44 archivos):
  - **Control plane:** `supabase/migrations/0001_control_plane.sql` (tenants, tenant_users,
    connections, connection_events, billing_events + RLS con `is_member`/`is_owner` + triggers).
  - **Núcleo:** `lib/plan.ts` (planes + matriz de gating `canAccess`/`visibleModules`),
    `lib/connectors.ts` (registro oauth vs asistidas), `lib/tenant.ts` (`getCurrentTenant`),
    `lib/nango.ts` + `lib/connections.ts` (`getToken`, mismo patrón que la prueba), `lib/supabase/*`
    (SSR con RLS + service-role), `lib/billing/*` (stripe lazy + mapa price↔plan +
    `deriveFromSubscription`).
  - **Auth + shell:** `app/login` (magic link), `app/auth/callback`, `app/onboarding`,
    `proxy.ts` (gate de /dashboard y /cuenta; Next 16 usa `proxy`, no `middleware`),
    `app/(app)/layout.tsx` (sidebar gateado por plan) + `dashboard`.
  - **Autogestión:** `app/(app)/cuenta/{conexiones,plan,addons}` + `components/{connect-button,
    plan-actions,sidebar}`. Conexiones self-serve (Nango) + upgrade prorrateado + add-ons + portal.
  - **API:** `connect/[provider]`(+callback), `billing/{checkout,upgrade,addon,portal,webhook}`,
    `onboarding`. Webhook con firma verificada (raw body, runtime nodejs) + idempotencia.
  - **Infra + docs:** `infra/nango-railway/` (docker-compose + RUNBOOK del self-host),
    `docs/conectores.md` (provider keys + scopes verificados) + `docs/verificacion-google.md`.
  - **Gotcha resuelto en build:** el cliente de Stripe se instanciaba al importar → rompía el
    "collect page data" sin `STRIPE_SECRET_KEY`. Fix: `getStripe()` lazy (se crea al primer uso).
  - Es la **capa de plataforma**; los ~17 dashboards se traen del fork de Drean y se cuelgan del
    shell. El único cambio del pipeline es `process.env.TOKEN` → `getToken(tenant, provider)`.
- **`bip-app.zip`** — la PRUEBA del circuito (Google→Supabase→Nango→Sheets), ya deployada y
  validada end-to-end en Vercel (`bip-explore/bip-app`). Es el MVP mínimo, no la plataforma.
- **`bip-mvp.zip`** — starter production-ready de la plataforma (21 archivos, ~840 líneas):
  `supabase/migrations/0001_control_plane.sql` (tenants, connections, tenant_users, RLS),
  `lib/{plan,connections,nango,billing,tenant,supabase/server}.ts`, `middleware.ts`,
  `app/api/{connect/[provider](+callback), billing/{checkout,webhook}}`, y UI:
  `app/(app)/layout.tsx` (sidebar gateado), `cuenta/{conexiones,plan,addons}`, `onboarding`,
  `components/{connect-button,upgrade-button}.tsx`. README con arquitectura/file-tree/schema/
  endpoints/UI.
- **`bip-site.zip`** — sitio comercial (landing + privacy + terms + assets) ya deployado.
- **Legales:** `privacy.html` + `terms.html` (con cláusulas Google Limited Use + Meta Platform
  Data + borrado de datos).

## Artifacts (referencia, en claude.ai/code/artifact)
- **Kit de Conexión de Datos** (cliente): `32aef65c-f941-47ac-8b98-52677cf4f0ba`
- **Playbook Interno de Consultoría**: `be94cfa5-272e-442f-8cf5-d8578514834c`
- **Blueprint Plataforma BIP** (arquitectura completa): `e3898daa-c21e-4c6b-ab06-c6664d00ec02`

## Pendiente — pasos del USER (irreducibles, necesitan su identidad)
1. **Dominio:** esperar propagación de `bip-go.com` → verificar que carga con HTTPS.
2. **Meta:** socio lo agrega como Admin del Business → crear app `BIP Connector` → **App Review**.
3. **Google Cloud:** proyecto + APIs (Analytics/Ads/Sheets) + pantalla OAuth + **verificación**
   (scopes sensibles, usar `bip-go.com` como dominio verificado en Search Console).
4. **TikTok:** app de Marketing API.
5. **Infra:** cuentas GitHub / Vercel / Supabase / Stripe (con `bip.explore@gmail.com`).
6. **Nango:** deploy self-hosted (Railway/Fly).
7. **Repo:** fork de Drean → dropear `bip-mvp` → correr migración → `.env` → deploy.

## Pendiente — lo que puede hacer Claude (sin las cuentas del user)
- Guía paso a paso de **Google Cloud** (proyecto + APIs + OAuth + verificación).
- Guía de **setup de Nango** (integraciones Meta/Google/TikTok, scopes, session tokens).
- **Retrofit** de los crons al patrón `getToken(tenant, provider)` — mapa validado: los 8 crons
  que tocan credenciales son `meta-paid-sync, meta-fb-sync, ig-sync, publicar-contenido,
  google-ads-sync, ga4-web-traffic, tiktok-sync` (+ SEO/trends son propios, no del cliente).
- Runbook de deploy (Vercel + Supabase + variables).
- Resto de UI: `/cuenta/usuarios`, portal de billing, dashboard de estado de conexiones.

## Progreso de setup (sep-2026)
- ✅ Identidad `bip.explore@gmail.com` (2FA) + dominio `bip-go.com` (Netlify, SSL OK, público).
- ✅ Sitio comercial vivo (`bip-go.com` + /privacy + /terms).
- ✅ **Google Cloud** listo: proyecto + 3 APIs (Analytics Data / Ads / Sheets) + pantalla de
  consentimiento (branding con bip-go.com/privacy+terms) + 3 scopes sensibles (sin CASA) +
  **cliente OAuth Web** (redirect `https://api.nango.dev/oauth/callback`) + `bip.explore` como
  **usuario de prueba** (modo Testing).
- ✅ **Nango Cloud** (free, env `dev`, org BIP): integración **Google** (`provider=google`, Custom
  developer app con el Client ID/Secret propios + los 3 scopes) → **CONEXIÓN DE PRUEBA CREADA Y
  FUNCIONANDO** (el "Conectar Google" self-serve anda end-to-end).
- ✅ **CIRCUITO COMPLETO VALIDADO EN PRODUCCIÓN (Vercel) — el hito clave.** Se armó una app
  mínima `bip-app` (Next 16, App Router) que prueba el patrón end-to-end y se deployó:
  - **Infra creada:** GitHub `bip-explore/bip-app` (privado); Vercel team **BIP** (Hobby, slug
    `bip9`) importó el repo con la GitHub App instalada; Supabase control-plane (proyecto
    `czcfrzqioulhjfqkagcb`, tablas `tenants`/`connections`/etc. + RLS de la migración 0001).
  - **Env vars en Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
    `NANGO_HOST=https://api.nango.dev`, `NANGO_SECRET_KEY` (Secret Key del env `dev`),
    `NEXT_PUBLIC_NANGO_CONNECT_HOST=https://api.nango.dev`, `NEXT_PUBLIC_DEMO_TENANT=demo`.
  - **Prueba real:** en la app deployada → "Conectar Google" (self-serve, un clic, autoriza con
    `bip.explore`) → guardó la conexión en Supabase (tenant `demo`) → se pegó el ID de un Google
    Sheet propio → **devolvió los `values` reales del sheet** (`ok:true`). O sea: Supabase →
    `getToken(tenant,'google')` → Nango (token fresco, auto-refresh) → API de Google. **El
    corazón técnico de la plataforma quedó probado de punta a punta.**
  - Es el mismo patrón que van a usar TODOS los crons por cliente (Sheets hoy; GA4/Ads/Meta/
    TikTok = mismo `getToken`, distinto scope/provider).
  - **Código del test:** vive en el scratchpad como `bip-app/` (11 archivos de código +
    config); es un MVP de prueba, NO la plataforma final (esa es `bip-mvp.zip`). Si hay que
    retomar, está en `bip-explore/bip-app`.
- ⏳ Meta (sep-2026, DESTRABÁNDOSE): **la agencia YA avanzó con los permisos** y llegó un **email
  de Meta a `bip.explore@gmail.com`** (probablemente la **invitación al Business Manager de la
  agencia** como Admin). PENDIENTE, EN LA COMPU: (1) abrir el email y **aceptar la invitación**
  (confirmar que es Admin del Business de la agencia); (2) crear la app **`BIP Connector`** en
  developers.facebook.com ligada a ese Business; (3) Facebook Login + redirect al callback de Nango
  (Cloud por ahora: `api.nango.dev/oauth/callback`; self-host después); (4) App ID + Secret →
  integración **Meta en Nango** (provider `facebook`, scopes: `ads_read read_insights
  pages_read_engagement pages_show_list instagram_basic instagram_manage_insights
  business_management`); (5) probar; (6) **App Review** de Meta para clientes externos.
- ⏳ TikTok: idem (opcional).
- ⏳ Pendiente Google: **enviar la verificación OAuth** (necesita demo de la app viva) → después.
- ⏳ Deploy de la app (`bip-mvp`): repo + Supabase (migración 0001) + Vercel + env (Nango
  `NANGO_HOST`+`NANGO_SECRET_KEY`, Supabase, Stripe).
- **Gotchas del setup Nango+Google (no re-tropezar):** (1) los scopes van en "Agregar permisos
  manualmente", NO en el filtro; (2) la callback va en "URIs de redireccionamiento", NO en
  "Orígenes JavaScript"; (3) si el consent da 403 "nango.dev no verificó", es que la integración
  usaba la app de Nango (faltaba guardar el Custom developer app) o falta el usuario de prueba;
  (4) en modo Testing hay que agregar cada mail como **usuario de prueba** en "Público", y en el
  consent tocar "Configuración avanzada → Ir a BIP (no seguro) → Continuar".

## 🟢 SESIÓN 14-sep-2026 — modelo 4 tiers, pagos (Mercado Pago), builder, web→plan, login cerrado
> **Día de mucho avance.** Todo pusheado a `main` (bip-platform.vercel.app deploya solo) y a
> `main` de Dashboard-Mkt (para `bip.html`). Este bloque SUPERA partes del "MODELO DE PLANES v2"
> de más arriba (precios/set-up/trial). Repos: **app** = `dsabena-byte/bip-platform` (deploy `main`);
> **landing + memoria** = `dsabena-byte/Dashboard-Mkt` (`apps/web/public/bip.html`).

### 1) Modelo de 4 tiers (DEFINITIVO, reemplaza precios/set-up/trial de v2)
`lib/plan.ts` — `PlanId = insight_trial | insight | optimize | accelerate`:
- **insight_trial** = estado de prueba de **15 días** (SOLO Insight tiene trial). Desde el trial se
  puede **activar/pagar cualquiera** de los 3 planes directo.
- **insight** USD **190**/mes · set-up **150** · 1 usuario · 1 marca · 1 categoría · historia **12 meses** (desde ene del año en curso).
- **optimize** USD **390**/mes · set-up **250** · **4 usuarios** · 1 marca · **2 categorías** · historia **24 meses**.
- **accelerate** USD **690**/mes · set-up **350** · **10 usuarios** · 1 marca · **3 categorías** · historia **24 meses**.
- **Contratación 3 o 6 meses.** Set-up **bonificado a 6 meses**; **a 3 meses se prorratea** (set-up/3
  sumado a cada mensualidad, flat) — se aclara en cada card. `maxUsers()`, `historyStartYear()`,
  `hasFeature()`, `planRank/canAccessLink/visibleLinks`, `TRIAL_DAYS=15` viven en `lib/plan.ts`.

### 2) Gating del menú por tier (`NAV` en `lib/plan.ts`)
- **insight_trial:** Mapa, Seguimiento, Plan de Medios, Redes, Web.
- **insight** suma: **Resultados Comerciales** + **Inversión de Marketing**.
- **optimize** suma: **Optimización SEO**, **Trade Mkt**, y la **capa Competencia** en Redes/Web/SEO
  (tag "+ COMP"). **Mkt de Influencia** = optimize+ (marcado "pronto"), ubicado debajo de Web/Ecom.
- **accelerate** suma: **research** (en desarrollo).
- **Alertas NO va en el menú** — se embebe por dashboard (pedido del user).
- Inversión/Resultados/Trade son dashboards **manuales** → apuntan a `/tablero/<slug>` (builder).

### 3) Builder de tableros config-driven (dashboards manuales sin código por cliente)
Para Inversión / Resultados / Trade: el **cliente sube su planilla** y **mapea columnas → variantes
de gráfico BIP** (elige tipo de gráfico y qué va en cada eje; NO random). Piezas:
- `lib/sheet-engine.ts` (client-safe: tipos + `inferColumns` + `shapeWidget`), `lib/sheet-dashboards.ts`
  (server-only: persistencia), `components/dash-builder/{widgets,dashboard-view,builder}.tsx`.
- Rutas `/tablero/[slug]` (+ `/editar`); APIs `/api/dashboards`, `/api/dashboards/dataset`,
  `/api/datasets` (upload → devuelve id). Fases 1-3 completas (tasks #21-23).

### 4) Pagos — Mercado Pago (gateway elegido p/ Argentina), diseño "sin fisuras"
- **Suscripción por preapproval:** `lib/billing/mercadopago.ts` — `mpToken()`, `getUsdArsRate()`,
  `mpAmountArs(plan)`, `setupAmountArs(plan)`, `createPreapproval({plan,months})` (end_date=now+months),
  `getPreapproval` (autoritativo, trae monto), `verifyWebhookSignature` (HMAC-SHA256 del manifest
  `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, **anti-replay 600s, fail-closed si no hay secret**).
- **Checkout** `app/api/billing/mp/checkout/route.ts`: solo owner/admin; `monthly = mpAmountArs(plan)`;
  si `months===3` suma `round(setup/3)` (a 6 meses set-up = 0); guarda `mp_preapproval_id`; redirige a `init_point`.
- **Webhook** `app/api/billing/mp/webhook/route.ts`: filtra `topic.includes("preapproval")`, verifica
  firma (401 si falla), `getPreapproval` como fuente de verdad, chequea `external_reference`, monto>0,
  **idempotente**, activa el plan solo en status `authorized`, loguea `billing_events`.
- **Reconcile al volver** (`/cuenta/plan?mp=ok`) activa el plan vía `getPreapproval` **sin depender del
  webhook**. `?activate=<plan>` resalta la card ("TU ELECCIÓN").
- **FX dinámico:** dólar oficial Banco Nación (`dolarapi.com/v1/dolares/oficial`, venta), cache 6h;
  mensual ARS = USD × TC. Override opcional `USD_ARS_RATE`.
- **Env (el user las carga en Vercel, NUNCA se pegan acá):** `MP_ACCESS_TOKEN` (APP_USR- prod / TEST- test),
  `MP_WEBHOOK_SECRET`, `MP_AMOUNT_<PLAN>` (pin opcional), `MP_SETUP_<PLAN>`, `MP_TEST_PAYER_EMAIL` (sandbox),
  `NEXT_PUBLIC_APP_URL`. **Webhook ya configurado + probado (200 OK).**
- **PENDIENTE MP:** el user tenía `MP_AMOUNT_*=100` como pin de prueba → **sacarlos** cuando termine de
  probar para volver a USD×TC. Sandbox pide "test payer" (crear con `POST /users/test_user {site_id:MLA}` y
  ponerlo en `MP_TEST_PAYER_EMAIL`).

### 5) Circuito Web → Plan (opción A: cuenta primero) + login cerrado
- **La web es la ÚNICA entrada de registro.** Flujo: web deja email + elige plan → `bip-platform.vercel.app/signup?email=&plan=X`
  → crea cuenta (contraseña o link mágico) → onboarding crea tenant **insight_trial** (+ `trial_ends_at` = +15d)
  → si el plan es pago, redirige a `/cuenta/plan?activate=X` → checkout MP → vuelve a `/cuenta/plan?mp=ok`.
  El **upgrade** se hace **adentro** de la plataforma. `back_url`/webhook de MP = URLs de la plataforma.
- **Login cerrado (hoy):** `app/login/page.tsx` = **solo ingreso**. Se sacó el toggle "Crear cuenta nueva";
  el link mágico usa `signInWithOtp({shouldCreateUser:false})` → un email nuevo **no** puede auto-registrarse
  desde el login. Queda link "¿No tenés cuenta? Empezá tu prueba de 15 días" → `/signup`. Password + reset OK.
- `app/signup/page.tsx` + `components/signup-form.tsx`; `app/onboarding/*`; `app/api/onboarding/route.ts`
  (acepta invitación pendiente por email). Equipo: `/cuenta/usuarios` + `team-manager` + `/api/team/{invite,remove}`
  con enforcement de `maxUsers`. Cambio de contraseña: `/cuenta/password`.

### 6) Landing `bip.html` (Drean repo) alineada
Set-up 150/250/350; "Comprobalo 15 días" (solo Insight); módulos por plan (Insight sin SEO/Trade;
fila "Historial de datos" 12/24/24); "Contratación por 3 o 6 meses"; bonif. a 6; **CTAs → `/signup`**
(pago con `?plan=<key>`); demo convertida en trial (form email → /signup); sección add-ons removida;
logo con interlineado 1.25. Commits en `main` de Dashboard-Mkt (hasta `2615b68`).

### Página de Planes (venta) — `app/(app)/cuenta/plan/page.tsx`
3 planes display + card "Tu plan actual" (verde), pill "Comprobalo 15 días" (oculta si onTrial/isCurrentPaid),
precio USD/mes, "Contratación por 3 o 6 meses", caja set-up ("Bonificado a 6 · prorrateado a 3"), fila
**usuarios·marcas·categorías** (jerarquizada, pedido del user), pitch, lista de incluidos, CTA. `MpSubscribeButton`
con selector 3/6 meses que muestra la mensualidad efectiva. Menú lateral: "Upgrade Plan".

### PENDIENTES abiertos tras esta sesión
- **Historia multi-año por tier:** `historyStartYear()` definido pero **NO cableado** a los rangos de
  fetch/snapshots de los dashboards (falta decisión UX de render de 2 años). Insight ve desde ene del
  año en curso; Optimize/Accelerate 24 meses.
- **SharePoint end-to-end:** falta que el user cree app Azure AD + integración Nango `sharepoint`; y el
  lado código (registrar source + cron sync a `tenant_datasets` + UI) sin construir.
- **MP:** sacar los pins `MP_AMOUNT_*=100` al terminar de probar. Opcional: SMTP propio en Supabase para
  entregar link mágico a cualquier email; deshabilitar "Confirm email" si se quiere alta instantánea.
- **Research (Accelerate)** en desarrollo; **Mkt de Influencia** (optimize+) marcado "pronto".

## 🎯 FEATURE PEDIDA (14-sep-2026) — Nurturing de leads/clientes + motor de venta interno (upgrades)
> **Pedido del user (verbatim):** "para el inicio del plan insight y el trial insight, me interesa
> que la página de inicio de la plataforma te permita **tomar datos, ir nutriendo cada lead y
> cliente** para poder luego **realizar un proceso de venta desde la plataforma para los distintos
> upgrades**." → CRM-lite embebido: captura + perfilado progresivo + señales de uso → upsell
> trial→Insight→Optimize→Accelerate **desde adentro** de la plataforma. **AÚN NO CONSTRUIDO** —
> esto es la spec para arrancar. Objetivo del negocio: cada cuenta (sobre todo trial e Insight)
> se va enriqueciendo con datos para que el consultor (y/o automatismos) empujen el upgrade correcto.

**Diseño propuesto (por fases, a confirmar campos/flujo con el user antes de codear la Fase 1):**
- **Puntos de captura:**
  1. **Onboarding** (ya crea el tenant) → sumar 2-3 campos mínimos (industria/rubro, rol de quien
     entra, tamaño de equipo/empresa).
  2. **/dashboard (inicio) = card "Completá tu perfil"** con perfilado **progresivo** (no todo de
     una): objetivos de negocio, marcas/categorías reales, fuentes de datos que ya tienen (Meta/GA4/
     etc.), presupuesto de marketing aprox., madurez analítica. Se guarda incrementalmente.
- **Modelo de datos (propuesto, proyecto bip-platform Supabase):**
  - `tenant_profile` (1:1 con tenant): firmografía + objetivos + fuentes declaradas + budget range +
    `profile_completeness` (%). RLS por tenant.
  - `lead_events` (append-only): señales de actividad/uso (login, dashboards vistos, conexión hecha,
    meta configurada, días de trial restantes, etc.) → alimentan scoring.
  - `sales_opportunities` / `sales_notes`: pipeline de upsell por tenant (etapa, plan objetivo,
    próxima acción, dueño=consultor). Visible solo para rol interno (owner de BIP/admin global).
- **Nurturing (señales → acción):** contador de trial + hitos de uso + gaps de perfil → **prompts de
  upgrade contextuales** dentro de la app (ej: "Estás usando X, con Optimize verías la competencia").
  Reglas simples primero (no ML): trial por vencer, límite de usuarios/categorías alcanzado, uso alto.
- **Proceso de venta interno:** **vista de consultor** (pipeline/CRM-lite) que lista cuentas con su
  perfil + score + próxima acción; el upgrade se consuma con el flujo MP ya existente (`/cuenta/plan`).
- **Reusar lo que ya hay:** el checkout/activación de MP (`/cuenta/plan?activate=`), el gating por
  plan (`lib/plan.ts`), `getCurrentTenant()`, `serviceClient()`. NO reinventar billing.

**Decisiones abiertas (confirmar con el user):** (a) set exacto de campos del perfil y cuáles son
obligatorios en onboarding vs progresivos; (b) ¿el "proceso de venta" es **self-serve** (prompts
automáticos in-app) y/o **consultor-driven** (vista CRM para el equipo BIP)?; (c) ¿se trackean leads
**pre-signup** desde la web (email dejado en `/signup`) o solo tenants ya creados?; (d) integración
con email/WhatsApp para nurturing saliente (hoy Alertas/reportes está pendiente de construir).
**Fase 1 sugerida (bajo riesgo, casi seguro correcta):** `tenant_profile` + card de perfil progresivo
en `/dashboard` + `profile_completeness`. Las fases de scoring/pipeline/prompts van después.

### ✅ IMPLEMENTADO (14-sep, misma sesión — todo en `main` de bip-platform)
> El user confirmó el diseño y pidió construirlo. **Estado: código completo y deployado.**
> **⚠️ ACCIÓN PENDIENTE DEL USER: correr la migración `supabase/migrations/0014_tenant_profile_crm.sql`
> en el SQL Editor de Supabase (proyecto BIP).** Hasta correrla, el gate NO bloquea (fail-open:
> `isProfileComplete` devuelve true si la tabla no existe) y el CRM sale vacío.

1. **Pricing SIN set-up, por período (3/6 meses)** — reemplaza 190/390/690 + set-up. `lib/plan.ts`
   `PLANS.price3/price6`: Insight **249/199**, Optimize **499/399**, Accelerate **869/695** (6 meses
   ≈ 20% off). `planPriceUsd(plan, months)`; `mpAmountArs(plan, months)` = USD/mes × TC; checkout sin
   proración; `/cuenta/plan` headline "Desde USD X/mes" + card elegida con fondo protagónico;
   `MpSubscribeButton` muestra ahorro %. `bip.html` (cards + tabla) actualizado. Se sacaron
   `setupAmountArs`/`updatePreapprovalAmount`.
2. **Captura nombre+apellido en el alta** — `bip.html` (form trial → `/signup?first&last&email`) +
   `SignupForm` (inputs nombre/apellido → `auth user_metadata` en signUp/OTP). Prefill del perfil.
3. **Migración 0014** — `tenant_profile` (first/last, sector+sector_other, own_brand, `competitors`
   jsonb [{name,instagram,facebook,tiktok,website}], `completed`) + CRM (`crm_status`, `crm_notes`,
   `lead_events`). RLS on, acceso service-role.
4. **Perfil de nurturing (bienvenida + form)** — `components/welcome-profile.tsx`
   (bienvenida "Bienvenido a BIP" + form: nombre/apellido/email + **sector** + **marca** + **4
   competidores**; Optimize/Accelerate exigen además **IG o web** por competidor).
   > **ACTUALIZACIÓN 14-sep:** el user pidió **simplificar el alta** → **el perfil YA NO es un gate
   > bloqueante** (se sacó el lock del menú y el form obligatorio en `(app)/layout.tsx`). La plataforma
   > se usa directo tras el alta. `welcome-profile.tsx` + `/api/profile` quedan en el repo para
   > reactivarlo como paso **opcional/prompt** si se quiere (motivo: fricción + destrabar al revisor de
   > Google, que ahora llega directo a Conexiones). Lo de abajo (Sidebar locked, gate por ruta) quedó
   > **desactivado**.
   `(app)/layout.tsx`: si el perfil no está completo → Sidebar **locked** (todos los ítems verdes,
   NO clickeables, con aviso "Completá tu perfil") + el Inicio muestra el form; `/cuenta/plan` queda
   **exento** (pagar antes del perfil). `proxy.ts` reenvía `x-pathname` para el gate por ruta.
   Al completar → `/dashboard` = segunda pantalla ("Puesta en marcha", ya existente). API
   `app/api/profile` valida server-side y marca `completed`.
5. **Pago desde la web** — `onboarding` con `?plan` pago → `/cuenta/plan?activate=X` (card resaltada) →
   elige 3/6 y paga → al volver `?mp=ok` con perfil incompleto → redirige a `/dashboard` (form, con
   los campos competitivos si es Optimize/Accelerate).
6. **CRM (a self-serve + b consultor-driven)** — `/consultor` (solo **staff** BIP, `isBipStaff` por
   `BIP_STAFF_EMAILS`, default `bip.explore@gmail.com,dsabena@gmail.com`): panorama de TODAS las
   cuentas (perfil, plan, trial, señales `lead_events`, **score**, etapa, competidores) + edición
   inline de etapa/plan-objetivo/próxima acción + **notas** (`components/crm-board.tsx`, API
   `app/api/crm`). Señales: `logEvent('dashboard_view'|'profile_completed')`. Self-serve: banner de
   upgrade en el Inicio para trials + link "Consultor · CRM" en el sidebar (solo staff).

**PENDIENTES de esta feature:** (a) **correr migración 0014** (crítico); (b) opcional: setear
`BIP_STAFF_EMAILS` en Vercel si el staff cambia; (c) el perfil hoy es 1 sola pantalla obligatoria
(no "progresivo" incremental — se decidió arrancar simple); (d) scoring es heurístico simple, se
puede enriquecer; (e) nurturing saliente (email/WhatsApp) sigue pendiente (depende de Alertas).

### ✅ SEGURIDAD, CONSENTIMIENTO, BORRADO y LEGALES (14-sep, tarde — todo en `main`)
- **Pricing sin set-up** (3/6 meses; Insight 249/199, Optimize 499/399, Accelerate 869/695) en
  plataforma **y** web; 6 meses ~20% off como mensaje de venta; Accelerate reposicionado a "3
  categorías = todo tu negocio" (se sacó Research del card).
- **Consentimiento en el alta** (migración **0015**): aceptación obligatoria de Términos+Privacidad +
  opt-in de comunicaciones (email/WhatsApp) → user_metadata + tenant.
- **Borrado de datos**: `api/connections/disconnect` (revoca Nango + purga snapshot de la fuente) y
  `api/account/delete` (baja total: revoca todo + borra tenant en cascada + borra usuarios de Auth).
  UI: botón desconectar en Conexiones + "Zona de peligro" en Mi cuenta.
- **Transparencia**: bloque "Cómo protegemos tus datos" en Conexiones + sección "Seguridad y privacidad"
  (8 cards, escudo) en la web + `privacy.html`/`terms.html` publicables.
- **Legales para Netlify** (`bip-go.com`): `apps/web/public/bip-privacy.html` + `bip-terms.html`
  (self-contained, Google+Meta+Microsoft). Se suben como `privacy/index.html` + `terms/index.html` +
  la carpeta `bip/` (assets). Docs: **`docs/bip-legal-privacidad.md`**, **`docs/bip-seguridad-procesos.md`**.
- **Google verificación OAuth — Opción B** (demostrar uso, NO dropear scopes): **construido** Sheets
  vía `drive.file`+Picker (`google-sheet-picker` + `/api/datasets/google-sheet` + `/api/connect/google/
  token`) y Google Ads (`lib/google-ads.ts` + sección en `/performance`, gated por
  `GOOGLE_ADS_DEVELOPER_TOKEN`). **Falta del user:** developer token de Ads, API key del Picker
  (`NEXT_PUBLIC_GOOGLE_API_KEY` + `NEXT_PUBLIC_GOOGLE_APP_ID=279230041069`), sumar `drive.file` en
  Nango/consent, video + test creds + responder T&S. Detalle: **`docs/bip-google-oauth-verificacion.md`**.
- **Migraciones a correr en Supabase (BIP):** 0014 (perfil+CRM) y 0015 (consentimiento) — ya corridas
  por el user el 14-sep.

## ✅ PLATAFORMA DEPLOYADA Y VALIDADA EN PRODUCCIÓN (sep-2026)
`bip-platform` está **viva en `bip-platform.vercel.app`** y probada end-to-end:
- **Infra:** repo GitHub `bip-explore/bip-platform` (privado) → Vercel team BIP (mismo que bip-app) →
  Supabase `czcfrzqioulhjfqkagcb` (proyecto "bip-platform", el mismo de siempre; usa las claves
  **nuevas** `sb_publishable_`/`sb_secret_`). Nango Cloud dev por ahora.
- **Env vars en Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (= publishable `sb_...`), `SUPABASE_SERVICE_ROLE_KEY` (= secret `sb_...`), `NANGO_HOST`
  (=api.nango.dev), `NANGO_SECRET_KEY`. Stripe todavía NO (billing pendiente).
- **Supabase Auth:** Email habilitado + **URL Configuration** con Site URL `https://bip-platform.vercel.app`
  y Redirect `https://bip-platform.vercel.app/**` (sin esto el magic link no vuelve).
- **Probado OK:** login (magic link) → onboarding (crea tenant) → dashboard **gateado por plan**
  (Insight muestra 4 tableros, el resto 🔒) → **Conexiones → Conectar Google** quedó conectada,
  ligada al tenant vía Nango. Auth + multi-tenant + RLS + gating + conexiones self-serve = FUNCIONA.
- **BUG resuelto en el camino:** la migración 0001 usa `create table if not exists`; las tablas ya
  existían de la prueba `bip-app` con esquema viejo (sin `trialing` en el status_check ni columnas
  de billing) → el onboarding tiraba `tenants_status_check`. Fix: **drop de las 5 tablas + re-run
  de 0001** (recrea con el esquema bueno). **OJO a futuro:** si se vuelve a correr sobre tablas
  pre-existentes, `if not exists` las saltea — para cambios de esquema hay que ALTER o drop+recreate.

### Ajustes ya hechos sobre el scaffold (sep-2026, 2da tanda)
- **Índice del menú corregido a un HÍBRIDO** (el user marcó que el mío inventado no era el real):
  ahora `lib/plan.ts` (`NAV`) espeja EXACTO el árbol de Drean (`apps/web/src/components/sidebar.tsx`)
  — Mapa Estratégico, Seguimiento Objetivos, grupo **Planes de Acción** (Plan de Medios, Redes
  Sociales, Mkt de Influencia, Mkt Canal Comercial, Web/Ecom, Optimización SEO, subgrupo **Trade
  Mkt**), Salud de Marca, Resultados Comerciales, Inversión de Marketing, Generador de Contenido,
  Monitoreo conexiones — **+ una sección de Extras de BIP (add-ons)** que Drean NO tiene: Copiloto
  IA y Competitivo, marcados con badge "add-on" y bloqueados hasta activarlos. `components/sidebar.tsx`
  reescrito para render en árbol con grupos colapsables + candado por plan/addon.
- **Logo de BIP** replicado del sitio (`components/logo.tsx`: wordmark Poppins 800 + triángulo
  `#0a4da0` + tagline; el logo NO es un PNG, es SVG/CSS — está en `public/bip.html`) puesto en
  login, onboarding y sidebar. Build revalidado OK. Zip actualizado entregado al user.
- **PENDIENTE ESTÉTICO (dicho por el user, aplazado):** hay que revisar orden, nomenclatura y
  varias cuestiones estéticas del menú/UI. La asignación de qué dashboard va en qué plan (campo
  `min` en `lib/plan.ts`) es un placeholder con criterio → **confirmar contra la matriz real de
  `public/bip.html`**.

### Decisión de dominios (sep-2026) — landing en la agencia, plataforma+legales en bip-go.com
El user quiere que **la PÁGINA comercial de BIP** (la landing `bip.html`) viva **en la web de la
agencia**. Eso NO afecta la verificación de Google, porque son cosas separadas:
- **Landing / marketing** → web de la agencia. Libre, sin dependencia de OAuth.
- **Plataforma (app + login) + el homepage/privacy/terms del consent + `nango.bip-go.com`** →
  se quedan en **`bip-go.com`** (dominio propio, verificado). Es lo que Google mira.
- Basta con que `bip-go.com` sirva homepage + /privacy + /terms para el consent (no hace falta que
  ahí esté la landing linda).
- **NO enmascarar/cloaking/iframe** para servir la app bajo el dominio de la agencia: rompe el
  OAuth (Google/Meta no corren en iframe) y las cookies de sesión. Si algún día se quiere la app
  SERVIDA bajo la agencia, sería un subdominio (`plataforma.agencia.com` → CNAME al Vercel) y habría
  que **re-verificar ese dominio** — por eso **decidir el dominio final ANTES de mandar la
  verificación** para no hacerla dos veces. Default acordado: plataforma en `bip-go.com`.

### 👉 RETOMAR ACÁ (próxima sesión): VERIFICAR LA APP DE GOOGLE
**✅ HECHO (sep-2026, desde el celu): `bip-go.com` VERIFICADO en Google Search Console** con
`bip.explore@gmail.com` (método "Proveedor de nombres de dominio" = registro TXT). El prerequisito
lento del paso 5 ya está. **OJO:** el DNS de `bip-go.com` se maneja en **Netlify** (nameservers
`nsone.net`), NO en DonWeb — el TXT `google-site-verification=fnvWJXf20vfl...` vive en Netlify; **no
borrarlo** o se pierde la verificación. (DonWeb solo tiene el registro del dominio, no el DNS.)

**✅✅ HITO (sep-2026): MARCA VERIFICADA EN GOOGLE — el bloqueo de `nango.dev` RESUELTO.**
Cadena completada hoy: Nango self-host en Railway (`nango.bip-go.com`, SSL OK) → login al dashboard
(cuenta `bip.explore@gmail.com`, verificada a mano en la DB: `UPDATE nango._nango_users SET
email_verified=true` porque el self-host no tiene SMTP) → **integración Google recreada** en ese
Nango (Client ID `279230041069-...apps.googleusercontent.com` + Client Secret + 3 scopes; callback
`https://nango.bip-go.com/oauth/callback`) → en Google Cloud se **cambió el redirect** del OAuth
client "BIP Nango" a `nango.bip-go.com/oauth/callback` (se borró `api.nango.dev`) y se **sacó
`nango.dev` de Dominios autorizados** (quedó solo `bip-go.com`) → **"Verificar la marca" PASÓ** y se
**publicó** → *"Se verificó la información de tu marca y se muestra a los usuarios"*.
**FALTA (último tramo): verificación de SCOPES (Data access)** — enviar desde el Centro de
verificación con las justificaciones de los 3 scopes + el video demo (materiales listos en
`docs/verificacion-google.md`). Google revisa días/semanas; recién ahí se saca del todo el cartel
"app no verificada" y se pasa de 100 usuarios. Mientras, la app funciona en producción con el aviso.

**✅✅ RESUELTO (sep-2026): la conexión OAuth funciona end-to-end en el self-host.** Se probó
"Conectar Google" en bip-platform → abrió el Connect UI → consent de Google (cuenta + 2FA) →
**Conectado ✓**. Antes moría en "Your session has expired". El fix que funcionó (detalle abajo):
**se expuso el Connect UI (puerto 3009) con un 2º dominio + se corrigieron `NANGO_PUBLIC_CONNECT_URL`
y el `openConnectUI(baseURL,apiURL)` + se subió `@nangohq/frontend` a 0.71.6.** Con esto queda
DESBLOQUEADO grabar el video demo → enviar la verificación de scopes.

**CONFIG QUE FUNCIONA (no re-romper):**
- **Railway:** el servicio `nango-server` expone DOS dominios generados (gratis, no cuentan al límite
  de custom domains del plan): `nango-server-production-ce30.up.railway.app` → **port 3003** (API +
  dashboard) y `nango-server-production-52d6.up.railway.app` → **port 3009** (Connect UI SPA). El
  custom domain `nango.bip-go.com` sigue en 3003 (es el que ve Google en el callback). No hizo falta
  `connect.bip-go.com` (Google NO mira el dominio del Connect UI, solo el callback del 3003).
- **Railway env:** `NANGO_PUBLIC_CONNECT_URL=https://nango-server-production-52d6.up.railway.app`
  (la SPA/3009 — ESTE era el error: apuntaba al 3003); `NANGO_SERVER_URL`/`NANGO_PUBLIC_SERVER_URL`=
  `https://nango.bip-go.com`; `FLAG_SERVE_CONNECT_UI=true`; `NANGO_CONNECT_UI_PORT=3009`.
- **Vercel (bip-platform):** `NEXT_PUBLIC_NANGO_API_URL=https://nango.bip-go.com` +
  `NEXT_PUBLIC_NANGO_CONNECT_URL=https://nango-server-production-52d6.up.railway.app`. (La vieja
  `NEXT_PUBLIC_NANGO_CONNECT_HOST` quedó sin uso.)
- **Código (`components/connect-button.tsx`):** `new Nango({ host: apiURL })` +
  `openConnectUI({ baseURL, apiURL, onEvent })` con `baseURL`=Connect URL y `apiURL`=API URL leídas
  de esas env `NEXT_PUBLIC_*`. El evento se tipa `ConnectUIEvent` (import de `@nangohq/frontend`) y
  en `event.type==="connect"` el payload es `{ providerConfigKey, connectionId }`.
- **`@nangohq/frontend` = `0.71.6`** (matchea el server; la 0.48.0 daba skew + tipos viejos).
- **GOTCHA build Vercel:** Vercel corre `npm ci` → si cambiás `package.json` sin regenerar el
  `package-lock.json`, el build falla ("can only install with an existing package-lock.json" o
  mismatch). Solución usada: se **borró `package-lock.json`** del repo → Vercel cae a `npm install` y
  lo regenera. (Y OJO: editar `package.json` a mano en GitHub web rompió el JSON una vez —
  "Expected ',' at position 256"; validar el JSON.) El repo de la app es **`bip-explore/bip-platform`**
  (branch `main`, conectado a Vercel; NO puedo pushear ahí desde esta sesión → los cambios los aplica
  el user por GitHub web y Vercel deploya solo).

**Root cause CONFIRMADO** (research contra el source real de Nango v0.71.6) — detalle abajo.

**Síntomas medidos (validado, no asumido):**
1. **Desde la app (bip-platform, `@nangohq/frontend` v0.48.0):** `new Nango({ host:
   'https://nango.bip-go.com' })` → `openConnectUI({ onEvent })` → `connect.setSessionToken(token)`.
   El modal **ABRE** pero muestra **"Your session has expired, please refresh the modal."** — o sea
   el session token se crea server-side pero el Connect UI lo rechaza/no lo consume.
2. **Desde el dashboard de Nango ("Add test connection → Google → Authorize"):** **no abre el popup
   de consent de Google**, el browser vuelve a `/connections/create` y **no se crea conexión**. Los
   logs del contenedor (Railway Deploy Logs) muestran operaciones `create_connection` con estado
   **"running", `endedAt: null`** → la connect-session se crea pero el OAuth nunca vuelve al callback.
3. Popups permitidos. Auth callback URL correcto (`https://nango.bip-go.com/oauth/callback`).
4. Los **Logs UI de Nango** dicen "Logs not configured" → Elasticsearch está apagado (no hay traza
   detallada; por eso se lee de los Deploy Logs de Railway).

**✅ ROOT CAUSE CONFIRMADO (research contra el source real de Nango v0.71.6):** en v0.71.x el
**Connect UI es una SPA estática que se sirve en un PUERTO APARTE (3009)**, NO en el puerto de la API
(3003). En Railway sólo expusimos el 3003 (un dominio → un puerto), así que **la SPA del Connect UI
es inalcanzable** → de ahí salen los dos síntomas. Evidencia en el repo (tag `v0.71.6`):
- `packages/server/entrypoint.sh`: con `FLAG_SERVE_CONNECT_UI=true` arranca **dos procesos** — la API
  (`server.js`) **y** un `serve -s packages/connect-ui/dist -p ${NANGO_CONNECT_UI_PORT:-3009}`.
- `packages/utils/.../detection.ts`: `connectUrl = NANGO_PUBLIC_CONNECT_URL || http://localhost:3009`
  (la SPA) es **distinto** de `baseUrl = NANGO_SERVER_URL` (la API). Son **orígenes diferentes por
  diseño.** Nosotros habíamos puesto `NANGO_PUBLIC_CONNECT_URL = nango.bip-go.com` (la API, 3003) →
  mal.
- El cartel **"Your session has expired"** se renderiza literal en un **HTTP 401**
  (`packages/connect-ui/.../ErrorFallback.tsx`): la SPA cargó pero pegó contra la **API equivocada**
  (Nango Cloud) que no conoce el session token del self-host.
- `packages/frontend/lib/connectUI.ts`: `openConnectUI` **NO usa** el `host` del `new Nango({host})`;
  tiene sus propios defaults a **Cloud** (`baseURL=https://connect.nango.dev`,
  `apiURL=https://api.nango.dev`). Hay que pasar `baseURL` + `apiURL` explícitos (así lo hace el
  propio dashboard de Nango).

**FIX (lista mínima para retomar):**
1. **Railway:** en el servicio `nango-server` → Networking → **agregar un 2º dominio
   `connect.bip-go.com` con target port `3009`** (dejar `nango.bip-go.com` → 3003). DNS: CNAME
   `connect` → target de Railway, en **Netlify**. Esperar SSL.
2. **Env vars (Railway):** `NANGO_PUBLIC_CONNECT_URL=https://connect.bip-go.com` (era el error);
   dejar `NANGO_SERVER_URL` y `NANGO_PUBLIC_SERVER_URL` = `https://nango.bip-go.com`; mantener
   `FLAG_SERVE_CONNECT_UI=true` y `NANGO_CONNECT_UI_PORT=3009`. Redeploy.
3. **App (bip-platform, `components/connect-button.tsx`):** llamar
   `nango.openConnectUI({ baseURL: 'https://connect.bip-go.com', apiURL: 'https://nango.bip-go.com',
   onEvent })` (nombres exactos `baseURL`/`apiURL`; **no** existe `connectHost`). Y **alinear la
   versión** de `@nangohq/frontend` (estamos en 0.48.0 contra server 0.71.6) → subir a ~0.71.x para
   evitar skew del handshake.
4. **Redirect en Google Cloud** = la API: `https://nango.bip-go.com/oauth/callback` (ya está bien; es
   el 3003, no el dominio del connect).

**WORKAROUND YA (para desbloquear el video demo sin tocar nada):** en el dashboard de Nango, el link
**"Use deprecated flow"** (`/connections/create-legacy`) hace el OAuth **directo** por el 3003 (abre
el popup de Google, vuelve al `/oauth/callback`, crea la conexión) — **no usa la SPA del 3009**. Sirve
para probar que el Client ID + callback están OK y para grabar el video mientras se expone el 3009.

**Config actual del self-host (Railway `ravishing-flow`, servicio `nango-server`
`nangohq/nango-server:hosted-0.71.6`, dominio `nango.bip-go.com` → port 3003):** `NANGO_SERVER_URL`,
`NANGO_PUBLIC_SERVER_URL` = `https://nango.bip-go.com`; **`NANGO_PUBLIC_CONNECT_URL` estaba mal en
`nango.bip-go.com` → debe ser `https://connect.bip-go.com` (3009)**; `FLAG_SERVE_CONNECT_UI=true`;
`SERVER_PORT=3003`; `CACHE_REDIS_ENABLED=false`; `CACHE_LOCAL_ENABLED=true`; `FLAG_AUTH_ENABLED=true`
(basic auth del dashboard); Postgres+Redis attach; `NANGO_ENCRYPTION_KEY` (inmutable, en Railway).
Integración Google cargada (Client ID `279230041069-...` + Secret + 3 scopes), redirect en Google
Cloud = `nango.bip-go.com/oauth/callback`.

**Estado de la verificación de scopes (form ya cargado, falta el video):** las 3 justificaciones
están pegadas en el Centro de verificación (957/1000 chars) + "Información adicional". Falta grabar
el **video demo** del flujo OAuth vivo → por eso resolver esta conexión es el camino crítico.

**✅✅ HITO (sep-2026): PUSH DIRECTO AL REPO — se terminó el upload manual.** El repo de la
plataforma **se transfirió de `bip-explore` a `dsabena-byte`** (GitHub → Settings → Danger Zone →
Transfer ownership → aceptar como dsabena). Motivo: esta sesión de Claude Code está anclada a
`dsabena-byte` y `add_repo` **solo acepta repos del mismo dueño** (los cross-tier están bloqueados);
con el repo bajo dsabena-byte, `add_repo(dsabena-byte/bip-platform, push)` funciona y **Claude
clona/edita/pushea directo**. Se descartaron: sesión nueva anclada a bip-explore (riesgo de pisar el
conector de GitHub de dsabena y **romper Drean** — ya pasó 2 veces al tocar esa autorización), y 2º
plan de Claude (costo). **Transferir NO toca el conector de Claude → Drean intacto.** El app de
GitHub de Claude en dsabena está en "All repositories" (tras la transferencia, `add_repo` entró sin
tocar nada; hubo ~1 min de propagación).
- **GOTCHA Vercel (Hobby):** el proyecto Vercel `bip-platform` es de la cuenta **BIP Hobby
  (bip.explore)**. El Hobby plan **bloquea deploys cuyo commit author no sea miembro de la cuenta**
  ("Deployment Blocked: commit author did not have contributing access… Hobby does not support
  collaboration for private repos"). Por eso los commits de este repo se firman como **`bip-explore
  <bip.explore@gmail.com>`** (ya quedó en el `git config` local del clon `/home/user/bip-platform`).
  Si algún commit sale firmado por dsabena → Blocked; se arregla `git commit --amend --reset-author`
  con la config bip-explore + force-push. NO hace falta pagar Pro.
- **Tras la transferencia, Vercel siguió deployando** desde `dsabena-byte/bip-platform` (el redirect
  de GitHub lo mantuvo; no hizo falta reconectar el Git en Vercel). Env vars/dominios intactos.
- **Identidad BIP intacta:** el dueño del repo en GitHub NO es parte de la verificación de Google/Meta
  (eso usa `bip-go.com` + `bip.explore`). La separación real no cambió.
- **Flujo actual:** Claude edita en `/home/user/bip-platform`, `npm ci && npm run build`, commit
  (autor bip-explore) + `git push origin main` → Vercel deploya. Lo único que queda del lado del user:
  correr migraciones SQL en el Supabase de bip-platform (no hay conexión DDL desde la sesión).

**Features nuevas (sep-2026, ya en main):** (1) **`/web` cableado a GA4 real** (`getToken` → Admin
API descubre propiedades + selector + Data API runReport: usuarios/sesiones/transacciones/ingresos +
serie diaria + canales). Requiere habilitar **Analytics Admin API + Data API** en el proyecto Google
Cloud (`279230041069`). (2) **Menú:** todo con `soon:true` (candado) menos Web/Ecommerce, para probar;
Trade Mkt como ítem único; viñetas de colores estilo Drean, logo BIP blanco, sidebar navy/cyan. (3)
**Conexiones rediseñada:** Plataformas (Google/Meta/TikTok, OAuth) / Tus archivos (subir Excel/CSV +
SharePoint) / Coordinadas (DV360), con íconos, **sin GfK**. (4) **Subir Excel/CSV self-serve:**
`components/file-upload.tsx` → `/api/datasets` (parseo SheetJS `xlsx@0.18.5`) → tabla `tenant_datasets`
(migración 0002, `tenant_id **text**` porque `tenants.id` es text, no uuid). **Pendiente self-serve:**
SharePoint/Excel Online por Microsoft OAuth (registrar app en Azure + integración Microsoft en Nango,
después reusa el ConnectButton). Nango soporta 400+ integraciones (LinkedIn/Bing/X/Pinterest/Snapchat/
Amazon Ads, Shopify, HubSpot/Salesforce, Microsoft/SharePoint, etc.).

**✅ `/web` RÉPLICA FIEL DE DREAN (sep-2026, en main) — el dash de referencia.** El `/web` de BIP
ahora espeja el de Drean (`apps/web/src/app/web/page.tsx`) sobre **GA4**, probado con la GA4 real de
**ROQUÉ** (`www.roque-in.com`; se le dio Viewer a `bip.explore` en Property Access Management). Tiene:
- **6 MetaKpiCards** con headline + filas **Mes / Acum.YTD** + meta + semáforo + barra (en gris "sin
  meta" hasta cargar objetivos): Tráfico, Duración media de sesión, Tasa de conversión, Transacciones,
  Ingresos, Valor medio de compra (ROAS no se puede en GA4 solo → AOV). + 5 KpiCards secundarios.
- **6 gráficos real-vs-meta** (Recharts, meta gris + real azul #1e40af, barra/línea por KPI).
- **MetaPanel** = Configuración de objetivos por KPI (12 meses + dirección/umbrales), guarda por
  cliente en `web_metas` (**migración 0003**, `tenant_id text`). API `/api/web-metas`.
- Performance/Tendencia por categoría, Tendencia de usuarios, Top 10 productos, Audiencia
  (dispositivos + provincias vía dim `region`), Detalle + Evolución por canal. Paletas de Drean.
- **Selector de período abajo** (no en header): dropdown "Mes" con **checkboxes multi-selección** +
  "Limpiar selección" + rango de fechas. Meses en orden cronológico ascendente.
- **Tipografía = fuente del sistema** (como Drean, más limpia); Poppins queda SOLO para el logo BIP.
- Componentes en `components/web/*` + `lib/web-viz.ts` + `lib/metas-web.ts`.
- **GOTCHA Recharts:** 2.x NO renderiza series con React 19/Next 16 (dibuja ejes, no barras/líneas) →
  **subido a Recharts v3** (compat React 19); ajustar formatters a los tipos nuevos (`(v)=>fn(Number(v))`).
- **⚠️ PENDIENTE del user en Supabase de bip-platform:** correr **migración 0002** (`tenant_datasets`,
  ya) y **0003** (`web_metas`) en el SQL Editor. Sin 0003 el MetaPanel no guarda.

**🔨 EN CURSO (sep-2026) — Alertas + Base de conocimiento (empezar por Plan de Medios en DREAN, luego
replicar a BIP):** ver **`docs/alertas-plan-medios.md`** (spec completo, best-practice format-aware,
benchmarks anclados en data real). Mockup interactivo aprobado:
`https://claude.ai/code/artifact/12fe8b5e-7dca-4924-af48-b3fff8e67b93`. **Un solo cerebro:** las
alertas y la base de conocimiento comparten los mismos benchmarks. Próximo paso: construir el motor
`lib/alertas/` + panel en `/performance` + el modelo `kb_content` (content-as-data, para que ROQUÉ
edite sin deploy y BIP lo reuse con gating por plan). Detalle abajo en la sección de alertas.

**🟢 CONECTOR META (sep-2026) — CONECTADO Y VALIDADO EN DEV con data real. Falta App Review para prod.**
- **Cómo funciona Meta en un SaaS (investigado a fondo):** BIP tiene **UNA app propia** ("BIP
  Connector") en un **Business Portfolio**; cada cliente **autoriza esa app por OAuth**
  (Facebook Login for Business) — el cliente NO te agrega a su Business. Para leer cuentas de OTROS
  (producción) hace falta **App Review** (cada permiso + screencast, 3-7 días) + **Business
  Verification** del portfolio dueño de la app (papeles legales). En **modo Desarrollo** el admin de
  la app prueba con su propia cuenta sin review.
- **Business:** la app vive en el portfolio de **ROQUÉ Marketing Insights** (business_id `10905…156439`;
  ROQUÉ = la agencia que opera BIP), **NO** en Alladio/Drean (Drean es cliente). **OJO Meta exige una
  persona REAL como admin** (no se puede un FB ficticio de "bip.explore" → baneo): el admin es el FB
  personal **`daniel_sabena@hotmail.com`**. La identidad BIP vive en el nombre del business + la app.
- **App:** **"BIP Connector"**, **App ID `1413533137383885`**, tipo **Negocios**, modo Desarrollo.
  Producto **Facebook Login for Business**, redirect `https://nango.bip-go.com/oauth/callback`. App
  Secret en Configuración→Básica (el user lo guardó; NO commitear).
- **CLAVE — FLB usa `config_id`, NO `scope` (esto trababa la conexión):** las apps tipo Negocios solo
  ofrecen **Facebook Login for Business**, cuyo consent va por un **`config_id`** que *reemplaza* a los
  scopes en la URL de OAuth. El provider `facebook` de Nango 0.71.6 manda `scope` clásico → si van
  juntos, Meta los pelea. **Solución (implementada y probada):**
  1. En Meta → FLB → **Configuraciones** → configuración **"BIP Data"**, variación **General**, token
     **de usuario** (NO system-user: el system-user no es self-serve por OAuth; Nango solo lo soporta
     pegando un token a mano). **`config_id = 1349490046995897`.** Los **12 permisos** viven en esta
     config (editables después; solo variación y tipo de token quedan fijos).
  2. **Nango:** integración `facebook` con **scopes VACÍOS** (los permisos vienen del config_id).
  3. **Código BIP** (`lib/nango.ts` `createConnectSession`): inyecta
     `integrations_config_defaults.facebook.authorization_params = { config_id }` desde la env
     **`META_LOGIN_CONFIG_ID`** (seteada en Vercel). Verificado en el source de Nango que
     `/connect/sessions` acepta ese campo.
- **12 SCOPES (solo lectura + community mgmt + potencial futuro, SIN publicación):**
  `ads_read, read_insights, pages_show_list, pages_read_engagement, pages_read_user_content,
  instagram_basic, instagram_manage_insights, instagram_manage_comments, business_management,
  pages_manage_engagement` (responder/ocultar comentarios FB), `pages_manage_metadata` (webhooks →
  alertas real-time), `leads_retrieval` (leads de Lead Ads). **Excluidos** `pages_manage_posts` /
  `instagram_content_publish` (publicación) y `ads_management` (write sobre pauta — se suma si algún
  día BIP "opera" campañas). Los 9 primeros = 100% de lo que Drean lee; los 3 últimos = potencial que
  Drean no hace. **OJO al elegir en Meta: `instagram_manage_comments` (comments), NO `..._contents`.**
- **VALIDADO con `/api/diag/meta`** (endpoint nuevo en BIP: pega a la Graph con el token del tenant vía
  Nango y reporta capacidad por capacidad). Resultado dev (cuenta admin Daniel Sabena): **12/12
  concedidos, 0 declinados.** Data real traída: page_follows Drean 129.550, IG @dreanargentina 154.888
  seg + reach 345.657, **texto de comentarios IG** ("NO LO RECOMIENDO", etc.), businesses OMD/
  Alladio-Drean(verified)/ROQUÉ, ad accounts (incl. **Mabe act_1428795852368328** = la de Drean). O
  sea en dev BIP ya ve la data real de Drean. **Lectura de texto de comentarios FB CONFIRMADA**
  (`pages_read_user_content`): el diag trae el texto real de comentarios de posts de la Página Drean
  (ej "Malísimo servicio técnico...") — **algo que Drean nunca cableó** (Drean solo leía conteo FB +
  texto IG por Apify). BIP lee texto de comentarios FB **e** IG por Graph.
- **Token = de usuario long-lived (60d).** Drean usa system-user (generado a mano, single-tenant); BIP
  self-serve usa user token que Nango refresca. Para un enterprise puntual se puede sumar después el
  camino system-user (provider `facebook-system-user`, API_KEY, token pegado a mano).
- **PENDIENTE:** (1) prod: **App Review** de los 12 + **Business Verification** de ROQUÉ. (2) construir
  el **dash de Meta/Redes** en BIP (hoy solo `/web` de GA4). (3) correr migs 0002+0003 en Supabase de BIP.
- **VERIFICACIÓN META — estado validado en vivo (sep-2026, diag `/api/diag/meta` → bloque `negocios`):**
  `verification_status` por negocio: **OMD Argentina = verified**, **Alladio-Negocio Drean = verified**,
  pero **ROQUÉ Marketing Insights (`109057158156439`, dueña de la app) = `not_verified`** → **falta la
  Business Verification de ROQUÉ**, que es prerequisito OBLIGATORIO del App Review (Meta no da Advanced
  Access sin el negocio dueño verificado). Orden: **Fase 1 Business Verification de ROQUÉ** (business.
  facebook.com → business ROQUÉ → Centro de seguridad → Verificación del negocio; razón social AFIP +
  dirección + constancia AFIP/CUIT; el nombre/dirección deben coincidir carácter x carácter con el doc)
  → **Fase 2 App Review** (~2-7 días). **Guion completo de App Review YA ESCRITO** en
  `docs/meta-app-review-guion.md`: justificación de cada uno de los 12 permisos + guion del screencast
  maestro + recomendación de 2 tandas (A=9 de solo-lectura ya; B=community mgmt+leads cuando exista la
  UI). Los 12 scopes siguen concedidos (dev). **OJO seguridad:** el JSON del diag trae tokens de acceso
  reales en las URLs de `paging` — nunca compartirlo público.

**🟢 SELECTOR DE CUENTA META + DASH REDES v1 (sep-2026).** Multi-cuenta resuelto: la conexión ve
varias páginas (Daniel ve **Drean** `257587170945975` Y **ROQUÉ - Research Solutions** `109052558156899`
/ IG `@roque.research.solutions` `17841427311265529`). NO se auto-elige: `lib/meta-assets.ts` descubre
las cuentas, `/api/meta/assets` lista+guarda la elección en `connections.config` (**migración 0004,
YA CORRIDA**), `MetaAssetPicker` (tarjeta Meta en Conexiones) deja elegir, `getSelectedMetaAsset()` da
selección + page token a los dashboards. **Dash `/redes` EN MAIN — IG + FB orgánico + metas, idéntico a
Drean.** Orgánico en vivo (`lib/meta-social.ts`: `getIgOrganicLive` + `getFbOrganicLive`, defensivos) →
`IgOrganicSection` + `FbOrganicSection` (cards Mes/YTD, `IgAlcanceChart` real-vs-meta, `SocialEngagementChart`
con `ENG_COLORS`, demografía, top posts). **Metas:** store genérico `dash_metas` (**migración 0005, YA
CORRIDA**, tenant/plan/kpi/anio) + `lib/metas-dash.ts` + API `/api/dash-metas` + **MetaPanel generalizado**
(props `endpoint`/`titulo`/`plan`, backward-compat con `/web`); planes **"Redes Sociales"** (IG) y
**"Facebook"** (FB); alineación por `mesIdx`. **GOTCHA IG resuelto:** NO pedir `shares` en insights de
media feed (rompe la llamada → alcance 0); fallback a `reach`. **FB:** reach por post
(`post_impressions_unique`) + filtro `isPaidOutlier`. **GOTCHA FB page token (#10):** leer una Página de FB
necesita un **page access token**; `getSelectedMetaAsset` lo saca con `/{pageId}?fields=access_token`, que
SOLO funciona si el usuario tiene un **rol/tarea sobre la Página** (no alcanza ser admin del *negocio*).
Con ROQUÉ dio #10 hasta asignar a Daniel a la Página en Business Settings → Cuentas → Páginas → control
total. Con clientes reales que autorizan su propia página no pasa. (ROQUÉ FB validado: 15 seguidores, sin
posts en 2026 → 0 real, no bug; la actividad de ROQUÉ está en IG.) **PENDIENTE Redes (menor):** `OrganicBuildupPanel`
(buildup IG+FB por pilar/categoría — requiere clasificar posts). Competitivo fuera (sin scraper).

**🟡 DASH DE REDES SOCIALES en BIP (en curso, sep-2026) — replica el orgánico de Drean con data de ROQUÉ.**
- **Blueprint relevado** del `/redes` de Drean (mapa completo de secciones/componentes/shapes/paleta —
  ver abajo). Se replica **fiel** el ORGÁNICO: `IgOrganicSection` + `FbOrganicSection` (cards Mes/YTD con
  semáforo, `IgAlcanceChart` barras real azul `#1e40af` + meta gris, `SocialEngagementChart` líneas
  real+meta con `ENG_COLORS=["#1e40af","#60a5fa","#bfdbfe"]`, demografía `HorizontalBars`, top posts,
  **comentarios FB+IG**) + los **MetaPanel** (planes `"Redes Sociales"`=IG y `"Facebook"`) +
  `OrganicBuildupPanel`. Shapes objetivo: `IgOrganicSummary` / `FbOrganicSummary` (ver blueprint).
- **FUERA por ahora:** el **Análisis Competitivo** (Drean lo arma con un scraper de cuentas de la
  competencia → tabla `social_posts`/`social_followers`; BIP no lo tiene para ROQUÉ). Se suma si el user
  quiere monitorear competidores. Insights tab (LLM) también más adelante.
- **Fuente de datos:** en Drean el orgánico sale de tablas pre-synced por crons (`meta_posts`,
  `meta_page_daily`, `meta_fb_audience_demographics`, `meta_fb_monthly_reach`). En **BIP v1 = LIVE desde
  la Graph API** vía `getToken(tenant,"facebook")` (ROQUÉ es chico, rinde). A escala → sync por tenant.
- **Selector de página/IG por tenant:** la conexión puede ver varias páginas (la de Daniel ve Drean +
  las de los negocios que administra). El dash debe elegir la de ROQUÉ (nunca mostrar Drean). **NO
  preguntar al user qué IG/página tiene ROQUÉ** — se DESCUBRE por API: `/api/diag/meta` ahora enumera
  `owned_pages`+`client_pages` con su `instagram_business_account` **por cada negocio** (`/{biz}/owned_pages`),
  porque `/me/accounts` solo trae las administradas directo (dio solo Drean). ROQUÉ = business
  `109057158156439`.

**🟢 PLAN DE MEDIOS `/performance` (Meta ads) EN MAIN — COMPLETO, 3 TABS (réplica de Drean).** Tabs:
(1) **Impacto Campaña** (6 MetaKpiCards + 6 EvolCharts real-vs-meta + MetaPanel plan "Pauta Mkt");
(2) **Eficiencia Medios** (KPIs del período CPM/CPC/CTR/Frecuencia/CPCV; tabla **por campaña** con semáforo
best-in-class; tabla **por objetivo**; **calidad de video** scorecard ≥50%/VTR100/CPCV/desperdiciadas +
**embudo** plays→p25→p50→p75→p100; **top creativos** con thumbnail); (3) **Insights** (motor de reglas
in-code: mejor/peor campaña por CPM, mejor CTR, escalables VTR≥50%+bajo share, video desperdiciado).
Motor `lib/meta-pauta.ts` `getPautaFull` (insights nivel campaña + objetivos + ads con thumbnail, todo con
cursor `after`); UI `components/pauta/performance-tabs.tsx` (cliente, specs locales para no importar el
server-only `metas-dash`). Fuente única Meta (se extiende a multi-medio cuando entren Google/TikTok). **Enriquecido (sep-2026):**
Impacto Campaña ahora también tiene **Distribución de inversión** (donuts por objetivo + por campaña),
**Desempeño mes-vs-mes** (cards con Δ%) y **Embudo de conversión** (Impresiones→Alcance→Reproducciones→
25/50/75/100→Clicks). Eficiencia: **piezas ricas** (badge objetivo + activa, grilla Inv/Impr/Alc/Frec/
Clicks/CTR/CPM/Views/VTR + interacción reacciones/comentarios/compartidos/guardados, link a permalink,
paginación) — el motor trae `actions`+`effective_status`+`campaign{objective}`. **TIPOGRAFÍA: todo BIP usa
Manrope** (self-hosted `/fonts/Manrope-Variable.ttf`, idéntica a Drean; Poppins solo el logo). **Fondo
BLANCO** (`--bg:#fff`). Nav: se agregó **"Mkt de Influencia"** (soon) en Planes de Acción bajo Web/Ecommerce.
**Refinamientos visuales (sep-2026, réplica fiel de Drean):** (a) **gráficos de evolución** = cada KPI en su
**propio sub-card bordeado**, grid **2 columnas fijas** (`repeat(2,minmax(0,1fr))`), título `KPI — REAL VS
META`; (b) **etiquetas de meses SIN año** (solo `Ene…Dic`) + `interval={0}` en el `XAxis` → los 12 meses no
se solapan (antes decía "Ene 26Feb 26…" pegado); (c) **Embudo de conversión CENTRADO y compacto**
(`margin:0 auto`, `maxWidth:560`, sin el `minWidth:300` que rompía el taper; padding/fuente reducidos) → las
barras decrecen desde el centro y parece un embudo real; (d) **filterBar (selector Objetivo) en AMBOS tabs**
(Impacto tras el MetaPanel, Eficiencia arriba), tabs resaltados con subrayado ámbar como Drean. **PENDIENTE
fino:** secciones "por medio" (Aporte al funnel, Mix ON/OFF) recién aplican con
multi-medio; selector de categoría (Meta no tiene la taxonomía de Drean). Genérico
para cualquier cliente (no atado a ROQUÉ). Selector de **cuenta de anuncios** (`meta-assets`:
`listMetaAdAccounts` + `getSelectedAdAccount`, guardado en `connections.config.meta.ad_account_id`; el
`MetaAssetPicker` de Conexiones ahora tiene 2 selects: Redes=página/IG, Plan de Medios=cuenta de anuncios;
`setMetaSelection` hace **merge** para que convivan). Motor `lib/meta-pauta.ts` `getPautaLive`: insights
**nivel ad, `time_increment=monthly`** de la cuenta elegida → 6 KPIs = **Inversión (Σspend), Alcance único
(Σreach), Frecuencia (Σimpr/Σalc), Impresiones (Σimpr), VTR ≥50% (Σvideo_p50/Σimpr de piezas de video ×100,
igual que Drean: solo filas con p25+p50+p75>0), Clicks (Σclicks)**. Página: 6 `MetaKpiCard` + 6 `EvolChart`
real-vs-meta (reusa los de `/web`) + `MetaPanel` plan **"Pauta Mkt"** (`dash_metas`, `PAUTA_KPIS` en
`metas-dash.ts`). **VALIDADO por diag:** ROQUÉ **no corre pauta en Meta** (0 ad accounts); única cuenta con
gasto = Mabe/Drean (151M ARS/360d) → se valida el pipeline contra Mabe en dev, ROQUÉ sale vacío.
**VALIDADO con data real:** cuenta **"Mabe Argentina"** (`act_1428795852368328`) → el dash muestra
inversión/alcance/impresiones/clicks/VTR OK. OJO "MABE DREAN" (`act_217161613138470`) tiene gasto 0 → vacío;
la que tiene pauta es "Mabe Argentina". **GOTCHA PAGINACIÓN (resuelto):** `paging.next` venía con versión
distinta (v26) a la del request (v22) → `next.replace(GRAPH,"")` fallaba y armaba `v22.0https://...` (error
"Object with ID 'v22.0https:'", rompía Redes con cuentas grandes tipo Drean). Fix: paginar con
`paging.cursors.after` en IG media, FB posts y pauta insights. `/performance` bajado a `min:"insight"` para
que aparezca en el menú. **FALTA Google Ads** (la otra fuente de pauta — ver abajo).

**🟢 MAPA ESTRATÉGICO + SEGUIMIENTO DE OBJETIVOS (sep-2026) — GENÉRICO multi-tenant.** Réplica del
modelo de Drean (`Plan → KPI → Objetivo`) pero **SIN la dimensión de categorías** (Lavado/Refri/Cocción
eran de Drean; Meta no tiene esa taxonomía → sería data inventada). El modelo es agnóstico de industria.
- **Modelo** (`lib/mapa-config.ts`): `Objetivo{id,nombre,color,peso}` (peso estratégico, se normaliza a
  100%), `Kpi{nombre,vinculos:Record<objId,pesoInbound>}` (**sin `mix`**), `Plan{nombre,kpis}`. Helpers
  `normPeso`, `pesoAsignado`. Seed neutro (Notoriedad/Consideración/Conversión, sin planes).
- **Catálogo** (`lib/mapa-catalogo.ts`): SOLO planes con fuente real cableada — **Plan de Medios**
  (Inversión/Alcance único/Frecuencia/Impresiones/VTR≥50%/Clicks), **Redes Sociales** (Alcance orgánico/
  Engagement rate), **Web / Ecommerce** (Tráfico web/Duración sesión/Tasa conversión/Transacciones/
  Ingresos/Valor medio compra). KPIs sin fuente muestran ⏳ en el editor.
- **Persistencia**: tabla `mapa_estrategico` **por tenant** (PK tenant_id, jsonb objetivos+planes —
  **migración 0006, FALTA CORRERLA en Supabase de BIP**; hasta entonces getMapaConfig devuelve null →
  Seguimiento muestra empty-state y el editor avisa "falta migración 0006"). Lectura SSR
  `getMapaConfig(tenantId)` (`lib/mapa-server.ts`), API `/api/mapa-estrategico` GET/POST tenant-scoped
  (upsert onConflict tenant_id). **Fuente de verdad = DB, sin localStorage** (multi-tenant → evita fuga
  entre tenants en el mismo browser).
- **Editor** (`components/mapa/mapa-editor.tsx`, cliente, CSS plano): 3 secciones — (1) Objetivos con
  peso normalizado (algoritmo "balance en el vecino"), (2) matriz de vínculos inbound con **cap 100% por
  objetivo** (header muestra asignado/libre), agregar plan/KPI del catálogo, (3) composición por objetivo
  (barra apilada). Botón Guardar → POST (no router.refresh). Sin sección de mix/categorías.
- **Rollup** (`lib/objetivos-rollup.ts`, server-only): `cumpl(KPI)=min(real/meta,100)`; `cumpl(objetivo)=
  Σ pesoInbound×cumpl / Σ pesoInbound` (renormalizado → cobertura); **Salud de Marca = Σ pesoEstratégico×
  cumpl(objetivo)**. `getSeguimientoObjetivos(tenantId,anio)` devuelve objetivos + saludMarca + los KPIs
  del mapa (para el scorecard) en una pasada.
- **Real+meta por KPI** (`lib/objetivos-kpis.ts`, server-only): cruza Pauta (`getPautaForTenant`), Redes
  (`getRedesForTenant`, IG orgánico) y Web (`getWebMonthlyForTenant` en `lib/ga4-monthly.ts` — extraje el
  report yearMonth de GA4 que estaba inline en `/web`) con las metas (`getDashMetas` planes "Pauta Mkt" y
  "Redes Sociales" + `getWebMetas`). Serie real[12]+meta[12] por KPI; tipo sum (volumen, YTD suma) o rate
  (ratio, YTD promedio).
- **UI Seguimiento** (`/overview`): `ObjetivosHero` (card Salud de Marca + grid de objetivos con
  cumpl mes/YTD, semáforo, aporte de KPIs) + `KpiScorecard` (agrupa por plan; por KPI: real/meta/desvío
  del mes + YTD + sparkline SVG real-vs-meta). Componentes en `components/objetivos/`. Sin selector de
  categoría (v1 = vista única). Semáforo reusa `lib/web-viz` (`semaforoDe`/`cumplimientoPct`/`SEMAFORO_COLOR`).
- **Nav**: `/mapa-estrategico` y `/overview` salieron de `soon` en `lib/plan.ts` **y** `components/plan.ts`.
- **PENDIENTE**: (1) correr **migración 0006** en Supabase BIP; (2) el objetivo/scorecard necesita que el
  tenant cargue metas (MetaPanel de cada dashboard) + arme el mapa; (3) futuro: si un cliente necesita
  categorías, se re-agrega la dimensión (mix) como opcional.

**🟡 GOOGLE ADS API — el acceso CAMBIÓ (sep-2026), clave para que Plan de Medios tenga data.** El developer
token y el "API Center" de la MCC **ya NO son el camino** (el 9-10/sep/2026 Google movió los niveles de
acceso al **PROYECTO de Google Cloud**, no al token; el API Center quedó solo para tokens legacy de app
conversion → por eso el cartel rojo). **Proceso correcto (todo bajo `bip.explore`):** (1) MCC de BIP en
ads.google.com (recomendado, sin gastar; da `login_customer_id`). (2) **UN proyecto de Google Cloud** (reusar
**BIP-GO** que ya existe para GA4) → **habilitar "Google Ads API"** en API Library. (3) **OAuth consent screen
+ branding + "Verify branding"** (obligatorio ahora, acelera la aprobación; authorized domain = bip-go.com).
(4) OAuth client con scope **`https://www.googleapis.com/auth/adwords`** (se puede sumar al mismo client de
GA4, pero el nivel de acceso cuelga del **proyecto** → usar UN proyecto con GA4+Ads+Basic). (5) **Solicitar
Basic Access en la página "Google Ads API Overview" de Cloud Console** (NO en el API Center) → con brand
verification suele aprobarse en **minutos**. **Niveles:** Test (solo cuentas de prueba) → **Basic** (cuentas
reales, 15k ops/día — el que necesitamos) → Standard (ilimitado, solo si escala). **Leer cuenta de un cliente
= Camino A (OAuth directo):** el cliente autoriza con su Google, se lee su `customer_id`, **sin** linkear a la
MCC ni `login_customer_id`. **Nango:** provider `google-ads`, `developer_token` se inyecta del backend (campo
"automated"), `login_customer_id` opcional. El developer token todavía se manda pero está de salida.
**Pendiente:** el user hace los pasos 1-5; me pasa developer_token + client_id/secret → cargo en Vercel/Nango
y construyo el motor de Google Ads en `/performance`. Doc completa la sacó el research (release-notes p/versión
de API). **OJO:** la doc de Nango de google-ads describe el flujo VIEJO (API Center) — ignorarla en eso.
- **ESTADO VALIDADO (sep-2026, mirando la consola real):** Ads API **habilitada** en BIP-GO ✓, consent+branding
  ✓, scope `adwords` ✓, credencial OAuth **"BIP Nango"** existe (ya hay tráfico a la API). Nivel de acceso
  estaba en **"Prueba"** (Test, solo cuentas de prueba) → **se solicitó "Explorador"** (nombre nuevo del nivel
  que permite cuentas de producción; reemplaza a "Basic"), quedó **EN REVISIÓN** (aprueba en minutos con marca
  verificada). Cuando pase a **Explorador**: copiar developer token de la MCC "BIP" (`206-880-2546`, bajo
  dsabena — sirve igual, el acceso lo gobierna el proyecto BIP-GO) → cargar en Vercel/Nango + construir motor.
  **OJO nombres nuevos de niveles:** Prueba (Test) → **Explorador** (producción) → superior. La MCC quedó bajo
  dsabena (validado: bip.explore no tenía cuenta de Ads); no bloquea porque el acceso cuelga del proyecto Cloud.
- **VERIFICACIÓN OAuth ENVIADA (sep-2026) — en revisión de Google.** El nivel Explorador se había DENEGADO
  (auto) por falta de **brand/OAuth verification** (validado en consola: "Verificación de la app de OAuth ⚠️").
  Se completó y **envió la verificación**: (1) **logo** subido (`bip-logo.jpg` 512×512, generado con sharp —
  BIP + triángulo cyan); (2) **justificación** de los 3 scopes sensibles (analytics.readonly, adwords,
  spreadsheets.readonly — todos SENSIBLES, no restringidos → **CASA no aplica**); (3) **video demo**
  `https://youtu.be/A2mP9qZOW8k` (Oculto, subtítulos EN por `.srt`, muestra bip-go.com → consent OAuth con
  "app no verificada" → dashboards). Cuestionario: **No a las 4** → verificación completa. Marca verificada
  primero (obligatorio; dominio bip-go.com ya verificado en Search Console), después Data access. **PENDIENTE:**
  esperar aprobación de Google (scopes sensibles, días) → al quedar verificada, **re-solicitar Explorador** en
  "Google Ads API Overview" (aprueba) → pasarme developer token (MCC API Center) + client_id/secret → cargo en
  Vercel/Nango + construyo motor Google Ads en `/performance`.
- **UX SIDEBAR + PERF (sep-2026):** iconos de estado por dashboard (🔒 no habilitado por plan · ✓ verde
  conectado · ● ámbar habilitado sin conectar; layout calcula google→/web, meta+página→/redes, meta+cuenta
  ads→/performance). `/performance` bajado a `min:"insight"` para verse en el menú del tenant demo. La
  enumeración de cuentas Meta se **cachea** en `connections.config.meta_cache` (antes re-consultaba la Graph en
  cada visita a Conexiones → "Cargando cuentas…"); botón "↻ Actualizar cuentas" fuerza refrescar.

**🔵 CONECTOR TIKTOK (investigado a fondo sep-2026, FALTA que ROQUÉ arme la app).**
- **TikTok ≠ Meta:** son DOS mundos separados (dos apps, dos flujos, dos tokens). **Ads** = Marketing
  API → provider Nango **`tiktok-ads`** (token **SIN vencimiento**, sin refresh — por eso el template no
  tiene `refresh_url`, es correcto; una auth cubre **varios advertiser_ids**). **Orgánico** = Accounts
  API → provider **`tiktok-accounts`** (token de usuario que **SÍ vence**/refresca; ventana **60 días**;
  "views" mezcla orgánico+pago) → **fase 2 opcional**. NO usar `tiktok-personal` ni Research API
  (restringida a académicos).
- **v1 = `tiktok-ads`** (es la tarjeta "TikTok Ads" del menú de BIP). Portal correcto:
  **`business-api.tiktok.com/portal`** (NO `developers.tiktok.com`). Modelo de control = **igual que
  Meta**: la app conectora vive en el **TikTok for Business de ROQUÉ**, Daniel admin; los clientes
  autorizan por OAuth (Model 1, no hace falta agregar a nadie al Business Center).
- **Pedido a ROQUÉ (enviado):** crear TikTok for Business + Business Center + advertiser (ARS); crear app
  con **Marketing API** en el portal; redirect `https://nango.bip-go.com/oauth/callback`; permisos de
  **lectura/Reporting** (sacar captura del selector antes de enviar — nombres exactos no se pudieron
  transcribir, dominios TikTok bloqueados en el sandbox); pasar **App ID + Secret** (secret en privado);
  agregar a Daniel como **Admin**; validar en **Sandbox**; enviar a **auditoría** (~días-2sem) para prod.
- **Yo después:** configuro integración `tiktok-ads` en Nango (App ID+Secret, scopes vacíos — TikTok
  maneja permisos en la app), y armo diag como el de Meta. **Gotcha:** confirmar ARS del ad account AR
  (reporting devuelve en la moneda de la cuenta; si no, FX como DV360).
- **Identidad TikTok de BIP CREADA (sep-2026):** Daniel registró `bip.explore@gmail.com` en
  `business.tiktok.com` como **advertiser** → Business Center **"BIP - Business Impact Platform"**
  (BC ID `7684666094161936400`) + ad account "BIP" (`7684666093257736208`). Así el email ya existe en
  TikTok para que ROQUÉ lo invite como Admin sin fricción (lección de Meta: la identidad debe existir
  antes). Se salteó "Link TikTok accounts" (opcional, es para correr campañas). **ORGÁNICO también
  pedido** → ROQUÉ debe tener además una **cuenta de contenido TikTok Business** (@handle) para
  `tiktok-accounts`. **Nota TikTok ≠ Meta:** el admin de TikTok va por email y se registra al aceptar
  (no exige perfil previo como Meta), así que acá bip.explore SÍ sirve.

**✅ NANGO SELF-HOST DEPLOYADO EN RAILWAY.** Estado:
- Proyecto Railway **`ravishing-flow`** (cuenta de BIP), 3 servicios **Online**: `nango-server`
  (imagen **`nangohq/nango-server:hosted-0.71.6`**), Postgres, Redis.
- **`NANGO_ENCRYPTION_KEY` está en las Variables de Railway** (es **INMUTABLE** — el user tiene que
  **backupearla en un gestor de contraseñas**; si se pierde, se pierden todas las credenciales. NO
  se commitea acá por seguridad).
- Dashboard: user **`bip`** + `NANGO_DASHBOARD_PASSWORD` (en Railway).
- Dominio temporal: `nango-server-production-ce30.up.railway.app` (port 3003).
- **Custom domain `nango.bip-go.com`** agregado en Railway (port 3003). DNS cargado en **Netlify**
  (DNS de bip-go.com): CNAME `nango` → `imgga2if.up.railway.app` + TXT `_railway-verify.nango`.
  Al momento de guardar: **Railway emitiendo el SSL** ("Certificate Authority is validating
  challenges") → esperar a que pase a ✓.
- Env vars ya puestas con `NANGO_SERVER_URL=https://nango.bip-go.com` (el callback correcto).
- **OJO uptime:** el trial de Railway ($5/30días) alcanza para probar; para 24/7 (la sesión no
  puede dormir) → plan Hobby ~$5/mes.

**RETOMAR: cuando `nango.bip-go.com` tenga SSL ✓:** (a) abrir `https://nango.bip-go.com` (login
`bip` + pass) para confirmar que Nango levantó; (b) **recrear la integración Google** en ESE Nango
(mismo Client ID/Secret propios + los 3 scopes) y copiar el **Secret Key** nuevo; (c) seguir la
secuencia de Google de abajo (cambiar redirect, sacar nango.dev, verificar marca, enviar scopes);
(d) apuntar la app (bip-platform en Vercel) a `NANGO_HOST=https://nango.bip-go.com` +
`NANGO_SECRET_KEY` nuevo.

**Secuencia de verificación de Google (la que queda tras el self-host):**

El user quiere sacar el cartel "app no verificada". **Requiere el self-host de Nango primero**
(el callback debe salir de `nango.dev`). Todo el runbook está listo en el zip:
`infra/nango-railway/RUNBOOK.md` + `docs/verificacion-google.md` (justificaciones de scopes + guión
del video ya escritos). Secuencia: (1) Nango self-host en **Railway** → `nango.bip-go.com`;
(2) recrear integración Google ahí; (3) cambiar redirect en Google Cloud a
`nango.bip-go.com/oauth/callback` y sacar el de `api.nango.dev`; (4) sacar `nango.dev` de dominios
autorizados; (5) verificar `bip-go.com` en Search Console (TXT en DonWeb); (6) "Verificar la marca"
→ pasa; (7) enviar verificación de scopes; (8) apuntar la app al self-host (`NANGO_HOST` +
`NANGO_SECRET_KEY` nuevos en Vercel). Implica **~$5-20/mes de Railway** + un cambio de DNS. El user
paró acá porque estaba cansado — arrancar por Railway (login con GitHub de BIP → New Project).

### Lo que FALTA para que sea el producto completo
1. **Los dashboards reales** (los ~17 de Drean) todavía NO están cableados en el shell — los links
   del menú apuntan a rutas que aún no existen en `bip-platform`. Próximo build grande: **traer los
   dashboards del fork de Drean** y colgarlos del shell, cambiando `process.env.TOKEN` →
   `getToken(tenant, provider)` en cada query/cron.
2. **Stripe** (billing): crear 3 Products+Prices (planes) + 3 add-ons, cargar los `STRIPE_*` en
   Vercel, configurar el webhook a `/api/billing/webhook` y el Customer Portal. Recién ahí se cobra.
3. **Nango self-host + verificación** (sacar el cartel). Ver sección de abajo.
4. **Meta/TikTok**: App Review de cada plataforma.

## Sacar el cartel "app no verificada" — plan definitivo (self-host Nango en Railway)
> Decidido sep-2026 tras llegar a la pantalla de verificación de Google y toparse con el bloqueo.

### Por qué aparece el cartel y por qué NO se puede verificar hoy
- La app OAuth (`BIP-GO`) ya está **En producción** (tokens estables, hasta 100 usuarios), pero
  **sin verificar** → sale "Google no verificó esta app" (Avanzado → Continuar). Funciona igual.
- **El bloqueo de la verificación es el dominio autorizado `nango.dev`.** Se metió **automático**
  cuando el OAuth client usó el redirect `https://api.nango.dev/oauth/callback` (el de **Nango
  Cloud**). Google exige que **TODOS los dominios autorizados estén verificados a tu nombre** en
  Search Console. `bip-go.com` sí; **`nango.dev` NO es tuyo → imposible verificarlo** → traba todo.
- Confirmado con precios reales (sep-2026): Nango Cloud **Free** = 10 conexiones (callback
  compartido); **Starter** ~$50/mes (20 conns + $1 c/u); **Growth** $500/mes (agrega branding del
  Connect UI, NO callback propio); **callback en dominio propio recién en Enterprise**. O sea:
  **pagar Nango Cloud NO resuelve la verificación** salvo Enterprise (caro).

### La solución: self-hostear Nango en un dominio propio (`nango.bip-go.com`)
Nango es **open source**. Self-host = correr el mismo software en un server tuyo (Railway), con el
callback en **`https://nango.bip-go.com/oauth/callback`** → dominio **tuyo, verificable**. Gratis el
software; solo ~**$5-20/mes** de server; **conexiones ilimitadas** (no $1 c/u). Resuelve **costo Y
verificación** a la vez. Era el plan de escala desde el arranque.

### Pasos para sacar el cartel (los ejecuta el USER; Claude deja el kit + runbook)
1. **Deploy Nango self-host en Railway** (docker-compose oficial de Nango: server + Postgres +
   Redis + Elasticsearch/Temporal según versión). Kit + runbook en
   `scratchpad/bip-platform/infra/nango-railway/` (o el zip entregado).
2. **Subdominio `nango.bip-go.com`** → CNAME al deploy de Railway (DNS en DonWeb + "custom domain"
   en Railway). Esperar SSL.
3. **Recrear la integración Google** en el Nango self-host (mismo Client ID/Secret propios + los 3
   scopes sensibles). Copiar el **nuevo Secret Key** del self-host.
4. **Google OAuth client** → cambiar el redirect a `https://nango.bip-go.com/oauth/callback` y
   **borrar** el de `api.nango.dev`.
5. **Google Auth Platform → Información de marca → Dominios autorizados** → dejar **solo
   `bip-go.com`** (borrar `nango.dev`).
6. **Verificar `bip-go.com` en Google Search Console** (mismo mail `bip.explore@gmail.com`,
   registro TXT en DonWeb).
7. **"Verificar la marca"** → ahora pasa (todos los dominios son tuyos).
8. **App (Vercel):** `NANGO_HOST=https://nango.bip-go.com` + `NANGO_SECRET_KEY` del self-host.
9. **Enviar verificación de scopes** → textos de justificación + guión del video ya escritos en
   `scratchpad/bip-verificacion-google.md`. Google revisa **días/semanas**.

### Mientras tanto (importante)
La app **YA sirve para los primeros clientes** en producción con el cartel (Avanzado → Continuar),
hasta 100 usuarios. La verificación es solo para **sacar el cartel + escalar >100**, y va **junto**
con este self-host. No bloquea onboardear los primeros clientes.

## Cómo retomar
Leer este doc. El código vive en los zips que tiene el user (pedirle que los suba si hace falta
continuarlo, o regenerar desde el README del `bip-mvp`). Próximo paso natural: **Google Cloud**
(la verificación lenta) una vez propagado el dominio.

---

## Sesión sep-2026 (2) — Comando staff, onboarding en 2 pasos, planes por tier, verificaciones

Todo en el repo **bip-platform** (deploy = push a `main`, Vercel). Commits clave: `181ede4`
(menú+histórico), `e8a043e` (gate bienvenida), `9d74f4e`/`5e0a22e` (comando+impersonación),
`d2d293c` (staff), `b25398b` (review bypass), `c3abbc8` (onboarding 2 pasos), `69983e6` (6/12).

### Tablero de COMANDO del staff + "ver como cliente" (impersonación)
- **Staff = `dsabena@gmail.com`** (env `BIP_STAFF_EMAILS`, default en código = solo dsabena).
  **`bip.explore` YA NO es staff** (es la cuenta cliente/demo que usan los revisores de Meta →
  tiene que ver dashboards, no el CRM).
- Staff sin impersonar → **shell de comando** (nav propia: "Comando · Clientes" = `/consultor` CRM;
  sin la vista cliente). Layout `app/(app)/layout.tsx`: `if (isStaff && !acting)` renderiza
  `<Sidebar staffCommand>`. `/dashboard` redirige staff→/consultor salvo que esté impersonando.
- **Impersonación:** cookie `bip_act_as` (const `ACT_AS_COOKIE` en `lib/tenant.ts`). `getCurrentTenant()`
  la respeta **solo si el user es staff** → devuelve ESE tenant con `acting:true` → todos los
  dashboards renderizan la data del cliente. Se setea/limpia en `/api/staff/act-as?tenant=<id>` /
  `?exit=1`. Botón "👁️ Entrar al tablero de <cliente>" en el CRM (`components/crm-board.tsx`,
  fila expandida). Banner `components/act-as-banner.tsx` + link "Volver al comando" (limpia cookie).
- **Cuentas de VALIDACIÓN (Google/Meta):** env `BIP_REVIEW_EMAILS` (CSV) → saltean el gate de
  onboarding pero NO son staff (ven la vista cliente). `bip.explore` no necesita estar ahí porque
  ya saltea el gate por tener Meta conectado. (helpers en `lib/profile.ts`.)

### Pantalla inicial "Bienvenidos" (gate) + onboarding en 2 pasos, DENTRO de la plataforma
- Se **re-activó** el gate (estaba off desde 14-sep). Mientras el perfil no esté `completed`, el
  layout renderiza el shell con **Sidebar en modo `locked` (preview)** + `WelcomeProfile` en el main
  → el cliente ve el menú/interfaz mientras carga (no una pantalla pelada). **Lo saltean:** staff,
  review accounts y cualquier tenant con conexión activa.
- **Form en 2 pasos** (`components/welcome-profile.tsx`, `mode="onboarding"`): **Paso 1 = empresa**
  (nombre, sector, marca+web/redes, categorías) → "Continuar" (guarda `phase="core"`, `completed=true`,
  desbloquea). **Paso 2 = competencia** (4 competidores nombre+redes/web + retailers). Optimize/
  Accelerate lo exigen; **Insight = gancho opcional** ("🎁 Sumá la mirada competitiva" + "Quizás
  después"). Route `/api/profile` valida competidores SOLO en `phase="competitive"` + `needCompetitive`.
  `/cuenta/perfil` (`mode="settings"`) = una pantalla con todo.

### Planes por tier (menú + histórico)
- **"Mkt de Influencia" SACADO del menú** (todos los planes) — era `soon:true`; reactivar cuando
  el tablero exista (`lib/plan.ts` NAV).
- **Histórico 6 / 12 meses** (NO 12/24): `historyMonths(plan)` (Insight/Trial 6, Optimize+ 12) +
  `historyStartDate` en `lib/plan.ts`. Cableado: rango live de `/redes` y `/performance`
  (los tenants nuevos sin snapshot caen a live); selector de período de `/web`
  (`monthOptions(historyMonths(plan))`); copy de `PLAN_FEATURES` y de `/cuenta/plan` (6/12).
  **Pendiente opcional:** recortar duro el eje de los gráficos mensuales de web a 6/12 (hoy dibujan
  el año calendario y muestran solo meses con dato). Snapshots (web/seo) toman la ventana del cron.
- **Matriz de dashboards por plan (confirmada por el user):** Insight = Mapa, Seguimiento, Plan de
  Medios, Redes/Web base, Resultados, Inversión, IA, Alertas. **Insight NO tiene SEO ni Trade.**
  Optimize = + SEO + Trade + capa de competencia (Redes/Web/SEO). Accelerate = + 3 categorías.

### Verificaciones (estado sep-2026)
- **Google OAuth (scope `adwords`) = APROBADO** (email "We've approved… .../auth/adwords",
  project 279230041069). Ojo: no se hereda — un scope nuevo o cambio en la consent screen pide
  re-verificación.
- **Meta App Review** (9 permisos) = enviado, esperando. Login de prueba = `bip.explore`.
- **TikTok** = las 2 apps (BIP Connector/Organic) **RECHAZADAS** por el PERFIL de negocio:
  "company name no coincide con email domain/website". Fix: consistencia empresa↔web↔email +
  Description con prueba de relevancia a BIP (bip-go.com), completar Additional Information, y
  reenviar. Company actual = "Roque Research Solutions" / roque-in.com.

### Los 3 usuarios de validación (los crea el user, con su plan)
`insight@bip.com` (Basico), `optimize@bip.com` (Intermedio), `accelerate@bip.com` (Full) +
`google.review@bip-go.com`. Al setear el `plan` del tenant, el onboarding, menú e histórico se
adaptan solos.

### PENDIENTE de validar (sin cerrar de la sesión anterior)
- SEO nuevo: correr `bip-go.com/api/diag/seo` logueado → confirmar `data.serp` (keyword-ideas) y
  `data.regions` (mapa por provincia). Migración 0023 ya corrida + retailers de Drean cargados.
- Trial competitivo para Insight (habilitar la capa gratis con vencimiento) — no armado aún.

## Etapa de REVISIÓN previa al lanzamiento (sep-2026) — bip-platform PR #2 (mergeado)
Pedido del user: **curar la primera experiencia** → el cliente nuevo NO ve sus tableros hasta que
el staff los revisa y los **libera TODOS JUNTOS** (decisión del user: no por tablero). **El trial de
15 días arranca al LIBERAR** (decisión del user), no al registrarse.
- **Estado** `tenants.review_status`: `pending` (sin fuentes) → `in_review` (conectó la 1ª fuente
  en `connect/[provider]/callback` → email al staff) → `released`. Migración **0025_launch_review.sql**
  (existentes quedan `released`; altas nuevas nacen `pending`). **✅ 0025 CORRIDA (23-sep-2026)** —
  validado: los 6 tenants existentes quedaron `released` → la etapa está ACTIVA para altas nuevas.
- **Cliente**: gate en `app/(app)/layout.tsx` → `LaunchPending` ("Estamos preparando tus tableros",
  checklist de pasos) con sidebar locked; `/cuenta/*` sigue accesible. Saltean: staff impersonando y
  `BIP_REVIEW_EMAILS`.
- **Staff**: `/consultor` → cola **"Revisión de lanzamiento"** (`components/review-queue.tsx`,
  `lib/launch-review.ts` `getReviewQueue`): espera con semáforo 24/48h, chequeo automático (perfil,
  fuentes, último `sync_runs` por fuente, page/ad account de Meta, Mapa), "Revisar como cliente"
  (banner azul "en revisión"), "Correr sync ahora" (`/api/staff/review` action `sync` → crons con
  `?tenant=`), "Liberar tableros" + mensaje de bienvenida (email al cliente + card en Inicio 14 días).
  Action `reopen` para volver a revisión.
- **Emails**: `lib/notify.ts` (Resend REST). **Opcional/PENDIENTE USER:** `RESEND_API_KEY` +
  `NOTIFY_FROM` en Vercel con dominio `bip-go.com` verificado en Resend; sin eso el aviso es solo in-app.
- Detalle menor: el trial se setea también en el onboarding (15d) y se **resetea al liberar**; mientras
  está en revisión `/cuenta/plan` muestra una cuenta regresiva que no aplica todavía.

## Archivos VINCULADOS con auto-sync — SharePoint/OneDrive + Google Sheets (sep-2026, bip-platform PR #3)
- Datasets vinculados guardan `source_ref` (`{fileUrl,sheet,range}` o `{spreadsheetId}`); el cron
  **`sync-datasets` (cada 30 min)** consulta la fecha de modificación y, si cambió, **pisa el MISMO
  dataset** (mismo id → los tableros del builder se actualizan solos). `lib/dataset-sync.ts`,
  `lib/google-sheets.ts`, `lib/ms-graph.ts` (`getSharepointLastModified`). UI: en Conexiones, con
  SharePoint conectado → pegar link para compartir (+ hoja opcional); tabla "Tus archivos" con estado
  + "↻ Actualizar". Migración **0026_dataset_autosync.sql** (fail-safe: sin ella guarda copia fija).
- **✅ HECHO (23-sep-2026):** cuenta Microsoft `bip.explore@gmail.com` + alta Azure (quedó "pendiente de
  revisión" anti-fraude, pero Entra ya funcionaba; **24-sep-2026: Azure APROBADA** — "Tu cuenta ya está
  lista", la revisión anti-fraude terminó. OJO: eso es la cuenta/suscripción Azure, NO la Publisher Verification
  de la app, que sigue pendiente) → app Entra **"BIP Connector"**, **Client ID
  `fe112911-4bb7-4f6b-ab6d-5f8d51ad95d4`**, "Varios inquilinos de Entra ID" + "Mostrar todos los
  inquilinos" (sin cuentas personales), redirect Web `https://nango.bip-go.com/oauth/callback`, 4 permisos
  delegados (ninguno pide admin consent por default), secreto 24 meses (vence ~sep-2028 → renovar). Nango
  self-host (env `dev`): proveedor **Microsoft Excel** (NO el "Client Credentials"), Integration ID
  renombrado a **`sharepoint`**. Falta: probar conectar desde BIP con una cuenta M365 de EMPRESA.
- **CUENTAS PERSONALES (decisión user 23-sep-2026, bip-platform PR #4):** la app pasa a aceptar
  "Cualquier inquilino de Entra ID + cuentas personales" (manifest `requestedAccessTokenVersion: 2`).
  Microsoft: en cuentas personales **NO existe `Sites.Read.All`** (el login falla si se pide) y **NO
  anda la API `/workbook`** → se SACÓ `Sites.Read.All` (Entra + scopes de Nango; `Files.Read.All`
  alcanza para `/shares` + leer archivos) y `readSharepointRange` cae a **descargar `/content` +
  parsear con SheetJS** si `/workbook` falla. Prueba: cuenta Microsoft personal `bip.explore` con un
  Excel en su OneDrive. **Mabe (cuenta corporativa del user) pidió aprobación de admin → NO usar
  cuentas de Mabe/Drean para probar BIP** (es otro proyecto; requeriría autorización formal).
  Para clientes empresa grandes: tramitar **Publisher Verification** (dominio `bip-go.com` en Entra
  + ID Microsoft AI Cloud Partner Program) para sacar el "sin comprobar".
- **(histórico) PENDIENTE USER:** (1) correr 0026; (2) **app Microsoft Entra ID** "BIP Connector" multitenant,
  plataforma Web, redirect `https://nango.bip-go.com/oauth/callback`, permisos delegados Graph
  `Files.Read.All`, `Sites.Read.All`, `offline_access`, `User.Read`; (3) en Nango self-host crear
  integración proveedor **Microsoft Excel** (o "Microsoft") con **Integration ID = `sharepoint`**
  (el código usa ese id literal) + Client ID/Secret + esos scopes. Clientes con tenant M365 que
  bloquee consentimiento de usuario → su admin tiene que aprobar la app.

## ⚠️ GOTCHA DEPLOY bip-platform (23-sep-2026): Vercel Hobby BLOQUEA commits de otro autor
Vercel de bip-platform es de la cuenta **`bip-explore`** (plan Hobby). Los merges #1–#4 (squash vía API
con el acceso de `dsabena-byte`) quedaron firmados por `dsabena-byte` → deploys de producción **"Blocked"**
(los previews sí "Ready") → producción quedó en el commit previo (sin etapa de revisión ni SharePoint).
**Regla (acordada con el user, en `bip-platform/CLAUDE.md`):** commits firmados `bip-explore
<bip.explore@gmail.com>` + merge con **rebase** (PR #5 = primero así; autor bip-explore, committer
dsabena-byte). Si igual queda Blocked: Vercel → preview "Ready" → "…" → **Promote to Production**.

## ✅ REDISEÑO UX DEL RECORRIDO DEL CLIENTE (23-sep-2026, bip-platform PR #7)
Propuesta aprobada por el user (artifact "BIP · Primeros pasos": `claude.ai/artifact/R2gQ1RVZCsGXS5XGWCwnss`)
e implementada completa. Decisiones del user: **sí** "Continuar con Google"; **competidores dentro del
tablero**, no en el onboarding; **Conexiones → "Fuentes de datos"**.
- **Antes:** 7 pantallas y ~45 campos antes del primer dato (nombre pedido 2 veces, 20–30 campos de
  competencia antes de ver valor, Inicio = 3 guías y 5 CTAs, Conexiones organizada por tecnología).
- **Ahora:** `/signup` (3 campos + 1 casilla, o Google) → **`/empezar`**: Tu marca → ¿Qué querés ver
  primero? (`tenant_profile.intents`, migración **0027**) → conectar SOLO lo necesario, de a una, con
  la elección de cuenta ahí mismo. Inicio = "Tu próximo paso" (`lib/journey.ts` → `homeSteps`),
  `/ayuda` = Centro de ayuda, Fuentes de datos = lista con estado + `SheetAdder` (detecta link
  Google/Microsoft). Competidores/categorías/sitio → `CompetitivePrompt` en Redes/Web/SEO.
- **PENDIENTE USER:** (1) correr la migración 0027; (2) habilitar **Google** en Supabase → Authentication
  → Providers (Client ID/Secret de un OAuth client Web de Google Cloud BIP-GO, con redirect
  `https://czcfrzqioulhjfqkagcb.supabase.co/auth/v1/callback`); (3) probar el alta completa con un email nuevo.
- **Ajustes post-prueba del user (bip-platform PR #9 y #10):** (a) pie del menú = Fuentes de datos ·
  Centro de ayuda · **botón de cuenta** (marca + plan/días de prueba) → Mi cuenta · Plan · Salir;
  (b) **Perfil del negocio NO va en el menú** (decisión user: se pregunta una vez) → es una pestaña de
  **Mi cuenta** (Usuarios · Contraseña · Perfil), con subpestañas Tu marca / Competencia y SEO, y links
  "Editar" junto a los competidores en Redes/Web/SEO; (c) **"Inicio" → "Primeros pasos"** con avance
  (3/5), visible solo mientras falten pasos; con todo configurado `/dashboard` redirige al
  **Seguimiento de Objetivos** (pantalla principal).

## ✅ UX v2 "GUIADO Y SIMPLE" (23-sep-2026, bip-platform PR #15)
Pedido del user: el flujo fuentes/planillas/ayuda seguía confuso → **sin centro de ayuda**, ayuda
embebida en cada paso. Propuesta: artifact `RFg4dSrCEh3YDqPdq92HZD`. Implementado:
- `/empezar`: **un solo objetivo** (Publicidad / Redes / Web / Presupuesto) → **mini-stepper del
  setup de ese objetivo** (`SETUP_STEPS`), autoselección de cuenta/página si hay una sola.
- **Tableros que se configuran solos:** `ConnectInPlace` (Web/Redes/Performance vacíos conectan ahí
  mismo) y `TableroSetup` (tableros de planilla: elegir planilla → preview → widgets sugeridos).
  Las planillas se suman desde el tablero, no desde Fuentes de datos (queda como lista de estado).
- **Pill "Configuración N/5"** con drawer (conectar · cuenta · objetivos · metas · seguimiento);
  `/dashboard` solo redirige. **Plantillas de Mapa Estratégico** por sector.
- **Se borraron `/ayuda` y el Inicio viejo.** `SourceHelp` = "¿No tenés acceso?" + mensaje copiable
  al admin. Bienvenida del consultor al liberar = `WelcomeNote` cerrable (14 días).
- Validado tsc + build. Detalle vivo en el `CLAUDE.md` de bip-platform.

## ✅ ONBOARDING v3 "MODELO DE IMPACTO" (23-sep-2026, bip-platform PRs #16–#26)
Iteración en vivo con el user (probando con cuentas nuevas `dsabena+pruebaN@gmail.com` en incógnito):
- **Concepto:** BIP NO es reporting (storytelling bip-go.com). Paso 3 = "Construyamos tu modelo de
  impacto": planes que trabaja hoy (multi) — Redes Sociales (orgánico FB+IG; TikTok cuando esté la app),
  Publicidad (Meta Ads + Google Ads al mismo nivel), Web/Ecommerce — cada uno con su promesa de valor.
  Inversión fuera del arranque. Sitio web de la marca OBLIGATORIO (base competitiva).
- **Paso 4** conecta y elige TODAS las cuentas en una secuencia (Página, Meta Ads, propiedad GA4,
  cuenta Google Ads; autoselección si hay una) → cierre "Listo, tus datos están conectados" (validar
  cuentas + tus tableros con tiempos: métricas en minutos, sentimiento/imágenes en horas) → Mapa en
  un solo paso (plantilla del sector con objetivos+KPIs) → "Tu modelo quedó armado" + metas.
- **Sacado por ruido:** centro de ayuda, pill/panel "Configuración", guía (`HowToRead`) en tableros
  vacíos. Menú: cuenta/Salir siempre visible.
- **Fix Plan de Medios:** serie mensual de Meta a nivel cuenta (a nivel ad se truncaba en cuentas
  grandes → tarjetas en "—").
- **Relevamiento de dashboards (gaps pendientes):** Google Ads en `/performance` es una tarjeta suelta
  (portar como Drean: el próximo desarrollo), offline no existe, Web con categorías/PDPs hardcodeados de
  Drean, IA de Insights con datos incompletos, "Alertas" vendidas sin existir. Detalle en el CLAUDE.md
  de bip-platform.

## ✅ SIN REVISIÓN + DATOS COMPLETOS EN LOS TABLEROS (23-sep-2026, bip-platform PRs #29–#32)
- **Sin etapa de revisión/curado** (decisión del user): la 1ª fuente libera sola al tenant, arranca el
  trial y avisa al staff; el cliente ve sus tableros apenas conecta.
- **3 auditorías del camino API → tablero** (Web/GA4, Redes, Plan de Medios) y fixes:
  - **Web (#30):** propiedad GA4 ELEGIDA (paginada, nunca "la primera"), errores visibles, snapshot v2
    por propiedad+período, reportes aditivos (sin usuarios inflados), categorías = secciones reales del
    sitio (o las de electro si aplican), top productos desde ítems de ecommerce o PDPs de cualquier
    plataforma, sitios sin ecommerce → conversión por eventos clave, día 1 → mes anterior.
  - **Redes (#31):** sin tope de 200 posts (FB `published_posts` since/until, IG por fecha), ventana =
    año en curso (hora AR), fallas de insights visibles y sin pisar datos buenos, token de Página en vivo,
    pautados marcados (regla relativa) en vez de borrados, sentimiento por conteo real + permisos
    visibles, primer sync al elegir la Página.
  - **Plan de Medios (#32):** sin ceros silenciosos (warnings + snapshot que no se degrada), consultas
    aptas para cuentas grandes, alcance de-duplicado, rango único, primer sync al elegir cuentas,
    **Google Ads integrado** (serie mensual + campañas + filtro Medio; monedas distintas no se suman).
- Nada de esto se probó contra las APIs reales desde el sandbox (sin credenciales): validar con cuentas
  reales y mirar los avisos "datos parciales" si aparecen.

## ▶ Para retomar (cierre 23-sep-2026)
- Estado vivo y próximos pasos en el **CLAUDE.md de bip-platform** (sección "Estado y próximos pasos").
- Último cambio: el sitio web ya NO se pide en el onboarding (bip-platform #33); se pide en Web/SEO.
- Siguiente: el user prueba los tableros con cuentas reales y manda capturas → ajustar campos de API
  que fallen. Después: offline por planilla, IA de Insights con datos completos, alertas reales.

## ✅ IA + MÉTODO BIP (24-sep-2026, bip-platform PRs #35–#38)
- **Copiloto "Preguntale a tus datos" (#35):** gpt-4o, 10 pasos, tools por dominio con parámetros, `calc`
  determinístico (correlación, elasticidad, proyección, CPA/ROAS/CPCV, reasignación), método de cruce,
  contexto de tablero, markdown + tarjetas de posts, pasos en vivo (NDJSON), rate limit.
- **Insights por tablero (#36):** motor de señales determinísticas `lib/signals` (umbrales relativos a la
  data propia) para Redes/Pauta/Web/SEO/Overview + Diagnóstico IA con data pack y sección "Oportunidades
  de optimización"; el chat consulta las señales (`get_senales`).
- **IA en todos los planes (#37)** (incluida la prueba).
- **Método BIP (#38):** `/guia` con 44 módulos (estratégico/táctico/operativo paso a paso por plataforma)
  atados al ciclo Construir/Aprender/Optimizar/Acelerar, 44 KPIs con fórmula/benchmark/palancas, y el
  chat cita módulos (`get_guia`). Pendiente: pasar el contenido a tabla `kb_content` (edición sin deploy).
- Nada probado contra OpenAI/APIs reales desde el sandbox.

## ✅ MOTOR DE TABLEROS DE PLANILLA v2 (24-sep-2026, bip-platform #39)
Motor tipo Tableau con la simpleza de BIP: `lib/viz/*` (parsing es-AR, calculados seguros, filtros,
granularidad, top N, % total, acumulado, media móvil, vs anterior/YoY, metas, pivot, blend por clave),
`components/viz/*` (15 tipos de visual con el sistema de BIP), builder `components/viz-builder/*`
(estantes + "Mostrame", drag&drop, filtros de tablero y cruzados, "Armalo con IA", tablero automático,
plantillas Inversión/Resultados/Trade), modo reporte (PDF + Excel) y "Mis tableros" (`/tableros`).
Config v2 en `tenant_dashboards.config` (upgrade de configs viejas al leer). Miembros = solo lectura.
Detalle en el CLAUDE.md de bip-platform.

## ✅ MEDIOS OFFLINE EN PLAN DE MEDIOS (24-sep-2026, bip-platform #41)
TV, radio, vía pública, DOOH, cine, gráfica y BTL se cargan por **planilla** (plantilla Excel descargable
en `/api/pauta-offline/plantilla`; tarjeta "Medios offline" `#offline` en `/performance`, mapeo con
auto-detección + preview). Config en fila reservada `tenant_dashboards` slug `pauta-offline` (sin
migración). Se integra con todo: `mergePauta(meta, google, offline)`, filtro Online/Offline, mix de
inversión por medio, eficiencia (contactos, CPM contactos, GRPs, costo/GRP), Seguimiento, señales, IA y
chat, módulo del Método BIP. **Reglas:** Inversión = online+offline; **contactos offline NO se suman a
impresiones digitales** salvo marcarlos "comparables"; el alcance nunca se suma entre medios; monedas
distintas no se suman (aviso). Pendiente: metas de GRPs/contactos; prueba con datos reales.

## ✅ OPTIMIZE / ACCELERATE CON VALOR REAL (24-sep-2026, bip-platform #43)
5 frentes: (A) datos de competencia sólidos (engagement FB/TT real, marca propia auto, DataForSEO sin
saldo no pisa, historial mensual, crons por tenant, fixes SEO); (B) **Tu mercado** `/mercado` (sugiere
categorías/competidores/retailers, 1..N competidores, sync inmediato); (C) **22 señales cruzadas**
propio×mercado + KPIs de mercado con metas en el Mapa + **Search Console**; (D) gating por plan real,
**alertas email** (semanal Optimize / diaria Accelerate) + **reporte ejecutivo mensual**, **simulador de
presupuesto**, **Research** (Salud de Marca + Share de mercado por planilla), **pauta de la competencia**
(Ad Library vía Apify); (E) **categorías en todos los tableros** (Accelerate). Migraciones a correr:
**0028–0031**. Config pendiente: Search Console (API + scope `webmasters.readonly` en Google Cloud y Nango,
clientes reconectan Google), `RESEND_API_KEY`/`NOTIFY_FROM`, `APIFY_ACTOR_AD_LIBRARY` opcional.
Pendiente: alinear landing (`bip.html`) con los planes nuevos. Nada probado con APIs reales.

## Finanzas de BIP (CRM → Finanzas, solo staff) — sep-2026
- **Qué es:** tablero de viabilidad económico-financiera en `/consultor/finanzas` (iframe `srcDoc`, alto por
  `postMessage` + ping al montar) + Excel descargable `/api/staff/modelo-financiero`. 3 caminos: **A Consultivo**
  (socio vende los primeros meses), **B Digital** (pauta), **C Autofinanciado** (consultivo + reinversión de un % de la
  ganancia en pauta, solo si LTV/CAC digital ≥ umbral). Unipersonal: IIBB Córdoba 4,75%, Ganancias persona humana
  (escala art. 94, anual), autónomos.
- **Fuentes en `bip-platform/scripts/finanzas/`** (README): `model.js` (motor, espejo del Excel; `node parity.js`),
  `ui.js`, `know.js` (🎓 + glosario), `head.html`/`body.html`, `build.py` (Excel con fórmulas), `gen.py` (genera
  `lib/finanzas/*.ts`). Los `.ts` son salida: NO editarlos a mano. Artifact espejo: `UH1XF6Ze41ixgHsq5PGkPi`.
- **Reglas del user:** (1) orden de lo general a lo particular (Resumen → Cómo funciona → Sensibles → Ajustá →
  Cómo definirlas/punto óptimo → Detalle → Plan → Riesgos → Glosario); (2) **ningún análisis fijo**: todo texto con
  números/conclusiones se recalcula con los supuestos; (3) paleta sobria (color de camino solo en puntos/líneas, verde
  solo "mejor"); (4) 🎓 en cada indicador + "Cómo leer" + glosario; (5) sin barra de scroll propia.
- **Modelo de demanda (supuestos, no medidos):** alcance del servicio por plan (IA/competencia/SEO → costo y valor
  percibido), ventas = exp(−s·(precio rel./valor − 1)), churn × precio^η × valor^−k, esfuerzo comercial por plan.
  El óptimo depende sobre todo de la sensibilidad al precio → recomendación: medirla con pruebas de precio.
