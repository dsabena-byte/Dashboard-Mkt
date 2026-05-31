-- =============================================================================
-- Reach por follow_type en meta_posts (IG/FB orgánico vía Graph API).
-- La Graph API expone reach con breakdown=follow_type a nivel media. Lo
-- guardamos por post y al sumar en /redes obtenemos el alcance segmentado
-- en seguidores / no seguidores sin hacer otra llamada al cargar.
-- =============================================================================

alter table meta_posts
  add column if not exists reach_followers     bigint,
  add column if not exists reach_non_followers bigint;

comment on column meta_posts.reach_followers     is 'Reach del post entre seguidores (Graph API: reach con breakdown=follow_type=FOLLOWER).';
comment on column meta_posts.reach_non_followers is 'Reach del post entre no seguidores (Graph API: breakdown=follow_type=NON_FOLLOWER).';
