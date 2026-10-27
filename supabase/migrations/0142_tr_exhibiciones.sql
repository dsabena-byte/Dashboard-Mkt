-- Exhibiciones especiales / activaciones WOW (mobiliario de marca) por tienda (27-oct-2026). Base distinta al maestro de
-- tiendas: `tienda_id` = cruce con tr_tiendas (dirección, nombre o cadena+ciudad; `match_metodo`/`match_confianza`), null
-- si la tienda no está en el relevamiento de Trade (igual se ubica con su propia dirección: lat/lon).
create table if not exists public.tr_exhibiciones (
  id bigserial primary key,
  origen text not null default 'manual',          -- 'wow-xlsx' = planilla "Activaciones WOW"
  anio int,
  gerencia text,
  cliente text,                                    -- columna TIENDA de la planilla (cadena / razón social)
  direccion text,
  ciudad text,
  provincia text,
  trade text,
  estado text,
  proveedor text,
  tv_tablet text,
  recambio text,
  exhibidor text,
  costo numeric,
  link_fotos text,
  activa boolean not null default true,           -- false si dice RETIRADO o PDV CERRADO
  tienda_id bigint references public.tr_tiendas (id) on delete set null,
  match_metodo text,                               -- direccion | nombre | cadena+ciudad | manual
  match_confianza text,                            -- alta | media
  lat double precision,
  lon double precision,
  geo_precision text,
  updated_at timestamptz not null default now()
);
create index if not exists tr_exhibiciones_tienda_idx on public.tr_exhibiciones (tienda_id);
alter table public.tr_exhibiciones enable row level security;
grant select, insert, update, delete on public.tr_exhibiciones to service_role;
grant usage, select on sequence public.tr_exhibiciones_id_seq to service_role;
