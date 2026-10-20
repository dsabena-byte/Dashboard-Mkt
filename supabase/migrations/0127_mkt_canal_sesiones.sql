-- Mkt Canal: sesiones del sitio del retailer (para la tasa de conversión = conversiones ÷ sesiones).
-- Idempotente. Sin esta columna el guardado sigue andando y descarta las sesiones (aviso en la UI).
alter table mkt_canal_acciones add column if not exists sesiones bigint;
comment on column mkt_canal_acciones.sesiones is 'Sesiones que reporta el retailer (Session / Sesiones); null = no informado.';
