-- =============================================================================
-- 0051_meta_posts_clasificacion: clasificación de contenido orgánico de Drean
-- por CATEGORÍA y PILAR de contenido, para el Objetivo de Salud de Marca.
--
-- La completa el cron /api/cron/clasificar-contenido (LLM sobre el caption
-- `message`). Es idempotente: solo procesa filas sin clasificar.
--
-- Categorías (alineadas con pauta): Brand | Lavado | Refrigeración | Cocción | Promoción
-- Pilares (5): Liderazgo marca/porfolio | Calidad superior | Respaldo Posventa
--              | Elegir bien | Experiencia uso
-- =============================================================================

alter table meta_posts
  add column if not exists categoria         text,        -- categoría de producto del contenido
  add column if not exists pilar_contenido   text,        -- pilar de contenido (1 de los 5)
  add column if not exists clasif_confianza  numeric(4, 3), -- 0..1 confianza del modelo
  add column if not exists clasif_at         timestamptz; -- cuándo se clasificó

comment on column meta_posts.categoria is
  'Categoría del contenido orgánico, alineada con pauta (Brand/Lavado/Refrigeración/Cocción/Promoción). Clasificado por LLM.';
comment on column meta_posts.pilar_contenido is
  'Pilar de contenido (Liderazgo marca/porfolio | Calidad superior | Respaldo Posventa | Elegir bien | Experiencia uso). Clasificado por LLM.';

create index if not exists idx_meta_posts_clasif
  on meta_posts (categoria, pilar_contenido);
