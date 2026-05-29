-- =============================================================================
-- Tabla pauta_performance: performance de pauta digital ejecutada vs planificada
-- de Drean por mes/categoría/medio/objetivo. Fuente: planillas "Control Digital_*"
-- de OMD (xlsx en Drive). Alimenta el dashboard /performance.
-- =============================================================================

create table if not exists pauta_performance (
  id               bigint generated always as identity primary key,
  mes              text not null,                  -- 'Abril 2026', 'Mayo 2026', ...
  categoria        text not null,                  -- Brand | Lavado | Refrigeración | Cocción | Promoción | UGC
  medio            text not null,                  -- Meta | TikTok | YouTube | Programmatic | Mercado Ads | Google Demand Gen | Geo Mobile | Google Search | TV Cable | DOOH
  objetivo         text not null,                  -- Build | Consider
  tipo_compra      text not null,                  -- CPM | CPC | CPV | TRP | OOH
  alcance_plan     bigint,
  alcance          bigint,
  frecuencia_plan  numeric(8,2),
  frecuencia       numeric(8,2),
  impresiones_plan bigint,
  impresiones      bigint,
  clics_plan       bigint,
  clics            bigint,
  views_plan       bigint,
  views            bigint,
  inversion_plan   numeric(16,2),
  inversion        numeric(16,2),
  costo_plan       numeric(12,4),
  costo            numeric(12,4),
  ctr_plan         numeric(8,4),
  ctr              numeric(8,4),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint uq_pauta_perf unique (mes, categoria, medio, objetivo, tipo_compra)
);

create index if not exists idx_pauta_perf_mes on pauta_performance(mes);
create index if not exists idx_pauta_perf_categoria on pauta_performance(categoria);
create index if not exists idx_pauta_perf_medio on pauta_performance(medio);

comment on table pauta_performance is
  'Pauta digital ejecutada vs planificada de Drean por mes/categoría/medio/objetivo. Fuente: planillas Control Digital_*.xlsx (OMD) del Drive. Alimenta /performance.';
comment on column pauta_performance.objetivo is 'Build = Upper Funnel (Awareness) | Consider = Mid Funnel.';
comment on column pauta_performance.tipo_compra is 'CPM/CPC/CPV para digital, TRP para TV Cable, OOH para DOOH.';

-- Lectura para Next.js server (anon role) y para anon publishable key.
alter table pauta_performance enable row level security;
drop policy if exists "pauta_performance_public_read" on pauta_performance;
create policy "pauta_performance_public_read"
  on pauta_performance for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Seed (idempotente): Abril 2026 (Control Digital_Abril.xlsx + TV Cable + DOOH)
--                     y Mayo 2026 (Control Digital_Mayo.xlsx).
-- ---------------------------------------------------------------------------
insert into pauta_performance
  (mes, categoria, medio, objetivo, tipo_compra,
   alcance_plan, alcance, frecuencia_plan, frecuencia,
   impresiones_plan, impresiones, clics_plan, clics,
   views_plan, views, inversion_plan, inversion,
   costo_plan, costo, ctr_plan, ctr)
values
  ('Abril 2026', 'Brand', 'TV Cable', 'Build', 'TRP', null, 2817518, null, 6.85, null, 19300000, null, null, null, null, 65253780, 65253780, null, null, null, null),
  ('Abril 2026', 'Brand', 'Meta', 'Build', 'CPM', 331617, 2584074, 15, 2.2, 4974262, 5695747, 7461, 2243, null, null, 1442536, 1414405.57, 290, 248.33, 0.15, 0.04),
  ('Abril 2026', 'Brand', 'TikTok', 'Build', 'CPM', 133333, 662680, 15, 4.91, 2000000, 3252934, 3000, 3484, null, null, 1000000, 999826.71, 500, 307.36, 0.15, 0.11),
  ('Abril 2026', 'Brand', 'YouTube', 'Build', 'CPM', 740741, 1278104, 1.5, 0.98, 1111111, 1248123, 3000, 1245, null, null, 1000000, 987154, 900, 790.91, 0.15, 0.1),
  ('Abril 2026', 'Brand', 'YouTube', 'Build', 'CPV', 1142857, 1550013, 1.5, 1.29, 1714286, 1992900, 3000, 2619, 1200000, 1306329, 3000000, 2958346.79, 2.5, 2.26, 0.15, 0.13),
  ('Abril 2026', 'Brand', 'Programmatic', 'Build', 'CPM', 277778, 642704, 4, 2.08, 1111111, 1338987, 3000, 3189, null, null, 2000000, 2003216.2, 1800, 1496.07, 0.15, 0.24),
  ('Abril 2026', 'Cocción', 'Meta', 'Build', 'CPM', 2525724, 2797395, 2, 2.21, 5051448, 6172573, 7577, 2695, null, null, 1464920, 1464784, 290, 237.31, 0.15, 0.04),
  ('Abril 2026', 'Cocción', 'Meta', 'Consider', 'CPC', 67820, 389329, 18, 2.61, 1220767, 1016878, 9766, 54652, null, null, 878952, 878832, 90, 16.08, 0.8, 5.37),
  ('Abril 2026', 'Cocción', 'TikTok', 'Build', 'CPM', 366118, 485386, 4, 5.12, 1464471, 2485367, 2197, 2050, null, null, 732235.72, 732195, 500, 294.6, 0.15, 0.08),
  ('Abril 2026', 'Cocción', 'YouTube', 'Build', 'CPM', 542563, 893884, 1.5, 0.9, 813844, 807550, 1221, 8620, null, null, 732460, 729146, 900, 902.91, 0.15, 1.07),
  ('Abril 2026', 'Cocción', 'YouTube', 'Build', 'CPV', 1436459, 1140014, 1.5, 1.4, 2154688, 1598740, 3232, null, 1508282, 1096756, 3770704.08, 2012787.63, 2.5, 1.84, 0.15, 0),
  ('Abril 2026', 'Cocción', 'Programmatic', 'Build', 'CPM', 305175, null, 4, null, 1220699, 1376071, 1831, 1430, null, null, 2197259, 2197211.57, 1800, 1596.73, 0.15, 0.1),
  ('Abril 2026', 'Cocción', 'Mercado Ads', 'Build', 'CPM', 24415, 190863, 10, 2, 244153, 314403, 366, 4882, null, null, 1464920, 750668, 6000, 2387.6, 0.15, 1.55),
  ('Abril 2026', 'Cocción', 'Google Demand Gen', 'Consider', 'CPC', null, 772223, null, 2.54, 1709073, 1963083, 17091, 127809, null, null, 1025444, 1024872, 60, 8.02, 1, 6.51),
  ('Abril 2026', 'Cocción', 'Geo Mobile', 'Consider', 'CPC', null, null, null, null, 205089, 370166, 2051, 2058, null, null, 717810.8, 717810.8, 350, 348.79, 1, 0.56),
  ('Abril 2026', 'Cocción', 'Google Search', 'Consider', 'CPC', null, null, null, null, 52319, 56285, 523, 1318, null, null, 292984, 72814, 560, 55.25, 1, 2.34),
  ('Abril 2026', 'Lavado', 'DOOH', 'Build', 'OOH', null, 1940000, null, 8.8, null, 17000000, null, null, null, null, 22500000, 22500000, null, null, null, null),
  ('Abril 2026', 'Lavado', 'Meta', 'Build', 'CPM', 5789172, 5299938, 2, 2.62, 11578345, 13869699, 17368, 658, null, null, 3357720, 3357435, 290, 242.07, 0.15, 0),
  ('Abril 2026', 'Lavado', 'Meta', 'Consider', 'CPC', 120429, 638592, 18, 2.73, 2167722, 1740214, 17342, 77654, null, null, 1560760, 1560476, 90, 20.1, 0.8, 4.46),
  ('Abril 2026', 'Lavado', 'TikTok', 'Build', 'CPM', 1218192, 1160405, 4, 6.44, 4872768, 7471551, 7309, 6754, null, null, 2436384.05, 2435959, 500, 326.03, 0.15, 0.09),
  ('Abril 2026', 'Lavado', 'YouTube', 'Build', 'CPM', 2199852, 3029247, 1.5, 1.02, 3299778, 3083213, 4950, 1381, null, null, 2969800, 2788944, 900, 904.56, 0.15, 0.04),
  ('Abril 2026', 'Lavado', 'YouTube', 'Build', 'CPV', 2671398, 2734476, 1.5, 1.97, 4007097, 5389939, 6011, 5298, 2804968, 3717310, 7012420, 7012771, 2.5, 1.89, 0.15, 0.1),
  ('Abril 2026', 'Lavado', 'Programmatic', 'Build', 'CPM', 556944, 642704, 4, 3.89, 2227778, 2498743, 3342, 2920, null, null, 4010000, 3991059.02, 1800, 1597.23, 0.15, 0.12),
  ('Abril 2026', 'Lavado', 'Mercado Ads', 'Build', 'CPM', 250000, 767735, 2, 2, 500000, 1538115, 750, 19892, null, null, 3000000, 3020934, 6000, 1964.05, 0.15, 1.29),
  ('Abril 2026', 'Lavado', 'Google Demand Gen', 'Consider', 'CPC', null, 1606671, null, 2.39, 3929533, 3843913, 39295, 195407, null, null, 2357720, 2355730, 60, 12.06, 1, 5.08),
  ('Abril 2026', 'Lavado', 'Geo Mobile', 'Consider', 'CPC', null, null, null, null, 557169, 1421503, 5572, 5602, null, null, 1950090, 1950090, 350, 348.11, 1, 0.39),
  ('Abril 2026', 'Lavado', 'Google Search', 'Consider', 'CPC', null, null, null, null, 104986, 313048, 1050, 6061, null, null, 587920, 315000, 560, 51.97, 1, 1.94),
  ('Abril 2026', 'Refrigeración', 'Meta', 'Build', 'CPM', 3788586, 3812410, 2, 2.38, 7577172, 9056344, 11366, 3326, null, null, 2197380, 2197130.42, 290, 242.61, 0.15, 0.04),
  ('Abril 2026', 'Refrigeración', 'Meta', 'Consider', 'CPC', 915575, 551469, 2, 2.2, 1831150, 1213701, 14649, 36518, null, null, 1318428, 1318322.5, 90, 36.1, 0.8, 3.01),
  ('Abril 2026', 'Refrigeración', 'TikTok', 'Build', 'CPM', 549177, 627860, 4, 5.67, 2196707, 3557516, 3295, 2941, null, null, 1098353.59, 1098069, 500, 308.66, 0.15, 0.08),
  ('Abril 2026', 'Refrigeración', 'YouTube', 'Build', 'CPM', 813682, 1250559, 1.5, 0.97, 1220523, 1208880, 1831, 586, null, null, 1098470.26, 1090897, 900, 902.4, 0.15, 0.05),
  ('Abril 2026', 'Refrigeración', 'YouTube', 'Build', 'CPV', 2154688, 1269795, 1.5, 1.72, 3232032, 2185462, 4848, 2581, 2262422, 1459815, 5656056.12, 3019183, 2.5, 2.07, 0.15, 0.12),
  ('Abril 2026', 'Refrigeración', 'Programmatic', 'Build', 'CPM', 457788, 910456, 4, 2, 1831150, 2066736, 2747, 2716, null, null, 3296070, 3295964.97, 1800, 1594.77, 0.15, 0.13),
  ('Abril 2026', 'Refrigeración', 'Mercado Ads', 'Build', 'CPM', 183115, 506374, 2, 2, 366230, 1006220, 549, 17679, null, null, 2197380, 2210823, 6000, 2197.16, 0.15, 1.76),
  ('Abril 2026', 'Refrigeración', 'Google Demand Gen', 'Consider', 'CPC', null, 954472, null, 2.72, 2563610, 2592881, 25636, 160901, null, null, 1538166, 1563373, 60, 9.72, 1, 6.21),
  ('Abril 2026', 'Refrigeración', 'Geo Mobile', 'Consider', 'CPC', null, null, null, null, 307633, 841844, 3076, 3093, null, null, 1076716.2, 1076716.2, 350, 348.11, 1, 0.37),
  ('Abril 2026', 'Refrigeración', 'Google Search', 'Consider', 'CPC', null, null, null, null, 78478, 46613, 785, 1139, null, null, 439476, 60261, 560, 52.91, 1, 2.44),
  ('Abril 2026', 'Promoción', 'Meta', 'Build', 'CPM', 533738, 4361947, 15, 1.63, 8006069, 7118529, 12009, 1926, null, null, 2321760, 1625232, 290, 228.31, 0.15, 0.03),
  ('Abril 2026', 'Promoción', 'Meta', 'Consider', 'CPC', 107489, 452443, 18, 1.61, 1934800, 728405, 15478, 18598, null, null, 1393056, 975139, 90, 52.43, 0.8, 2.55),
  ('Abril 2026', 'Promoción', 'TikTok', 'Build', 'CPM', 341386, 3106298, 15, 1.76, 5120792, 5480384, 7681, 6208, null, null, 2560396, 1791879, 500, 326.96, 0.15, 0.11),
  ('Abril 2026', 'Promoción', 'YouTube', 'Build', 'CPM', 103189, 1344053, 15, 1.02, 1547840, 1375269, 2322, 1196, null, null, 1393056, 974971, 900, 708.93, 0.15, 0.09),
  ('Abril 2026', 'Promoción', 'YouTube', 'Build', 'CPV', 227665, 2356784, 15, 1.32, 3414977, 3120543, 5122, 1341, 2390484, 2964102, 5976210.24, 4179364, 2.5, 1.41, 0.15, 0.04),
  ('Abril 2026', 'Promoción', 'Programmatic', 'Build', 'CPM', 93157, null, 18, null, 1676827, 1193053, 2515, 1113, null, null, 3018288, 2112234.83, 1800, 1770.45, 0.15, 0.09),
  ('Abril 2026', 'Promoción', 'Mercado Ads', 'Build', 'CPM', 38696, 350462, 10, 2, 386960, 583385, 580, 13104, null, null, 2321760, 1706957, 6000, 2925.95, 0.15, 2.25),
  ('Abril 2026', 'Promoción', 'Google Demand Gen', 'Consider', 'CPC', null, 41265, null, 9.49, 2708720, 391630, 29692, 41189, null, null, 1625232, 2886337, 60, 70.08, 1.1, 10.52),
  ('Abril 2026', 'Promoción', 'Google Search', 'Consider', 'CPC', null, null, null, null, 82920, 2587, 829, 144, null, null, 464352, 8010, 560, 55.63, 1, 5.57),
  ('Mayo 2026', 'Brand', 'TV Cable', 'Build', 'TRP', null, 2900000, null, 7.09, null, 20800000, null, null, null, null, 97400325, 97400325, null, null, null, null),
  ('Mayo 2026', 'Brand', 'Meta', 'Build', 'CPM', 6465776, 4033486, 2, 2.88, 12931553, 11603969, 19396, 5764, null, null, 3750150.3, 2859417.66, 290, 246.42, 0.15, 0.05),
  ('Mayo 2026', 'Brand', 'TikTok', 'Build', 'CPM', 1250050, 812273, 4, 4.89, 5000200, 3970518, 7500, 4139, null, null, 2500100.2, 1386099.89, 500, 349.1, 0.15, 0.1),
  ('Mayo 2026', 'Brand', 'YouTube', 'Build', 'CPM', 1851926, 1278104, 1.5, 0.98, 2777889, 1248123, 4167, 1245, null, null, 2500100.2, 2228864, 900, 1785.77, 0.15, 0.1),
  ('Mayo 2026', 'Brand', 'YouTube', 'Build', 'CPV', 2381048, 1550013, 1.5, 1.29, 3571572, 1992900, 5357, 2619, 2500100, 1306329, 6250250.5, 5585056, 2.5, 4.28, 0.15, 0.13),
  ('Mayo 2026', 'Cocción', 'Meta', 'Build', 'CPM', 3448276, 3001663, 2, 2.22, 6896552, 6673306, 10345, 3544, null, null, 2000000, 1622204.2, 290, 243.09, 0.15, 0.05),
  ('Mayo 2026', 'Cocción', 'Meta', 'Consider', 'CPC', 1199898, 662876, 2, 2.37, 2399795, 1573856, 19198, 72066, null, null, 1727852.46, 1406952.92, 90, 19.52, 0.8, 4.58),
  ('Mayo 2026', 'Cocción', 'TikTok', 'Build', 'CPM', 719939, 541239, 4, 4.55, 2879754, 2461276, 4320, 1938, null, null, 1439877.05, 806547.15, 500, 327.69, 0.15, 0.08),
  ('Mayo 2026', 'Cocción', 'YouTube', 'Build', 'CPM', 1066576, 351851, 1.5, 0.84, 1599863, 294929, 2400, 109, null, null, 1439877.05, 269260, 900, 912.97, 0.15, 0.04),
  ('Mayo 2026', 'Cocción', 'YouTube', 'Build', 'CPV', 2326231, 1651054, 1.5, 1.47, 3489347, 2428169, 5234, 3316, 2442543, 1605679, 6106356.68, 3511582, 2.5, 2.19, 0.15, 0.14),
  ('Mayo 2026', 'Cocción', 'Programmatic', 'Build', 'CPM', 199983, null, 4, null, 799932, 781835, 1200, 919, null, null, 1439877.05, 1183294, 1800, 1513.48, 0.15, 0.12),
  ('Mayo 2026', 'Cocción', 'Mercado Ads', 'Build', 'CPM', 206114, 379572, 2, 3.47, 412227, 1318488, 618, 7663, null, null, 2473364.18, 2181813.91, 6000, 1654.78, 0.15, 0.58),
  ('Mayo 2026', 'Cocción', 'Google Demand Gen', 'Consider', 'CPC', null, null, null, null, 3359713, 2984536, 33597, 201568, null, null, 2015827.86, 1620765, 60, 8.04, 1, 6.75),
  ('Mayo 2026', 'Cocción', 'Geo Mobile', 'Consider', 'CPC', null, null, null, null, 403166, 747124, 4032, 3309, null, null, 1411079.51, 1154841, 350, 349, 1, 0.44),
  ('Mayo 2026', 'Cocción', 'Google Search', 'Consider', 'CPC', null, null, null, null, 102848, 50674, 1028, 1342, null, null, 575950.82, 72116, 560, 53.74, 1, 2.65),
  ('Mayo 2026', 'Lavado', 'DOOH', 'Build', 'OOH', null, 1590000, null, 7.2, null, 11300000, null, null, null, null, 20700000, 20700000, null, null, null, null),
  ('Mayo 2026', 'Lavado', 'Meta', 'Build', 'CPM', 12068966, 7661897, 2, 2.94, 24137931, 22533794, 36207, 462, null, null, 7000000, 5672400.39, 290, 251.73, 0.15, 0),
  ('Mayo 2026', 'Lavado', 'Meta', 'Consider', 'CPC', 2924920, 1237935, 2, 2.86, 5849839, 3536092, 46799, 127049, null, null, 4211884.36, 3422430.87, 90, 26.94, 0.8, 3.59),
  ('Mayo 2026', 'Lavado', 'TikTok', 'Build', 'CPM', 1754952, 1169418, 4, 4.76, 7019807, 5571096, 10530, 4833, null, null, 3509903.63, 1990575.79, 500, 357.3, 0.15, 0.09),
  ('Mayo 2026', 'Lavado', 'YouTube', 'Build', 'CPM', 2962963, 49975, 1.5, 0.81, 4444444, 40508, 6667, 8, null, null, 4000000, 36980, 900, 912.91, 0.15, 0.02),
  ('Mayo 2026', 'Lavado', 'YouTube', 'Build', 'CPV', 6256674, 2740254, 1.5, 1.99, 9385011, 5440044, 14078, 6338, 6569507, 3706727, 16423768.72, 7385446, 2.5, 1.99, 0.15, 0.12),
  ('Mayo 2026', 'Lavado', 'Programmatic', 'Build', 'CPM', 611111, null, 4, null, 2444444, 2509034, 3667, 2474, null, null, 4400000, 3796149, 1800, 1512.99, 0.15, 0.1),
  ('Mayo 2026', 'Lavado', 'Mercado Ads', 'Build', 'CPM', 515284, 814615, 2, 4.25, 1030568, 3465375, 1546, 37913, null, null, 6183410.46, 5542212, 6000, 1599.31, 0.15, 1.09),
  ('Mayo 2026', 'Lavado', 'Google Demand Gen', 'Consider', 'CPC', null, null, null, null, 8189775, 8606337, 81898, 358411, null, null, 4913865.09, 3944086, 60, 11, 1, 4.16),
  ('Mayo 2026', 'Lavado', 'Geo Mobile', 'Consider', 'CPC', null, null, null, null, 989366, 1307898, 9894, 5351, null, null, 3462781.07, 1867499, 350, 349, 1, 0.41),
  ('Mayo 2026', 'Lavado', 'Google Search', 'Consider', 'CPC', null, null, null, null, 321385, 297558, 3214, 6273, null, null, 1800000, 323490, 560, 51.57, 1, 2.11),
  ('Mayo 2026', 'Refrigeración', 'Meta', 'Build', 'CPM', 6317145, 4628816, 2, 2.57, 12634290, 11885313, 18951, 4642, null, null, 3663944.2, 2974504.77, 290, 250.27, 0.15, 0.04),
  ('Mayo 2026', 'Refrigeración', 'Meta', 'Consider', 'CPC', 1982654, 917699, 2, 2.19, 3965308, 2010955, 31722, 50558, null, null, 2855021.46, 2317711.27, 90, 45.84, 0.8, 2.51),
  ('Mayo 2026', 'Refrigeración', 'TikTok', 'Build', 'CPM', 1189592, 822458, 4, 4.64, 4758369, 3816266, 7138, 3256, null, null, 2379184.55, 1328296.36, 500, 348.06, 0.15, 0.09),
  ('Mayo 2026', 'Refrigeración', 'YouTube', 'Build', 'CPM', 1762359, 323106, 1.5, 0.89, 2643538, 288356, 3965, 106, null, null, 2379184.55, 263044, 900, 912.22, 0.15, 0.04),
  ('Mayo 2026', 'Refrigeración', 'YouTube', 'Build', 'CPV', 2154688, 1929320, 1.5, 2.01, 3232032, 3883986, 4848, 4551, 2262422, 2611930, 10468412.01, 5846221, 2.5, 2.24, 0.15, 0.12),
  ('Mayo 2026', 'Refrigeración', 'Programmatic', 'Build', 'CPM', 330442, null, 4, null, 1321769, 1302969, 1983, 1760, null, null, 2379184.55, 1971933, 1800, 1513.42, 0.15, 0.14),
  ('Mayo 2026', 'Refrigeración', 'Mercado Ads', 'Build', 'CPM', 309171, 539002, 2, 3.37, 618341, 1814734, 928, 25129, null, null, 3710046.28, 3329970, 6000, 1834.96, 0.15, 1.38),
  ('Mayo 2026', 'Refrigeración', 'Google Demand Gen', 'Consider', 'CPC', null, null, null, null, 5551431, 4257414, 55514, 271674, null, null, 3330858.37, 2650852, 60, 9.76, 1, 6.38),
  ('Mayo 2026', 'Refrigeración', 'Geo Mobile', 'Consider', 'CPC', null, null, null, null, 666172, 2073885, 6662, 8097, null, null, 2331600.86, 2825853, 350, 349, 1, 0.39),
  ('Mayo 2026', 'Refrigeración', 'Google Search', 'Consider', 'CPC', null, null, null, null, 169894, 40015, 1699, 1551, null, null, 951673.82, 80497, 560, 51.9, 1, 3.88),
  ('Mayo 2026', 'UGC', 'Meta', 'Build', 'CPM', 8345791, 2584743, 2, 1.73, 16691583, 4462995, 25037, 85, null, 3536379, 4840559, 1046580.02, 290, 234.5, 0.15, 0),
  ('Mayo 2026', 'UGC', 'TikTok', 'Build', 'CPM', 1642235, 747939, 4, 2.72, 6568938, 2034281, 9853, 2155, null, 2014675, 3284469, 715550.3, 500, 351.75, 0.15, 0.11),
  -- OOH (vía pública estática) Brand: $10M/mes desde Abril. Alcance pendiente.
  ('Abril 2026', 'Brand', 'OOH', 'Build', 'OOH', null, null, null, null, null, null, null, null, null, null, 10000000, 10000000, null, null, null, null),
  ('Mayo 2026',  'Brand', 'OOH', 'Build', 'OOH', null, null, null, null, null, null, null, null, null, null, 10000000, 10000000, null, null, null, null)
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
