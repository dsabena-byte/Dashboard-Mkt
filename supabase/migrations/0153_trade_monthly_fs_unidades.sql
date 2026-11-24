-- Floor Share general = unidades Drean ÷ unidades exhibidas (presencia en el piso), no ponderado por facturación.
-- Se guardan las unidades exhibidas por categoría para ponderar también la META general (Seguimiento, Mapa).
alter table public.trade_monthly
  add column if not exists fs_u_lavado numeric,
  add column if not exists fs_u_refri numeric,
  add column if not exists fs_u_coccion numeric;
