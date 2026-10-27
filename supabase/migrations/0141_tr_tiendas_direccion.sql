-- Dirección y ubicación de cada tienda (master de tiendas, 27-oct-2026) → mapa con un punto por tienda.
-- lat/lon = geocodificación con Georef (apis.datos.gob.ar, gratis); geo_precision: 'direccion' | 'localidad'.
alter table public.tr_tiendas
  add column if not exists direccion text,
  add column if not exists codigo_postal text,
  add column if not exists municipio text,
  add column if not exists lat double precision,
  add column if not exists lon double precision,
  add column if not exists geo_precision text,
  add column if not exists estado text;          -- provincia real (provincia = región del maestro viejo)
