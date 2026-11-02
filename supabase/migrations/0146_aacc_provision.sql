-- =============================================================================
-- 0146_aacc_provision: provisiones de AACC (acuerdos comerciales con clientes) en Mkt Canal (2-nov-2026, pedido del user).
--   · aacc_acuerdos            = BGT por cliente: monto fijo por mes o % de la facturación (FC) de ciertas categorías.
--   · aacc_provision_mensual   = foto que se manda a Finanzas antes de que cierre el mes (botón «Generar provisión»).
--   · mkt_canal_aacc (0131)    = provisión REAL (mes cerrado) por cliente: la que se usa para Solped/OC. Ya existe.
--   · aacc_liquidado           = facturas de los clientes ya recepcionadas → Falta liquidar = real − liquidado.
--   · vt_ventas.importe        = $ de cada renglón de facturación (lo sube el Office Script de CB Sell In).
-- Idempotente. Seeds = planilla «Tablero de AACC 2026» + mail «Provisión AACC Octubre 2026» del user.
-- =============================================================================
create table if not exists public.aacc_acuerdos (
  anio          int  not null,
  cliente       text not null,              -- nombre en el tablero (Naldo, Cetrogar, Oncity…)
  razon_social  text not null,              -- como va en el mail a Finanzas
  cliente_sap   text,                       -- vt_ventas.cliente (solo los de %)
  tipo          text not null check (tipo in ('fijo', 'pct')),
  pct           numeric(6,3),
  categorias    text[] not null default '{}', -- vacío = todas
  montos        numeric(16,2)[] not null default array_fill(0::numeric(16,2), array[12]),
  orden         int  not null default 0,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  primary key (anio, cliente)
);

create table if not exists public.aacc_provision_mensual (
  mes           text not null,              -- 'YYYY-MM'
  cliente       text not null,
  razon_social  text not null,
  categorias    text,
  acuerdo       text,
  facturacion   numeric(16,2),
  aacc          numeric(16,2) not null,
  generado_at   timestamptz not null default now(),
  generado_por  text,
  primary key (mes, cliente)
);

create table if not exists public.aacc_liquidado (
  id            bigint generated always as identity primary key,
  mes           text not null,              -- mes del AACC que se liquida
  cliente       text not null,
  monto         numeric(16,2) not null,
  factura       text,
  fecha         date,
  nota          text,
  created_at    timestamptz not null default now(),
  created_by    text
);
create index if not exists idx_aacc_liquidado_mes on public.aacc_liquidado(mes);

alter table public.vt_ventas add column if not exists importe numeric(16,2);

alter table public.aacc_acuerdos enable row level security;
alter table public.aacc_provision_mensual enable row level security;
alter table public.aacc_liquidado enable row level security;
grant select, insert, update, delete on public.aacc_acuerdos, public.aacc_provision_mensual, public.aacc_liquidado to service_role;

-- ---------- seeds 2026 (solo si están vacías) ----------
insert into public.aacc_acuerdos (anio, cliente, razon_social, cliente_sap, tipo, pct, categorias, orden)
select * from (values
  (2026, 'Cetrogar', 'CETROGAR SA', 'CETROGAR SA', 'pct', 1.5, '{}'::text[], 1),
  (2026, 'Naldo', 'NALDO LOMBARDI S A', 'NALDO LOMBARDI S A', 'pct', 2.0, '{Lavado,Lavavajillas}'::text[], 2)
) v(anio, cliente, razon_social, cliente_sap, tipo, pct, categorias, orden)
where not exists (select 1 from public.aacc_acuerdos where anio = 2026);

-- Montos fijos: lo que figura en la planilla por mes (ene–sep) + octubre del mail. Nov–dic quedan en 0 para completar.
insert into public.aacc_acuerdos (anio, cliente, razon_social, tipo, montos, orden)
select 2026, a.cliente, max(a.razon_social), 'fijo',
       array(select coalesce(sum(b.aacc), 0)::numeric(16,2) from generate_series(1, 12) m
             left join public.mkt_canal_aacc b on b.cliente = a.cliente and b.mes = '2026-' || lpad(m::text, 2, '0')
             group by m order by m),
       10
from public.mkt_canal_aacc a
where a.mes like '2026-%' and a.cliente not in ('Cetrogar', 'Naldo')
  and not exists (select 1 from public.aacc_acuerdos x where x.anio = 2026 and x.cliente = a.cliente)
group by a.cliente;
update public.aacc_acuerdos set montos[10] = v.m from (values ('Rodo', 600000), ('Oncity', 20839783), ('Frávega', 30000000), ('Cencosud (Jumbo)', 4485600)) v(c, m)
 where anio = 2026 and cliente = v.c and montos[10] = 0;

-- Provisión mensual histórica: el mail de oct trae solo el total por mes (ene–sep) y el detalle de octubre.
insert into public.aacc_provision_mensual (mes, cliente, razon_social, categorias, acuerdo, facturacion, aacc, generado_por)
select * from (values
  ('2026-01', '(total planilla)', '(total planilla)', null, null, null::numeric, 45300861::numeric, 'planilla'),
  ('2026-02', '(total planilla)', '(total planilla)', null, null, null, 60801496, 'planilla'),
  ('2026-03', '(total planilla)', '(total planilla)', null, null, null, 91996150, 'planilla'),
  ('2026-04', '(total planilla)', '(total planilla)', null, null, null, 113028817, 'planilla'),
  ('2026-05', '(total planilla)', '(total planilla)', null, null, null, 90498725, 'planilla'),
  ('2026-06', '(total planilla)', '(total planilla)', null, null, null, 42488614, 'planilla'),
  ('2026-07', '(total planilla)', '(total planilla)', null, null, null, 74491481, 'planilla'),
  ('2026-08', '(total planilla)', '(total planilla)', null, null, null, 54650501, 'planilla'),
  ('2026-09', '(total planilla)', '(total planilla)', null, null, null, 62352049, 'planilla'),
  ('2026-10', 'Cetrogar', 'CETROGAR SA', 'Drean', '1,5%', 1982767920, 29741519, 'mail 23-oct'),
  ('2026-10', 'Naldo', 'NALDO LOMBARDI S A', 'Lavado - Lavavajillas', '2%', 649646143, 12992923, 'mail 23-oct'),
  ('2026-10', 'Rodo', 'BOSAN (RODO)', 'Drean', '$ 600.000', null, 600000, 'mail 23-oct'),
  ('2026-10', 'Oncity', 'EMSA -ELECTRONICA MEGATONE SA', 'Drean', '$ 20.839.783', null, 20839783, 'mail 23-oct'),
  ('2026-10', 'Frávega', 'FRAVEGA S A C I E I', 'Drean', '$ 30.000.000', null, 30000000, 'mail 23-oct'),
  ('2026-10', 'Cencosud (Jumbo)', 'CENCOSUD (JUMBO)', 'Drean', '$ 4.485.600', null, 4485600, 'mail 23-oct')
) v(mes, cliente, razon_social, categorias, acuerdo, facturacion, aacc, generado_por)
where not exists (select 1 from public.aacc_provision_mensual);

-- Liquidado según el mail del 23-oct: ene–jul todo; agosto todo salvo Jumbo; septiembre todo salvo Frávega y Rodo.
insert into public.aacc_liquidado (mes, cliente, monto, nota, created_by)
select a.mes, a.cliente, sum(a.aacc), 'según mail Provisión AACC Octubre 2026', 'carga inicial'
from public.mkt_canal_aacc a
where a.mes between '2026-01' and '2026-09'
  and not (a.mes = '2026-08' and a.cliente = 'Cencosud (Jumbo)')
  and not (a.mes = '2026-09' and a.cliente in ('Frávega', 'Rodo'))
  and not exists (select 1 from public.aacc_liquidado)
group by a.mes, a.cliente;
