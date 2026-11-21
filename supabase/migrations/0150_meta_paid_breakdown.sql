-- Pauta de Meta abierta por EDAD y por UBICACIÓN (Feed/Reels/Stories/Explore…), por anuncio y mes.
-- Meta no permite pedir edad y ubicación juntas: se guardan como dos dimensiones (dim = 'edad' | 'ubicacion')
-- y el tablero estima el cruce dentro de cada anuncio. Lo llena meta-paid-sync?edad=1.
create table if not exists public.meta_paid_breakdown (
  mes text not null,                 -- 'YYYY-MM'
  ad_id text not null,
  dim text not null check (dim in ('edad', 'ubicacion')),
  valor text not null,               -- '25-34' | 'instagram|reels'
  campaign_name text,
  impresiones bigint not null default 0,
  alcance bigint not null default 0,
  clicks bigint not null default 0,
  link_clicks bigint not null default 0,
  landing_views bigint not null default 0,
  interacciones bigint not null default 0,
  video_p100 bigint not null default 0,
  thruplay bigint not null default 0,
  spend numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (mes, ad_id, dim, valor)
);
alter table public.meta_paid_breakdown enable row level security;
grant select on public.meta_paid_breakdown to authenticated;
grant select, insert, update, delete on public.meta_paid_breakdown to service_role;
