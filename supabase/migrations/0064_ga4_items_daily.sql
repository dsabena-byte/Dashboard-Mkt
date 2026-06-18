-- =============================================================================
-- 0064_ga4_items_daily: productos (ítems) comprados por campaña, desde GA4.
-- Alimenta el ranking "Top productos" del dashboard Pauta Ecommerce.
-- Sale de la GA4 Data API con dimensiones date + sessionCampaignName + itemName
-- y métricas itemsPurchased + itemRevenue, filtrado a campañas inhouse_*.
-- =============================================================================

create table if not exists ga4_items_daily (
  id              uuid primary key default uuid_generate_v4(),
  fecha           date not null,
  utm_campaign    text,
  item_name       text not null,
  items_purchased bigint  not null default 0,  -- itemsPurchased (unidades)
  item_revenue    numeric not null default 0,  -- itemRevenue (ingresos del ítem, ARS)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_ga4_items unique nulls not distinct (fecha, utm_campaign, item_name)
);

create index if not exists idx_ga4_items_fecha on ga4_items_daily (fecha);

comment on table ga4_items_daily is
  'Productos (ítems) comprados por fecha+campaña (GA4 itemsPurchased/itemRevenue). Para el Top productos de la pauta de conversión inhouse_*.';

-- RLS: solo lectura anon/auth; escritura vía service_role (igual que 0061).
alter table ga4_items_daily enable row level security;
drop policy if exists rls_anon_read on ga4_items_daily;
create policy rls_anon_read on ga4_items_daily for select to anon using (true);
drop policy if exists rls_auth_read on ga4_items_daily;
create policy rls_auth_read on ga4_items_daily for select to authenticated using (true);
