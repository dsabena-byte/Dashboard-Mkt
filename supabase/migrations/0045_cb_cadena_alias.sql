-- =============================================================================
-- Tabla cb_cadena_alias: mapea nombres operativos del reporte_existencia con
-- razones sociales del catálogo cb_homologos
-- =============================================================================
-- Aplicar en proyecto CB (fsvdcpqzchrezkxflyfi).
--
-- Razón: el archivo de homologos usa razones sociales formales (ej.
-- "ELECTRONICA MEGATONE SRL") mientras que el reporte de existencia usa el
-- nombre operativo / comercial (ej. "ON CITY"). Esta tabla resuelve el match.
--
-- Mapeos NUEVOS (cuando OMD agregue una cadena al homologos, sumar acá):
--   insert into cb_cadena_alias values (...);
-- =============================================================================

create table if not exists cb_cadena_alias (
  cadena_reporte    text primary key,   -- nombre como aparece en reporte_existencia.cadena
  cliente_homologos text not null       -- razón social como aparece en cb_homologos.cliente
);

-- Mapeos iniciales (Junio 2026)
insert into cb_cadena_alias (cadena_reporte, cliente_homologos) values
  ('CETROGAR SA',       'CETROGAR SA'),
  ('FRÁVEGA SA',        'FRAVEGA S A C I E I'),
  ('ON CITY',           'ELECTRONICA MEGATONE SRL'),
  ('JUMBO',             'CENCOSUD S.A. (JUMBO)'),
  ('CASTILLO',          'CASTILLO SACIFIA'),
  ('COPPEL MA',         'COPPEL SA'),
  ('COTO CICSA',        'COTO CENTRO INTEGRAL DE'),
  ('NALDO LOMBARDI',    'NALDO LOMBARDI S A'),
  ('PETENATTI HOGAR',   'PETENATTI HNOS SA'),
  ('CHANGO MAS',        'DORINKA SRL'),
  ('RODO HOGAR',        'BOSAN SA'),
  ('LA CASA DEL AUDIO', 'MARANSI S A'),
  ('NOVOGAR',           'BLAS OSCAR MARTINUCCI E HIJOS S A')
on conflict (cadena_reporte) do update set
  cliente_homologos = excluded.cliente_homologos;

comment on table cb_cadena_alias is
  'Mapeo de nombres operativos (reporte_existencia.cadena) a razones sociales (cb_homologos.cliente). Se mantiene a mano: cuando se agrega una cadena al archivo de homologos, sumar la fila acá.';

-- ----------------------------------------------------------------------------
-- vw_cb_suggestions ACTUALIZADA: usa cb_cadena_alias para matchear cadenas
-- ----------------------------------------------------------------------------

drop view if exists vw_cb_suggestions;

create or replace view vw_cb_suggestions as
with
catalogo as (
  select distinct
    upper(trim(cliente))       as cliente_norm,
    upper(trim(categoria))     as categoria_norm,
    upper(trim(cuadro_basico)) as cuadro_basico_norm,
    modelo
  from cb_homologos
),
medidas as (
  select distinct
    (regexp_match(tienda, '^(\d+)\s*-'))[1] as numero_tienda
  from cuadro_basico_semanal
  where tienda ~ '^\d+\s*-'
),
tiendas_reporte as (
  select
    numero_tienda,
    max(tienda)  as tienda,
    max(cadena)  as cadena
  from reporte_existencia
  where numero_tienda is not null
  group by numero_tienda
),
no_medidas as (
  select tr.*,
         coalesce(upper(trim(a.cliente_homologos)), upper(trim(tr.cadena))) as cliente_norm
  from tiendas_reporte tr
  left join cb_cadena_alias a
    on upper(trim(a.cadena_reporte)) = upper(trim(tr.cadena))
  where tr.numero_tienda not in (select numero_tienda from medidas where numero_tienda is not null)
),
presentes as (
  select distinct
    re.numero_tienda,
    upper(trim(ch.cliente)) as cliente_norm,
    ch.modelo
  from reporte_existencia re
  join cb_homologos ch on ch.sku = re.sku
  where re.numero_tienda in (select numero_tienda from no_medidas)
    and coalesce(re.existencia, 0) > 0
),
analisis as (
  select
    nm.numero_tienda,
    nm.tienda,
    nm.cadena,
    cat.categoria_norm,
    cat.cuadro_basico_norm,
    cat.modelo,
    case when p.modelo is not null then 1 else 0 end as presente
  from no_medidas nm
  join catalogo cat on cat.cliente_norm = nm.cliente_norm
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
  'Tiendas no medidas con compliance CB calculado contra cb_homologos. Usa cb_cadena_alias para mapear nombres operativos (reporte_existencia.cadena) a razones sociales (cb_homologos.cliente).';
