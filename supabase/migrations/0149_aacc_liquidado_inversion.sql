-- 0149 (2-nov-2026, pedido del user: «la AACC es un gasto más; la factura sale de Inversión de Marketing»):
-- lo liquidado ya no se carga en Mkt Canal: sale de bgt_lineas (REAL, cuenta 6202010084, con Nº de recepción).
-- aacc_acuerdos.proveedor = Nº o nombre de proveedor con el que se carga el gasto en Inversión. Se borra aacc_liquidado
-- (solo tenía la carga inicial armada desde el mail del 23-oct). APLICADA 2-nov-2026.
alter table public.aacc_acuerdos add column if not exists proveedor text;
update public.aacc_acuerdos set proveedor = '4009347' where anio = 2026 and cliente = 'Cetrogar' and proveedor is null; -- Nº de proveedor de CETROGAR SA en bgt_lineas
drop table if exists public.aacc_liquidado;
