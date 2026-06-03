-- =============================================================================
-- 0040_insights_log: tabla para el historial de insights/recomendaciones
-- generados automáticamente por los crons de análisis.
--
-- Cada fila es una "señal" (alerta, oportunidad, info) detectada por las
-- reglas heurísticas o por LLM (fase B). Se identifica por una clave
-- compuesta (categoria, signal_key) para hacer upsert idempotente — si el
-- mismo insight se genera de nuevo en el siguiente run, se actualiza la
-- fila existente en lugar de crear duplicados.
-- =============================================================================

create table if not exists insights_log (
  id             uuid primary key default gen_random_uuid(),
  fecha_generado timestamptz not null default now(),
  categoria      text not null,                   -- 'organico_drean' / 'pauta' / 'web' / 'floor_share' / 'cb'
  signal_key     text not null,                   -- identificador estable del tipo de señal (ej. 'ig_reels_reach_drop_30d')
  prioridad      text not null,                   -- 'alta' / 'media' / 'baja'
  tipo           text not null,                   -- 'alerta' / 'oportunidad' / 'info'
  titulo         text not null,
  descripcion    text not null,                   -- 1-2 oraciones, lenguaje accionable
  acciones       jsonb,                           -- array de strings — recomendaciones concretas
  datos          jsonb,                           -- payload de respaldo (% delta, valores, refs a posts, etc.)
  estado         text not null default 'nuevo',   -- 'nuevo' / 'visto' / 'cerrado' (manual desde UI)
  updated_at     timestamptz not null default now(),
  constraint uq_insight_signal unique (categoria, signal_key)
);

create index if not exists idx_insights_prioridad on insights_log (prioridad, fecha_generado desc);
create index if not exists idx_insights_categoria on insights_log (categoria, fecha_generado desc);
create index if not exists idx_insights_estado on insights_log (estado, fecha_generado desc);

comment on table insights_log is
  'Historial de insights/recomendaciones generados por los crons de análisis. Upsert por (categoria, signal_key) para idempotencia.';

create or replace function set_insights_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_insights_updated_at on insights_log;
create trigger trg_insights_updated_at
  before update on insights_log
  for each row execute function set_insights_updated_at();

alter table insights_log enable row level security;
drop policy if exists "insights_log public read" on insights_log;
create policy "insights_log public read"
  on insights_log for select
  to anon, authenticated
  using (true);
