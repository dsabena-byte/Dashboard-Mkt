-- =============================================================================
-- 0125_presupuesto: presupuesto de Marketing cargado DESDE EL TABLERO (reemplaza al Excel de SharePoint).
--
-- Reglas (definidas por el user, 16-oct-2026):
--  * Todo gasto es en PESOS. Los dólares NO se guardan: USD = $ ÷ tipo de cambio del mes de esa versión.
--  * Un tipo de cambio por (versión, mes) — lo pasa finanzas; nadie lo estima.
--  * Versiones: BGT, 4+8, 8+4, REAL (por año). "BGT 2024 CRISIS" queda como histórico.
--  * REAL = renglones de gasto (proveedor, Solped, OC, recepción, factura…), los carga cualquiera con acceso a /funnel.
--  * Presupuestos y tipos de cambio = solo los emails de bgt_editores.
--  * Todo cambio queda en bgt_auditoria (quién, cuándo, antes y después).
-- Acceso: RLS prendido SIN policies → solo la service key (rutas /api/presupuesto/*). Idempotente.
-- =============================================================================

create table if not exists bgt_versiones (
  nombre      text primary key,                     -- "BGT 2026", "4+8 2026", "REAL 2026", "BGT 2024 CRISIS"
  tipo        text not null check (tipo in ('BGT','4+8','8+4','REAL','OTRO')),
  anio        int  not null check (anio between 2000 and 2100),
  cerrada     boolean not null default false,       -- cerrada = no se edita
  created_at  timestamptz not null default now(),
  created_by  text
);

create table if not exists bgt_tc (
  version     text not null references bgt_versiones(nombre) on update cascade on delete cascade,
  mes         smallint not null check (mes between 1 and 12),
  tc          numeric not null check (tc > 0),      -- pesos por dólar
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (version, mes)
);

create table if not exists bgt_lineas (
  id                    uuid primary key default gen_random_uuid(),
  version               text not null references bgt_versiones(nombre) on update cascade on delete cascade,
  mes                   smallint not null check (mes between 1 and 12),
  ceco                  text not null default '',
  cuenta                text not null default '',   -- código (6202010072)
  nombre_cta            text not null default '',   -- "PUBLICIDAD EXHIBICIONES"
  concepto              text not null default '',
  nro_proveedor         text,
  proveedor             text,
  detalle               text,
  solped                text,
  oc                    text,
  nro_recepcion         text,
  nro_doc_contable      text,                       -- lo que la planilla vieja tenía en "FECHA CONTABILIZ"
  fecha_contabilizacion date,
  factura               text,
  provision             text check (provision in ('SI','NO')),
  ars                   numeric not null,
  origen                text not null default 'manual' check (origen in ('import','manual','copia')),
  created_at            timestamptz not null default now(),
  created_by            text,
  updated_at            timestamptz not null default now(),
  updated_by            text
);
create index if not exists idx_bgt_lineas_version_mes on bgt_lineas (version, mes);

create table if not exists bgt_catalogo (
  tipo    text not null check (tipo in ('cuenta','concepto','proveedor','ceco')),
  clave   text not null,                              -- código de cuenta / nro proveedor / código CECO / nombre del concepto
  nombre  text not null default '',
  primary key (tipo, clave)
);

create table if not exists bgt_auditoria (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  usuario  text,
  entidad  text not null,                             -- linea | tc | version | importacion
  accion   text not null,                             -- alta | cambio | baja | importacion | cierre | apertura
  version  text,
  clave    text,                                      -- id de la línea / "mes" del TC
  antes    jsonb,
  despues  jsonb
);
create index if not exists idx_bgt_auditoria_at on bgt_auditoria (at desc);
create index if not exists idx_bgt_auditoria_version on bgt_auditoria (version, at desc);

create table if not exists bgt_editores (
  email text primary key
);
insert into bgt_editores (email) values ('dsabena@gmail.com') on conflict do nothing;

alter table bgt_versiones enable row level security;
alter table bgt_tc        enable row level security;
alter table bgt_lineas    enable row level security;
alter table bgt_catalogo  enable row level security;
alter table bgt_auditoria enable row level security;
alter table bgt_editores  enable row level security;
