# Agente de monitoreo de datos (Drean) — instrucciones

Objetivo: que los tableros estén SIEMPRE actualizados sin que el usuario tenga que enterarse. El agente corre 2 veces por día
(tarea programada «Monitoreo Drean · corrige el watchdog») y sigue este archivo; para cambiar su comportamiento, editá esto.

## Cómo está armado
1. **Detecta y diagnostica:** `watchdog.yml` (cada 6 h) → `.github/scripts/watchdog.sh`:
   - runs fallados de TODOS los workflows programados, con la causa leída del log (timeout / temporal / saldo / credencial / desconocido);
   - datos sin actualizar (`/api/cron/health`: atrasado o crítico, margen ≤ 48 h sobre la cadencia), incluidos los runs «verdes» que
     no trajeron datos.
2. **Corrige lo seguro solo:** reintenta syncs gratuitos (hasta 3 intentos), relanza `seo-sync` (reanuda: no recompra lo guardado),
   relanza un sync gratuito que terminó OK sin traer datos (1 vez cada 20 h).
3. **Escala al agente** lo que necesita código o una persona: sección «Necesita corrección» del Issue
   «🔴 Watchdog: procesos de datos con desvío» (etiqueta `watchdog-agente`).

## Qué hace el agente en cada corrida
Trabajá solo por GitHub (este entorno no llega a Vercel ni a Supabase). Si el repo no está clonado, sumalo con la tool `add_repo`
(owner `dsabena-byte`, repo `Dashboard-Mkt`, access `push`) y clonalo.

1. Leé el Issue abierto del watchdog (`gh issue view <n> --comments`) y quedate con el ÚLTIMO comentario. Sin Issue abierto → terminá.
2. Por cada ítem de «Necesita corrección»:
   - Mirá el log completo (`gh run view <id> --log-failed`), la ruta del cron (`apps/web/src/app/api/cron/<x>/route.ts`) y el workflow.
     Diagnóstico con evidencia; sin evidencia, decilo en el log (no inventar).
   - **timeout / bug / «corre OK pero no trae datos»** → arreglá la causa (rama `claude/fix-monitoreo-<slug>`, cambio chico; antes de
     pushear `cd apps/web && pnpm install && pnpm exec tsc --noEmit`), PR + merge (squash). Después relanzá el workflow
     (`gh workflow run <wf>.yml`) y verificá que el run nuevo termine en `success`.
   - **Workflows pagos** (`seo-sync`, `trends-sync`, `llmo-sync`, `ad-library`, `competencia-social`): relanzarlos vuelve a comprar.
     Relanzalos solo DESPUÉS de corregir la causa y como máximo 1 vez por día; `seo-sync` reanuda; los otros, solo si el workflow tiene
     un parámetro para limitar a lo que falta; si no, que lo tome la próxima corrida programada.
   - **saldo** (DataForSEO / Apify / OpenAI) o **credencial vencida** → no se arregla con código: comentá en el Issue qué cargar o
     renovar y dónde.
   - **Apps Script / carga manual** (sin workflow) → comentá en el Issue la acción humana exacta.
   - Nunca: borrar datos, desactivar un workflow, saltear un test, relanzar en loop, exponer secretos.
3. Registrá cada acción en `docs/monitoreo-fix-log.md` (fecha UTC, proceso, causa, evidencia, acción: PR #N / run #N / pendiente
   humano) y comentá el resumen en el Issue. El log solo puede ir directo a `main`.
