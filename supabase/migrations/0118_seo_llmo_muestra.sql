-- Visibilidad en IA (LLMO) con diseño estadístico (portado de BIP, sep-2026).
-- Cada respuesta del modelo con búsqueda (gpt-4o-search-preview) se guarda como UNA muestra:
-- qué marcas nombró y qué URLs citó. /api/cron/llmo-sync agrega las muestras de los últimos 28 días
-- por categoría → tasa de mención con intervalo de Wilson (95%) + fuentes citadas (citation share,
-- "fuentes que te faltan"). seo_llmo sigue siendo el agregado mensual (menciones/prompts/share_pct)
-- que usan el KPI "Visibilidad en IA" del Mapa y el tablero.
-- Sin esta tabla el sync funciona igual (sin acumular muestras ni fuentes; la UI lo avisa).
create table if not exists seo_llmo_muestra (
  id bigserial primary key,
  fecha timestamptz not null default now(),
  categoria text not null,
  prompt_id text not null,
  intencion text,
  modelo text not null,
  marcas text[] not null default '{}',
  fuentes text[] not null default '{}'
);
create index if not exists seo_llmo_muestra_cat_fecha on seo_llmo_muestra (categoria, fecha desc);
alter table seo_llmo_muestra enable row level security;
-- Sin policies: solo la service key (server) lee/escribe.

revoke all on seo_llmo_muestra from anon, authenticated;
