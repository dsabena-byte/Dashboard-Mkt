-- 0120 · Copiloto: feedback 👍/👎 + respuestas verificadas (portado de BIP 0048, sep-2026), single-tenant.
-- Idempotente y aditiva. Sin ella: el feedback responde ok con stored:false (la UI agradece igual), el
-- copiloto no inyecta ejemplos verificados y /copiloto muestra el aviso de la migración.

-- 👍/👎 de cada respuesta (con "¿qué estaba mal?"). pregunta/respuesta/tools = lo que vio el usuario.
create table if not exists public.chat_feedback (
  id          bigserial primary key,
  user_email  text,
  rating      smallint not null check (rating in (-1, 1)),
  motivo      text check (motivo is null or motivo in ('dato_incorrecto', 'no_respondio', 'incompleta', 'lenta', 'otro')),
  comentario  text,
  pregunta    text not null,
  respuesta   text not null,
  tools       text[] not null default '{}',
  pathname    text,
  model       text,
  revisado    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists chat_feedback_created_idx on public.chat_feedback (created_at desc);
create index if not exists chat_feedback_rating_idx on public.chat_feedback (rating, revisado);

-- Respuestas VERIFICADAS por el equipo: el copiloto inyecta hasta 2 parecidas como ejemplo de MÉTODO
-- (qué fuentes consultar y cómo responder). Los números siempre se vuelven a traer con las tools.
create table if not exists public.chat_verified (
  id           bigserial primary key,
  pregunta     text not null,
  respuesta    text not null,
  tools        text[] not null default '{}',
  pathname     text,
  feedback_id  bigint references public.chat_feedback(id) on delete set null,
  verified_by  text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists chat_verified_activo_idx on public.chat_verified (activo, id desc);

-- Solo la service key (API server-side) lee y escribe: contienen preguntas y respuestas con datos del negocio.
alter table public.chat_feedback enable row level security;
alter table public.chat_verified enable row level security;
revoke all on public.chat_feedback from anon, authenticated;
revoke all on public.chat_verified from anon, authenticated;
