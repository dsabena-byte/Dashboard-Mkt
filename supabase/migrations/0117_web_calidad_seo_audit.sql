-- Web / SEO avanzado (portado de BIP, sep-2026). Dos SNAPSHOTS JSON single-tenant (una fila, id=1).
-- Sin estas tablas los tableros funcionan igual (las secciones nuevas avisan que falta la migración).
--
-- 1) web_calidad_snapshot: calidad del dato de GA4 (embudo de ecommerce, tráfico desde asistentes
--    de IA, landings en caída, checklist de tracking) + serie mensual de tráfico desde IA
--    (web_traffic) + chequeo indirecto de consent (sesiones google/cpc vs clicks de Google Ads).
--    Lo llena /api/cron/web-calidad (workflow web-cat-agg.yml, 1x/día). /web lee la fila al instante.
create table if not exists web_calidad_snapshot (
  id smallint primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint web_calidad_snapshot_singleton check (id = 1)
);
alter table web_calidad_snapshot enable row level security;

-- 2) seo_audit_snapshot: auditoría técnica SEO/GEO + Core Web Vitals de drean.com.ar (robots.txt con
--    bots de IA, sitemap, title/description/h1/canonical/noindex/schema, CrUX/PageSpeed Insights).
--    Lo llena /api/cron/seo-audit (workflow seo-audit.yml, semanal). /seo-search lee la fila.
create table if not exists seo_audit_snapshot (
  id smallint primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint seo_audit_snapshot_singleton check (id = 1)
);
alter table seo_audit_snapshot enable row level security;
-- Sin policies: solo la service key (server) lee/escribe.
