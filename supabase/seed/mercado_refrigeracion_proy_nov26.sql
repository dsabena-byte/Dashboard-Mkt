-- Mercado Refrigeración — PROYECCIÓN nov-2026 (U12/MAT, segmento Total) por marca.
-- Base para estimar la Salud de Marca nov-26. U12(nov-26) construido desde el
-- valor MENSUAL final proyectado + rampa desde el último U12 real (abr-26).
--   Samsung: mensual nov-26 US 10% / VS 17% → U12 US 10.65 / VS 17.07
--   Philco:  mensual nov-26 US 10% / VS  8% → U12 US 12.39 / VS  9.91
delete from mercado_share where categoria='Refrigeración' and segmento='Total' and agregacion='MAT' and mes='2026-11-01';

insert into mercado_share (mes,categoria,segmento,marca,unit_share,value_share,index_price,agregacion) values
  ('2026-11-01','Refrigeración','Total','SAMSUNG',10.65,17.07,null,'MAT'),
  ('2026-11-01','Refrigeración','Total','PHILCO',12.39,9.91,null,'MAT')
on conflict (mes,categoria,segmento,marca,agregacion) do update set unit_share=excluded.unit_share, value_share=excluded.value_share;
