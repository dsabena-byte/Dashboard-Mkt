-- Config de diseño de una pieza (posición/tamaño de logo y texto) para el editor
-- flexible del paso "Diseñar", con la misma lógica que la Adaptación de piezas.
-- Guarda { logoOn, logoX, logoY, logoPct, textX, textY, textPct, color } como
-- fracciones 0..1 (X/Y/tamaño) para poder recomponer la pieza fielmente.
alter table contenido_calendario
  add column if not exists diseno jsonb;
