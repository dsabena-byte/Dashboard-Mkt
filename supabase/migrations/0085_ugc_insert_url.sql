-- =============================================================================
-- UGC: insert shot del producto real. Cada pieza UGC puede guardar, además del
-- talking-head (video_url), un b-roll del producto Drean real (insert_url) para
-- intercalar en edición (estrategia "talking-head cerrado + insert del producto").
-- =============================================================================

alter table contenido_calendario
  add column if not exists insert_url text;   -- ugc: b-roll del producto real (insert shot)

comment on column contenido_calendario.insert_url is
  'ugc: URL del insert shot (b-roll del producto Drean real, sin persona) para intercalar con el talking-head (video_url).';
