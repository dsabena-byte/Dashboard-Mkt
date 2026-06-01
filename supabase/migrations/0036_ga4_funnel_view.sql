-- 0036: Vista de funnel GA4 — clasifica cada landing en (etapa, categoria_funnel)
-- para alimentar el funnel del Overview alineado al slide de estrategia Drean.
--
-- Etapas (Awareness NO recibe tráfico de GA4 — es media-only):
--   interes        → páginas de categoría/subcategoría (sin `/p/<SKU>`)
--   consideracion  → home + servicio + combo (Brand)  y  páginas de producto `/p/<SKU>` (por categoría)
--
-- Categorías funnel (6):
--   Brand         → Landing / home + Combos + Servicio
--   Lavado        → Lavado y secado (lavarropas, secarropas)
--   Refrigeración → Heladeras y Freezers
--   Cocinas       → Cocción (cocinas, hornos, anafes)
--   Lavavajillas  → Lavavajillas (categoría propia)
--   Otros         → No clasificado

create or replace view vw_ga4_funnel as
with classified as (
  select
    fecha,
    landing_page,
    case
      -- PDP (página de producto) → consideración de su categoría
      when landing_page ~* '/p/[A-Z0-9-]+' then 'consideracion'
      -- Home / landing → consideración (de Brand)
      when landing_page ~* '^/?(es_AR)?/?$' then 'consideracion'
      -- Combos y Servicio → consideración (de Brand)
      when landing_page ~* '(combo|servicio)' then 'consideracion'
      -- Páginas de categoría → interés
      when landing_page ~* '(lavarropas|secarrop|/Lavado|lavavajilla|heladera|refriger|freezer|cocci|/Cocina|horno|anafe)' then 'interes'
      -- Fallback (path desconocido) → consideración de Brand para no perder volumen
      else 'consideracion'
    end as etapa,
    case
      when landing_page ~* '^/?(es_AR)?/?$'                                                            then 'Brand'
      when landing_page ~* '(combo|servicio)'                                                          then 'Brand'
      when landing_page ~* '(lavavajilla)'                                                             then 'Lavavajillas'
      when landing_page ~* '(lavarropas|secarrop|/Lavado(/|$))'                                        then 'Lavado'
      when landing_page ~* '(heladera|refriger|freezer|/Heladeras|/Freezers)'                          then 'Refrigeración'
      when landing_page ~* '(cocci|/Coccion|horno|anafe|/Cocina(s)?(/|$))'                             then 'Cocinas'
      else 'Otros'
    end as categoria,
    sesiones,
    usuarios,
    conversiones,
    pageviews,
    bounce_rate
  from web_traffic
)
select
  fecha,
  etapa,
  categoria,
  sum(sesiones)::bigint as sesiones,
  sum(usuarios)::bigint as usuarios,
  sum(conversiones)::bigint as conversiones,
  sum(pageviews)::bigint as pageviews,
  case
    when sum(sesiones) filter (where bounce_rate is not null) > 0
    then sum(sesiones * bounce_rate) filter (where bounce_rate is not null)
       / sum(sesiones) filter (where bounce_rate is not null)
    else null
  end as bounce_rate
from classified
group by fecha, etapa, categoria;

comment on view vw_ga4_funnel is
  'Clasificación de GA4 por etapa de funnel (interes/consideracion) y categoría (Lavado/Refrigeración/Cocinas/Lavavajillas/Brand/Otros). Awareness es media-only (Pauta). Home/Servicio/Combo → consideración de Brand. PDP → consideración de su categoría. Páginas de categoría → interés. Usado por el widget Funnel del Overview.';
