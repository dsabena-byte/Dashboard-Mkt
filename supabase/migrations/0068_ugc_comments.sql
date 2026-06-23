-- =============================================================================
-- 0068_ugc_comments: comentarios de las piezas UGC (scrapeados del post de IG
-- con Apify) + análisis por pieza (LLM). Para validar credibilidad, intención de
-- compra y percepción de marca, y sugerir mejoras de contenido/guión.
--   - ugc_comments: un row por comentario, keyed por permalink del post.
--   - ugc_piece_analysis: análisis agregado por permalink (jsonb con secciones).
-- =============================================================================

create table if not exists ugc_comments (
  id           uuid primary key default uuid_generate_v4(),
  permalink    text not null,                 -- instagram_permalink_url de la pieza
  author       text,
  comment_text text not null,
  like_count   bigint not null default 0,
  comment_date timestamptz,
  fetched_at   timestamptz not null default now()
);
create index if not exists idx_ugc_comments_permalink on ugc_comments (permalink);

create table if not exists ugc_piece_analysis (
  permalink   text primary key,
  n_comments  int  not null default 0,
  analysis    jsonb,                          -- {credibilidad, intencion_compra, percepcion_marca, mejoras, resumen}
  updated_at  timestamptz not null default now()
);

comment on table ugc_comments is 'Comentarios scrapeados (Apify) del post de IG de cada pieza UGC, por permalink.';
comment on table ugc_piece_analysis is 'Análisis LLM por pieza UGC (permalink): credibilidad, intención de compra, percepción de marca, mejoras de contenido.';
