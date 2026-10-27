-- Fotos de la exhibición copiadas desde la carpeta de Drive (link_fotos) al bucket público meta-thumbs
-- (exhibiciones/<id>/<fileId>.jpg): el tablero las muestra sin mandar a Drive (27-oct-2026).
alter table public.tr_exhibiciones add column if not exists fotos text[] not null default '{}';
