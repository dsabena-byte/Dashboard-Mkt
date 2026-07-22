-- =============================================================================
-- 0070_ga4_google_ads_daily: inversión de Google Ads a nivel campaña REAL,
-- traída por la GA4 Data API con las dimensiones nativas de Google Ads
-- (googleAdsCampaignId/Name/Type) — no atribuida por UTM de sesión.
--
-- Requiere el vínculo GA4 ↔ Google Ads activo (Admin → Vínculos de productos →
-- Google Ads). Métricas: advertiserAdCost/Clicks/Impressions/CostPerClick.
-- Moneda = la de la propiedad GA4 (ARS).
--
-- Diferencia con ga4_ads_cost_daily: esa tabla atribuye el costo por UTM de
-- sesión (para el funnel de conversión inhouse_*); ésta trae la identidad REAL
-- de la campaña de Google Ads (id, nombre, tipo Search/PMax/Demand Gen/Video).
-- =============================================================================

create table if not exists ga4_google_ads_daily (
  id             uuid primary key default uuid_generate_v4(),
  fecha          date not null,
  campaign_id    text not null,
  campaign_name  text not null default '',
  campaign_type  text,                          -- Search | Performance Max | Demand Gen | Display | Video | ...
  cost           numeric not null default 0,    -- advertiserAdCost (ARS)
  clicks         bigint  not null default 0,    -- advertiserAdClicks
  impressions    bigint  not null default 0,    -- advertiserAdImpressions
  cpc            numeric not null default 0,     -- advertiserAdCostPerClick
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint uq_ga4_google_ads unique nulls not distinct (fecha, campaign_id)
);

create index if not exists idx_ga4_google_ads_fecha on ga4_google_ads_daily (fecha);
create index if not exists idx_ga4_google_ads_campaign on ga4_google_ads_daily (campaign_name);

comment on table ga4_google_ads_daily is
  'Inversión diaria de Google Ads por campaña real (dimensiones nativas googleAds* de la GA4 Data API; requiere link GA4↔Google Ads). Costo en ARS. Fuente única de inversión Google Ads directa desde GA4.';

-- RLS: solo lectura anon/auth; escritura vía service_role (igual que 0063).
alter table ga4_google_ads_daily enable row level security;
drop policy if exists rls_anon_read on ga4_google_ads_daily;
create policy rls_anon_read on ga4_google_ads_daily for select to anon using (true);
drop policy if exists rls_auth_read on ga4_google_ads_daily;
create policy rls_auth_read on ga4_google_ads_daily for select to authenticated using (true);
