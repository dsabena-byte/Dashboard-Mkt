# BIP Platform — Handoff (proyecto APARTE de Drean)

> Proyecto NUEVO: convertir el dashboard de Drean en un **SaaS self-serve multi-tenant**
> (BIP). **NO se toca nada de Drean.** Este doc es la memoria para retomar en cualquier
> sesión. El código se entregó al user como zips (ver abajo); el scratchpad es efímero.

## Qué es
Plataforma donde **el cliente se autogestiona**: conecta sus fuentes de un clic (OAuth),
elige/sube de plan pagando, suma add-ons, maneja usuarios — con mínima participación del
consultor. Segura, escalable (objetivo: 50 clientes en simultáneo), sin perder funcionalidad.

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
- ⏳ Meta: esperando que el socio dé Admin del Business → después crear app `BIP Connector` +
  integración en Nango (mismo flujo que Google).
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

## Cómo retomar
Leer este doc. El código vive en los zips que tiene el user (pedirle que los suba si hace falta
continuarlo, o regenerar desde el README del `bip-mvp`). Próximo paso natural: **Google Cloud**
(la verificación lenta) una vez propagado el dominio.
