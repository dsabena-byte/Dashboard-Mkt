-- =============================================================================
-- Seed: una semana de data de prueba
-- =============================================================================
-- Ejecutar DESPUÉS de aplicar 0001 y 0002.
-- Reemplazá los nombres ('Marca', 'Campaña Q2', etc.) por los reales cuando
-- empieces a ingestar data en serio.
-- =============================================================================

-- ---------- Planning ----------
insert into planning (fecha, canal, campania, inversion_plan, kpi_target, metric_type) values
  ('2026-05-04', 'google_ads', 'Campaña Q2 — Search', 5000.00, 200000, 'impressions'),
  ('2026-05-04', 'google_ads', 'Campaña Q2 — Search', 5000.00, 8000,   'clicks'),
  ('2026-05-04', 'google_ads', 'Campaña Q2 — Search', 5000.00, 250,    'conversions'),
  ('2026-05-04', 'meta_ads',   'Campaña Q2 — Awareness', 3000.00, 500000, 'impressions'),
  ('2026-05-04', 'meta_ads',   'Campaña Q2 — Awareness', 3000.00, 12000,  'clicks'),
  ('2026-05-04', 'tv',         'Spot Mayo',              15000.00, 2000000, 'impressions'),
  ('2026-05-04', 'radio',      'Cuña Mayo',              4000.00, 800000,  'impressions');

-- ---------- Ads performance (5 días) ----------
insert into ads_performance
  (fecha, plataforma, campania_id, campania_nombre, utm_source, utm_medium, utm_campaign,
   impresiones, clicks, costo, conversiones, valor_conversion)
values
  ('2026-05-04', 'google_ads', 'gads_001', 'Campaña Q2 — Search', 'google', 'cpc', 'q2-search', 28500, 1180, 720.50, 38, 4560.00),
  ('2026-05-05', 'google_ads', 'gads_001', 'Campaña Q2 — Search', 'google', 'cpc', 'q2-search', 31200, 1310, 815.00, 42, 5040.00),
  ('2026-05-06', 'google_ads', 'gads_001', 'Campaña Q2 — Search', 'google', 'cpc', 'q2-search', 29800, 1260, 770.20, 40, 4800.00),
  ('2026-05-07', 'google_ads', 'gads_001', 'Campaña Q2 — Search', 'google', 'cpc', 'q2-search', 33100, 1420, 870.00, 47, 5640.00),
  ('2026-05-08', 'google_ads', 'gads_001', 'Campaña Q2 — Search', 'google', 'cpc', 'q2-search', 35400, 1510, 920.40, 51, 6120.00),
  ('2026-05-04', 'meta_ads',   'meta_001', 'Campaña Q2 — Awareness', 'facebook', 'paid-social', 'q2-awareness', 71200, 1820, 430.00, 22, 1980.00),
  ('2026-05-05', 'meta_ads',   'meta_001', 'Campaña Q2 — Awareness', 'facebook', 'paid-social', 'q2-awareness', 68500, 1740, 410.00, 19, 1710.00),
  ('2026-05-06', 'meta_ads',   'meta_001', 'Campaña Q2 — Awareness', 'instagram','paid-social', 'q2-awareness', 82400, 2100, 510.00, 28, 2520.00),
  ('2026-05-07', 'meta_ads',   'meta_001', 'Campaña Q2 — Awareness', 'instagram','paid-social', 'q2-awareness', 79100, 2020, 480.00, 25, 2250.00),
  ('2026-05-08', 'meta_ads',   'meta_001', 'Campaña Q2 — Awareness', 'instagram','paid-social', 'q2-awareness', 84800, 2160, 525.00, 30, 2700.00);

-- ---------- Web traffic (GA4) ----------
insert into web_traffic
  (fecha, utm_source, utm_medium, utm_campaign, sesiones, usuarios, conversiones, eventos_clave, bounce_rate, avg_session_duration)
values
  ('2026-05-04', 'google',    'cpc',         'q2-search',    1020, 940,  35, 120, 0.4210, 145.30),
  ('2026-05-05', 'google',    'cpc',         'q2-search',    1140, 1050, 40, 138, 0.4015, 152.20),
  ('2026-05-06', 'google',    'cpc',         'q2-search',    1100, 1010, 38, 132, 0.4108, 148.90),
  ('2026-05-07', 'google',    'cpc',         'q2-search',    1230, 1130, 44, 148, 0.3920, 158.40),
  ('2026-05-08', 'google',    'cpc',         'q2-search',    1310, 1200, 48, 160, 0.3850, 162.10),
  ('2026-05-04', 'facebook',  'paid-social', 'q2-awareness', 1580, 1420, 20, 78,  0.5520, 88.10),
  ('2026-05-05', 'facebook',  'paid-social', 'q2-awareness', 1510, 1360, 17, 70,  0.5610, 84.30),
  ('2026-05-06', 'instagram', 'paid-social', 'q2-awareness', 1820, 1640, 25, 92,  0.5310, 95.40),
  ('2026-05-07', 'instagram', 'paid-social', 'q2-awareness', 1750, 1580, 22, 86,  0.5410, 92.20),
  ('2026-05-08', 'instagram', 'paid-social', 'q2-awareness', 1880, 1700, 27, 98,  0.5240, 97.10);

-- ---------- Social metrics (propia + 1 competidor placeholder) ----------
insert into social_metrics (fecha, plataforma, cuenta, es_competidor, seguidores, engagement_rate, posts, alcance) values
  ('2026-05-08', 'instagram', '@mi_marca',     false, 45200, 0.0320, 4, 128000),
  ('2026-05-08', 'tiktok',    '@mi_marca',     false, 18300, 0.0510, 3,  92000),
  ('2026-05-08', 'instagram', '@competidor_1', true,  62100, 0.0280, 5, 145000),
  ('2026-05-08', 'instagram', '@competidor_2', true,  38900, 0.0410, 6, 102000);

-- ---------- Alerts config ----------
insert into alerts_config (nombre, kpi, canal, threshold_pct, comparison, canal_notif) values
  ('Conversiones Search por debajo del 80%', 'conversions', 'google_ads', 80.00, 'below', 'in_app'),
  ('CPA Search por encima del 120%',          'cpa',         'google_ads', 120.00, 'above', 'in_app');
