-- =============================================================================
-- Calendario: separa RRSS de UGC usando el mismo motor (misma tabla) pero con un
-- discriminador `canal`. Cada tab del dashboard muestra sólo su canal (no se
-- mezclan orgánico/RRSS con UGC). Se agregan los campos propios del flujo UGC.
-- =============================================================================

alter table contenido_calendario
  add column if not exists canal text not null default 'rrss',  -- 'rrss' | 'ugc'
  add column if not exists perfil text,        -- ugc: usuario | tecnico | personal
  add column if not exists guion text,         -- ugc: guion hablado
  add column if not exists persona_url text;   -- ugc: retrato de la persona (identidad)

create index if not exists idx_contenido_calendario_canal on contenido_calendario(canal, fecha);

comment on column contenido_calendario.canal is 'rrss (orgánico/producto) | ugc (persona hablando). Separa los calendarios.';
