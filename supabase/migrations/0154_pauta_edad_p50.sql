-- «Edad × formato» (Eficiencia Medios): videos vistos al 50% o más por edad (resultado de video pedido por el user 24-nov-2026).
-- Lo llenan los crons de Meta (video_p50_watched_actions), TikTok (video_views_p50), Google Ads (p50 rate × impresiones)
-- y DV360 YouTube (Midpoint Views). Filas cargadas antes de esta migración quedan en 0 hasta la próxima sincronización.
alter table public.pauta_edad add column if not exists video_p50 bigint not null default 0;
