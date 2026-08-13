# Multi-empresa (multi-tenant) — Fase 0

Estructura base para convertir el dashboard (hoy single-tenant, cableado a Drean)
en un producto donde cada empresa vive aislada. Arranca por la **config por
empresa**, sin cambiar comportamiento.

## Modelo (resumen)

- **Silo por empresa**: cada empresa tendrá su propio proyecto Supabase (datos +
  login + credenciales aislados). Código y hosting (GitHub + Vercel) son únicos.
- **Control plane**: registro de empresas → `{ supabase, branding, categorías,
  conectores }`. La app resuelve la empresa desde el subdominio/sesión.
- **Ingesta**: jobs-as-code por tenant (recomendación: Inngest). No n8n ni
  GitHub Actions para los crons del producto.

## Qué introduce Fase 0 (este PR)

- `apps/web/src/lib/tenant/config.ts` — tipo `TenantConfig` + entrada `DREAN`
  con los valores actuales (marca propia, cuentas sociales, categorías,
  dashboards). Fuente única de la identidad de marca.
- `apps/web/src/lib/tenant/current.ts` — `getTenant()`, el "seam" de resolución.
  Fase 0 devuelve Drean fijo; Fase 1 resolverá por subdominio/sesión.
- `social-queries.ts` y `social-posts-queries.ts` ahora **derivan** `OWN_BRAND`,
  `BRAND_LABELS` y `BRAND_COLORS` de `getTenant()`. Mismos valores → **cero
  cambio visual ni de datos**.

## Surfaces pendientes de migrar a `tenant-config` (próximos PRs)

Constantes de identidad todavía hardcodeadas/duplicadas que deben pasar a leer
de `getTenant()`:

- Mapas de label/color por marca duplicados en componentes sociales:
  `components/social/brand-sentiment-summary.tsx`,
  `paginated-posts-panel.tsx`, `competencia-posts-panel.tsx`
  (incluye `BRAND_ORDER`), `components/engagement-trend-chart.tsx`,
  `components/pilar-chart.tsx`.
- `components/social/ig-organic-section.tsx` — `@dreanargentina` en el título.
- `lib/competitive-config.ts` — `MARCAS`, `CATEGORIA_MARCAS`, `TRACKED_DOMAINS`
  (SEO/Search y competitivo) → `competidoresPorCategoria`.
- `lib/floor-share-colors.ts` / `floor-share-queries.ts` — `OWN_BRAND_FS`.
- `lib/meta-publish.ts` — `IG_ID`.

## Siguientes fases

1. **Control plane + routing**: `getTenant()` resuelve por subdominio/sesión;
   config desde tabla.
2. **Empresa Demo**: silo Supabase con datos ficticios (mockup compartible).
3. **Provisioning + migraciones fan-out**.
4. **Conectores por empresa** (Inngest, fan-out por tenant).
