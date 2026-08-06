-- Días reales que cada pieza estuvo entregando (impresiones > 0) dentro del mes.
-- La tabla guarda una fila por (ad_id, mes) agregada, así que el conteo de días
-- activos se calcula en el sync (insights diarios: level=ad, time_increment=1) y
-- se persiste acá. NULL = todavía no calculado (piezas legacy / meses no re-synceados).
alter table meta_paid_creatives
  add column if not exists dias_activos int;

comment on column meta_paid_creatives.dias_activos is
  'Días del mes con impresiones > 0 (días reales que la pieza estuvo pautada/entregando). Lo completa meta-paid-sync a partir de insights diarios. NULL si aún no se calculó.';
