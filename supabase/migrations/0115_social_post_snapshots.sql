-- 0115 · Fotos de interacciones por EDAD del post (1, 3 y 7 días) — sep-2026. Idempotente.
-- El código funciona sin ella: recordPostSnapshots devuelve ok:false y la comparación competitiva de
-- /redes sigue con el método anterior (mediana de posts con 7+ días, lib/redes-competencia.ts).
--
-- Una fila por red + post + edad objetivo. La llenan:
--   · /api/cron/competencia-ig (diario): cuentas de la competencia por Business Discovery (fuente
--     'business_discovery') + filas de social_posts del scraper n8n/Apify fotografiadas con su
--     updated_at (fuente 'apify');
--   · /api/cron/ig-sync (cada 6 h): posts propios de @dreanargentina (fuente 'graph', con alcance).
-- La PRIMERA observación dentro de la ventana de cada edad gana (upsert ... on conflict do nothing):
--   edad 1 = [24 h, 48 h) · edad 3 = [72 h, 120 h) · edad 7 = [168 h, 240 h)  (lib/post-snapshots-core.ts)
-- followers = seguidores de la marca EN ESE MOMENTO → el ER a 7 días no usa los seguidores de hoy.
create table if not exists public.social_post_snapshots (
  red          text not null,                -- INSTAGRAM | FACEBOOK | TIKTOK
  post_key     text not null,                -- shortcode de IG ('ig:XXXX') o URL normalizada
  edad_dias    smallint not null,            -- 1 | 3 | 7
  marca        text not null,                -- clave de social_posts (dreanargentina, philco.arg, …)
  horas_edad   numeric,                      -- edad real al observarlo
  likes        integer not null default 0,
  comentarios  integer not null default 0,
  views        integer,
  followers    integer,
  alcance      integer,                      -- solo posts propios (Graph)
  fuente       text not null default 'business_discovery',
  observed_at  timestamptz not null default now(),
  constraint social_post_snapshots_pk primary key (red, post_key, edad_dias),
  constraint social_post_snapshots_edad check (edad_dias in (1, 3, 7))
);
create index if not exists idx_social_post_snapshots_obs on public.social_post_snapshots (observed_at desc);
create index if not exists idx_social_post_snapshots_marca on public.social_post_snapshots (marca, edad_dias);
alter table public.social_post_snapshots enable row level security;  -- sin policies: solo service role
revoke all on public.social_post_snapshots from anon, authenticated;
