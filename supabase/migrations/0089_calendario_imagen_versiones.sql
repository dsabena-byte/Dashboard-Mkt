-- Historial de versiones de la imagen de una pieza, para el retoque iterativo.
-- Cada retoque (edición sobre la imagen actual con nano-banana/edit) apila la
-- URL anterior acá, de modo que se pueda "revertir" al estado previo sin tener
-- que regenerar desde cero.
alter table contenido_calendario
  add column if not exists imagen_versiones jsonb not null default '[]'::jsonb;
