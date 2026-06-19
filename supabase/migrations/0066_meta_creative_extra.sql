-- =============================================================================
-- 0066_meta_creative_extra: datos extra del creative de Meta para la pauta.
--   - creative_id            → id del creative (además del ad_id que ya guardamos)
--   - instagram_permalink_url → URL pública de la pieza en Instagram (para IG el
--     link de Facebook por story_id no siempre resuelve; este sí).
-- El permalink_url existente pasa a preferir el de Instagram cuando la pieza es IG.
-- =============================================================================

alter table meta_paid_creatives
  add column if not exists creative_id text,
  add column if not exists instagram_permalink_url text;

comment on column meta_paid_creatives.creative_id is 'ID del creative de Meta (Graph API).';
comment on column meta_paid_creatives.instagram_permalink_url is 'URL pública de la pieza en Instagram (Graph API creative.instagram_permalink_url).';
