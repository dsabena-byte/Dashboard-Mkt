-- =============================================================================
-- Tabla cb_homologos + actualización de vw_cb_suggestions
-- =============================================================================
-- Aplicar en proyecto CB (fsvdcpqzchrezkxflyfi).
--
-- Propósito: el cumplimiento de CB no debe ser match exacto por SKU. Si la
-- tienda tiene CUALQUIERA de los modelos equivalentes definidos en el archivo
-- de homologación de Drean, ese "slot" de producto cuenta como cumplido.
--
-- Fuente: archivo "Cuadros Basicos - V.X Mes Año-hom.csv" en el folder de CB.
-- Cargado automáticamente por el Apps Script "Sync Drive Tablero CB".
--
-- Formato wide en el CSV: 1 fila por (cliente, categoría, modelo) con columnas
-- MODELO + HOMOLOGO 1..9. El loader desnormaliza a formato long: 1 fila por
-- cada SKU equivalente, todas compartiendo el mismo `modelo` como slot_id.
-- =============================================================================

create table if not exists cb_homologos (
  id              bigserial primary key,
  tipologia       text,                 -- GRANDES CUENTAS, etc.
  cliente         text not null,
  cuadro_basico   text not null,        -- INFALTABLE | ESTRATEGICO
  categoria       text not null,        -- LAVADO | REFRIGERACION | COCCION
  modelo          text not null,        -- SKU "canónico" del slot
  sku             text not null,        -- modelo OR cualquier homólogo (desnormalizado)
  homologo_n      int not null default 0, -- 0 = el propio modelo, 1..9 = HOMOLOGO N
  loaded_at       timestamptz not null default now()
);

create index if not exists idx_cbh_cliente   on cb_homologos (cliente);
create index if not exists idx_cbh_categoria on cb_homologos (categoria);
create index if not exists idx_cbh_sku       on cb_homologos (sku);
create index if not exists idx_cbh_modelo    on cb_homologos (modelo);

comment on table cb_homologos is
  'Catálogo de Cuadro Básico con homologaciones por cliente/categoría/modelo. Desnormalizado: 1 fila por SKU equivalente. Fuente: archivo "Cuadros Basicos - V.X Mes Año-hom.csv" sincronizado desde Drive via Apps Script.';

-- ----------------------------------------------------------------------------
-- vw_cb_suggestions ACTUALIZADA: usa cb_homologos como catálogo + equivalencias
-- ----------------------------------------------------------------------------
-- Cambios clave vs versión anterior:
-- 1. Catálogo ahora viene de cb_homologos (no de cuadro_basico_semanal).
--    Esto permite evaluar tiendas de cadenas no medidas (ej. Electrónica
--    Megatone, Blas Oscar Martínez) que no aparecen en cuadro_basico_semanal.
-- 2. Cumplimiento ahora considera homólogos: si CUALQUIER SKU equivalente
--    aparece en reporte_existencia, el modelo cuenta como presente.
-- 3. Clasificación Infaltable/Estratégico viene de cb_homologos.cuadro_basico
--    en lugar de cuadro_basico_semanal.tipo_sku.
-- ----------------------------------------------------------------------------

drop view if exists vw_cb_suggestions;

create or replace view vw_cb_suggestions as
with
catalogo as (
  -- 1 fila por slot (cliente × categoria × cuadro_basico × modelo)
  select distinct
    upper(trim(cliente))       as cliente_norm,
    upper(trim(categoria))     as categoria_norm,
    upper(trim(cuadro_basico)) as cuadro_basico_norm,
    modelo
  from cb_homologos
),
medidas as (
  -- Tiendas que ya están en el programa CB (numero_tienda del prefijo "NN - Nombre")
  select distinct
    (regexp_match(tienda, '^(\d+)\s*-'))[1] as numero_tienda
  from cuadro_basico_semanal
  where tienda ~ '^\d+\s*-'
),
tiendas_reporte as (
  -- Universo de tiendas en el reporte de existencia
  select
    numero_tienda,
    max(tienda)  as tienda,
    max(cadena)  as cadena
  from reporte_existencia
  where numero_tienda is not null
  group by numero_tienda
),
no_medidas as (
  -- Las tiendas en el reporte que NO están siendo medidas hoy
  select * from tiendas_reporte
  where numero_tienda not in (select numero_tienda from medidas where numero_tienda is not null)
),
presentes as (
  -- Para cada (tienda no-medida, modelo): hay presencia si CUALQUIER sku
  -- equivalente aparece con existencia > 0 en el reporte para esa tienda
  select distinct
    re.numero_tienda,
    upper(trim(ch.cliente))   as cliente_norm,
    ch.modelo
  from reporte_existencia re
  join cb_homologos ch on ch.sku = re.sku
  where re.numero_tienda in (select numero_tienda from no_medidas)
    and coalesce(re.existencia, 0) > 0
),
analisis as (
  -- Cruzar cada tienda no medida con el catálogo de su cadena
  -- y marcar presencia por modelo
  select
    nm.numero_tienda,
    nm.tienda,
    nm.cadena,
    cat.categoria_norm,
    cat.cuadro_basico_norm,
    cat.modelo,
    case when p.modelo is not null then 1 else 0 end as presente
  from no_medidas nm
  join catalogo cat on cat.cliente_norm = upper(trim(nm.cadena))
  left join presentes p
    on p.numero_tienda = nm.numero_tienda
   and p.cliente_norm  = cat.cliente_norm
   and p.modelo        = cat.modelo
)
select
  numero_tienda,
  tienda,
  cadena,

  count(*)                                                              as cb_target,
  sum(presente)::int                                                    as cb_ok,
  round(100.0 * sum(presente)::numeric / nullif(count(*), 0), 1)        as cb_pct,

  count(*) filter (where cuadro_basico_norm = 'INFALTABLE')::int        as infalt_target,
  sum(presente) filter (where cuadro_basico_norm = 'INFALTABLE')::int   as infalt_ok,
  round(
    100.0 * sum(presente) filter (where cuadro_basico_norm = 'INFALTABLE')::numeric
    / nullif(count(*) filter (where cuadro_basico_norm = 'INFALTABLE'), 0),
    1
  )                                                                     as infalt_pct,

  count(*) filter (where cuadro_basico_norm = 'ESTRATEGICO')::int       as estrat_target,
  sum(presente) filter (where cuadro_basico_norm = 'ESTRATEGICO')::int  as estrat_ok,
  round(
    100.0 * sum(presente) filter (where cuadro_basico_norm = 'ESTRATEGICO')::numeric
    / nullif(count(*) filter (where cuadro_basico_norm = 'ESTRATEGICO'), 0),
    1
  )                                                                     as estrat_pct
from analisis
group by numero_tienda, tienda, cadena;

comment on view vw_cb_suggestions is
  'CB compliance para tiendas en reporte_existencia que NO están en programa CB. Usa cb_homologos como catálogo + equivalencias: un slot (cliente, categoría, modelo) cuenta como cumplido si CUALQUIER SKU equivalente aparece en el reporte.';
