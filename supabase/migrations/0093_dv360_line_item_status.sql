-- Estado de la línea (activa/pausada) de las piezas DV360. Lo trae el reporte
-- "DV360 Video Drean" con la dimensión "Line Item Status" (Active/Paused/Archived)
-- y lo escribe el Apps Script syncDv360. NULL = meses sincronizados antes de
-- agregar la dimensión al reporte.
alter table dv360_creatives
  add column if not exists line_item_status text;

comment on column dv360_creatives.line_item_status is
  'Estado de la línea en DV360 (Active/Paused/Archived). Del reporte "DV360 Video Drean" (dim. Line Item Status). Active = pauta corriendo.';
