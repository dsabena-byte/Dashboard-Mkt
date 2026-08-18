# Dashboard-Mkt — memoria del proyecto

> Claude Code lee este archivo al inicio de cada sesión. Mantenerlo **conciso**:
> orientación + decisiones + gotchas + punteros a `docs/`. El detalle va en `docs/`.
> NO poner secretos acá (solo nombres de env vars).

## Cómo trabajar con este usuario (preferencias — aplican siempre)
- **Español**, directo y conciso. No re-explicar lo ya decidido ni narrar opciones que no se van a tomar.
- **Validá con datos, NO asumas.** Es su preferencia #1. Antes de afirmar una causa, comprobala
  (consultá la DB por REST con la service key, corré el código, leé el archivo). Si no lo podés
  verificar, decilo — no maquilles ni inventes. Corregí explícitamente cuando algo que dijiste
  resultó mal.
- **Compilá antes de pushear:** `cd apps/web && pnpm exec tsc --noEmit` (hay `node_modules`).
- **Deploy:** commit + `git push origin HEAD:main` (Vercel deploya solo; rebasar si main avanzó).
- **Mantené esta memoria al día:** después de cualquier decisión/fix importante, actualizá este
  `CLAUDE.md` y/o `docs/` **proactivamente**, sin que te lo pidan.
- **Seguridad:** hay credenciales de producción en el entorno (service-role key, API keys). No
  las expongas ni las mandes a servicios externos. Desconfiá de herramientas de terceros que
  corran solas (hooks) cerca de este entorno.

## Qué es
Dashboard de marketing de **Drean** (electrodomésticos, Argentina). Monorepo Next.js en
`apps/web` (App Router, pnpm). ~17 dashboards: overview/objetivos, cuadros-basicos, floor-share,
web (GA4), redes (FB/IG), seo-search, performance (pauta), performance-conversion, influencia,
mercado (GFK), salud-marca (Kantar), mkt-canal, funnel, monitoreo, contenido, alerts, campaigns.
Data en Supabase; se alimenta con **cron syncs** (GitHub Actions → API routes `app/api/cron/*`)
y un **Apps Script "Sync Drive Tablero CB"** (Drive → Supabase, para CB/Floor-Share/Planning/
reporte_existencia/cb_homologos).

## Infra / accesos
- **Dos proyectos Supabase:**
  - **Principal** (`dashboard-mkt`, ref `vtcrhyyirqexczycuwhe`): web/GA4, meta (posts/paid),
    pauta, mercado, salud-marca, mkt_canal_acciones, etc. Env: `NEXT_PUBLIC_SUPABASE_URL` +
    `SUPABASE_SERVICE_ROLE_KEY`. Cliente server: `getServerSupabase()` (`lib/supabase-server.ts`).
  - **CB** (`dashboard-cb-fs`, ref `fsvdcpqzchrezkxflyfi`): `cuadro_basico_semanal`,
    `reporte_existencia`, `cb_homologos`, floor_share. Cliente: `getCbSupabase()`
    (`lib/supabase-cb.ts`). Env `CB_SUPABASE_*` con fallback al principal.
  - **Plan Supabase: Pro.** Disco de `dashboard-mkt` subido a 8 GB (era free/2 GB y se llenó —
    ver gotcha de web abajo).
- **IA:** OpenAI **gpt-4o-mini** vía fetch (`OPENAI_API_KEY`). DataForSEO (`DATAFORSEO_AUTH`) para
  trends/search volume. Meta/GA4/DV360 tokens en los crons.
- **Deploy:** push a `main` → Vercel deploya solo. (Rama designada por sesión: pushear con
  `git push origin HEAD:main`, rebasar si `main` avanzó.)
- **Sandbox:** `node_modules` se instala con `pnpm install`. Typecheck real:
  `cd apps/web && pnpm exec tsc --noEmit` (el `tsc` sin deps da miles de errores de entorno —
  no sirve). Acceso directo a la DB solo por REST con la service key (sin conexión DDL: las
  migraciones las corre el usuario en el SQL Editor de Supabase).

## Convenciones que importan
- **Dashboards de datos = siempre frescos:** cada `page.tsx` con data lleva
  `export const dynamic = "force-dynamic"` **y** `export const fetchCache = "force-no-store"`.
  Sin eso, Next cachea los fetch a Supabase y los paneles salen vacíos hasta refrescar.
- **Multi-tenant (Fase 0):** `lib/tenant/` (`getTenant()` devuelve Drean fijo). El código
  consume ese seam, no constantes. Al escalar a varias empresas, se resuelve el tenant ahí.
- **Copiloto de datos (chat):** motor genérico en `lib/chat/` + `components/data-chat.tsx` +
  `components/global-data-chat.tsx` (monta el chat según la URL) + `app/api/chat/route.ts`
  (loop de function-calling OpenAI). Extender a un dashboard = escribir `lib/chat/tools-<dash>.ts`
  (envolver query functions existentes) + registrarlo en `lib/chat/registry.ts` + sumar entrada
  en `global-data-chat.tsx`. El motor NO se toca.

## Gotchas / decisiones (lo que costó tiempo — no re-litigar)
- **Reach orgánico de Facebook:** Meta deprecó el reach viejo (15-jun-2026). Se usa la métrica
  nueva **`post_total_media_view_unique`** (singular, "Total Unique Media Views"). Ojo:
  devuelve `lifetime` Y `day` con el mismo name → **leer lifetime, no day**. Se **excluyen
  posts pagos/boosteados** del gráfico orgánico (firma: reach fuera de escala + engagement casi
  nulo; ver `isPaidOutlier` en `lib/meta-fb-queries.ts`). El mes en curso es acumulativo (arranca
  bajo). Detalle: `docs/meta-fb-reach-deprecation.md`.
- **Redes FB vs IG:** por post rinden parecido; IG usa `reach` (vivo), FB usa Media Views. Los
  gráficos de "total" engañan por volumen de posts (IG suma Stories que FB no expone por API).
- **CB — sugerencias de tiendas:** `reporte_existencia` (proyecto CB) alimenta `vw_cb_suggestions`.
  El sync del Apps Script hace **clean-replace** (borra e inserta) para que cada "Reporte U3"
  reemplace al anterior (no acumular fantasmas). Baseline = últimas 3 semanas de
  `cuadro_basico_semanal`. "Tiendas relevadas" del card global respeta el filtro (usa
  `totals.tiendas`, no el histórico).
- **Web (GA4) — timeouts:** las vistas derivadas de `web_landing_daily` (~113k filas/mes) hacían
  regex por fila y **timeouteaban** (statement_timeout 8s) → paneles vacíos (`safe()` lo escondía).
  Fix: **columna generada `categoria`/`sku` precomputada** (migración `0087`, corrida en SQL
  Editor) + **chunk semanal** (`splitRangeByWeek` en `lib/web-queries.ts`, no mensual). Causa raíz
  original: disco lleno en free tier → se subió a Pro + 8 GB.
- **Modelo:** el proyecto usa OpenAI (no Anthropic) para las features de IA existentes.

## Punteros a docs/
`docs/architecture.md`, `docs/crons-github-actions.md`, `docs/guia-replicacion-y-seguridad.md`,
`docs/meta-fb-reach-deprecation.md`, y varios `*-sync.md` (dv360, google-ads, etc.). Los
`handoff-*.md` son notas de sesiones previas.
</content>
