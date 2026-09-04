-- Distribución DIARIA de web por categoría, PRECALCULADA.
-- Motivo: vw_drean_web_by_category agrega web_landing_daily (tabla enorme) y bajo
-- carga en Vercel tardaba ~18-27s (era el cuello del dash /web). El cron web-cat-agg
-- llena esta tabla en background; getWebByCategory la lee al instante (indexada por
-- fecha). Guarda lo que el dash necesita: usuarios/sesiones/conversiones/pageviews/
-- bounce por día×categoría (para el agregado del período Y el gráfico de tendencia).

create table if not exists web_daily_by_category (
  fecha date not null,
  categoria text not null,
  usuarios integer not null default 0,
  sesiones integer not null default 0,
  conversiones integer not null default 0,
  pageviews integer not null default 0,
  bounce_rate numeric,
  updated_at timestamptz not null default now(),
  primary key (fecha, categoria)
);
create index if not exists web_daily_by_category_fecha_idx on web_daily_by_category (fecha);
