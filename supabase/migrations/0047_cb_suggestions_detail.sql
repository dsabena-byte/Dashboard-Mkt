-- =============================================================================
-- vw_cb_suggestions_detail: detalle por (tienda × modelo) para el drill-down
-- =============================================================================
-- Aplicar en proyecto CB (fsvdcpqzchrezkxflyfi).
--
-- Una fila por cada modelo CB de la cadena de la tienda no medida, con flag
-- presente (1 si alguno de sus SKUs equivalentes aparece en reporte_existencia).
--
-- Alimenta el "Detalle de SKUs" desplegable de cada tienda en el tab Sugerencias.
-- =============================================================================

drop view if exists vw_cb_suggestions_detail;

create or replace view vw_cb_suggestions_detail as
with
semanas_recientes as (
  select distinct semana
  from cuadro_basico_semanal
  order by semana desc
  limit 3
),
catalogo as (
  select distinct
    upper(trim(cliente))       as cliente_norm,
    upper(trim(categoria))     as categoria,
    upper(trim(cuadro_basico)) as cuadro_basico,
    modelo
  from cb_homologos
),
medidas as (
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
)
select
  nm.numero_tienda,
  nm.tienda,
  nm.cadena,
  cat.cuadro_basico,
  cat.categoria,
  cat.modelo,
  (case when p.modelo is not null then 1 else 0 end)::int as presente
from no_medidas nm
join catalogo cat on cat.cliente_norm = nm.cliente_norm
left join presentes p
  on p.numero_tienda = nm.numero_tienda
 and p.cliente_norm  = cat.cliente_norm
 and p.modelo        = cat.modelo;

comment on view vw_cb_suggestions_detail is
  'Detalle por (tienda no medida × modelo): para el drill-down del tab Sugerencias. Cada fila indica si ese modelo del catalogo CB esta presente en el reporte_existencia (1 = sí, 0 = no).';
