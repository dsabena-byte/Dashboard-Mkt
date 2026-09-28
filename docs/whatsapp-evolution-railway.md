# WhatsApp por Evolution API (self-host en Railway) — runbook

> Gateway de WhatsApp **propio** (open source, sin alta en terceros, sin costo por mensaje) para
> mandar reportes/alertas desde los crons de Drean (y a futuro BIP). Verificado contra
> `EvolutionAPI/evolution-api` **v2.3.7** (sep-2026).

## Por qué esto y no un gateway pago
WhatsApp necesita una **sesión conectada 24/7** a un número (como WhatsApp Web). Los crons de
GitHub son efímeros → no la sostienen. Evolution corre en un server persistente (Railway ~US$5/mes),
mantiene la sesión, y expone una **REST API** que los crons llaman con un `fetch`. Es tuyo: sin
cuenta de gateway, sin paywall.

## Prerequisito
Un **número de WhatsApp DEDICADO** (chip/SIM extra o número de empresa), NO el personal — se
empareja escaneando un QR una vez, y hay riesgo de ban por uso automatizado.

## Estado (28-sep-2026) — gateway DEPLOYADO + código de Drean listo; falta emparejar número
- **Evolution v2.3.7 corriendo** en Railway (proyecto `reasonable-perception`, cuenta de BIP):
  URL pública **`https://evolution-api-production-6d60.up.railway.app`** (responde el JSON de
  bienvenida). Postgres conectado, variables cargadas.
- **API key global** (`AUTHENTICATION_API_KEY`): está en las Variables de Railway del servicio
  `evolution-api` (NO se commitea acá por seguridad).
- **Instancia `drean-cron`** creada (Channel Baileys), estado **Disconnected**.
- **PENDIENTE:** conseguir el **número dedicado** (chip aparte, NO el personal) → en el Manager
  (`/manager`, login con Server URL + API key global) abrir `drean-cron` → **Connect** → escanear
  el QR con WhatsApp → Dispositivos vinculados. Queda en "open" y ya envía.
- **CÓDIGO EN DREAN LISTO (28-sep-2026, rama `claude/drean-alertas-whatsapp`) — fail-safe hasta
  vincular el número.** No hay cron nuevo: los crons existentes `/api/cron/alertas` y
  `/api/cron/reporte-ejecutivo` (workflow `alertas.yml`) mandan también por WhatsApp si está prendido
  en `/alerts` y la instancia está `open`. Si no está `open` → no envía, deja latido en `alert_log`
  (canal `whatsapp`, estado `desconectado` / `sin_config`) y el cron sigue OK (email intacto).
  - `lib/whatsapp.ts` (server): `sendWhatsAppText`, `sendWhatsAppMany`, `whatsappStatus` (timeouts
    15 s, nunca tira), latido `logWhatsappHeartbeat` / `lastWhatsappHeartbeat`.
  - `lib/whatsapp-shared.ts` (puro, test `scripts/whatsapp.test.ts`): normalización de celulares AR
    (`11 1234-5678` / `011 15 …` / `+54 11 …` → `5491112345678`) y mensajes (≤1500 caracteres,
    `*negrita*`, 3–5 alertas con "Qué hacer" + link; reporte = Salud de Marca, objetivos, KPIs con
    brecha, share of search, 3 alertas).
  - `/alerts`: toggle WhatsApp + celulares (se guardan en `alert_prefs`), estado Conectado /
    Desconectado, "Enviar prueba por WhatsApp" (`/api/alertas/whatsapp-test`, GET = estado, POST =
    prueba; mismo permiso que editar las preferencias). `/monitoreo`: franja con el último latido.
  - Migración **`0123_alertas_whatsapp.sql`** (`alert_prefs.whatsapp_on`, `whatsapp_destinatarios`,
    `alert_log.estado`). Sin ella: email igual, WhatsApp apagado y la UI avisa.
  - Frecuencia = la misma del email (semanal lunes / diaria solo si hay algo nuevo de prioridad
    alta); dedupe propio (canal `whatsapp` en `alert_log`); reporte 1 vez por mes por canal. `?dry=1`
    no envía ni escribe (devuelve el texto en `whatsapp.preview`).
  - **Env vars en Vercel (proyecto Dashboard-Mkt):** `EVO_URL`
    (`https://evolution-api-production-6d60.up.railway.app`), `EVO_API_KEY` (= `AUTHENTICATION_API_KEY`
    de Railway), `EVO_INSTANCE` (opcional, default `drean-cron`). Los destinatarios NO van por env:
    se cargan en `/alerts` (reemplaza la idea vieja de `WA_RECIPIENTS`).
- **Para activarlo:** (1) número dedicado + QR (arriba); (2) env vars en Vercel + redeploy; (3) correr
  0123 en el SQL Editor; (4) `/alerts` → prender WhatsApp, cargar celulares, Guardar → "Enviar prueba".
- **OJO tag de imagen:** es **`evoapicloud/evolution-api:v2.3.7`** (con la `v`; `2.3.7` sin v no
  existe en el registry).

## Deploy en Railway
1. **New Project** → **Add → Database → PostgreSQL** (obligatorio; guarda la sesión/creds para que
   sobreviva a redeploys). Redis NO hace falta (lo desactivamos por env).
2. **Add → Service → Docker Image:** `evoapicloud/evolution-api:v2.3.7` (con la `v`; pineá la versión, no `latest`).
   (OJO: NO usar `atendai/evolution-api`, es la v1 vieja.)
3. **Variables** del servicio (Settings → Variables). Cargar:
   ```
   AUTHENTICATION_API_KEY=<genera una clave fuerte, ej 32 hex al azar>
   SERVER_PORT=8080
   DATABASE_PROVIDER=postgresql
   DATABASE_CONNECTION_URI=${{Postgres.DATABASE_URL}}?schema=evolution_api
   CACHE_REDIS_ENABLED=false
   CACHE_LOCAL_ENABLED=true
   DATABASE_SAVE_DATA_INSTANCE=true
   DEL_INSTANCE=false
   LOG_LEVEL=ERROR,WARN,INFO
   CONFIG_SESSION_PHONE_CLIENT=Evolution API
   CONFIG_SESSION_PHONE_NAME=Chrome
   WEBHOOK_GLOBAL_ENABLED=false
   TELEMETRY_ENABLED=false
   ```
   (`${{Postgres.DATABASE_URL}}` es una *referencia* de Railway al plugin de Postgres; si el plugin
   se llama distinto, ajustá el nombre. El `?schema=evolution_api` lo pide Prisma.)
4. **Settings → Networking → Generate Domain**, target port **8080**. Copiá la URL pública
   (`https://xxx.up.railway.app`).
5. Agregá la env var que faltaba con esa URL y **redeploy**:
   ```
   SERVER_URL=https://xxx.up.railway.app
   ```
6. Verificá que arranque: abrí `https://xxx.up.railway.app` (debería responder algo, no error).

## Crear la instancia y emparejar el número
Header de auth: **`apikey`** con tu `AUTHENTICATION_API_KEY`.

1. Crear instancia:
   ```bash
   curl -X POST 'https://xxx.up.railway.app/instance/create' \
     -H 'apikey: TU_API_KEY' -H 'Content-Type: application/json' \
     -d '{"instanceName":"drean-cron","integration":"WHATSAPP-BAILEYS","qrcode":true}'
   ```
   La respuesta trae el **QR en base64** (`data:image/png;base64,...`) + un `code` de pairing.
2. Escanear: renderizá ese base64 como imagen y escaneá con el WhatsApp del **número dedicado**
   (WhatsApp → Dispositivos vinculados). Alternativa: usar el **Manager UI** (`/manager`) que muestra
   el QR. Re-obtener QR: `GET /instance/connect/drean-cron` (¡es GET!).
3. Estado: `GET /instance/connectionState/drean-cron` → tiene que decir `state: "open"`.

## Enviar un mensaje (lo que hace el cron)
```
POST https://xxx.up.railway.app/message/sendText/drean-cron
Header: apikey: TU_API_KEY
Body JSON: { "number": "54911XXXXXXXX", "text": "..." }
```
- `number` = dígitos, con código país, **sin `+` ni `@c.us`**.
- Éxito = **HTTP 201**.
- Opcionales: `delay` (throttle), `linkPreview`.

## Cron de Drean (construido, sep-2026)
Reusa `alertas.yml` → `/api/cron/alertas` + `/api/cron/reporte-ejecutivo` (ver "Estado"). El body que
manda `sendWhatsAppText` es `{ number, text, delay: 1200, linkPreview: false }`. Env vars SOLO en
Vercel: `EVO_URL`, `EVO_API_KEY`, `EVO_INSTANCE`. Probar sin enviar: Actions → "Alertas y reporte
ejecutivo" → Run workflow con `dry=1` (la respuesta trae `whatsapp.estado` y el texto en `preview`).

## Gotchas (verificados)
- **NO existe `DATABASE_ENABLED` en v2** (eso era v1); la DB se configura solo con
  `DATABASE_PROVIDER` + `DATABASE_CONNECTION_URI`.
- `CACHE_REDIS_ENABLED` viene **`true` por default** → si no ponés Redis, hay que setearlo `false`
  o el boot falla (error #1 de primer deploy).
- `SERVER_URL` mal/vacío rompe QR y media (error #2). Setearlo con el dominio real y redeploy.
- El contenedor debe estar **siempre prendido** (no sleep/scale-to-zero) o la sesión se cae.
- Prisma necesita `?schema=` en la URI de Postgres.
- Pinear versión (`2.3.7`), no `latest` (la v2 tuvo cambios breaking).
- **Ban risk:** número dedicado, warm-up, sin spam, throttle con `delay`.

Fuentes: repo EvolutionAPI/evolution-api (.env.example, docker-compose, env.config.ts,
instance.router.ts, Dockerfile), Postman v2.
