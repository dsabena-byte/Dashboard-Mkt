-- =============================================================================
-- Drop columnas que no se usan en el dashboard:
--   - sponsored: redundante con `tipo` (ya dice ORGÁNICO/PAUTA)
--   - hashtags: no se muestra ni se filtra
-- =============================================================================

alter table social_posts drop column if exists sponsored;
alter table social_posts drop column if exists hashtags;
