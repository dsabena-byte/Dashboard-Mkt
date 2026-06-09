-- =============================================================================
-- vw_cb_suggestions_detail: agrega found_sku (SKU exacto encontrado en reporte)
-- =============================================================================
-- Aplicar en proyecto CB (fsvdcpqzchrezkxflyfi).
--
-- Antes: la view solo devolvía el modelo canónico (cb_homologos.modelo). Si la
-- tienda cumplía con un homólogo distinto del modelo, no se sabía cuál SKU
-- físico estaba presente.
--
-- Ahora: agrega columna found_sku que indica el SKU exacto del reporte que
-- gatilló el match. Si el modelo no está presente, found_sku queda NULL.
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
  -- Por cada (tienda, cliente_norm, modelo) que tenga al menos un SKU
  -- equivalente presente, devolvemos un SKU representativo encontrado.
  -- Priorizamos el modelo canónico si está presente; sino el primero alfabético.
  select
    re.numero_tienda,
    upper(trim(ch.cliente)) as cliente_norm,
    ch.modelo,
    -- string_agg ordenado: si el modelo canónico aparece, queda primero
    (array_agg(distinct re.sku order by re.sku))[1] as found_sku_first,
    bool_or(re.sku = ch.modelo) as modelo_present
  from reporte_existencia re
  join cb_homologos ch on ch.sku = re.sku
  where re.numero_tienda in (select numero_tienda from no_medidas)
    and coalesce(re.existencia, 0) > 0
  group by re.numero_tienda, upper(trim(ch.cliente)), ch.modelo
)
select
  nm.numero_tienda,
  nm.tienda,
  nm.cadena,
  cat.cuadro_basico,
  cat.categoria,
  cat.modelo,
  (case when p.modelo is not null then 1 else 0 end)::int as presente,
  case
    when p.modelo is null then null
    when p.modelo_present then cat.modelo  -- el modelo canónico mismo está presente
    else p.found_sku_first                  -- un homólogo está presente
  end as found_sku
from no_medidas nm
join catalogo cat on cat.cliente_norm = nm.cliente_norm
left join presentes p
  on p.numero_tienda = nm.numero_tienda
 and p.cliente_norm  = cat.cliente_norm
 and p.modelo        = cat.modelo;

comment on view vw_cb_suggestions_detail is
  'Detalle por (tienda no medida × modelo). presente=1 si cualquier SKU equivalente está en reporte. found_sku indica el SKU real encontrado: el modelo canónico si está presente, sino el homólogo alfabéticamente primero.';
