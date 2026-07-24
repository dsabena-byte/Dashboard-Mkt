-- Bucket público para contenido externo subido a mano al calendario
-- (imágenes/videos desarrollados por fuera del generador).
insert into storage.buckets (id, name, public)
values ('contenido-uploads', 'contenido-uploads', true)
on conflict (id) do nothing;
