-- =============================================================================
-- Testeo de creativos UGC: vincula cada pieza UGC generada
-- (contenido_calendario, canal='ugc') con el anuncio de Meta que la pautea
-- (meta_paid_creatives.ad_id). Ese puente permite atribuir la performance del
-- anuncio a los tags del generador (perfil, escenario, formato, pilar, género) y
-- así producir "aprendizajes por dimensión" en el panel de /influencia.
-- =============================================================================

alter table contenido_calendario
  add column if not exists ad_id text;   -- ugc: id del anuncio Meta pauteado (link a meta_paid_creatives.ad_id)

create index if not exists idx_contenido_calendario_ad_id on contenido_calendario(ad_id);

comment on column contenido_calendario.ad_id is
  'ugc: id del anuncio Meta (meta_paid_creatives.ad_id) que pautea esta pieza. Conecta la performance con los tags del generador para el panel de testeo de creativos en /influencia.';
