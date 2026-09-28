-- 0122 · "Mis acciones": seguimiento de las tarjetas de "Qué hacer ahora" (Diagnóstico e Inteligencia).
-- Single-tenant (Drean). Una fila por tarjeta marcada: "La voy a hacer" (planificada), "Hecha" o
-- "Descartada". `id` = id estable de la tarjeta (senal:<dash>:<clave de la regla> | ia:<dash>:<hash del
-- título>); `snapshot` = foto de la tarjeta al marcarla (así sigue visible aunque la señal ya no salga).
-- Idempotente y aditiva. Acceso SOLO por la API del servidor con la service key
-- (/api/recomendaciones/seguimiento, exige sesión y guarda el email del autor). Sin esta tabla la app
-- funciona igual: las tarjetas se ven y los botones avisan que falta correr esta migración.

create table if not exists public.recomendacion_seguimiento (
  id          text primary key,
  dash        text not null,
  estado      text not null default 'planificada',
  titulo      text not null,
  snapshot    jsonb not null default '{}'::jsonb,
  autor       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$ begin
  alter table public.recomendacion_seguimiento
    add constraint recomendacion_seguimiento_estado_chk check (estado in ('planificada', 'hecha', 'descartada'));
exception when duplicate_object then null; end $$;

create index if not exists recomendacion_seguimiento_dash_idx
  on public.recomendacion_seguimiento (dash, updated_at desc);

-- Sin policies: solo la service role (server) lee y escribe.
alter table public.recomendacion_seguimiento enable row level security;
revoke all on public.recomendacion_seguimiento from anon, authenticated;
