# BIP Platform — Handoff (proyecto APARTE de Drean)

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

**🔴 BLOQUEO ACTUAL (sep-2026): la CONEXIÓN OAuth no se completa en el self-host.** La marca ya
está verificada, pero al intentar conectar Google **el flujo OAuth nunca termina** (esto BLOQUEA
grabar el video demo, que a su vez BLOQUEA enviar la verificación de scopes). **Root cause
CONFIRMADO** (research contra el source real de Nango v0.71.6) + fix listo — ver abajo.

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
