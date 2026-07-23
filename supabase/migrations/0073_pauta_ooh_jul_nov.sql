-- =============================================================================
-- OOH Brand Julio→Noviembre 2026 (vía pública, gestión OMD) → pauta_performance.
--
-- Dos compras OOH de Brand que corren con los MISMOS datos de Julio a Noviembre:
--   1) Vía pública estática recurrente: $10.000.000/mes (sin medición de visibilidad).
--   2) Cartel de dos caras ($25.500.000/mes) medido por GeoPlanning+ (Scopesi/UCA).
--
-- Como pauta_performance tiene clave única (mes, categoria, medio, objetivo,
-- tipo_compra), ambas compras Brand/OOH se COMBINAN en una sola fila por mes:
--   · inversión  = 10.000.000 + 25.500.000 = 35.500.000
--   · visibilidad = la del cartel (la vía pública no tiene medición).
--
-- Cartel (dos caras, datos SEMANALES de GeoPlanning+, base circulación 4Q 2025):
--   · Impactos = (867.110 + 883.855) semanales × 4,3 semanas ≈ 7.529.150 / mes
--   · Alcance  = 535.163 + 540.729 = 1.075.892 (suma de ambas caras)
--   · Frecuencia = impactos / alcance ≈ 7,00  (1,62 semanal × 4,3 ≈ 7)
--
-- Idempotente: on conflict (mes, categoria, medio, objetivo, tipo_compra) update.
-- =============================================================================
insert into pauta_performance
  (mes, categoria, medio, objetivo, tipo_compra,
   alcance_plan, alcance, frecuencia_plan, frecuencia,
   impresiones_plan, impresiones, clics_plan, clics,
   views_plan, views, inversion_plan, inversion,
   costo_plan, costo, ctr_plan, ctr)
values
  ('Julio 2026',      'Brand', 'OOH', 'Build', 'OOH', null, 1075892, null, 7.00, null, 7529150, null, null, null, null, 35500000, 35500000, null, null, null, null),
  ('Agosto 2026',     'Brand', 'OOH', 'Build', 'OOH', null, 1075892, null, 7.00, null, 7529150, null, null, null, null, 35500000, 35500000, null, null, null, null),
  ('Septiembre 2026', 'Brand', 'OOH', 'Build', 'OOH', null, 1075892, null, 7.00, null, 7529150, null, null, null, null, 35500000, 35500000, null, null, null, null),
  ('Octubre 2026',    'Brand', 'OOH', 'Build', 'OOH', null, 1075892, null, 7.00, null, 7529150, null, null, null, null, 35500000, 35500000, null, null, null, null),
  ('Noviembre 2026',  'Brand', 'OOH', 'Build', 'OOH', null, 1075892, null, 7.00, null, 7529150, null, null, null, null, 35500000, 35500000, null, null, null, null)
on conflict (mes, categoria, medio, objetivo, tipo_compra) do update set
  alcance_plan     = excluded.alcance_plan,
  alcance          = excluded.alcance,
  frecuencia_plan  = excluded.frecuencia_plan,
  frecuencia       = excluded.frecuencia,
  impresiones_plan = excluded.impresiones_plan,
  impresiones      = excluded.impresiones,
  clics_plan       = excluded.clics_plan,
  clics            = excluded.clics,
  views_plan       = excluded.views_plan,
  views            = excluded.views,
  inversion_plan   = excluded.inversion_plan,
  inversion        = excluded.inversion,
  costo_plan       = excluded.costo_plan,
  costo            = excluded.costo,
  ctr_plan         = excluded.ctr_plan,
  ctr              = excluded.ctr,
  updated_at       = now();
