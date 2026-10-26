-- 0137 · Permisos de EDICIÓN por área (sobre la tabla usuarios de 0136). Idempotente.
-- Tres niveles de edición (el resto de los usuarios solo VE: lee, usa el copiloto y da 👍/👎):
--   es_admin        → edita todo (y administra /usuarios).
--   edita_marketing → edita todos los tableros y funciones de Marketing, salvo Cuadros Básicos / Floor Share / CB Ventas.
--   es_editor       → edita SOLO Cuadros Básicos, Floor Share y CB Ventas.
-- El control real está en el server: toda ruta que escribe o gasta llama a exigirEdicion(area)
-- (apps/web/src/lib/usuarios-server.ts). Sin esta columna el código trata edita_marketing = false.
alter table public.usuarios add column if not exists edita_marketing boolean not null default false;

comment on column public.usuarios.edita_marketing is
  'Edita los tableros de Marketing (todo salvo CB / Floor Share / CB Ventas, que van con es_editor). Admin edita todo.';
