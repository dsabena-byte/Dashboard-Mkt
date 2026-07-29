-- =============================================================================
-- UGC: controles de casting del video nativo. Permiten elegir el rango de edad
-- y el estilo de ropa de la persona generada por Seedance (antes fijos en
-- "early 30s" y sin control de vestimenta). Se guardan por pieza en el
-- calendario UGC (canal='ugc').
-- =============================================================================

alter table contenido_calendario
  add column if not exists edad text,        -- ugc: joven | adulto | mayor (o texto libre)
  add column if not exists vestimenta text;  -- ugc: informal | camisa | prolijo | deportivo | trabajo (o texto libre)

comment on column contenido_calendario.edad is
  'ugc: rango de edad de la persona del video (joven ~25 | adulto ~40 | mayor ~60, o texto libre). Se mapea a prompt en ugc.ts.';
comment on column contenido_calendario.vestimenta is
  'ugc: estilo de ropa de la persona del video (informal | camisa | prolijo | deportivo | trabajo, o texto libre). Se mapea a prompt en ugc.ts.';
