-- =============================================================================
-- 0131_mkt_canal_aacc: inversión de Mkt Canal = acuerdos comerciales (AACC) por cliente y mes (22-oct-2026, pedido
-- del user: "toma solo los valores de AACC como inversión"). Va APARTE de mkt_canal_acciones (trazabilidad por medio y
-- performance): no entra al CPC/CPM. Fuente: planilla de AACC del user (ene–sep 2026). Lectura pública (el dashboard
-- /mkt-canal es HTML estático con la anon key). Idempotente: el seed reemplaza ene–sep 2026.
-- =============================================================================
create table if not exists mkt_canal_aacc (
  id           bigint generated always as identity primary key,
  cliente      text not null,          -- nombre en el tablero (EMSA = Oncity, INC = Carrefour, Dorinka = Changomás, S.A. Imp. y Exp. = La Anónima, Bosan = Rodo; user 22-oct)
  razon_social text not null,          -- como viene en la planilla
  categoria    text,                   -- Drean | Lavado - Secarropas | Refrigeración | Cocinas | Lavado - Lavajillas
  mes          text not null,          -- 'YYYY-MM'
  aacc         numeric(16,2) not null, -- ARS
  updated_at   timestamptz not null default now()
);
create index if not exists idx_mkt_canal_aacc_mes on mkt_canal_aacc(mes);
alter table mkt_canal_aacc enable row level security;
drop policy if exists "mkt_canal_aacc_public_read" on mkt_canal_aacc;
create policy "mkt_canal_aacc_public_read" on mkt_canal_aacc for select to anon, authenticated using (true);
grant select on public.mkt_canal_aacc to anon, authenticated;
grant select, insert, update, delete on public.mkt_canal_aacc to service_role;

delete from mkt_canal_aacc where mes between '2026-01' and '2026-09';
insert into mkt_canal_aacc (cliente, razon_social, categoria, mes, aacc) values
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-01', 43997284),
  ('Frávega', 'FRAVEGA S A C I E I', 'Lavado - Secarropas', '2026-01', 1931563),
  ('Frávega', 'FRAVEGA S A C I E I', 'Refrigeración', '2026-01', 6509385),
  ('Frávega', 'FRAVEGA S A C I E I', 'Cocinas', '2026-01', 2317799),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-01', 858986),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-01', 600000),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-02', 32523964),
  ('Frávega', 'FRAVEGA S A C I E I', 'Lavado - Secarropas', '2026-02', 19415160),
  ('Frávega', 'FRAVEGA S A C I E I', 'Refrigeración', '2026-02', 8376045),
  ('Frávega', 'FRAVEGA S A C I E I', 'Cocinas', '2026-02', 8106589),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-02', 15508907),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-02', 600000),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-03', 37367021),
  ('Frávega', 'FRAVEGA S A C I E I', 'Lavado - Secarropas', '2026-03', 21863332),
  ('Frávega', 'FRAVEGA S A C I E I', 'Refrigeración', '2026-03', 22427117),
  ('Frávega', 'FRAVEGA S A C I E I', 'Cocinas', '2026-03', 6384783),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-03', 20254427),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-03', 600000),
  ('Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '2026-03', 4228875),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-04', 51139500),
  ('Frávega', 'FRAVEGA S A C I E I', 'Lavado - Secarropas', '2026-04', 19380547),
  ('Frávega', 'FRAVEGA S A C I E I', 'Refrigeración', '2026-04', 7803242),
  ('Frávega', 'FRAVEGA S A C I E I', 'Cocinas', '2026-04', 11653836),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-04', 12278889),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-04', 600000),
  ('Frávega', 'FRAVEGA S A C I E I', 'Drean', '2026-04', 6161780),
  ('Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '2026-04', 5167000),
  ('Cencosud', 'CENCOSUD', 'Drean', '2026-04', 2000000),
  ('Changomás', 'DORINKA', 'Drean', '2026-04', 2500000),
  ('Carrefour', 'INC SOCIEDAD ANÓNIMA', 'Drean', '2026-04', 3500000),
  ('Coto', 'COTO', 'Drean', '2026-04', 2500000),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-05', 28558113),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-05', 12330393),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-05', 600000),
  ('Bazar Avenida', 'BAZAR AVENIDA SA', 'Drean', '2026-05', 4411500),
  ('Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '2026-05', 5091250),
  ('Coto', 'COTO', 'Drean', '2026-05', 2500000),
  ('La Anónima', 'S A IMPORTADORA Y EXPORTADORA', 'Drean', '2026-05', 6500000),
  ('Carrefour', 'INC SOCIEDAD ANÓNIMA', 'Drean', '2026-05', 3500000),
  ('Cencosud', 'CENCOSUD', 'Drean', '2026-05', 4655000),
  ('Cencosud (Easy)', 'CENCOSUD (EASY)', 'Drean', '2026-05', 3000000),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-06', 40932574),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-06', 16730738),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-06', 600000),
  ('Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '2026-06', 2396100),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-07', 55174109),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-07', 18149513),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-07', 600000),
  ('Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '2026-07', 9590700),
  ('Frávega', 'FRAVEGA S A C I E I', 'Drean', '2026-07', 6000000),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-08', 20608234),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-08', 10363884),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-08', 600000),
  ('Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '2026-08', 18592783),
  ('Cencosud (Jumbo)', 'CENCOSUD (JUMBO)', 'Drean', '2026-08', 4485600),
  ('Cetrogar', 'CETROGAR SA', 'Drean', '2026-09', 15479773),
  ('Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavajillas', '2026-09', 8657405),
  ('Rodo', 'BOSAN (RODO)', 'Drean', '2026-09', 600000),
  ('Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '2026-09', 16869300),
  ('Frávega', 'FRAVEGA S A C I E I', 'Drean', '2026-09', 8170506),
  ('Frávega', 'FRAVEGA S A C I E I', 'Drean', '2026-09', 18820000),
  ('Cencosud (Jumbo)', 'CENCOSUD (JUMBO)', 'Drean', '2026-09', 3139920);

notify pgrst, 'reload schema';
