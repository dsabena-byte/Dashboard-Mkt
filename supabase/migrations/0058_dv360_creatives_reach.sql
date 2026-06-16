-- =============================================================================
-- 0058_dv360_creatives_reach: modelo final de DV360 para el dash de pauta general.
-- Reemplaza dv360_performance (channel-only) por dos tablas granulares:
--   - dv360_creatives: pauta por mes × canal × creative (pieza) con todos los KPIs.
--   - dv360_reach: alcance único + frecuencia por mes × Line Item (DV360 no da
--     reach por pieza; sólo a nivel Line Item).
-- El resumen por canal y el embudo de video se derivan de dv360_creatives en código.
-- =============================================================================

drop table if exists dv360_performance;

create table if not exists dv360_creatives (
  mes          date    not null,
  canal        text    not null,            -- YouTube | Programmatic | Marketplace | Demand Gen
  creative     text    not null,            -- nombre del creative ('Unknown' para YouTube)
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
  primary key (mes, canal, creative)
);

create table if not exists dv360_reach (
  mes          date    not null,
  canal        text    not null,
  line_item    text    not null,
  impresiones  bigint  not null default 0,
  revenue_usd  numeric not null default 0,
  reach        bigint  not null default 0,  -- Unique Reach: Impression Reach (deduplicado por mes)
  frequency    numeric not null default 0,  -- Unique Reach: Average Impression Frequency
  source       text    not null default 'dv360_report',
  updated_at   timestamptz not null default now(),
  primary key (mes, line_item)
);

comment on table dv360_creatives is 'Pauta de DV360 por mes × canal × creative. Costo (revenue_usd) en USD, sin comisión de agencia ni impuestos.';
comment on table dv360_reach is 'Alcance único + frecuencia de DV360 por mes × Line Item. Reach NO sumable entre líneas (solapamiento de usuarios).';
