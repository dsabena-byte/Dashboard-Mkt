-- =============================================================================
-- Planning Media — schema rico para la pauta de campañas (Drean)
-- =============================================================================
-- La tabla `planning` original (migration 0001) cubre el caso simple de
-- "fecha + canal + campaña + inversion_plan + kpi_target". Se mantiene para
-- compatibilidad y la vista vw_cumplimiento_planning sigue usándola.
--
-- Esta tabla nueva `planning_media` cubre el caso rico de la pauta OMD/Drean
-- con todas las dimensiones: TouchPoint, Sistema (canal de medio), Formato,
-- Rol of Comms (Build/Consider), y separa explícitamente líneas de medios
-- vs líneas de costo (IIBB, Tech Fee, Comisión, Impuesto al cheque).
--
-- Granularidad: una fila por (mes, campaña, rol, sistema, formato, tipo).
-- El N8N workflow desempivota el Sheet wide-format del usuario (12 columnas
-- de meses) a este formato long.
-- =============================================================================

create type planning_media_tipo as enum ('media', 'costo');

create table planning_media (
  id              uuid primary key default uuid_generate_v4(),
  fecha           date not null,                       -- primer día del mes
  campania        text not null,                       -- Brand, Cocina, Refrigeración, Lavado, Promoción, UGC
  rol             text,                                -- Build / Consider / NULL para costos
  touchpoint      text,                                -- libre, viene del Sheet
  sistema         text,                                -- YouTube, Meta, TikTok, OOH, TVC, etc.
  formato         text,                                -- Bumper, TrueView, Kiosco/Totem, PNTs, etc. (o nombre del costo)
  inversion       numeric(14,2) not null default 0,
  tipo            planning_media_tipo not null default 'media',
  source          text not null default 'google_sheet',
  raw             jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_planning_media unique nulls not distinct
    (fecha, campania, rol, sistema, formato, tipo)
);

create index idx_planning_media_fecha    on planning_media (fecha);
create index idx_planning_media_campania on planning_media (campania);
create index idx_planning_media_tipo     on planning_media (tipo);
create index idx_planning_media_sistema  on planning_media (sistema);
create index idx_planning_media_rol      on planning_media (rol);

comment on table planning_media is
  'Planning rico de pauta (Drean). Una fila por mes × campaña × sistema × formato × tipo. Incluye media y costos.';

create trigger trg_planning_media_updated before update on planning_media
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- Vistas para el dashboard
-- -----------------------------------------------------------------------------

-- Totales mensuales por tipo de medio (Digital ON, TV Cable, OOH, Costos)
create or replace view vw_planning_media_mensual as
select
  fecha,
  date_trunc('month', fecha)::date as mes,
  extract(year from fecha)::int    as ano,
  extract(month from fecha)::int   as mes_numero,
  campania,
  case
    when tipo = 'costo' then 'Costos'
    when sistema in ('TVC', 'TV Cable', 'TVA') then 'TV Cable'
    when sistema in ('OOH', 'Vía Pública') then 'OOH'
    else 'Digital'
  end as medio,
  rol,
  sistema,
  formato,
  sum(inversion) as inversion
from planning_media
group by fecha, campania, tipo, sistema, rol, formato;

comment on view vw_planning_media_mensual is
  'Agrupa planning_media por (fecha, campania, medio, rol, sistema, formato) clasificando en Digital/TVC/OOH/Costos.';

-- Resumen por categoría (Brand, Cocina, etc.)
create or replace view vw_planning_media_por_categoria as
select
  fecha,
  campania,
  sum(inversion) filter (where tipo = 'media') as media,
  sum(inversion) filter (where tipo = 'costo') as costos,
  sum(inversion) filter (where rol = 'Build')  as build,
  sum(inversion) filter (where rol = 'Consider') as consider_,
  sum(inversion) as total
from planning_media
group by fecha, campania;

comment on view vw_planning_media_por_categoria is
  'Por (fecha, campania): split media/costos y Build/Consider. Usado por las KPI cards.';
