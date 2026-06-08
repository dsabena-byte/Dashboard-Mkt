-- =============================================================================
-- Agrega columna `rol` a meta_paid_creatives
-- =============================================================================
-- Aplicar en proyecto PRINCIPAL (vtcrhyyirqexczycuwhe).
--
-- Patrón: el cron meta-paid-sync ahora parsea ad_name (que sigue la convención
-- de OMD "Drean - {Categoria} - Meta - {TipoCompra} - {SKU}") y setea
-- categoria + tipo_compra + rol directamente desde el API. Sin dependencia de
-- CSV de OMD para Meta.
--
-- rol = Awareness (CPM, CPV) | Consideración (CPC).
-- =============================================================================

alter table meta_paid_creatives
  add column if not exists rol text;

comment on column meta_paid_creatives.rol is
  'Awareness | Consideración. Inferido del tipo_compra durante el cron meta-paid-sync (CPC→Consideración, CPM/CPV→Awareness).';

create index if not exists idx_mpc_categoria   on meta_paid_creatives (categoria);
create index if not exists idx_mpc_rol         on meta_paid_creatives (rol);
create index if not exists idx_mpc_tipo_compra on meta_paid_creatives (tipo_compra);
