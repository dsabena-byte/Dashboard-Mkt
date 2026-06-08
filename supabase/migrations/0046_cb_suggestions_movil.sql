-- =============================================================================
-- vw_cb_suggestions: hace móvil el universo de "tiendas medidas"
-- =============================================================================
-- Aplicar en proyecto CB (fsvdcpqzchrezkxflyfi).
--
-- Antes: `medidas` consideraba CUALQUIER tienda con data histórica en
-- cuadro_basico_semanal (cualquier semana). Si una tienda fue medida en
-- semana 5 pero hoy no está en el programa, se excluía de sugerencias.
--
-- Ahora: `medidas` solo considera tiendas en las **últimas 3 semanas cargadas**
-- (igual semánticamente a vw_cb_baseline_medidas). Cuando se carga una semana
-- nueva en cuadro_basico_semanal, automáticamente la ventana se desliza y
-- las sugerencias se recalculan sin tocar nada.
-- =============================================================================

drop view if exists vw_cb_suggestions;

create or replace view vw_cb_suggestions as
with
semanas_recientes as (
  -- Últimas 3 semanas cargadas en cuadro_basico_semanal — ventana móvil
  select distinct semana
  from cuadro_basico_semanal
  order by semana desc
  limit 3
),
catalogo as (
  select distinct
    upper(trim(cliente))       as cliente_norm,
    upper(trim(categoria))     as categoria_norm,
    upper(trim(cuadro_basico)) as cuadro_basico_norm,
    modelo
  from cb_homologos
),
medidas as (
  -- Tiendas presentes en las últimas 3 semanas del programa CB
  select distinct
    (regexp_match(tienda, '^(\d+)\s*-'))[1] as numero_tienda
  from cuadro_basico_semanal
  where tienda ~ '^\d+\s*-'
    and semana in (select semana from semanas_recientes)
),
tiendas_reporte as (
  select numero_tienda, max(tienda) as tienda, max(cadena) as cadena
  from reporte_existencia
  where numero_tienda is not null
  group by numero_tienda
),
no_medidas as (
  select tr.*,
    coalesce(upper(trim(a.cliente_homologos)), 'SMALL RETAILERS') as cliente_norm
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
  select nm.numero_tienda, nm.tienda, nm.cadena,
         cat.categoria_norm, cat.cuadro_basico_norm, cat.modelo,
         case when p.modelo is not null then 1 else 0 end as presente
  from no_medidas nm
  join catalogo cat on cat.cliente_norm = nm.cliente_norm
  left join presentes p
    on p.numero_tienda = nm.numero_tienda
   and p.cliente_norm  = cat.cliente_norm
   and p.modelo        = cat.modelo
)
select
  numero_tienda, tienda, cadena,
  count(*) as cb_target,
  sum(presente)::int as cb_ok,
  round(100.0 * sum(presente)::numeric / nullif(count(*), 0), 1) as cb_pct,
  count(*) filter (where cuadro_basico_norm = 'INFALTABLE')::int as infalt_target,
  sum(presente) filter (where cuadro_basico_norm = 'INFALTABLE')::int as infalt_ok,
  round(100.0 * sum(presente) filter (where cuadro_basico_norm = 'INFALTABLE')::numeric
        / nullif(count(*) filter (where cuadro_basico_norm = 'INFALTABLE'), 0), 1) as infalt_pct,
  count(*) filter (where cuadro_basico_norm = 'ESTRATEGICO')::int as estrat_target,
  sum(presente) filter (where cuadro_basico_norm = 'ESTRATEGICO')::int as estrat_ok,
  round(100.0 * sum(presente) filter (where cuadro_basico_norm = 'ESTRATEGICO')::numeric
        / nullif(count(*) filter (where cuadro_basico_norm = 'ESTRATEGICO'), 0), 1) as estrat_pct
from analisis
group by numero_tienda, tienda, cadena;

comment on view vw_cb_suggestions is
  'Tiendas no medidas con compliance CB calculado. Universo "medidas" usa solo las últimas 3 semanas de cuadro_basico_semanal (ventana móvil — se actualiza automático al cargar semana nueva).';
