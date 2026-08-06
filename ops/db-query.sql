-- Consulta de validación (solo lectura). Al pushear este archivo, corre el
-- workflow "DB inspect (read-only)" contra Supabase y deja el resultado en el log.

-- 0) Ping de conexión
select 'conexion ok' as estado, now() as ahora;

-- 1) meta_paid_creatives: filas por plataforma x mes + frescura
select plataforma, mes, count(*) as filas, max(fetched_at) as ultimo_fetch
from meta_paid_creatives
group by 1, 2
order by 1, 2;
