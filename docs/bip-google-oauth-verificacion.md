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

## ✅ PLAN DEFINITIVO — Opción B (ELEGIDA POR EL USER): DEMOSTRAR el uso de cada scope
> Decisión del user (14-sep): **NO se dropean scopes.** Ads y Sheets son necesarios para el producto
> (mostrar TODA la pauta de Google como Drean, y leer las planillas del cliente para CB / Floor Share).
> "No es pedir menos permisos, es mostrar cómo los voy a usar." Google verifica **funcionalidad**: hay
> que **construir/mostrar** cada scope funcionando con el token OAuth del cliente conectado.

**Requisito por scope (qué tiene que existir y verse en el video + test):**
1. **`analytics.readonly` (GA4):** YA funciona (`/web`). ✓ Mostrar el dashboard con data real del GA4
   conectado.
2. **`adwords` (Google Ads):** hay que **implementar la lectura de Google Ads con el token OAuth del
   cliente** (vía Nango) y mostrar la **pauta de Google** en `/performance` (portar la lógica de Drean
   `google_ads_creatives`, pero alimentada por el token del tenant, no por cron/service token).
   **Prerrequisito externo:** **Google Ads API developer token** (Basic Access) a nombre de ROQUÉ/BIP
   — es una aprobación aparte de Google Ads (MCC). Sin developer token no hay llamada a la Ads API.
3. **Sheets / Drive (CB + Floor Share):** el cliente **conecta y elige su planilla** de Drive y BIP la
   lee. **Recomendación fuerte (= lo que Google pидió):** usar **`drive.file` + Google Picker** en vez
   de `spreadsheets.readonly`. NO es "menos funcionalidad": `drive.file` permite leer **exactamente la
   planilla que el cliente elige** (que es el caso de uso real de CB/Floor Share); es más privado y es
   **el scope que Google va a aprobar**. `spreadsheets.readonly` (leer TODAS las planillas) es lo que
   rechazan por amplio. Implementar el Picker → el cliente tilda su sheet → BIP la ingiere como dataset.
   - En el mail: **Opción 1** (agregar `drive.file`, "save & submit", responder *"Confirming narrower
     scopes"*, NO llamarlo en prod hasta que lo aprueben). Si por algo `drive.file` no alcanzara,
     Opción 2 (*"Unable to use narrower scopes"* + justificación) — pero para CB/Floor Share drive.file
     alcanza.

**Además (para cualquier variante):**
- **Política de privacidad** (`bip-go.com/privacy`, editar `privacy.html`): agregar
  - **Sección "Protección de datos sensibles / Seguridad":** cifrado en tránsito (TLS) y en reposo;
    **tokens OAuth cifrados y revocables** (Nango); control de acceso por roles; **aislamiento por
    cliente (RLS multi-tenant Supabase)**; acceso restringido al personal; retención limitada + borrado
    a pedido / al desconectar.
  - **Disclosure AI/ML:** los datos de las APIs de Google (incl. Workspace/Sheets) **no se usan para
    entrenar ni mejorar modelos de IA/ML** (NO se envían a OpenAI para entrenamiento).
- **Video demo (YouTube no listado):** un recorrido que muestre, con la cuenta conectada, la
  funcionalidad de **los 3 scopes**: consent → `/web` (GA4) → `/performance` (Ads) → carga de planilla
  (Sheets/Drive). Debe verse la URL/dominio y el flujo OAuth completo.
- **Test credentials + pasos:** cuenta de prueba en BIP **sin bloqueos** (sin teléfono/tarjeta), con la
  conexión Google lista, + pasos claros. Aclarar que **BIP es una plataforma de integración de mínimo
  privilegio: cada cliente conecta SUS cuentas en solo lectura** (Google lo pide explícito).
- **Reenviar** en Console + **responder el mail** con: link del video, cómo testear el consentimiento,
  y la opción de scope elegida para Sheets.

### Orden sugerido (el user pidió "ir por parte")
1. **Política de privacidad** (rápido, desbloquea el item C; no depende de build). ← empezar acá.
2. **Sheets vía `drive.file` + Picker** en la plataforma (ingesta de la planilla del cliente).
3. **Google Ads** en la plataforma (requiere developer token — tramitarlo en paralelo).
4. **Video** cubriendo los 3 + **test creds** + responder el mail.

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
