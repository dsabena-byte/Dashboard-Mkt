-- 0038: Reemplazar planning_media Jun-Dec con valores oficiales de MIX MEDIOS
--
-- Contexto: OMD solo confirmó el plan a nivel agregado (Digital / TV / OOH /
-- DOOH) para Jun-Dec. El granular por sistema/formato cargado en Supabase
-- (YouTube, TikTok, Meta, etc.) no es real y desinforma. Lo eliminamos y
-- cargamos los totales oficiales como filas simples.
--
-- Valores tomados del tab "MIX MEDIOS" del Sheet de OMD (mayo 2026):
--   Digital = DIGITAL + MELI (Mercado Ads va a Digital)
--   TV      = TV Cable
--   OOH     = OOH GF (Vía Pública tradicional)
--   DOOH    = OOH Táctico
--
-- El chart aplica un -7.5% (PLAN_NET_FACTOR) en código para netear costos
-- impositivos / agencia / fees. Los valores cargados acá son BRUTOS.

-- 1) Borrar el granular Jun-Dec (no es data real)
delete from planning_media
where fecha >= '2026-06-01' and tipo = 'media';

-- 2) Insertar valores oficiales de MIX MEDIOS
insert into planning_media (fecha, campania, sistema, tipo, inversion) values
  -- Junio: $70M total
  ('2026-06-01', 'Plan OMD', 'Digital', 'media', 60000000),
  ('2026-06-01', 'Plan OMD', 'OOH',     'media', 10000000),

  -- Julio: $204.7M total
  ('2026-07-01', 'Plan OMD', 'Digital', 'media', 164739813),
  ('2026-07-01', 'Plan OMD', 'OOH',     'media',  40000000),

  -- Agosto: $422.5M total
  ('2026-08-01', 'Plan OMD', 'Digital', 'media', 203608000),
  ('2026-08-01', 'Plan OMD', 'TV',      'media', 143825635),
  ('2026-08-01', 'Plan OMD', 'OOH',     'media',  44800000),
  ('2026-08-01', 'Plan OMD', 'DOOH',    'media',  30240000),

  -- Septiembre: $474.2M total
  ('2026-09-01', 'Plan OMD', 'Digital', 'media', 227431965),
  ('2026-09-01', 'Plan OMD', 'TV',      'media', 170000000),
  ('2026-09-01', 'Plan OMD', 'OOH',     'media',  44800000),
  ('2026-09-01', 'Plan OMD', 'DOOH',    'media',  31920000),

  -- Octubre: $505.9M total
  ('2026-10-01', 'Plan OMD', 'Digital', 'media', 246310000),
  ('2026-10-01', 'Plan OMD', 'TV',      'media', 182154872),
  ('2026-10-01', 'Plan OMD', 'OOH',     'media',  44800000),
  ('2026-10-01', 'Plan OMD', 'DOOH',    'media',  32620000),

  -- Noviembre: $242.2M total
  ('2026-11-01', 'Plan OMD', 'Digital', 'media', 141000000),
  ('2026-11-01', 'Plan OMD', 'TV',      'media',  83221301),
  ('2026-11-01', 'Plan OMD', 'DOOH',    'media',  18000000),

  -- Diciembre: $7.9M total
  ('2026-12-01', 'Plan OMD', 'Digital', 'media', 7933227);
