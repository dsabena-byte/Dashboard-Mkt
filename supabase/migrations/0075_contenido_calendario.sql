-- =============================================================================
-- Tabla contenido_calendario: calendario editorial del generador de contenido.
-- Cada fila = una pieza programada para un día: guarda los parámetros de
-- generación, el contenido generado (editable) y el estado del workflow
-- (pendiente → generado → aprobado → publicado). La publicación automática en
-- IG/FB (Fase 2) leerá las filas 'aprobado' con fecha/hora cumplida.
-- =============================================================================

create table if not exists contenido_calendario (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,               -- día programado
  hora          time,                        -- hora opcional de publicación
  -- Parámetros de generación
  pilar         text,
  categoria     text,
  modelo        text,                         -- sku del catálogo o null
  formato       text,                         -- imagen | carrusel
  aspecto       text,                         -- feed | vertical | story
  detalles      text,                         -- texto libre (instrucciones extra)
  -- Contenido generado (editable en la revisión)
  imagen_url    text,
  video_url     text,
  caption       text,
  hashtags      jsonb,
  mensaje_clave text,                         -- título de la placa
  bajada        text,
  image_prompt  text,
  -- Workflow
  estado        text not null default 'pendiente',  -- pendiente | generado | aprobado | publicado
  aprobado      boolean not null default false,
  publicado_at  timestamptz,
  redes         jsonb,                        -- ["instagram","facebook"] destino
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_cal_fecha on contenido_calendario(fecha);
create index if not exists idx_cal_estado on contenido_calendario(estado);

comment on table contenido_calendario is
  'Calendario editorial del generador de contenido: pieza programada por día, con parámetros, contenido generado (editable) y estado (pendiente/generado/aprobado/publicado). Alimenta la publicación automática en IG/FB (Fase 2).';

-- Lectura/escritura desde el dashboard (autenticado). Mantengo RLS on con
-- políticas permisivas para anon/authenticated como el resto del proyecto; la
-- escritura real va con service-role desde los endpoints server.
alter table contenido_calendario enable row level security;
drop policy if exists "contenido_calendario_read" on contenido_calendario;
create policy "contenido_calendario_read"
  on contenido_calendario for select
  to anon, authenticated
  using (true);
