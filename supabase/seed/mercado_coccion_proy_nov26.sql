-- =============================================================================
-- Mercado Cocción — proyección U12/MAT nov-2026 (punto estimado, no medición GFK).
-- Alimenta el driver de Salud de Marca y el dashboard de mercado.
--
-- Drean (driver = blend Mid+High): lanzó nuevo portfolio en may-25, así que el año
-- móvil de nov-26 cae 100% post-lanzamiento → U12(nov-26)=0,7·mensual+0,3·U12(nov-25).
--   Drean Mid:  mensual US 20 / VS 24  → U12 US 16,74 / VS 19,66
--   Drean High: mensual US 10 / VS 10  → U12 US  7,59 / VS  7,51
--
-- Electrolux (driver = blend Total): crecimiento gradual (sin lanzamiento discreto)
-- → U12(nov-26)=0,5·mensual+0,5·U12(nov-25).
--   Electrolux Total: mensual US 7 / VS 12 → U12 US 4,71 / VS 8,79
--
-- index_price queda null (es un punto proyectado, no una medición de precio).
-- =============================================================================

delete from mercado_share
 where categoria='Cocción' and agregacion='MAT' and mes='2026-11-01'
   and ( (marca='DREAN' and segmento in ('Mid','High'))
      or (marca='ELECTROLUX' and segmento='Total') );

insert into mercado_share (mes,categoria,segmento,marca,unit_share,value_share,index_price,agregacion) values
  ('2026-11-01','Cocción','Mid','DREAN',16.74,19.66,null,'MAT'),
  ('2026-11-01','Cocción','High','DREAN',7.59,7.51,null,'MAT'),
  ('2026-11-01','Cocción','Total','ELECTROLUX',4.71,8.79,null,'MAT')
on conflict (mes,categoria,segmento,marca,agregacion) do update
  set unit_share=excluded.unit_share, value_share=excluded.value_share, index_price=excluded.index_price;
