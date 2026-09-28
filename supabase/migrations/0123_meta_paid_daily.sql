-- 0123 · Gasto DIARIO de Meta por campaña (Plan de Medios → Eficiencia Medios → "Inversión diaria por medio").
-- meta_paid_creatives guarda el gasto por MES (insights con time_range del mes): no deja ver si una campaña se
-- gastó todo el presupuesto en pocos días. El cron meta-paid-sync ya pide a Meta una serie con
-- time_increment=1 (un dato por anuncio y por día) para contar los días activos; ahora esa misma llamada trae
-- también `spend` y lo guarda acá agregado por (día, campaña). Se re-escribe en cada corrida del mes (el
-- workflow sincroniza el mes en curso + los 2 anteriores → al correr por primera vez completa ~3 meses).
-- Idempotente y aditiva. Sin esta tabla el dash funciona igual (Meta se muestra con su dato mensual y un aviso).

create table if not exists public.meta_paid_daily (
  fecha          date not null,
  campaign_id    text not null,
  campaign_name  text,
  spend          numeric not null default 0,   -- ARS (moneda de la cuenta)
  impresiones    bigint not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (fecha, campaign_id)
);

create index if not exists meta_paid_daily_fecha_idx on public.meta_paid_daily (fecha desc);

-- Sin policies: solo la service role (server) lee y escribe.
alter table public.meta_paid_daily enable row level security;
revoke all on public.meta_paid_daily from anon, authenticated;
