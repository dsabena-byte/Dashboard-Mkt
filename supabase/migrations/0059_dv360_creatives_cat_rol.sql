-- =============================================================================
-- 0059_dv360_creatives_cat_rol: agrega categoría (Lavado/Refrigeración/Cocción/
-- Promoción/Brand/General) y rol (Awareness/Consideración) a dv360_creatives.
-- Se derivan del nombre del Line Item en la sync. Permite ver la pauta de DV360
-- por categoría y por rol de comunicación.
-- =============================================================================

drop table if exists dv360_creatives;

create table if not exists dv360_creatives (
  mes          date    not null,
  canal        text    not null,            -- YouTube | Programmatic | Marketplace | Demand Gen
  categoria    text    not null default 'General', -- Lavado | Refrigeración | Cocción | Promoción | Brand | General
  rol          text    not null default 'Awareness', -- Awareness | Consideración
  creative     text    not null,            -- 'Unknown' para YouTube
  impresiones  bigint  not null default 0,
  clicks       bigint  not null default 0,
  starts       bigint  not null default 0,
  q25          bigint  not null default 0,
  q50          bigint  not null default 0,
  q75          bigint  not null default 0,
  q100         bigint  not null default 0,
  skips        bigint  not null default 0,
  revenue_usd  numeric not null default 0,
  source       text    not null default 'dv360_report',
  updated_at   timestamptz not null default now(),
  primary key (mes, canal, categoria, rol, creative)
);

comment on table dv360_creatives is 'Pauta de DV360 por mes × canal × categoría × rol × creative. categoria/rol derivados del Line Item. Costo en USD.';
