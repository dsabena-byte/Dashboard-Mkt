-- =============================================================================
-- 0147_vt_facturacion: facturación en $ de TODOS los renglones FC (sin el filtro del cuadro básico) para las provisiones de AACC
-- (2-nov-2026). La manda el Office Script del Excel «FC + BO» en el mismo POST de /api/cb-ventas/ingesta (campo `facturacion`).
-- vt_ventas solo guarda lo que matchea el CB → no sirve para el % de facturación de Naldo/Cetrogar. Reemplaza la columna
-- vt_ventas.importe de 0146 (nunca se llenó).
-- =============================================================================
create table if not exists public.vt_facturacion (
  id       bigint generated always as identity primary key,
  cliente  text not null,
  sku      text not null,
  fecha    date not null,          -- fecha REAL de la factura (mes calendario)
  importe  numeric(16,2) not null
);
create index if not exists idx_vt_facturacion_cliente_fecha on public.vt_facturacion(cliente, fecha);
alter table public.vt_facturacion enable row level security;
grant select, insert, update, delete on public.vt_facturacion to service_role;
grant usage, select on sequence public.vt_facturacion_id_seq to service_role;

-- Reemplazo total y atómico (igual que vt_reemplazar_ventas).
create or replace function public.vt_reemplazar_facturacion(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.vt_facturacion where true;
  insert into public.vt_facturacion (cliente, sku, fecha, importe)
  select r->>'cliente', r->>'sku', (r->>'fecha')::date, (r->>'importe')::numeric from jsonb_array_elements(p_rows) r;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vt_reemplazar_facturacion(jsonb) from public, anon, authenticated;
grant execute on function public.vt_reemplazar_facturacion(jsonb) to service_role;

alter table public.vt_ventas drop column if exists importe;
