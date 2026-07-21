-- =============================================================================
-- 0069_meta_fb_monthly_reach: alcance MENSUAL de la Página de Facebook (Drean),
-- pedido a Meta con period=month (mes calendario completo), no la suma del reach
-- de los posteos individuales.
--
-- Motivo: la métrica nueva de reach de posts es "lifetime" → los meses recientes
-- se ven artificialmente bajos hasta que los posts maduran. El alcance a nivel
-- Página por mes es el número cerrado y comparable.
--
-- Solo alimenta el gráfico "Evolución mensual — Alcance" de Facebook. No toca
-- ninguna tabla ni proceso existente.
-- =============================================================================

create table if not exists meta_fb_monthly_reach (
  mes         date primary key,   -- primer día del mes (YYYY-MM-01)
  reach       numeric,            -- alcance único de la Página en ese mes (period=month)
  updated_at  timestamptz not null default now()
);

comment on table meta_fb_monthly_reach is
  'Alcance mensual de la Página de FB (Drean) vía Graph API period=month. Solo para el gráfico de evolución de alcance de Facebook.';
