-- =============================================================================
-- Reporte de Existencias U3 (últimas 3 semanas) + análisis de sugerencias CB
-- =============================================================================
-- Aplicar en el proyecto SUPABASE_CB (fsvdcpqzchrezkxflyfi), mismo proyecto
-- que cuadro_basico_semanal.
--
-- Propósito: detectar tiendas que HOY no medimos en CB pero que muestran buen
-- nivel de cumplimiento en el Reporte de Existencias, para sumar al programa
-- y mejorar el promedio.
-- =============================================================================

create table if not exists reporte_existencia (
  id              bigint primary key,
  fecha_captura   date,
  numero_tienda   text,
  tienda          text,
  cadena          text,
  canal           text,
  division        text,
  categoria       text,
  subcategoria    text,
  marca           text,
  sku             text,
  descripcion     text,
  existencia      int,
  estado          text,
  raw             jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_re_numero_tienda on reporte_existencia (numero_tienda);
create index if not exists idx_re_cadena        on reporte_existencia (cadena);
create index if not exists idx_re_sku           on reporte_existencia (sku);
create index if not exists idx_re_fecha         on reporte_existencia (fecha_captura);
create index if not exists idx_re_division      on reporte_existencia (division);

comment on table reporte_existencia is
  'Reporte de Existencias U3: una fila por observación de SKU en tienda. Sincronizado desde Drive via Apps Script "Sync Drive Tablero CB".';

-- ----------------------------------------------------------------------------
-- Vista: baseline de tiendas medidas (% CB promedio en últimas 3 semanas)
-- ----------------------------------------------------------------------------
create or replace view vw_cb_baseline_medidas as
with semanas_recientes as (
  select distinct semana
  from cuadro_basico_semanal
  order by semana desc
  limit 3
)
select
  round(100.0 * sum(real_cb)::numeric  / nullif(sum(target_cb), 0), 1)  as cb_pct_avg,
  round(100.0 * sum(real_inf)::numeric / nullif(sum(target_inf), 0), 1) as infalt_pct_avg,
  count(distinct tienda) as tiendas_medidas
from cuadro_basico_semanal
where semana in (select semana from semanas_recientes);

comment on view vw_cb_baseline_medidas is
  '% CB e Infaltable promedio de las tiendas que actualmente medimos (últimas 3 semanas). Es el threshold contra el que se comparan las sugerencias.';

-- ----------------------------------------------------------------------------
-- Vista: análisis de cumplimiento CB para tiendas en el reporte que NO medimos
-- ----------------------------------------------------------------------------
-- Lógica:
--  1. Catálogo CB: SKUs definidos como CB por cada cliente (cadena), con su
--     tipo_sku (Infaltable / Estratégico).
--  2. Tiendas medidas: las que tienen filas en cuadro_basico_semanal con
--     numero_tienda extraído del prefijo "NN - Nombre".
--  3. Tiendas en reporte: agrupadas por numero_tienda con su cadena.
--  4. No medidas = en reporte pero NO en medidas.
--  5. Cross-join con el catálogo de su cadena y left join con presencia real
--     en el reporte (existencia > 0).
--  6. % por tienda: cb_pct, infalt_pct, estrat_pct + cuántos modelos de cada tipo.
-- ----------------------------------------------------------------------------
create or replace view vw_cb_suggestions as
with
catalogo as (
  -- Distinct (cliente_norm, sku, tipo_sku) — qué SKUs son CB por cadena
  select distinct
    upper(trim(cliente)) as cliente_norm,
    upper(trim(division)) as division_norm,
    sku,
    tipo_sku
  from cuadro_basico_semanal
  where target_cb > 0
    and cliente is not null
    and sku is not null
),
medidas as (
  -- Tiendas medidas: numero_tienda extraído del prefijo "NN - Nombre"
  select distinct
    (regexp_match(tienda, '^(\d+)\s*-'))[1] as numero_tienda
  from cuadro_basico_semanal
  where tienda ~ '^\d+\s*-'
),
tiendas_reporte as (
  -- Tiendas únicas presentes en el reporte de existencia
  select
    numero_tienda,
    max(tienda)  as tienda,
    max(cadena)  as cadena
  from reporte_existencia
  where numero_tienda is not null
  group by numero_tienda
),
no_medidas as (
  select *
  from tiendas_reporte
  where numero_tienda not in (select numero_tienda from medidas where numero_tienda is not null)
),
presentes as (
  -- Para cada tienda no medida, qué SKUs aparecieron al menos una vez con existencia > 0
  select
    re.numero_tienda,
    re.sku
  from reporte_existencia re
  where re.numero_tienda in (select numero_tienda from no_medidas)
    and coalesce(re.existencia, 0) > 0
    and re.sku is not null
  group by re.numero_tienda, re.sku
),
analisis as (
  -- Cross-join tienda × catálogo de su cadena, con flag de presencia
  select
    nm.numero_tienda,
    nm.tienda,
    nm.cadena,
    cat.division_norm,
    cat.sku,
    cat.tipo_sku,
    case when p.sku is not null then 1 else 0 end as presente
  from no_medidas nm
  join catalogo cat on cat.cliente_norm = upper(trim(nm.cadena))
  left join presentes p
    on p.numero_tienda = nm.numero_tienda
   and p.sku = cat.sku
)
select
  numero_tienda,
  tienda,
  cadena,
  count(*) as cb_target,
  sum(presente)::int as cb_ok,
  round(100.0 * sum(presente)::numeric / nullif(count(*), 0), 1) as cb_pct,

  count(*) filter (where tipo_sku = 'Infaltable')::int as infalt_target,
  sum(presente) filter (where tipo_sku = 'Infaltable')::int as infalt_ok,
  round(
    100.0 * sum(presente) filter (where tipo_sku = 'Infaltable')::numeric
    / nullif(count(*) filter (where tipo_sku = 'Infaltable'), 0),
    1
  ) as infalt_pct,

  count(*) filter (where tipo_sku ilike '%estrat%')::int as estrat_target,
  sum(presente) filter (where tipo_sku ilike '%estrat%')::int as estrat_ok,
  round(
    100.0 * sum(presente) filter (where tipo_sku ilike '%estrat%')::numeric
    / nullif(count(*) filter (where tipo_sku ilike '%estrat%'), 0),
    1
  ) as estrat_pct
from analisis
group by numero_tienda, tienda, cadena;

comment on view vw_cb_suggestions is
  'Análisis CB para tiendas en reporte_existencia que NO están en cuadro_basico_semanal. Se sugiere agregar al programa las que tengan cb_pct >= cb_pct_avg de vw_cb_baseline_medidas.';
