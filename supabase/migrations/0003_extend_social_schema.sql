-- =============================================================================
-- Extender social_competitor y social_metrics con columnas del scraping
-- =============================================================================
-- El scraper existente (Tombaio adaptado a Drean) provee un Sheet con columnas
-- adicionales que vale la pena guardar como columnas propias en vez de meterlas
-- en `raw`, para poder filtrarlas y agregarlas vía SQL.
--
-- Columnas nuevas en social_competitor (data por post):
--   - pilar              (categoría de contenido: Producto, Branding, Educacional, Promo)
--   - sentiment_positivo (% positivo)
--   - sentiment_negativo (% negativo)
--   - sentiment_neutro   (% neutro)
--   - content_type       (SIDECAR, VIDEO, IMAGE)
--   - sponsored          (boolean, pauta vs orgánico)
--   - hashtags           (texto libre con hashtags del post)
--   - tipo_post          (ORGÁNICO / PAUTA — alias del sponsored para reporting)
--   - insight            (descripción/resumen del post)
--
-- Columnas nuevas en social_metrics (agregado diario por cuenta):
--   - posts_organicos    (cantidad de posts orgánicos del día)
--   - posts_pauta        (cantidad de posts pagados del día)
--   - views              (total de views del día)
--   - sentiment_promedio_positivo (promedio del % positivo del día)
--   - sentiment_promedio_negativo (idem negativo)
--   - sentiment_promedio_neutro   (idem neutro)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- social_competitor
-- -----------------------------------------------------------------------------
alter table social_competitor
  add column if not exists pilar              text,
  add column if not exists sentiment_positivo numeric(5,2),
  add column if not exists sentiment_negativo numeric(5,2),
  add column if not exists sentiment_neutro   numeric(5,2),
  add column if not exists content_type       text,
  add column if not exists sponsored          boolean,
  add column if not exists hashtags           text,
  add column if not exists tipo_post          text,
  add column if not exists insight            text;

create index if not exists idx_social_comp_pilar      on social_competitor (pilar);
create index if not exists idx_social_comp_sponsored  on social_competitor (sponsored);
create index if not exists idx_social_comp_tipo       on social_competitor (tipo_post);

comment on column social_competitor.pilar is
  'Categoría de contenido (Producto, Branding, Educacional, Promo, etc.).';
comment on column social_competitor.tipo_post is
  'ORGÁNICO o PAUTA. Alias legible del flag sponsored.';

-- -----------------------------------------------------------------------------
-- social_metrics
-- -----------------------------------------------------------------------------
alter table social_metrics
  add column if not exists posts_organicos              integer default 0 not null,
  add column if not exists posts_pauta                  integer default 0 not null,
  add column if not exists views                        bigint,
  add column if not exists sentiment_promedio_positivo  numeric(5,2),
  add column if not exists sentiment_promedio_negativo  numeric(5,2),
  add column if not exists sentiment_promedio_neutro    numeric(5,2);

-- -----------------------------------------------------------------------------
-- Vista: social_competitor agregado por día y cuenta (para dashboards)
-- -----------------------------------------------------------------------------
create or replace view vw_social_daily as
select
  date_trunc('day', fecha_post)::date as fecha,
  plataforma,
  cuenta,
  count(*)                                    as posts,
  count(*) filter (where sponsored = false)   as posts_organicos,
  count(*) filter (where sponsored = true)    as posts_pauta,
  sum(coalesce(likes, 0))                     as likes,
  sum(coalesce(comentarios, 0))               as comentarios,
  sum(coalesce(shares, 0))                    as shares,
  sum(coalesce(vistas, 0))                    as vistas,
  avg(sentiment_positivo)                     as sentiment_promedio_positivo,
  avg(sentiment_negativo)                     as sentiment_promedio_negativo,
  avg(sentiment_neutro)                       as sentiment_promedio_neutro
from social_competitor
group by 1, 2, 3;

comment on view vw_social_daily is
  'Métricas sociales agregadas por (día, plataforma, cuenta) a partir de los posts individuales en social_competitor.';

-- -----------------------------------------------------------------------------
-- Vista: ranking de pilares de contenido por cuenta y mes
-- -----------------------------------------------------------------------------
create or replace view vw_social_pilar_breakdown as
select
  date_trunc('month', fecha_post)::date as mes,
  cuenta,
  pilar,
  count(*)                       as posts,
  sum(coalesce(likes, 0))        as likes,
  sum(coalesce(comentarios, 0))  as comentarios,
  avg(sentiment_positivo)        as sentiment_promedio_positivo
from social_competitor
where pilar is not null
group by 1, 2, 3;

comment on view vw_social_pilar_breakdown is
  'Breakdown mensual de posts por cuenta y pilar de contenido. Útil para entender qué tipo de contenido publica cada marca.';
