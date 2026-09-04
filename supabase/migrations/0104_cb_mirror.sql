-- Mirror de la data del proyecto CB (lento) en el proyecto PRINCIPAL (rápido).
-- Motivo: los dashboards /cuadros-basicos y /floor-share leen la tabla CB entera
-- (getCbRows/getFloorShareRows) y el proyecto CB responde lento por query → CB ~6s,
-- Floor Share ~21s EN CADA visita (paginar en paralelo NO alcanzó: el cuello es el
-- throughput del proyecto CB, no los round-trips). El cron cb-mirror copia estas
-- tablas al principal en background; los dashboards leen el mirror al instante.
-- Se hace clean-replace (DELETE + INSERT) en cada corrida.

create table if not exists cb_semanal_mirror (
  semana integer,
  tienda text,
  sku text,
  cliente text,
  division text,
  target_cb integer,
  real_cb integer,
  target_inf integer,
  real_inf integer,
  tipo_sku text
);
create index if not exists cb_semanal_mirror_semana_idx on cb_semanal_mirror (semana);

create table if not exists floor_share_mirror (
  periodo text,
  semana integer,
  categoria text,
  numero_tienda text,
  nombre_tienda text,
  marca text,
  unidades numeric,
  pct_raw numeric
);
create index if not exists floor_share_mirror_semana_idx on floor_share_mirror (semana);

create table if not exists cb_tienda_cliente_mirror (
  numero_tienda text primary key,
  cliente text
);
