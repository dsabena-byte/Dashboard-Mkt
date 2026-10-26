-- 0139 · CB Ventas dentro de Dashboard-Mkt (26-oct-2026). Reemplaza la app vieja /ventas (cuadros-basicos):
--   vt_clientes   = "Clasificacion-clientes-*.csv" (razón social, tipología, vendedor, gerencia, peso).
--   vt_cb_catalogo = "Cuadros Basicos-*-hom.csv": una fila por renglón del CSV (cliente vacío = toda la tipología),
--                   con SUS homólogos (text[]). Los homólogos van POR RENGLÓN y no en una tabla global modelo↔homólogo:
--                   en el CSV real el mismo modelo tiene homólogos distintos según el renglón; una lista global
--                   cambiaría los números contra la app vieja.
--   vt_ventas     = FC / BO del Office Script (reemplazo total en cada corrida, como el blob viejo).
--   vt_ingestas   = una fila por corrida del Office Script (fecha de generación, conteos).
--   vt_auditoria  = toda edición (quién, cuándo, antes → después).
-- RLS sin policies: solo el server (service role) lee y escribe, DESPUÉS de validar sesión, grupo y alcance.
-- Idempotente.

create table if not exists public.vt_clientes (
  cliente text primary key,
  id_sap text,
  tipologia text not null check (tipologia in ('TOP 10', 'GRANDES CUENTAS RESTO', 'HIPERMERCADOS', 'SMALL RETAILERS')),
  vendedor text not null default '',
  gerencia text not null default '',
  peso numeric not null default 0,
  orden int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.vt_cb_catalogo (
  id bigserial primary key,
  tipologia text not null check (tipologia in ('TOP 10', 'GRANDES CUENTAS RESTO', 'HIPERMERCADOS', 'SMALL RETAILERS')),
  cliente text,
  tipo text not null check (tipo in ('INFALTABLE', 'ESTRATEGICO')),
  categoria text not null check (categoria in ('LAVADO', 'REFRIGERACION', 'COCCION')),
  modelo text not null,
  homologos text[] not null default '{}',
  orden int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists vt_cb_catalogo_cliente_idx on public.vt_cb_catalogo (cliente);

create table if not exists public.vt_ventas (
  id bigserial primary key,
  documento text not null default '',
  cliente text not null,
  sku text not null,
  tipo text not null check (tipo in ('FC', 'BO')),
  unidades numeric not null,
  fecha date not null,
  mes int not null check (mes between 1 and 12),
  vendedor text not null default '',
  fecha_factura date,
  canal text check (canal in ('SELL_IN', 'FOB'))
);
create index if not exists vt_ventas_cliente_idx on public.vt_ventas (cliente);

create table if not exists public.vt_ingestas (
  id bigserial primary key,
  at timestamptz not null default now(),
  generated_at timestamptz not null,
  filas int not null default 0,
  detalle jsonb
);

create table if not exists public.vt_auditoria (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_email text,
  entidad text not null,
  accion text not null,
  antes jsonb,
  despues jsonb
);

-- Reemplazo total y atómico de las ventas (una sola transacción: nunca queda la tabla a medias).
create or replace function public.vt_reemplazar_ventas(p_rows jsonb, p_generated_at timestamptz, p_detalle jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.vt_ventas where true;
  insert into public.vt_ventas (documento, cliente, sku, tipo, unidades, fecha, mes, vendedor, fecha_factura, canal)
  select coalesce(r->>'documentoVentas', ''), r->>'cliente', r->>'sku', r->>'tipo', (r->>'unidades')::numeric,
         (r->>'fecha')::date, (r->>'mes')::int, coalesce(r->>'vendedor', ''), nullif(r->>'fechaFactura', '')::date,
         nullif(r->>'canal', '')
  from jsonb_array_elements(p_rows) r;
  get diagnostics n = row_count;
  insert into public.vt_ingestas (generated_at, filas, detalle) values (p_generated_at, n, p_detalle);
  return n;
end $$;

do $$
declare t text;
begin
  foreach t in array array['vt_clientes', 'vt_cb_catalogo', 'vt_ventas', 'vt_ingestas', 'vt_auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.vt_cb_catalogo_id_seq, public.vt_ventas_id_seq, public.vt_ingestas_id_seq,
  public.vt_auditoria_id_seq to service_role;
revoke all on function public.vt_reemplazar_ventas(jsonb, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.vt_reemplazar_ventas(jsonb, timestamptz, jsonb) to service_role;
