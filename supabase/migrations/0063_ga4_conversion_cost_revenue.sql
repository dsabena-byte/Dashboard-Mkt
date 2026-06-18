-- =============================================================================
-- 0063_ga4_conversion_cost_revenue: agrega lo necesario para el dashboard
-- "Performance Pauta Conversión" (parte baja del funnel, campañas inhouse_* de
-- Google Ads).
--
--   1) ga4_purchases_daily.revenue  → Total de ingresos (purchaseRevenue de GA4).
--      Permite ticket promedio (ingresos/transacciones) y ROAS (ingresos/inversión).
--
--   2) ga4_ads_cost_daily           → INVERSIÓN por campaña (advertiserAdCost).
--      OJO: inversión ≠ revenue. Esto es cuánta plata se GASTÓ en cada campaña,
--      no lo que entró. Sale de GA4 vía la métrica advertiserAdCost, que requiere
--      tener Google Ads vinculado a la propiedad GA4. Con esto se calculan los
--      KPIs de eficiencia del gasto: CAC/CPA (inversión/transacciones), CPC
--      (inversión/clics) y ROAS (ingresos/inversión).
-- =============================================================================

-- 1) Revenue por (fecha, utm) ------------------------------------------------
alter table ga4_purchases_daily
  add column if not exists revenue numeric not null default 0;

comment on column ga4_purchases_daily.revenue is
  'Total de ingresos (purchaseRevenue de GA4) por fecha+UTM. NO es inversión. Para ticket promedio y ROAS.';

-- 2) Inversión por (fecha, utm) ----------------------------------------------
create table if not exists ga4_ads_cost_daily (
  id             uuid primary key default uuid_generate_v4(),
  fecha          date not null,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  cost           numeric not null default 0,  -- advertiserAdCost: plata gastada (moneda de la propiedad = ARS)
  ad_clicks      bigint  not null default 0,  -- advertiserAdClicks
  ad_impressions bigint  not null default 0,  -- advertiserAdImpressions
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint uq_ga4_ads_cost unique nulls not distinct (fecha, utm_source, utm_medium, utm_campaign)
);

create index if not exists idx_ga4_ads_cost_fecha on ga4_ads_cost_daily (fecha);

comment on table ga4_ads_cost_daily is
  'Inversión diaria por campaña (advertiserAdCost de GA4; requiere link Google Ads↔GA4). En ARS (moneda de la propiedad). Para CAC/CPA/CPC/ROAS de la pauta de conversión inhouse_*.';

-- RLS: igual criterio que 0061 — solo lectura anon/auth; escritura vía service_role.
alter table ga4_ads_cost_daily enable row level security;
drop policy if exists rls_anon_read on ga4_ads_cost_daily;
create policy rls_anon_read on ga4_ads_cost_daily for select to anon using (true);
drop policy if exists rls_auth_read on ga4_ads_cost_daily;
create policy rls_auth_read on ga4_ads_cost_daily for select to authenticated using (true);
