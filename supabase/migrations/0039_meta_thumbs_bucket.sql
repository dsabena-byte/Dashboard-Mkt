-- 0039: Bucket de Supabase Storage para mirroring de thumbnails de Meta.
-- Las URLs de Meta (FB e IG) son firmadas y caducan en 1-2 días. Para que
-- el dashboard no muestre imágenes rotas, el cron descarga cada thumbnail
-- una sola vez y la sube acá. La columna meta_posts.thumbnail_url pasa a
-- apuntar a la URL pública de Supabase que no caduca.

insert into storage.buckets (id, name, public)
values ('meta-thumbs', 'meta-thumbs', true)
on conflict (id) do update set public = true;

-- Lectura pública (el dashboard lee con la anon key o sin auth)
drop policy if exists "meta-thumbs public read" on storage.objects;
create policy "meta-thumbs public read"
on storage.objects for select
to public
using (bucket_id = 'meta-thumbs');

-- Escritura solo desde service_role (usado por el cron)
drop policy if exists "meta-thumbs service write" on storage.objects;
create policy "meta-thumbs service write"
on storage.objects for insert
to service_role
with check (bucket_id = 'meta-thumbs');

drop policy if exists "meta-thumbs service update" on storage.objects;
create policy "meta-thumbs service update"
on storage.objects for update
to service_role
using (bucket_id = 'meta-thumbs');
