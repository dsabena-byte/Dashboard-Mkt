-- Snapshot MENSUAL del índice de posición conglomerado por marca × categoría.
-- indice = Σ(volumen × posición) / Σ(volumen) sobre el universo de keywords de la
-- categoría (si el dominio no rankea una keyword, cuenta como posición 100).
-- Menor = mejor. Alimenta el gráfico de evolución del índice de Drean en el tiempo.
create table if not exists seo_index_history (
  categoria  text not null,
  marca      text not null,
  mes        date not null,          -- primer día del mes
  indice     numeric not null,
  updated_at timestamptz not null default now(),
  primary key (categoria, marca, mes)
);

comment on table seo_index_history is 'Snapshot mensual del índice de posición conglomerado (Σ(vol×pos)/Σvol, ausente=100) por marca×categoría. Lo escribe el cron seo-index-snapshot; alimenta el gráfico de evolución.';

-- Seed del mes actual (2026-08) calculado desde seo_rankings con la misma fórmula
-- que muestra el dashboard (Drean: lavarropas 5.6 · heladeras 29.8 · cocinas 30.0).
insert into seo_index_history (categoria, marca, mes, indice) values
  ('lavarropas','Midea','2026-08-01',99.11),
  ('lavarropas','Whirlpool','2026-08-01',27.79),
  ('lavarropas','Electrolux','2026-08-01',81.19),
  ('lavarropas','Coto','2026-08-01',29.05),
  ('lavarropas','Philco','2026-08-01',95.5),
  ('lavarropas','Longvie','2026-08-01',99.5),
  ('lavarropas','ML','2026-08-01',2.23),
  ('lavarropas','Drean','2026-08-01',5.55),
  ('lavarropas','Gafa','2026-08-01',72.28),
  ('lavarropas','Cetrogar','2026-08-01',14.67),
  ('lavarropas','Naldo','2026-08-01',10.14),
  ('lavarropas','Rodo','2026-08-01',12.64),
  ('lavarropas','Megatone','2026-08-01',18.95),
  ('lavarropas','Oncity','2026-08-01',53.53),
  ('lavarropas','Frávega','2026-08-01',9.88),
  ('lavarropas','Casa del Audio','2026-08-01',12.4),
  ('heladeras','Whirlpool','2026-08-01',81.45),
  ('heladeras','Electrolux','2026-08-01',42.19),
  ('heladeras','Coto','2026-08-01',32.26),
  ('heladeras','Philco','2026-08-01',99.98),
  ('heladeras','Oncity','2026-08-01',65.0),
  ('heladeras','ML','2026-08-01',2.22),
  ('heladeras','Megatone','2026-08-01',7.05),
  ('heladeras','Drean','2026-08-01',29.78),
  ('heladeras','Gafa','2026-08-01',20.1),
  ('heladeras','Naldo','2026-08-01',11.48),
  ('heladeras','Rodo','2026-08-01',12.47),
  ('heladeras','Midea','2026-08-01',94.15),
  ('heladeras','Cetrogar','2026-08-01',14.2),
  ('heladeras','Frávega','2026-08-01',5.33),
  ('heladeras','Casa del Audio','2026-08-01',18.29),
  ('cocinas','Longvie','2026-08-01',98.47),
  ('cocinas','ML','2026-08-01',2.86),
  ('cocinas','Drean','2026-08-01',29.98),
  ('cocinas','Oncity','2026-08-01',59.84),
  ('cocinas','Frávega','2026-08-01',8.59),
  ('cocinas','Casa del Audio','2026-08-01',32.16),
  ('cocinas','Electrolux','2026-08-01',77.82),
  ('cocinas','Coto','2026-08-01',27.89),
  ('cocinas','Rodo','2026-08-01',15.99),
  ('cocinas','Whirlpool','2026-08-01',41.81),
  ('cocinas','Escorial','2026-08-01',98.05),
  ('cocinas','Gafa','2026-08-01',92.6),
  ('cocinas','Naldo','2026-08-01',11.22),
  ('cocinas','Megatone','2026-08-01',17.06),
  ('cocinas','Cetrogar','2026-08-01',17.77),
  ('cocinas','Domec','2026-08-01',71.26),
  ('cocinas','Florencia','2026-08-01',26.06),
  ('cocinas','Philco','2026-08-01',99.76),
  ('cocinas','Orbis','2026-08-01',85.81)
on conflict (categoria, marca, mes) do update set indice = excluded.indice, updated_at = now();
