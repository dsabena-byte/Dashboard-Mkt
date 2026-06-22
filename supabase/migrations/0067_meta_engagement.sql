-- =============================================================================
-- 0067_meta_engagement: interacciones (engagement) por pieza de Meta, desde el
-- campo `actions` de los insights de la Marketing API. Permite analizar cada
-- pieza por su engagement (reacciones, comentarios, shares, saves) además del
-- performance de pauta.
-- =============================================================================

alter table meta_paid_creatives
  add column if not exists reactions       bigint not null default 0,
  add column if not exists comments        bigint not null default 0,
  add column if not exists shares          bigint not null default 0,
  add column if not exists saves           bigint not null default 0,
  add column if not exists post_engagement bigint not null default 0;

comment on column meta_paid_creatives.reactions is 'Reacciones (action_type=post_reaction) de los insights de Meta.';
comment on column meta_paid_creatives.comments is 'Comentarios (action_type=comment).';
comment on column meta_paid_creatives.shares is 'Veces compartido (action_type=post).';
comment on column meta_paid_creatives.saves is 'Guardados (action_type=onsite_conversion.post_save).';
comment on column meta_paid_creatives.post_engagement is 'Engagement total del post (action_type=post_engagement).';
