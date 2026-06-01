-- 0037: Limpieza de planning_media + trigger de normalización de rol
--
-- Contexto del bug (junio 2026):
-- 1. La fila "Plan ON+OFF 2026" del Sheet de OMD se importó como una fila
--    regular más, duplicando los totales mensuales (~$400M en Aug-Oct).
-- 2. El rename Build→Awareness / Consider→Consideración del 0035 funcionó,
--    pero después N8n volvió a sincronizar desde el Sheet con los nombres
--    viejos. Como el UNIQUE constraint incluye `rol`, no detectó la
--    duplicación y quedaron 2 filas (una con rol viejo, una con rol nuevo)
--    para el mismo (fecha, campania, sistema, formato, tipo).
--
-- Solución:
-- A. Borrar las filas "Plan ON+OFF 2026" (son totales del Sheet).
-- B. Deduplicar Build/Consider que ya tienen su contraparte Awareness/Consideración.
-- C. Renombrar las huérfanas (rol viejo sin contraparte renombrada).
-- D. Instalar trigger que normalice rol en INSERT/UPDATE para evitar recurrencia.

-- A. Borrar totales del Sheet
delete from planning_media
where campania = 'Plan ON+OFF 2026';

-- B. Deduplicar Build → Awareness y Consider → Consideración
delete from planning_media a
using planning_media b
where a.rol = 'Build' and b.rol = 'Awareness'
  and a.fecha = b.fecha
  and coalesce(a.campania,'') = coalesce(b.campania,'')
  and coalesce(a.sistema,'')  = coalesce(b.sistema,'')
  and coalesce(a.formato,'')  = coalesce(b.formato,'')
  and a.tipo = b.tipo;

delete from planning_media a
using planning_media b
where a.rol = 'Consider' and b.rol = 'Consideración'
  and a.fecha = b.fecha
  and coalesce(a.campania,'') = coalesce(b.campania,'')
  and coalesce(a.sistema,'')  = coalesce(b.sistema,'')
  and coalesce(a.formato,'')  = coalesce(b.formato,'')
  and a.tipo = b.tipo;

-- C. Renombrar huérfanas
update planning_media set rol = 'Awareness'     where rol = 'Build';
update planning_media set rol = 'Consideración' where rol = 'Consider';

-- D. Trigger de normalización (idempotente)
create or replace function normalize_planning_rol() returns trigger as $$
begin
  if new.rol = 'Build'    then new.rol := 'Awareness';     end if;
  if new.rol = 'Consider' then new.rol := 'Consideración'; end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_normalize_planning_rol on planning_media;
create trigger trg_normalize_planning_rol
  before insert or update on planning_media
  for each row execute function normalize_planning_rol();
