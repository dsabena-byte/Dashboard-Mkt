-- =============================================================================
-- Tabla social_posts: cada fila = un post de RRSS (IG/FB/TT) con metricas y
-- analisis de sentimiento. Fuente: planilla del scraper (n8n + Apify + Claude).
-- Se usa para el dashboard /redes (replica del HTML Social Intelligence).
-- =============================================================================

create table if not exists social_posts (
  id            uuid primary key default gen_random_uuid(),
  red_social    text not null,                  -- INSTAGRAM | FACEBOOK | TIKTOK
  url           text not null unique,           -- URL del post (dedup key)
  pilar         text,                            -- Branding | Promo | Producto | Educacional
  positivo      smallint,                        -- 0-100 (% sentiment positivo)
  negativo      smallint,
  neutro        smallint,
  likes         integer,                         -- -1 si IG no expone, 0 si FB sin reactions
  comentarios   integer,
  engagement    numeric(6, 3),                   -- % engagement rate del post
  fecha         date,                            -- fecha de publicacion
  tipo          text,                            -- ORGÁNICO | PAUTA
  marca         text not null,                   -- dreanargentina | philco.arg | gafaargentina
  views         integer default 0,
  content_type  text,                            -- IMAGE | VIDEO | SIDECAR | REEL
  sponsored     boolean default false,
  hashtags      text,                            -- comma-separated o JSON string
  followers     integer,                         -- snapshot al momento del scrape
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_social_posts_marca on social_posts(marca);
create index if not exists idx_social_posts_fecha on social_posts(fecha desc);
create index if not exists idx_social_posts_red_social on social_posts(red_social);
create index if not exists idx_social_posts_marca_fecha on social_posts(marca, fecha desc);

comment on table social_posts is
  'Posts individuales de RRSS (IG/FB/TT) con sentimiento y engagement. Cargados desde el Sheet del scraper.';
comment on column social_posts.red_social is 'Plataforma: INSTAGRAM, FACEBOOK, TIKTOK';
comment on column social_posts.engagement is 'Engagement rate del post (likes+comments)/followers * 100';
comment on column social_posts.tipo is 'ORGÁNICO o PAUTA (paid)';
