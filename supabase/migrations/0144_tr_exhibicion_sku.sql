-- Exhibición de SKUs por tienda (reporte semanal "ReportExhibitions" del relevamiento, 27-oct-2026): base de las
-- «Sugerencias de SKUs» del CB de Trade (SKUs fuera del CB que ya están exhibidos y subirían el % CB). Carga semanal
-- por "Cargar datos" (tipo 'exh'): reemplaza la semana entera, con backup y deshacer como CB/FS.
create table if not exists public.tr_exhibicion_sku (
  id bigserial primary key,
  anio smallint not null,       -- smallint como tr_cb_semanal (la vista vw_tr_cargado une las tres)
  semana smallint not null,
  tienda text,                -- "325 - FAVA MAR DEL PLATA AV. LURO" (mismo formato que tr_cb_semanal.tienda)
  numero_tienda text,
  cadena text,
  formato text,               -- razón social
  canal text,
  division text,
  categoria text,
  subcategoria text,          -- segmento: "56 cm - Piso - Gas -", "Automática Carga Frontal - 8 kg - …", "277 - 2 puertas - Cíclico -"
  marca text,
  sku text not null,
  descripcion text,
  tipo_espacio text,
  estatus_pdv text,           -- Se mantiene | Nueva Colocación | Retirada
  existencia int not null default 0,
  fecha_captura date,
  carga_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists tr_exh_sku_sem_idx on public.tr_exhibicion_sku (anio, semana);
create index if not exists tr_exh_sku_sku_idx on public.tr_exhibicion_sku (sku);
alter table public.tr_exhibicion_sku enable row level security;
grant select, insert, update, delete on public.tr_exhibicion_sku to service_role;
grant usage, select on sequence public.tr_exhibicion_sku_id_seq to service_role;

alter table public.tr_cargas drop constraint if exists tr_cargas_tipo_check;
alter table public.tr_cargas add constraint tr_cargas_tipo_check check (tipo in ('cb', 'fs', 'u3', 'tiendas', 'exh'));

-- Qué hay cargado por semana: suma la exhibición.
create or replace view public.vw_tr_cargado with (security_invoker = true) as
select anio, semana, 'cb'::text as tipo, null::text as categoria, count(*)::int as filas
from public.tr_cb_semanal group by anio, semana
union all
select anio, semana, 'fs'::text, categoria, count(*)::int
from public.tr_floor_share where semana is not null group by anio, semana, categoria
union all
select anio, semana, 'exh'::text, null::text, count(*)::int
from public.tr_exhibicion_sku group by anio, semana;

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
  elsif c.tipo = 'exh' then
    select coalesce(jsonb_agg(to_jsonb(t) - 'id'), '[]'::jsonb) into prev
      from public.tr_exhibicion_sku t where t.anio = c.anio and t.semana = c.semana;
    delete from public.tr_exhibicion_sku where anio = c.anio and semana = c.semana;
    insert into public.tr_exhibicion_sku (anio, semana, tienda, numero_tienda, cadena, formato, canal, division, categoria,
      subcategoria, marca, sku, descripcion, tipo_espacio, estatus_pdv, existencia, fecha_captura, carga_id)
    select c.anio, c.semana, r.tienda, r.numero_tienda, r.cadena, r.formato, r.canal, r.division, r.categoria,
      r.subcategoria, r.marca, r.sku, r.descripcion, r.tipo_espacio, r.estatus_pdv, coalesce(r.existencia, 0), r.fecha_captura, c.id
    from public.tr_carga_filas f, jsonb_populate_record(null::public.tr_exhibicion_sku, f.fila) r
    where f.carga_id = c.id;
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
  elsif c.tipo = 'exh' then
    delete from public.tr_exhibicion_sku where anio = c.anio and semana = c.semana;
    insert into public.tr_exhibicion_sku (anio, semana, tienda, numero_tienda, cadena, formato, canal, division, categoria,
      subcategoria, marca, sku, descripcion, tipo_espacio, estatus_pdv, existencia, fecha_captura, carga_id)
    select anio, semana, tienda, numero_tienda, cadena, formato, canal, division, categoria,
      subcategoria, marca, sku, descripcion, tipo_espacio, estatus_pdv, existencia, fecha_captura, carga_id
    from jsonb_populate_recordset(null::public.tr_exhibicion_sku, c.anterior);
  end if;
  get diagnostics n = row_count;
  update public.tr_cargas set estado = 'deshecha' where id = c.id;
  return jsonb_build_object('carga_id', c.id, 'restauradas', n);
end $$;
