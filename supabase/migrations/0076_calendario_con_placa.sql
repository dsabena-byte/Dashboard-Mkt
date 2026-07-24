-- Preferencia por pieza: publicar/mostrar con la placa (título + bajada sobre la
-- imagen) o sin ella (imagen limpia). La Fase 2 (auto-post) usará este flag.
alter table contenido_calendario
  add column if not exists con_placa boolean not null default true;
