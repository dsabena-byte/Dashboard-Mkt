-- =============================================================================
-- social_posts.thumbnail_url: miniatura del post de competencia.
--
-- La data de competencia viene del scraper (n8n + Apify). Apify YA devuelve la
-- imagen del post (displayUrl), pero el workflow no la traía. Esta columna guarda
-- la URL de la miniatura para mostrarla en las tarjetas de /redes, igual que los
-- posts propios de Drean.
--
-- Recomendado: re-hostear la imagen en Supabase Storage antes de guardarla acá,
-- porque las URLs del CDN de IG/FB caducan (ver docs/competencia-thumbnails-setup.md).
-- =============================================================================

alter table social_posts
  add column if not exists thumbnail_url text;

comment on column social_posts.thumbnail_url is
  'Miniatura del post (idealmente re-hosteada en Supabase Storage; las URLs de IG/FB caducan). Alimenta las tarjetas de competencia en /redes.';
