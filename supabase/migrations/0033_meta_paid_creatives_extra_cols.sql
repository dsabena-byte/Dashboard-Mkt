-- =============================================================================
-- Extiende meta_paid_creatives para:
-- - métricas de video (views_total, views_completed, vtr)
-- - origen de la fila (source: 'graph_api' por Cron Meta o 'looker_export'
--   por carga manual desde Looker mientras esperamos acceso a la Ad Account)
-- - clasificación derivada del nombre del anuncio (categoria, tipo_compra)
-- =============================================================================

alter table meta_paid_creatives
  add column if not exists views_total      bigint,
  add column if not exists views_completed  bigint,
  add column if not exists vtr               numeric(8,4),
  add column if not exists source            text not null default 'graph_api',
  add column if not exists categoria         text,
  add column if not exists tipo_compra       text;

comment on column meta_paid_creatives.views_total      is 'Reproducciones totales del video (Reprs Total en Looker).';
comment on column meta_paid_creatives.views_completed  is 'Reproducciones completas al 100% (Reprs 100% en Looker).';
comment on column meta_paid_creatives.vtr              is 'Video Through Rate como porcentaje (views_completed / views_total * 100).';
comment on column meta_paid_creatives.source           is 'graph_api (cron Meta) o looker_export (carga manual desde Looker mientras no hay acceso a la Ad Account).';
