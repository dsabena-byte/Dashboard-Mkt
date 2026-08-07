-- Estado ACTUAL (activa/pausada) de cada pieza, para mostrar un indicador en las
-- grillas de pauta digital. Lo completa cada sync con el estado vigente al momento
-- de la corrida. NULL = todavía no calculado (piezas legacy / meses no re-synceados).

-- Google Ads: estado del anuncio y de su campaña (ENABLED / PAUSED / REMOVED).
-- Una pieza "corre" solo si el ad Y su campaña están ENABLED.
alter table google_ads_creatives add column if not exists ad_status text;
alter table google_ads_creatives add column if not exists campaign_status text;

-- Meta: effective_status del ad (ACTIVE / PAUSED / CAMPAIGN_PAUSED / ADSET_PAUSED /
-- ARCHIVED / ...). ACTIVE = corriendo; cualquier otro = pausada/archivada.
alter table meta_paid_creatives add column if not exists effective_status text;

comment on column google_ads_creatives.ad_status is 'Estado del anuncio en Google Ads (ENABLED/PAUSED/REMOVED). Lo completa google-ads-sync.';
comment on column google_ads_creatives.campaign_status is 'Estado de la campaña en Google Ads (ENABLED/PAUSED/REMOVED). Lo completa google-ads-sync.';
comment on column meta_paid_creatives.effective_status is 'effective_status del ad en Meta (ACTIVE=corriendo). Lo completa meta-paid-sync.';
