-- =============================================================================
-- 0056_dv360_video_metrics: visibilidad real de video de DV360 (Display & Video 360).
-- Fuente: reporte de DV360 (Bid Manager / Instant report). Agregado por mes y
-- fuente (YouTube/TrueView vs Programmatic Video vs Display). Alimenta el panel
-- "Visibilidad real de video · DV360" del dash de Performance, al lado de Meta.
-- =============================================================================

create table if not exists dv360_video_metrics (
  mes          date    not null,             -- primer día del mes (YYYY-MM-01)
  fuente       text    not null,             -- 'YouTube/TrueView' | 'Programmatic Video' | 'Display'
  impresiones  bigint  not null default 0,
  starts       bigint  not null default 0,   -- reproducciones iniciadas (Starts Video)
  q25          bigint  not null default 0,   -- First-quartile Views (25%)
  q50          bigint  not null default 0,   -- Midpoint Views (50%)
  q75          bigint  not null default 0,   -- Third-quartile Views (75%)
  q100         bigint  not null default 0,   -- Complete Views (100%)
  skips        bigint  not null default 0,   -- Skips (Video) — sólo aplica a TrueView
  revenue_usd  numeric not null default 0,   -- Revenue (USD): costo de medios facturado
  source       text    not null default 'dv360_instant_report',
  updated_at   timestamptz not null default now(),
  primary key (mes, fuente)
);

comment on table dv360_video_metrics is 'Embudo de visibilidad de video de DV360 por mes y fuente. Revenue es costo de medios (sin comisión de agencia/impuestos), en USD.';
