-- =============================================================================
-- 0057_dv360_performance: pauta general de DV360 por mes y canal.
-- Generaliza dv360_video_metrics (que era sólo video) a TODA la pauta de DV360:
-- YouTube, Programmatic, Marketplace, Demand Gen. Incluye impresiones, clicks,
-- costo (USD) y las métricas de video (cuartiles) donde apliquen.
-- Alimenta el dash de Performance (vista DV360 por canal + embudo de video).
-- Nota: Google Search NO está en DV360 (vive en Google Ads) → no se incluye.
-- =============================================================================

drop table if exists dv360_video_metrics;

create table if not exists dv360_performance (
  mes          date    not null,            -- primer día del mes (YYYY-MM-01)
  canal        text    not null,            -- YouTube | Programmatic | Marketplace | Demand Gen
  impresiones  bigint  not null default 0,
  clicks       bigint  not null default 0,
  starts       bigint  not null default 0,  -- reproducciones de video iniciadas
  q25          bigint  not null default 0,  -- First-quartile Views (25%)
  q50          bigint  not null default 0,  -- Midpoint Views (50%)
  q75          bigint  not null default 0,  -- Third-quartile Views (75%)
  q100         bigint  not null default 0,  -- Complete Views (100%)
  skips        bigint  not null default 0,  -- Skips (Video) — sólo TrueView
  revenue_usd  numeric not null default 0,  -- costo de medios facturado (USD)
  source       text    not null default 'dv360_report',
  updated_at   timestamptz not null default now(),
  primary key (mes, canal)
);

comment on table dv360_performance is 'Pauta de DV360 por mes y canal: impresiones, clicks, costo (USD) y embudo de video. Revenue = costo de medios sin comisión de agencia ni impuestos.';
