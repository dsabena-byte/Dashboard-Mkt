-- Herramientas "Accelerate" portadas de BIP (sep-2026), single-tenant (Drean):
--   · competitor_ads_snapshot → Pauta de la competencia (Biblioteca de anuncios de Meta vía Apify).
--     UNA FILA POR MARCA (el cron /api/cron/ad-library hace fan-out por marca y cada request escribe
--     solo la suya). `ads` = JSON de anuncios normalizados (lib/ad-library-shared.ts CompetitorAd).
--   · alert_log   → dedupe de alertas por email + reporte mensual + latido de los crons (canal 'cron').
--   · alert_prefs → preferencias de envío (singleton id=1).
-- Todo lo lee/escribe la API server-side con la service key. Aditiva e idempotente.

create table if not exists competitor_ads_snapshot (
  marca text primary key,
  own boolean not null default false,
  ads jsonb not null default '[]'::jsonb,
  fetched_at timestamptz,
  error text,
  stale boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists alert_log (
  id bigserial primary key,
  key text not null,
  canal text not null default 'email', -- email | reporte | prueba | cron
  sent_at timestamptz not null default now()
);
create index if not exists alert_log_canal_sent_idx on alert_log (canal, sent_at desc);

create table if not exists alert_prefs (
  id int primary key default 1 check (id = 1),
  email_on boolean not null default true,
  frecuencia text not null default 'auto' check (frecuencia in ('auto', 'semanal', 'diaria', 'off')),
  destinatarios text[] not null default '{}',
  reporte_on boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Escritura: solo la service key (API server-side). Lectura anon/authenticated SOLO en las dos tablas
-- que mira /monitoreo (maxUpdatedAt usa el cliente anon, patrón rls_anon_read de 0061): el snapshot de
-- anuncios (dato público de Meta) y el log (claves + fecha). alert_prefs (emails) queda sin policies.
alter table competitor_ads_snapshot enable row level security;
alter table alert_log enable row level security;
alter table alert_prefs enable row level security;

drop policy if exists rls_anon_read on competitor_ads_snapshot;
create policy rls_anon_read on competitor_ads_snapshot for select to anon using (true);
drop policy if exists rls_auth_read on competitor_ads_snapshot;
create policy rls_auth_read on competitor_ads_snapshot for select to authenticated using (true);
drop policy if exists rls_anon_read on alert_log;
create policy rls_anon_read on alert_log for select to anon using (true);
drop policy if exists rls_auth_read on alert_log;
create policy rls_auth_read on alert_log for select to authenticated using (true);
