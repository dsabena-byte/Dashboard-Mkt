-- Versiones guardadas del Diagnóstico IA por tablero (portado de BIP, sep-2026).
-- Single-tenant (Drean): una fila por versión generada; `data` = { insights, model, signalsCount }.
-- La API (/api/insights) es fail-safe: si esta tabla no existe, el diagnóstico se genera y se
-- muestra igual, solo que no se guarda el historial.
create table if not exists insights_report (
  id bigserial primary key,
  dash text not null,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists insights_report_dash_created_idx on insights_report (dash, created_at desc);

-- Solo la service key (API server-side) lee/escribe.
alter table insights_report enable row level security;
