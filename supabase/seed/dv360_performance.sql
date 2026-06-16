-- Seed DV360 performance — reporte "DV360 Video Drean" (Mar 18 – Jun 15 2026,
-- Partner Mabe Argentina 7996192225). Agregado por mes + canal. Idempotente.
delete from dv360_performance where source = 'dv360_report';

insert into dv360_performance
  (mes, canal, impresiones, clicks, starts, q25, q50, q75, q100, skips, revenue_usd, source)
values
  ('2026-04-01','Demand Gen',348515,41276,335199,275160,233987,190749,168644,1159,2059.2225,'dv360_report'),
  ('2026-04-01','Marketplace',1338987,3189,1350555,1174454,1083484,973273,902592,0,1452.8003,'dv360_report'),
  ('2026-04-01','Programmatic',7134603,8179,7157980,6124772,5677283,5273937,4801776,0,8410.6178,'dv360_report'),
  ('2026-04-01','YouTube',22010619,18487,21231122,20580472,19648937,17555408,16657056,3197889,18685.4274,'dv360_report'),
  ('2026-05-01','Marketplace',3399830,10495,3406860,2952884,2677481,2357499,2164168,0,3688.8136,'dv360_report'),
  ('2026-05-01','Programmatic',5422957,5996,5458320,4835683,4503735,4165698,3740639,0,5883.9056,'dv360_report'),
  ('2026-05-01','YouTube',33118321,33662,32366305,31555371,29823096,25435974,23678906,7146976,32043.0399,'dv360_report'),
  ('2026-06-01','Programmatic',3,0,3,3,3,4,2,0,0.0033,'dv360_report'),
  ('2026-06-01','YouTube',5102253,3859,5094435,5046909,4847584,4087614,3789571,1182933,4886.4036,'dv360_report')
on conflict (mes, canal) do update set
  impresiones = excluded.impresiones,
  clicks      = excluded.clicks,
  starts      = excluded.starts,
  q25         = excluded.q25,
  q50         = excluded.q50,
  q75         = excluded.q75,
  q100        = excluded.q100,
  skips       = excluded.skips,
  revenue_usd = excluded.revenue_usd,
  source      = excluded.source,
  updated_at  = now();
