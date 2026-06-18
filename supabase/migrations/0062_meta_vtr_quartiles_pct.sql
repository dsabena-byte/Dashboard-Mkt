-- =============================================================================
-- 0062_meta_vtr_quartiles_pct: VTR por cuartil en PORCENTAJE.
-- Las columnas video_p25/50/75/100 guardan CANTIDADES (de la Marketing API de Meta).
-- Pero fuentes como TikTok (vía OMD/Looker) entregan la visibilidad como TASA (VTR
-- 25%/50%/75%/100% = % de impresiones que llegaron a ese punto del video). Para esas
-- fuentes guardamos el % acá; el dashboard lo convierte a cantidad (impresiones × %/100).
-- =============================================================================

alter table meta_paid_creatives
  add column if not exists vtr_p25  numeric,  -- % de impresiones que llegaron al 25%
  add column if not exists vtr_p50  numeric,  -- % al 50%
  add column if not exists vtr_p75  numeric,  -- % al 75%
  add column if not exists vtr_p100 numeric;  -- % al 100% (video completo)

comment on column meta_paid_creatives.vtr_p25  is 'VTR al 25% en % (Looker/TikTok). Cantidad = impresiones × vtr_p25/100.';
comment on column meta_paid_creatives.vtr_p50  is 'VTR al 50% en % (Looker/TikTok).';
comment on column meta_paid_creatives.vtr_p75  is 'VTR al 75% en % (Looker/TikTok).';
comment on column meta_paid_creatives.vtr_p100 is 'VTR al 100% en % (Looker/TikTok). Video visto completo.';
