---
name: safe-changes
description: >-
  Disciplina para cualquier acción IRREVERSIBLE o difícil de revertir, en cualquier proyecto o
  repositorio: borrar o pisar datos/archivos, escrituras/migraciones en una base de datos, ediciones
  masivas, deploys, force-push / reescritura de historia git, o enviar/publicar a un servicio
  externo. Usala SIEMPRE antes de ejecutar algo de eso. Fuerza: hacer un snapshot/backup primero,
  MOSTRAR el plan exacto (qué se toca, qué queda) para aprobación ANTES de ejecutar, usar el método
  menos destructivo posible, y verificar el resultado después. Nació de un borrado que destruyó datos
  sin backup.
---

# Cambios seguros — antes de tocar algo irreversible

Un borrado sin red de seguridad ya destruyó datos. La regla que evita repetirlo:
**backup → mostrar el plan y esperar OK → ejecutar con el método menos destructivo → verificar.**

## Cuándo aplica
Cualquier operación que no se pueda deshacer con un simple undo:
- **Base de datos:** DELETE/UPDATE/UPSERT, migraciones, `clean-replace`, truncates.
- **Archivos:** borrar, sobrescribir, mover en lote, regenerar assets versionados.
- **Git:** `push --force`, rebase/amend sobre ramas compartidas, reset --hard.
- **Deploy / release:** publicar, mergear a la rama que deploya, tags.
- **Externo:** mandar mails, publicar en redes, llamar a una API que muta estado.

## El procedimiento (en orden)
1. **Leé el estado actual** de lo que vas a tocar y **guardá un snapshot/backup** que permita
   restaurar (filas SELECT + guardadas, `git stash`/branch, copia del archivo, export). Para un
   DELETE en DB, usá `return=representation` y **guardá las filas devueltas antes de insertar**.
2. **Mostrá el plan exacto y esperá aprobación** antes de escribir: qué filas/archivos/recursos se
   tocan, con qué valores, y **qué totales/estado quedan**. Esto no es opcional cuando el usuario
   trabaja con datos que le importan. Regla del usuario: *"pasame la tabla antes de ejecutar"*.
3. **Elegí el método menos destructivo:** preferí `PATCH`/upsert por clave a delete+insert; editar
   in-place a regenerar; un merge-commit a un force-push; acotar el scope (WHERE por mes/id) a un
   borrado amplio.
4. **Verificá después:** volvé a leer el estado y confirmá filas/totales/resultado contra lo
   esperado. Reportá el resultado final; si algo no cuadra, decilo y restaurá del backup.

## Anti-patrones
- Borrar y después insertar sin haber guardado lo borrado (si el insert falla, perdiste el dato).
- Ejecutar una escritura sin haberle mostrado al usuario qué va a cambiar.
- Force-push o reescribir historia en una rama que otros usan.
- "Confío en que sale bien" en algo que no se puede deshacer. Si no lo podés revertir, tratalo con
  el máximo cuidado y confirmá antes.

## Nota
Para el detalle específico de escrituras a Supabase en proyectos que lo usen (claves compuestas,
snippet REST), seguí el runbook del proyecto si existe. Esta skill es el principio general,
independiente del stack.
