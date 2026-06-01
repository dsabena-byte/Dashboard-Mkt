-- 0035: Rename Build → Awareness y Consider → Consideración
-- Alinea la nomenclatura de Pauta y Planning con el funnel del Overview
-- (Awareness / Interés / Consideración) tomado del slide de estrategia Drean.

-- 1) Data en pauta_performance.objetivo
update pauta_performance
set objetivo = 'Awareness'
where objetivo = 'Build';

update pauta_performance
set objetivo = 'Consideración'
where objetivo = 'Consider';

-- 2) Data en planning_media.rol
update planning_media
set rol = 'Awareness'
where rol = 'Build';

update planning_media
set rol = 'Consideración'
where rol = 'Consider';

-- 3) Recrear vista que filtraba por los valores viejos
drop view if exists vw_planning_media_por_categoria;
create view vw_planning_media_por_categoria as
select
  fecha,
  campania,
  sum(inversion) filter (where tipo = 'media') as media,
  sum(inversion) filter (where tipo = 'costo') as costos,
  sum(inversion) filter (where rol = 'Awareness')     as awareness,
  sum(inversion) filter (where rol = 'Consideración') as consideracion,
  sum(inversion) as total
from planning_media
group by fecha, campania;

comment on view vw_planning_media_por_categoria is
  'Por (fecha, campania): split media/costos y Awareness/Consideración (ex Build/Consider). Usado por las KPI cards.';
