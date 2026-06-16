-- =============================================================================
-- 0055_meta_video_quartiles: métricas de visibilidad de video por anuncio de Meta.
-- Fuente: Marketing API (insights). Permiten medir efectividad real del video:
-- cuántas impresiones llegan al 25/50/75/100% del video y el ThruPlay.
-- Alimenta el panel "Visibilidad real de video" del dash de Performance.
-- =============================================================================

alter table meta_paid_creatives
  add column if not exists video_plays    bigint,  -- reproducciones iniciadas (video_play_actions)
  add column if not exists video_p25      bigint,  -- llegaron al 25% del video
  add column if not exists video_p50      bigint,  -- llegaron al 50%
  add column if not exists video_p75      bigint,  -- llegaron al 75%
  add column if not exists video_p100     bigint,  -- llegaron al 100% (= views_completed)
  add column if not exists video_thruplay bigint;  -- ThruPlay (≥15s o completo)

comment on column meta_paid_creatives.video_plays    is 'Reproducciones de video iniciadas (video_play_actions).';
comment on column meta_paid_creatives.video_p25       is 'Impresiones que llegaron al 25% del video (video_p25_watched_actions).';
comment on column meta_paid_creatives.video_p50       is 'Impresiones que llegaron al 50% del video.';
comment on column meta_paid_creatives.video_p75       is 'Impresiones que llegaron al 75% del video.';
comment on column meta_paid_creatives.video_p100      is 'Impresiones que llegaron al 100% del video (reproducciones completas).';
comment on column meta_paid_creatives.video_thruplay  is 'ThruPlay: reproducciones de ≥15s o completas (video_thruplay_watched_actions).';
