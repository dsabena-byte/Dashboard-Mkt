-- =============================================================================
-- Tabla meta_paid_creatives: piezas pautadas en Meta Ads (IG + FB) con su
-- métrica individual del mes. Una fila por (ad_id, mes). Se sincroniza desde
-- la Graph API vía /api/cron/meta-paid-sync (System User token).
-- Alimenta la grilla "Piezas pautadas — Meta" en /performance.
-- =============================================================================

create table if not exists meta_paid_creatives (
  id              uuid primary key default gen_random_uuid(),
  ad_id           text not null,
  mes             text not null,                  -- 'Mayo 2026' (label como pauta_performance)
  fecha_desde     date not null,                  -- date_start del insight
  fecha_hasta     date not null,                  -- date_stop del insight
  act_id          text,                           -- 'act_XXXXXXXX' (cuenta publicitaria)
  campaign_id     text,
  campaign_name   text,
  adset_id        text,
  adset_name      text,
  ad_name         text,
  objective       text,                           -- objetivo de la campaña (REACH, CONVERSIONS, ...)
  plataforma      text not null default 'meta',   -- 'meta' (luego, si discriminamos publisher_platform: 'meta_fb' | 'meta_ig')
  thumbnail_url   text,                           -- thumbnail chica (Meta la entrega ~64x64)
  image_url       text,                           -- creative principal (estático) o portada del video
  body            text,                           -- copy del ad
  permalink_url   text,                           -- link a la pieza pautada en FB
  impresiones     bigint default 0,
  alcance         bigint default 0,
  frecuencia      numeric(8,2),
  clicks          bigint default 0,
  spend           numeric(14,2) default 0,
  ctr             numeric(8,4),
  cpm             numeric(12,4),
  cpc             numeric(12,4),
  raw             jsonb,                          -- payload Meta completo (para inspección)
  fetched_at      timestamptz not null default now(),
  constraint uq_meta_paid_creative unique (ad_id, mes)
);

create index if not exists idx_meta_paid_mes on meta_paid_creatives(mes);
create index if not exists idx_meta_paid_campaign on meta_paid_creatives(campaign_id);
create index if not exists idx_meta_paid_impresiones on meta_paid_creatives(mes, impresiones desc);

comment on table meta_paid_creatives is
  'Piezas pautadas en Meta Ads (IG+FB) con métricas por mes. Una fila por (ad_id, mes). Fuente: Graph API vía /api/cron/meta-paid-sync.';

alter table meta_paid_creatives enable row level security;
drop policy if exists "meta_paid_public_read" on meta_paid_creatives;
create policy "meta_paid_public_read"
  on meta_paid_creatives for select
  to anon, authenticated
  using (true);
