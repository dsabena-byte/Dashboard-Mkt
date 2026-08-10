-- LLMO (LLM Optimization / GEO) — visibilidad de marca en respuestas de LLM.
-- Mide, por categoría, cuántas veces cada marca aparece cuando se le pregunta a un
-- LLM "¿qué/cuál <categoria> conviene en Argentina?" (varios prompts, varias
-- corridas), y su SHARE de menciones vs el resto. Es el equivalente al Share of
-- Search pero en el canal de IA generativa (ChatGPT/Gemini/etc.), el nuevo lugar
-- donde el consumidor pregunta antes de comprar.
create table if not exists seo_llmo (
  categoria   text not null,
  marca       text not null,
  mes         date not null,          -- primer día del mes
  menciones   integer not null default 0,   -- veces que la marca fue nombrada
  prompts     integer not null default 0,    -- total de respuestas evaluadas
  share_pct   numeric not null default 0,    -- % de menciones sobre el total de marcas
  rank_prom   numeric,                        -- orden promedio en que aparece (1 = primera; menor = mejor)
  modelo      text,                           -- modelo LLM usado
  updated_at  timestamptz not null default now(),
  primary key (categoria, marca, mes)
);

comment on table seo_llmo is 'Visibilidad de marca en respuestas de LLM (LLMO / Share of Model) por categoría×mes. Menciones y share cuando se le pregunta a un LLM por la categoría. Lo escribe el cron llmo-sync.';
