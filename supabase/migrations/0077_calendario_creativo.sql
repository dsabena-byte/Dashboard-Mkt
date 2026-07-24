-- Modo "creativo/editorial" en el calendario: tipo de contenido + sub-tipo + idea.
alter table contenido_calendario
  add column if not exists tipo_contenido text not null default 'producto',  -- producto | creativo
  add column if not exists subtipo text,                                       -- efemeride | trending | beneficio | disruptivo
  add column if not exists idea text;                                          -- tema/idea (texto libre)
