-- 0138 · Trade dentro de Dashboard-Mkt (26-oct-2026): Cuadros Básicos de Trade, Floor Share y Existencias U3
-- pasan del proyecto Supabase CB (+ Drive + Apps Script) al proyecto PRINCIPAL.
--   Maestros (edición puntual en /cuadros-basicos): tr_cadenas, tr_tiendas, tr_personas, tr_tienda_asignacion, tr_skus, tr_config.
--   Cargas (archivo por "Cargar datos"): tr_cb_semanal, tr_floor_share, tr_existencias, con log tr_cargas (+ staging tr_carga_filas).
--   tr_auditoria: quién cambió qué (antes → después). tr_precalc: vistas default precalculadas (se refrescan en cada carga).
-- Reemplazo ATÓMICO de una semana: tr_confirmar_carga(id) (una sola transacción: backup → delete → insert); tr_deshacer_carga(id).
-- Sin esta migración la app sigue leyendo el mirror / proyecto CB (fail-safe en el código).
-- RLS activado sin policies: solo el server (service_role). NUNCA anon. Idempotente.

-- ───────────────────────── Maestros ─────────────────────────
create table if not exists public.tr_cadenas (
  id bigserial primary key,
  clave text not null unique,            -- nombre normalizado (MAYÚSC., sin acentos, espacios simples)
  nombre text not null,                  -- como se muestra
  cliente text,                          -- razón social SAP (absorbe cb_cadena_alias y cb_tienda_cliente)
  alias text[] not null default '{}',    -- otras grafías vistas (claves normalizadas) → la carga las reconoce
  activa boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tr_tiendas (
  id bigserial primary key,
  cadena text not null default '',       -- tr_cadenas.clave ('' = sin cadena conocida)
  numero text not null,
  nombre text,
  segmentacion text,
  provincia text,
  localidad text,
  canal text,
  activa boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (cadena, numero)                -- el número NO es único entre cadenas
);
create index if not exists tr_tiendas_numero_idx on public.tr_tiendas (numero);

create table if not exists public.tr_personas (
  nombre text primary key,
  rol text not null default 'promotor' check (rol in ('promotor', 'supervisor', 'ambos')),
  activa boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tr_tienda_asignacion (
  id bigserial primary key,
  tienda_id bigint not null references public.tr_tiendas (id) on delete cascade,
  promotor text references public.tr_personas (nombre) on update cascade on delete set null,
  supervisor text references public.tr_personas (nombre) on update cascade on delete set null,
  desde date not null default current_date,
  hasta date,                            -- null = vigente
  origen text,
  created_at timestamptz not null default now()
);
create index if not exists tr_asig_tienda_idx on public.tr_tienda_asignacion (tienda_id, hasta);

create table if not exists public.tr_skus (
  sku text primary key,
  descripcion text,
  nombre_comercial text,
  division text,
  categoria text,
  marca text,
  ean text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tr_config (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.tr_config (clave, valor) values
  ('fs_objetivos', '{"lavado": 32, "refrigeracion": 25, "coccion": 23}'::jsonb)
on conflict (clave) do nothing;

-- ───────────────────────── Cargas ─────────────────────────
create table if not exists public.tr_cargas (
  id bigserial primary key,
  tipo text not null check (tipo in ('cb', 'fs', 'u3', 'tiendas')),
  archivo text,
  anio smallint,
  semana smallint,
  categoria text,
  filas integer not null default 0,
  estado text not null default 'subiendo' check (estado in ('subiendo', 'ok', 'deshecha', 'error')),
  usuario text,
  detalle jsonb,
  anterior jsonb,                        -- filas que había antes (para "Deshacer")
  created_at timestamptz not null default now(),
  confirmada_at timestamptz
);
create index if not exists tr_cargas_scope_idx on public.tr_cargas (tipo, anio, semana, categoria, estado);

create table if not exists public.tr_carga_filas (
  id bigserial primary key,
  carga_id bigint not null references public.tr_cargas (id) on delete cascade,
  fila jsonb not null
);
create index if not exists tr_carga_filas_carga_idx on public.tr_carga_filas (carga_id);

create table if not exists public.tr_cb_semanal (
  id bigserial primary key,
  anio smallint not null,
  semana smallint not null,
  tienda text not null,                  -- "N - NOMBRE" tal cual el archivo
  numero_tienda text,
  sku text not null,
  cliente text,                          -- cadena (CLIENTE/CADENA del archivo)
  division text,
  categoria text,
  target_cb integer not null default 0,
  real_cb integer not null default 0,
  target_inf integer not null default 0,
  real_inf integer not null default 0,
  tipo_sku text,
  carga_id bigint,
  updated_at timestamptz not null default now(),
  unique (anio, semana, tienda, sku)
);
create index if not exists tr_cb_anio_semana_idx on public.tr_cb_semanal (anio, semana);
create index if not exists tr_cb_numero_idx on public.tr_cb_semanal (numero_tienda);
create index if not exists tr_cb_cliente_idx on public.tr_cb_semanal (cliente);
create index if not exists tr_cb_division_idx on public.tr_cb_semanal (division);

create table if not exists public.tr_floor_share (
  id bigserial primary key,
  anio smallint not null,
  semana smallint,                       -- null = carga mensual histórica (ene–abr 2026)
  mes smallint,
  periodo text not null,                 -- "2026-W42" | "2026-01"
  categoria text not null,               -- lavado | refrigeracion | coccion
  numero_tienda text not null default '',
  nombre_tienda text not null default '',
  marca text not null,
  unidades integer not null default 0,
  pct_raw numeric,
  carga_id bigint,
  updated_at timestamptz not null default now(),
  unique (periodo, categoria, numero_tienda, nombre_tienda, marca)
);
create index if not exists tr_fs_anio_semana_cat_idx on public.tr_floor_share (anio, semana, categoria);
create index if not exists tr_fs_numero_idx on public.tr_floor_share (numero_tienda);

create table if not exists public.tr_existencias (
  id bigint primary key,                 -- ID de la observación del U3
  fecha_captura date,
  numero_tienda text,
  tienda text,
  cadena text,
  formato text,                          -- razón social de la cadena
  canal text,
  division text,
  categoria text,
  subcategoria text,
  marca text,
  sku text,
  ean text,
  descripcion text,
  existencia integer not null default 0,
  estado text,                           -- provincia
  promotor text,
  supervisor text,
  carga_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists tr_ex_numero_idx on public.tr_existencias (numero_tienda);
create index if not exists tr_ex_sku_idx on public.tr_existencias (sku);

create table if not exists public.tr_auditoria (
  id bigserial primary key,
  at timestamptz not null default now(),
  usuario text,
  entidad text not null,
  clave text,
  antes jsonb,
  despues jsonb
);

create table if not exists public.tr_precalc (
  clave text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Vistas ─────────────────────────
-- CB agregado sin SKU (~2x menos filas) para vistas con filtros. Mismos totales que el detalle.
create or replace view public.vw_tr_cb_agg with (security_invoker = true) as
select anio, semana, tienda, cliente, division,
       case when tipo_sku ilike '%estrat%' then 'Estratégico' else 'Infaltable' end as tipo_sku,
       sum(target_cb)::int as target_cb, sum(real_cb)::int as real_cb,
       sum(target_inf)::int as target_inf, sum(real_inf)::int as real_inf
from public.tr_cb_semanal
group by 1, 2, 3, 4, 5, 6;

-- Número de tienda → cadena (como el viejo cb_tienda_cliente_mirror, pero con la semana más reciente).
create or replace view public.vw_tr_tienda_cadena with (security_invoker = true) as
select distinct on (numero_tienda) numero_tienda, cliente
from public.tr_cb_semanal
where numero_tienda is not null and coalesce(cliente, '') <> ''
order by numero_tienda, anio desc, semana desc;

-- Qué hay cargado por semana (panel "Qué falta cargar").
create or replace view public.vw_tr_cargado with (security_invoker = true) as
select anio, semana, 'cb'::text as tipo, null::text as categoria, count(*)::int as filas
from public.tr_cb_semanal group by anio, semana
union all
select anio, semana, 'fs'::text, categoria, count(*)::int
from public.tr_floor_share where semana is not null group by anio, semana, categoria;

-- ───────────────────────── Funciones (reemplazo atómico) ─────────────────────────
create or replace function public.tr_confirmar_carga(p_carga_id bigint)
returns jsonb language plpgsql set search_path = public as $$
declare
  c public.tr_cargas;
  prev jsonb;
  n integer;
begin
  select * into c from public.tr_cargas where id = p_carga_id for update;
  if not found then raise exception 'La carga % no existe', p_carga_id; end if;
  if c.estado <> 'subiendo' then raise exception 'La carga % ya está %', p_carga_id, c.estado; end if;

  if c.tipo = 'cb' then
    select coalesce(jsonb_agg(to_jsonb(t) - 'id'), '[]'::jsonb) into prev
      from public.tr_cb_semanal t where t.anio = c.anio and t.semana = c.semana;
    delete from public.tr_cb_semanal where anio = c.anio and semana = c.semana;
    insert into public.tr_cb_semanal (anio, semana, tienda, numero_tienda, sku, cliente, division, categoria,
      target_cb, real_cb, target_inf, real_inf, tipo_sku, carga_id)
    select c.anio, c.semana, r.tienda, r.numero_tienda, r.sku, r.cliente, r.division, r.categoria,
      coalesce(r.target_cb, 0), coalesce(r.real_cb, 0), coalesce(r.target_inf, 0), coalesce(r.real_inf, 0), r.tipo_sku, c.id
    from public.tr_carga_filas f, jsonb_populate_record(null::public.tr_cb_semanal, f.fila) r
    where f.carga_id = c.id
    on conflict (anio, semana, tienda, sku) do update set
      target_cb = excluded.target_cb, real_cb = excluded.real_cb, target_inf = excluded.target_inf,
      real_inf = excluded.real_inf, tipo_sku = excluded.tipo_sku, cliente = excluded.cliente, division = excluded.division;
  elsif c.tipo = 'fs' then
    select coalesce(jsonb_agg(to_jsonb(t) - 'id'), '[]'::jsonb) into prev
      from public.tr_floor_share t where t.anio = c.anio and t.semana = c.semana and t.categoria = c.categoria;
    delete from public.tr_floor_share where anio = c.anio and semana = c.semana and categoria = c.categoria;
    insert into public.tr_floor_share (anio, semana, mes, periodo, categoria, numero_tienda, nombre_tienda, marca, unidades, pct_raw, carga_id)
    select c.anio, c.semana, null, c.anio || '-W' || lpad(c.semana::text, 2, '0'), c.categoria,
      coalesce(r.numero_tienda, ''), coalesce(r.nombre_tienda, ''), r.marca, coalesce(r.unidades, 0), r.pct_raw, c.id
    from public.tr_carga_filas f, jsonb_populate_record(null::public.tr_floor_share, f.fila) r
    where f.carga_id = c.id
    on conflict (periodo, categoria, numero_tienda, nombre_tienda, marca) do update set
      unidades = excluded.unidades, pct_raw = excluded.pct_raw, anio = excluded.anio, semana = excluded.semana, carga_id = excluded.carga_id;
  elsif c.tipo = 'u3' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into prev from public.tr_existencias t;
    delete from public.tr_existencias where true;
    insert into public.tr_existencias (id, fecha_captura, numero_tienda, tienda, cadena, formato, canal, division, categoria,
      subcategoria, marca, sku, ean, descripcion, existencia, estado, promotor, supervisor, carga_id)
    select r.id, r.fecha_captura, r.numero_tienda, r.tienda, r.cadena, r.formato, r.canal, r.division, r.categoria,
      r.subcategoria, r.marca, r.sku, r.ean, r.descripcion, coalesce(r.existencia, 0), r.estado, r.promotor, r.supervisor, c.id
    from public.tr_carga_filas f, jsonb_populate_record(null::public.tr_existencias, f.fila) r
    where f.carga_id = c.id and r.id is not null
    on conflict (id) do update set existencia = excluded.existencia;
  else
    raise exception 'Tipo % no se confirma por esta función', c.tipo;
  end if;

  get diagnostics n = row_count;
  delete from public.tr_carga_filas where carga_id = c.id;
  update public.tr_cargas set estado = 'ok', filas = n, anterior = prev, confirmada_at = now() where id = c.id;
  return jsonb_build_object('carga_id', c.id, 'filas', n, 'reemplazadas', jsonb_array_length(prev));
end $$;

create or replace function public.tr_deshacer_carga(p_carga_id bigint)
returns jsonb language plpgsql set search_path = public as $$
declare
  c public.tr_cargas;
  n integer := 0;
begin
  select * into c from public.tr_cargas where id = p_carga_id for update;
  if not found or c.estado <> 'ok' or c.anterior is null then raise exception 'La carga % no se puede deshacer', p_carga_id; end if;
  if exists (select 1 from public.tr_cargas x where x.id > c.id and x.estado = 'ok' and x.tipo = c.tipo
             and x.anio is not distinct from c.anio and x.semana is not distinct from c.semana
             and x.categoria is not distinct from c.categoria) then
    raise exception 'Hay una carga más nueva de la misma semana: deshacé esa primero';
  end if;

  if c.tipo = 'cb' then
    delete from public.tr_cb_semanal where anio = c.anio and semana = c.semana;
    insert into public.tr_cb_semanal (anio, semana, tienda, numero_tienda, sku, cliente, division, categoria,
      target_cb, real_cb, target_inf, real_inf, tipo_sku, carga_id, updated_at)
    select anio, semana, tienda, numero_tienda, sku, cliente, division, categoria,
      target_cb, real_cb, target_inf, real_inf, tipo_sku, carga_id, coalesce(updated_at, now())
    from jsonb_populate_recordset(null::public.tr_cb_semanal, c.anterior);
  elsif c.tipo = 'fs' then
    delete from public.tr_floor_share where anio = c.anio and semana = c.semana and categoria = c.categoria;
    insert into public.tr_floor_share (anio, semana, mes, periodo, categoria, numero_tienda, nombre_tienda, marca, unidades, pct_raw, carga_id, updated_at)
    select anio, semana, mes, periodo, categoria, numero_tienda, nombre_tienda, marca, unidades, pct_raw, carga_id, coalesce(updated_at, now())
    from jsonb_populate_recordset(null::public.tr_floor_share, c.anterior);
  elsif c.tipo = 'u3' then
    delete from public.tr_existencias where true;
    insert into public.tr_existencias select * from jsonb_populate_recordset(null::public.tr_existencias, c.anterior);
  end if;
  get diagnostics n = row_count;
  update public.tr_cargas set estado = 'deshecha' where id = c.id;
  return jsonb_build_object('carga_id', c.id, 'restauradas', n);
end $$;

-- ───────────────────────── Seguridad ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tr_cadenas','tr_tiendas','tr_personas','tr_tienda_asignacion','tr_skus','tr_config','tr_cargas',
                           'tr_carga_filas','tr_cb_semanal','tr_floor_share','tr_existencias','tr_auditoria','tr_precalc'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
  foreach t in array array['vw_tr_cb_agg','vw_tr_tienda_cadena','vw_tr_cargado'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;
revoke all on function public.tr_confirmar_carga(bigint) from public, anon, authenticated;
revoke all on function public.tr_deshacer_carga(bigint) from public, anon, authenticated;
grant execute on function public.tr_confirmar_carga(bigint) to service_role;
grant execute on function public.tr_deshacer_carga(bigint) to service_role;
