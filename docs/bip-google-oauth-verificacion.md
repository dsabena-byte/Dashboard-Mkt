# BIP · Verificación OAuth de Google — diagnóstico DEFINITIVO (14-sep-2026)

> Fuente de verdad: el **mail exacto de Google Trust & Safety** (pegado por el user) + validación
> contra el **código real** de `bip-platform`. Reemplaza análisis previos. Objetivo: resolver **de
> una, sin iterar**. App: **BIP** (proyecto Google Cloud **279230041069**), agencia **ROQUÉ**.

## ⚠️ Correcciones a errores propios previos (para no repetirlos)
- La **política de privacidad SÍ EXISTE** (`bip-go.com/privacy`, `privacy.html` del `bip-site.zip`,
  con cláusulas Google Limited Use + borrado). Antes afirmé que no existía **porque busqué solo en los
  repos** y los legales viven en el sitio comercial (Netlify), no en el código. Falta **agregarle** una
  sección, no crearla.
- El **dominio/homepage/branding YA PASARON** en verde. El tema `nango.dev`/self-host **NO es el
  blocker** de esta verificación.

## 📧 Lo que pide Google (mail literal) — 3 scopes en revisión
Scopes solicitados en la consent screen:
1. `https://www.googleapis.com/auth/analytics.readonly` (GA4, sensible)
2. `https://www.googleapis.com/auth/spreadsheets.readonly` (Google Sheets, sensible)
3. `https://www.googleapis.com/auth/adwords` (Google Ads, sensible)

Items a resolver (del mail):
- **A) In-App Functionality:** demostrar la **funcionalidad completa de CADA scope** solicitado.
  (Google aclara: "si tu app es una plataforma de integración con permisos granulares bajo un modelo
  de mínimo privilegio, avisanos" → **hay que decirle que BIP es eso**.)
- **B) Test credentials + pasos:** dar una **cuenta de prueba SIN bloqueos** (sin verificación de
  teléfono ni tarjeta) y **instrucciones paso a paso** para llegar al flujo de consentimiento OAuth.
- **C) Política de privacidad:** *"no especifica ningún mecanismo de protección de datos sensibles"*
  → agregar **disclosures de protección de datos**.
- **D) Permisos mínimos (CONCRETO):** para **`spreadsheets.readonly`** Google recomienda cambiarlo por
  **`https://www.googleapis.com/auth/drive.file`** (más angosto). Opción 1: agregar el scope
  recomendado + "save & submit" + responder *"Confirming narrower scopes"* (sin llamarlo hasta que
  aprueben). Opción 2: responder *"Unable to use narrower scopes"* + justificación.
- **OJO del mail:** NO borrar scopes ya aprobados; NO llamar a los scopes recomendados hasta que la
  verificación termine (si no, sale el "unverified app screen").
- Además, en la lista de requisitos aparece **"AI/ML Model Training Privacy Policy Disclosure for
  Workspace APIs"**: como se usa **Sheets (Workspace API)** y **OpenAI**, la política **debe declarar
  que los datos de Workspace NO se usan para entrenar modelos de IA/ML**.
- **Reenviar** en Cloud Console con la política actualizada, y **responder el mail** con: (1) link al
  video, (2) cómo testear el consentimiento OAuth, (3) opción de scopes.

## 🔎 VALIDACIÓN CONTRA EL CÓDIGO (bip-platform) — qué scope se usa de verdad
- **`analytics.readonly` (GA4): USADO.** `lib/ga4-monthly.ts`, `lib/ga4-reports.ts`,
  `app/api/cron/sync-web`. Demostrable en el dashboard `/web`.
- **`spreadsheets.readonly` (Google Sheets): NO se usa en la plataforma.** Lo que parece "Sheets" es
  **SharePoint/Excel** (`lib/ms-graph.ts`) y el parser **`xlsx`** de archivos subidos
  (`app/api/datasets`) — **no la API de Google Sheets**. El uso de Sheets fue en la *prueba* original
  (`bip-app.zip`), no en la plataforma.
- **`adwords` (Google Ads): NO se usa.** Cero llamadas a la API de Google Ads en el código.
- ⇒ **Solo GA4 es demostrable hoy.** Por eso Google marca "no usa los permisos mínimos" y "demostrá
  cada scope": **está pidiendo Sheets y Ads que la app no ejercita**.

## ✅ PLAN DEFINITIVO — Opción A (recomendada: rápida y sin iterar)
**Reducir la consent screen a lo que la app REALMENTE usa hoy: `analytics.readonly`** (+ `openid`,
`email`, `profile`). Así **cada scope solicitado es demostrable** → cierra A y D de una.
1. **Cloud Console → OAuth consent screen:** dejar **solo `analytics.readonly`** (sacar
   `spreadsheets.readonly` y `adwords` del pedido, que aún no se usan). "Save & submit".
2. **Política de privacidad** (`bip-go.com/privacy`, editar `privacy.html`): agregar
   - **Sección "Protección de datos sensibles / Seguridad":** cifrado **en tránsito (TLS)** y **en
     reposo**; **tokens OAuth cifrados y revocables** (Nango); **control de acceso por roles**;
     **aislamiento por cliente (RLS multi-tenant en Supabase)**; acceso restringido al personal;
     **retención limitada + borrado a pedido / al desconectar**.
   - **Disclosure AI/ML:** los datos obtenidos vía APIs de Google **no se usan para entrenar ni
     mejorar modelos de IA/ML** (aclarar que NO se envían a OpenAI para entrenamiento).
   - (Mantener las cláusulas Limited Use + qué datos se acceden/usan/guardan/comparten/borran, que ya
     tiene.) **Reenviar** la app en Console con el link actualizado.
3. **Video demo (YouTube no listado):** mostrar (a) la URL/dominio de BIP, (b) "Conectar Google" → el
   **consent screen** con el scope, (c) el dashboard **`/web` con la data real de GA4**. Solo cubre GA4
   (que es el único scope que queda). Linkearlo en la respuesta al mail.
4. **Test credentials + pasos (responder el mail):** crear una **cuenta de prueba en BIP sin bloqueos**
   (sin teléfono/tarjeta), idealmente con la conexión Google ya hecha o lista para hacer, + pasos:
   "Ingresá en bip-platform… → Conexiones → Conectar Google → autorizá → ver `/web`". Aclarar que **BIP
   es una plataforma de integración: cada cliente conecta SU propia cuenta de Google bajo mínimo
   privilegio (solo lectura de GA4)** ← esto es lo que Google pide que informemos.
5. **Responder el mail** con: link del video + instrucciones de test + (para el scope) como sacamos
   Sheets/Ads, decir que **"only analytics.readonly is required for current functionality"**.

### Opción B (si se QUIERE Sheets y/o Ads ya)
Hay que **construir** primero esas funciones para poder demostrarlas: (Ads) un dashboard que llame a la
Google Ads API; (Sheets) leer planillas del cliente **con `drive.file` + Google Picker** (el scope
recomendado por Google) en vez de `spreadsheets.readonly`. Más trabajo y más riesgo de iterar → **no
recomendado ahora**. Se suma después con una nueva verificación.

## Estado por requisito (tras validar)
| Requisito | Estado |
|---|---|
| App Homepage / Domain / Branding | ✅ Verde (hecho) |
| Privacy policy | 🟠 Existe, falta sección protección + AI/ML disclosure |
| Demo Video | 🔴 Insuficiente → regrabar (GA4) |
| In-app Testing (test creds) | 🔴 Falta dar cuenta + pasos por mail |
| Minimum scopes | 🔴 Reducir a `analytics.readonly` (Opción A) |
| CASA (restricted) | N/A (los scopes son sensibles, no restringidos) |

## Artefactos previos que YA existen (leer antes de rehacer nada)
- `bip-site.zip` → `privacy.html` + `terms.html` (Limited Use + borrado) — **editar, no recrear**.
- `docs/meta-app-review-guion.md` — guion de video para **Meta** (reusable como base para el de Google).
- `bip-platform/infra/nango-railway/` (RUNBOOK + docker-compose + .env.example) — self-host, **no
  necesario para esta verificación**.
- `docs/bip-platform-handoff.md` §"Progreso de setup" y §"Sacar el cartel" — contexto OAuth/Nango.
