-- =============================================================================
-- Tabla social_followers: snapshot mensual (o cuando quieras) de seguidores
-- por marca y red social. Sirve para:
--   1. Calcular engagement = (likes+comments)/followers usando el valor más
--      reciente ANTES de la fecha de cada post (apples-to-apples).
--   2. Mostrar evolución mensual de seguidores en el dashboard.
--
-- Clave primaria por (marca, red_social, fecha) → permite múltiples snapshots
-- en distintas fechas. Para actualizar el del mes corriente, hacés UPSERT.
-- =============================================================================

create table if not exists social_followers (
  marca         text    not null,                       -- dreanargentina | philco.arg | gafaargentina | whirlpoolarg | electroluxar
  red_social    text    not null,                       -- INSTAGRAM | FACEBOOK | TIKTOK
  fecha         date    not null,                       -- snapshot date (primer día del mes recomendado)
  followers     integer not null,
  created_at    timestamptz not null default now(),
  primary key (marca, red_social, fecha)
);

create index if not exists idx_social_followers_marca_red
  on social_followers(marca, red_social, fecha desc);

comment on table social_followers is
  'Snapshots de seguidores por marca+red. Usado para calcular engagement on-the-fly y ver evolución mensual.';
