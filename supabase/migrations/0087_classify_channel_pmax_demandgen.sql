-- =============================================================================
-- Fix de clasificación de canal (classify_channel): "Paid Search" venía inflado
-- (225k usuarios, 56%) porque absorbía dos tipos de campaña de Google que NO son
-- Search:
--
--   1. PMax (Performance Max): la regla de Cross-network buscaba `^pmax` (anclado
--      al inicio), pero las campañas se llaman `inhouse_..._pmax_...` (pmax en el
--      medio) → no matcheaba → caían a Paid Search. Fix: `pmax` sin ancla.
--   2. Demand Gen: llega como source=google, medium=cpc, con "demandgen"/"demangen"
--      en el NOMBRE de campaña → caía a Paid Search. Fix: rama propia "Demand Gen"
--      (detectada por el nombre de campaña) ANTES de Paid Search.
--
-- Validado con data real (julio 2026): del bucket "Paid Search" (~225k sesiones),
-- ~116k eran Demand Gen y ~65k PMax; el Paid Search real es ~40k.
--
-- La función estaba creada fuera de migraciones (directo en Supabase); esta
-- migración la deja versionada. Cambia solo el cuerpo → no requiere reload de
-- PostgREST (se llama en la vista a query-time).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.classify_channel(p_source text, p_medium text, p_campaign text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    -- PMax / Performance Max / Cross-network (pmax SIN ancla: matchea en el medio del nombre)
    when lower(coalesce(p_campaign,'')) ~ 'cross.?network|crossnetwork|pmax|performance.?max' then 'Cross-network'
    when lower(coalesce(p_source,'')) = 'insider' or lower(coalesce(p_medium,'')) ~ 'web.?push|push.?notif' then 'Push'
    when lower(coalesce(p_source,'')) = 'sitio-web' or lower(coalesce(p_medium,'')) ~ '^banner' then 'Internal'
    -- Demand Gen (por nombre de campaña; incluye el typo "demangen"). ANTES de Paid Search.
    when lower(coalesce(p_campaign,'')) ~ 'demandgen|demangen|demand.?gen'
         and lower(coalesce(p_medium,'')) ~ '(cpc|ppc|paid|cpm|cpv)' then 'Demand Gen'
    when (lower(coalesce(p_source,'')) ~ '(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)' and not lower(coalesce(p_source,'')) ~ 'shopping')
         and lower(coalesce(p_medium,'')) ~ '(cpc|ppc|paid|paidsearch|paid_search|sem)' then 'Paid Search'
    when lower(coalesce(p_source,'')) ~ '(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)'
         and (lower(coalesce(p_medium,'')) = 'organic' or coalesce(p_medium,'') = '') then 'Organic Search'
    when (lower(coalesce(p_source,'')) ~ '(facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|snapchat|reddit|fb\.com|fb\.me|ig\.com|meta)')
         and lower(coalesce(p_medium,'')) ~ '(cpc|ppc|paid|cpm|cpv|smartup|paid_social|paidsocial|paid.social|social.paid)' then 'Paid Social'
    when lower(coalesce(p_source,'')) ~ '(facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|snapchat|reddit|fb\.com|fb\.me|ig\.com|meta)' then 'Organic Social'
    when lower(coalesce(p_medium,'')) = 'email' or lower(coalesce(p_source,'')) ~ 'mail|email|mailchimp|sendgrid|hubspot|klaviyo' then 'Email'
    when lower(coalesce(p_medium,'')) ~ '^(display|banner|expandable|interstitial|cpm|cpa)$' or lower(coalesce(p_source,'')) = 'dv360' then 'Display / Programmatic'
    when lower(coalesce(p_source,'')) ~ '(youtube|vimeo|twitch)' then 'Paid Video'
    when lower(coalesce(p_medium,'')) = 'referral' or lower(coalesce(p_source,'')) ~ 'chatgpt|perplexity|claude' then 'Referral'
    when lower(coalesce(p_medium,'')) ~ '^(affiliate|affiliates)$' then 'Affiliates'
    when (coalesce(p_source,'') = '' or lower(coalesce(p_source,'')) = '(direct)') and (coalesce(p_medium,'') = '' or lower(coalesce(p_medium,'')) in ('(none)','(not set)')) then 'Direct'
    when lower(coalesce(p_medium,'')) ~ '(cpc|ppc|paid|cpm|cpa|cpv)' then 'Paid Other'
    when lower(coalesce(p_medium,'')) = 'organic' then 'Organic Search'
    else 'Unassigned'
  end;
$function$;
