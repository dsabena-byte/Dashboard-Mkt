-- Metas por KPI del Mapa Estratégico. Una meta NO es un solo número: tiene una
-- configuración (cómo se mide, contra qué se compara, umbrales de semáforo) y
-- una serie de valores mensuales (que además pueden abrirse por categoría:
-- Lavado / Refrigeración / Cocción). Por eso van dos tablas.
--
-- La clave lógica de un KPI es (plan, kpi) — los MISMOS nombres que usa el Mapa
-- Estratégico (lib/mapa-catalogo.ts / la config del usuario). `categoria` permite
-- una meta general ('__general__') o una meta por categoría del negocio.

-- Configuración de la meta (por KPI, opcionalmente por categoría).
create table if not exists kpi_meta_config (
  plan            text not null,                     -- nombre del plan (idéntico al Mapa)
  kpi             text not null,                     -- nombre del KPI (idéntico al Mapa)
  categoria       text not null default '__general__', -- '__general__' o Lavado/Refrigeración/Cocción
  unidad          text,                              -- '%', 'u', '$', 'pts', 'x'
  direccion       text not null default 'up',        -- 'up' = mejor mayor · 'down' = mejor menor
  referencia      text not null default 'interno',   -- 'interno' | 'mercado' | 'periodo'
  frecuencia      text not null default 'mensual',   -- 'mensual' | 'semanal' | 'trimestral'
  agregacion      text not null default 'mensual',   -- 'mensual' | 'U3M' | 'U4M' | 'MAT' | 'YTD'
  umbral_verde    numeric not null default 100,      -- % de cumplimiento >= => verde
  umbral_amarillo numeric not null default 90,       -- % de cumplimiento >= => amarillo (si no verde)
  notas           text,
  updated_at      timestamptz not null default now(),
  primary key (plan, kpi, categoria)
);

comment on table kpi_meta_config is 'Configuración de metas por KPI del Mapa Estratégico: cómo se mide, contra qué, y umbrales de semáforo. Se carga desde cada tablero.';

-- Valores mensuales de la meta.
create table if not exists kpi_meta_valores (
  plan       text not null,
  kpi        text not null,
  categoria  text not null default '__general__',
  anio       int  not null,
  mes        int  not null check (mes between 1 and 12),
  valor      numeric,                                -- valor meta para ese mes
  updated_at timestamptz not null default now(),
  primary key (plan, kpi, categoria, anio, mes)
);

comment on table kpi_meta_valores is 'Valores mensuales de las metas por KPI (y categoría). Referenciados por los tableros y por el Mapa/Resumen para el semáforo actual vs meta.';
