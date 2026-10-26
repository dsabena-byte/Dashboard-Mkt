-- 0133 · Cerrar la LECTURA anónima de la base (auditoría 26-oct-2026).
-- Con la clave pública del sitio se leían presupuesto, facturación, metas, Mapa, GfK, etc.
-- Desde #919 nada del tablero lee con `anon`: los usuarios logueados leen como `authenticated`
-- (sin cambios) y las rutas sin sesión ya autenticadas (crons, /compartido) como service role.
-- Se le saca a `anon` todo privilegio sobre las tablas/vistas/secuencias de `public`, también
-- para las que se creen en el futuro. Idempotente. Reversible con:
--   grant select on all tables in schema public to anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
