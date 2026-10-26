-- 0136 · Usuarios del tablero por persona y por GRUPO (26-oct-2026, etapa 1).
-- Reemplaza la regla fija de dominio (@mabe.com.ar o cuenta previa al 23-oct) y la tabla
-- dashboard_access (0065), que NUNCA se creó en prod: 0065 queda SUPERADA por esta (no se borra el archivo).
--   grupos: marketing (ve todos los tableros) · trade (Cuadros Básicos + Floor Share) · ventas (CB Ventas).
--   es_admin: administra /usuarios · es_editor: edita maestros de Trade/Ventas (etapas siguientes).
--   vendedor / gerencia: alcance de Ventas (ve solo sus clientes).
-- Sin esta migración la app sigue con la regla vieja (modo "legacy", fail-safe en el código).
-- Idempotente.

create table if not exists public.usuarios (
  email text primary key check (email = lower(email) and email like '%@%'),
  nombre text,
  grupos text[] not null default '{}' check (grupos <@ array['marketing', 'trade', 'ventas']::text[]),
  es_admin boolean not null default false,
  es_editor boolean not null default false,
  vendedor text,
  gerencia text,
  activo boolean not null default true,
  ultimo_acceso timestamptz,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;
drop policy if exists usuarios_propia on public.usuarios;
create policy usuarios_propia on public.usuarios
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
revoke all on public.usuarios from public, anon, authenticated;
grant select on public.usuarios to authenticated;
grant select, insert, update, delete on public.usuarios to service_role;

create table if not exists public.usuarios_auditoria (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_email text,
  email text,
  accion text not null,
  antes jsonb,
  despues jsonb
);
alter table public.usuarios_auditoria enable row level security; -- sin policies: solo el server
revoke all on public.usuarios_auditoria from public, anon, authenticated;
grant select, insert, update, delete on public.usuarios_auditoria to service_role;
grant usage, select on sequence public.usuarios_auditoria_id_seq to service_role;

-- Seed: quienes hoy entran con la regla vieja quedan en el grupo marketing (no se deja a nadie afuera).
insert into public.usuarios (email, grupos, activo, creado_por)
select lower(u.email), array['marketing']::text[], true, 'migracion 0136'
from auth.users u
where u.email is not null
  and u.email_confirmed_at is not null
  and (u.email ilike '%@mabe.com.ar' or u.created_at < '2026-10-23T20:00:00Z')
on conflict (email) do nothing;

-- Primer administrador.
update public.usuarios set es_admin = true, es_editor = true where email = 'dsabena@gmail.com';
