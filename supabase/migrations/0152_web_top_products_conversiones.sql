-- web_top_products_monthly ya existía en prod (creada a mano el 16-nov-2026, sin código que la usara) sin la
-- columna conversiones: 0151 no la recreó (if not exists). La suma para que el cron y el lector coincidan.
alter table web_top_products_monthly add column if not exists conversiones bigint not null default 0;
