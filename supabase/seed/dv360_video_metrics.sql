-- Seed DV360 video metrics — Instant report (Mar 18 – Jun 15 2026, Partner Mabe Argentina 7996192225).
-- Agregado por mes + fuente. Re-correr es idempotente (delete + insert ... on conflict).
delete from dv360_video_metrics where source = 'dv360_instant_report';

insert into dv360_video_metrics
  (mes, fuente, impresiones, starts, q25, q50, q75, q100, skips, revenue_usd, source)
values
  ('2026-04-01','Display',13221,1457,1411,711,291,198,1158,64.7044,'dv360_instant_report'),
  ('2026-04-01','Programmatic Video',8808884,8842277,7572975,6994043,6437668,5872814,1,11857.9362,'dv360_instant_report'),
  ('2026-04-01','YouTube/TrueView',22010619,21231122,20580472,19648937,17555408,16657056,3197889,18685.4274,'dv360_instant_report'),
  ('2026-05-01','Programmatic Video',8822787,8865180,7788567,7181216,6523197,5904807,0,9572.7192,'dv360_instant_report'),
  ('2026-05-01','YouTube/TrueView',33118321,32366305,31555371,29823096,25435974,23678906,7146976,32043.0399,'dv360_instant_report'),
  ('2026-06-01','Programmatic Video',3,3,3,3,4,2,0,0.0033,'dv360_instant_report'),
  ('2026-06-01','YouTube/TrueView',5102267,5094450,5046925,4847600,4087630,3789586,1182933,4886.4152,'dv360_instant_report')
on conflict (mes, fuente) do update set
  impresiones = excluded.impresiones,
  starts      = excluded.starts,
  q25         = excluded.q25,
  q50         = excluded.q50,
  q75         = excluded.q75,
  q100        = excluded.q100,
  skips       = excluded.skips,
  revenue_usd = excluded.revenue_usd,
  source      = excluded.source,
  updated_at  = now();
