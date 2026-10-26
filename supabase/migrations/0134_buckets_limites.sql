-- 0134 · Límites de los buckets de subida (auditoría D-11, 26-oct-2026). Idempotente.
-- contenido-uploads es PÚBLICO: solo imágenes/videos (octet-stream = archivos sin tipo del navegador;
-- la extensión ya la valida /api/contenido/calendario/upload-url) y hasta 200 MB (hoy el mayor pesa 7 MB).
update storage.buckets
   set file_size_limit = 200 * 1024 * 1024,
       allowed_mime_types = array['image/*', 'video/*', 'application/octet-stream']
 where id = 'contenido-uploads';
-- mkt-canal-uploads es privado (reportes PDF/Excel/imagen): solo tope de tamaño.
update storage.buckets set file_size_limit = 50 * 1024 * 1024 where id = 'mkt-canal-uploads';
