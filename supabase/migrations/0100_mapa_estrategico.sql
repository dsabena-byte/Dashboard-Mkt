-- Persistencia del Mapa Estratégico (antes vivía solo en localStorage del browser).
-- Config singleton (id=1): objetivos + planes/KPIs con vínculos inbound.
-- Modelo nuevo (aplanado, dic-2026): cada KPI aporta un % a un objetivo y la suma
-- por objetivo se capa en 100% (peso inbound = fracción del objetivo que explica ese KPI).
-- Fase 0 = multi-tenant fijo (Drean). Al escalar, se agrega tenant_id a la PK.

create table if not exists mapa_estrategico (
  id smallint primary key default 1,
  objetivos jsonb not null default '[]'::jsonb, -- [{id, nombre, color, peso}]
  planes    jsonb not null default '[]'::jsonb, -- [{nombre, kpis:[{nombre, vinculos:{objId:peso}}]}]
  updated_at timestamptz not null default now(),
  constraint mapa_estrategico_singleton check (id = 1)
);

comment on table mapa_estrategico is 'Config del Mapa Estratégico (objetivos + KPIs + pesos inbound). Singleton id=1.';
