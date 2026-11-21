-- Pauta por EDAD de cada medio con API (Meta, TikTok, DV360, Google Ads), por pieza y mes.
-- Sección «Edad × medio» de Eficiencia Medios. La llenan los crons de cada medio con ?edad=1.
-- Formato = ubicación de Meta (IG Feed, IG Reels, IG Stories, IG Explore, FB Feed…); en los demás medios = el medio.
-- Meta no da edad y ubicación juntas: el cruce se estima dentro de cada anuncio (estimado = true si el anuncio corrió en más de una ubicación).
drop table if exists public.meta_paid_breakdown;
create table if not exists public.pauta_edad (
  medio text not null,              -- Meta | TikTok | YouTube | Programmatic | Google Search | Demand Gen
  mes text not null,                -- 'YYYY-MM'
  pieza_id text not null,           -- ad_id (Meta/TikTok), creative (DV360), ad_group_id (Google Ads)
  edad text not null,               -- 18-24 | 25-34 | 35-44 | 45-54 | 55+ | Sin dato
  formato text not null default '',
  estimado boolean not null default false,
  tipo text,                        -- video | imagen | texto
  impresiones bigint not null default 0,
  clicks bigint not null default 0,
  video_completos bigint not null default 0,
  interacciones bigint not null default 0,
  spend numeric not null default 0,
  moneda text not null default 'ARS', -- DV360 = USD (se pasa a $ con el TC REAL al leer)
  updated_at timestamptz not null default now(),
  primary key (medio, mes, pieza_id, edad, formato)
);
alter table public.pauta_edad enable row level security;
grant select on public.pauta_edad to authenticated;
grant select, insert, update, delete on public.pauta_edad to service_role;
