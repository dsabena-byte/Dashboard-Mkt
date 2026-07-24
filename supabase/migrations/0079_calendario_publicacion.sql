-- Fase 2: campos para la publicación automática en IG/FB.
alter table contenido_calendario
  add column if not exists imagen_final_url text,   -- imagen lista para publicar (con placa grabada, hosteada permanente)
  add column if not exists publicado_ig_id text,    -- id del post publicado en Instagram
  add column if not exists publicado_fb_id text,    -- id del post publicado en Facebook
  add column if not exists publish_error text;       -- último error de publicación (para diagnosticar)
-- `redes` (jsonb, ej. ["instagram","facebook"]) ya existe desde la migración 0075.
