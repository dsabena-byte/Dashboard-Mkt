-- 0148: vt_facturacion guarda el «Grupo de artículos» del Excel (categoría) y la manda agrupada (cliente × día × categoría).
-- APLICADA 2-nov-2026.
alter table public.vt_facturacion add column if not exists categoria text;
create or replace function public.vt_reemplazar_facturacion(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.vt_facturacion where true;
  insert into public.vt_facturacion (cliente, sku, fecha, importe, categoria)
  select r->>'cliente', r->>'sku', (r->>'fecha')::date, (r->>'importe')::numeric, nullif(r->>'categoria', '') from jsonb_array_elements(p_rows) r;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vt_reemplazar_facturacion(jsonb) from public, anon, authenticated;
grant execute on function public.vt_reemplazar_facturacion(jsonb) to service_role;
