-- Texto de los comentarios de los posts de redes (propios por la API de Meta, competencia por Apify).
-- Antes solo se guardaba el % de sentimiento: si se perdía, no había con qué recalcularlo (may–jul 2026).
create table if not exists public.social_post_comments (
  clave       text primary key,            -- id del comentario en Meta, o apify:<shortcode>:<hash del texto>
  post_url    text not null,
  post_key    text not null,               -- postKey(): ig:<shortcode>
  red_social  text not null,
  marca       text not null,
  texto       text not null,
  like_count  integer,
  fecha       timestamptz,
  fuente      text not null,               -- 'graph' | 'apify'
  fetched_at  timestamptz not null default now()
);
create index if not exists social_post_comments_post_key on public.social_post_comments (post_key);
create index if not exists social_post_comments_marca_fecha on public.social_post_comments (marca, fecha);
alter table public.social_post_comments enable row level security;
grant select, insert, update, delete on public.social_post_comments to service_role;
