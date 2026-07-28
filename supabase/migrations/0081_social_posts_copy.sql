-- =============================================================================
-- social_posts.copy: texto/caption del post de competencia.
--
-- El scraper (Apify) ya trae el caption (Tag Instagram: post.caption), pero no se
-- guardaba. Esta columna lo persiste para mostrarlo en las tarjetas de /redes,
-- igual que los posts propios de Drean (que muestran el copy).
-- =============================================================================

alter table social_posts
  add column if not exists copy text;

comment on column social_posts.copy is
  'Texto/caption del post (viene del scraper: Apify caption). Se muestra en las tarjetas de competencia en /redes.';
