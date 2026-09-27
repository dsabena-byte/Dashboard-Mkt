-- 0119 · Anotaciones en gráficos + umbrales propios de alertas (portado de BIP 0044, sep-2026), single-tenant.
-- Idempotente y aditiva. El código funciona sin ella: sin tablero_anotaciones no hay marcas (el panel avisa);
-- sin alert_prefs.umbrales los umbrales no se guardan (la UI avisa) y no se evalúan.

-- ── A. Anotaciones ("lanzamiento TV", "corte de stock") ─────────────────────────────────────
-- tablero = slug del dashboard nativo ("performance", "web", "redes"…) o de Mis tableros ("t-ventas-ab12"),
-- o NULL = de todo el dashboard. Se dibujan como marca vertical en los gráficos por fecha de Mis tableros
-- y entran al Diagnóstico IA del tablero como contexto humano.
create table if not exists public.tablero_anotaciones (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  tablero     text,
  texto       text not null,
  autor       text,
  created_at  timestamptz not null default now(),
  constraint tablero_anotaciones_texto_len check (char_length(texto) between 1 and 280),
  constraint tablero_anotaciones_tablero_fmt check (tablero is null or tablero ~ '^[a-z0-9][a-z0-9-]{0,63}$')
);
create index if not exists tablero_anotaciones_fecha_idx on public.tablero_anotaciones (fecha desc);
alter table public.tablero_anotaciones enable row level security;   -- sin policies: solo service role (API server-side)
revoke all on public.tablero_anotaciones from anon, authenticated;

-- ── B. Umbrales propios ("avisame si el CPM supera $X o las sesiones caen 20%") ────────────
-- jsonb [{ id, metrica, cond: "mayor"|"menor"|"cae_pct"|"sube_pct", valor }] (máx. 10, validado en lib/umbrales.ts).
alter table public.alert_prefs add column if not exists umbrales jsonb not null default '[]'::jsonb;
