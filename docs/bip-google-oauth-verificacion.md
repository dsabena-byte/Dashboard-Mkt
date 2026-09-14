# BIP · Verificación OAuth de Google — diagnóstico DEFINITIVO (14-sep-2026)

## ✅ DECISIÓN + PLAN EN EJECUCIÓN: RONDA 1 = GA4 + Drive (el user confirmó)
> Verificar la app con **2 scopes demostrables hoy**: `analytics.readonly` (GA4) + `drive.file`
> (Google Sheet por Picker, reemplaza `spreadsheets.readonly`). **`adwords` → Ronda 2** (con cuenta de
> prueba de Google Ads; producción/Explorer se destraba al verificar la app). Código de todo YA hecho.
> Privacy PUBLICADA en bip-go.com/privacy. Brand verification HECHA. Estas 3 cosas NO se re-piden.
>
> **Pasos (todos config del user; el código está listo):**
> - **Fase 1 — Picker:** Cloud Console (BIP-GO) → APIs y servicios → Biblioteca → habilitar **"Google
>   Picker API"**; Credenciales → **Clave de API** → Vercel `bip-platform`: `NEXT_PUBLIC_GOOGLE_API_KEY`
>   + `NEXT_PUBLIC_GOOGLE_APP_ID=279230041069` → Redeploy.
> - **Fase 2 — Scopes:** Google Auth Platform → Acceso a los datos: agregar `drive.file`, dejar
>   `analytics.readonly`, **sacar** `spreadsheets.readonly` y `adwords`. Mismo set en la integración de Nango.
> - **Fase 3 — Reconectar:** en BIP (bip.explore) Conexiones → Desconectar + Conectar Google (pasar el
>   aviso "app no verificada" → Avanzado → Continuar) → el token ya trae `drive.file`.
> - **Fase 4 — Probar/grabar:** `/web` (GA4) + tablero → "Conectar Google Sheet" (Picker) → tablero.
> - **Fase 5 — Cuenta de prueba + video + responder el hilo de T&S + reenviar** (guión y texto de
>   respuesta ya entregados en el chat; scopes = solo analytics.readonly + drive.file).
> **Estado:** esperando que el user haga Fases 1-3; después validamos 4-5.


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

### ⚠️ SECUENCIA CORRECTA del acceso a Google Ads (corregido 14-sep — NO re-litigar)
- El **nivel de acceso de la Ads API para BIP-GO (proyecto 279230041069) es "Prueba" (Test)** y la
  solicitud de **"Explorer" (producción) fue DENEGADA AUTOMÁTICAMENTE**. **Esto es ESPERADO, no un
  problema aparte.** Google otorga el acceso a producción **DESPUÉS** de que la app pase la
  **verificación OAuth / brand verification** del proyecto de Cloud. El proyecto que ya pasó **brand
  verification** habilita/acelera el Explorer (a veces en horas).
- ⇒ **El camino es terminar la verificación OAuth** (esto = Opción B: política + scopes + video + test
  creds + responder T&S). Cuando la app quede verificada, se re-solicita/otorga Explorer y Ads
  producción queda habilitado. **NO hay que "tramitar el developer token" aparte** (además Google movió
  el acceso a los proyectos de Cloud el 10-sep y el developer token es opcional). El código ya está
  listo (token opcional / `GOOGLE_ADS_ENABLED`).
- **Mientras tanto, con Test access** se puede demostrar el scope `adwords` en el video usando una
  **cuenta de prueba de Google Ads** (el nivel Test lo permite).

#### 📍 ESTADO REAL en Google (validado con capturas 14-sep — NO re-chequear estas dos)
- ✅ **Brand verification: HECHA.** Google Auth Platform → *Información de la marca* muestra
  **"✓ Se verificó la información de tu marca y se muestra a los usuarios."** Homepage `bip-go.com`,
  privacy `bip-go.com/privacy`, terms `bip-go.com/terms`, **dominio autorizado `bip-go.com`**, contacto
  `bip.explore@gmail.com`. **No hay nada que hacer acá.**
- 🟠 **Verificación de la app de OAuth (scopes / Trust & Safety): EN PROCESO** (Auth Platform →
  Descripción general: "⚠️ Tu app está en proceso de verificación"). Esta es la ÚNICA pata pendiente.
- 🔴 **Ads Explorer (producción): denegado AUTOMÁTICO — esperado.** Se otorga **después** de que la app
  quede verificada. Como la brand verification ya está, **el único gate es que termine la verificación
  de la app** (los scopes).

**Estado de los entregables (14-sep):**
- ✅ **Política de privacidad PUBLICADA** en `bip-go.com/privacy` (con protección de datos + no-IA-training)
  y `bip-go.com/terms`. **NO falta publicar nada.**
- ✅ Brand verification hecha; app en verificación (scopes/T&S en proceso).

### ⚠️ CHICKEN-AND-EGG (el punto real, 14-sep): no se puede demostrar Ads ni Sheets todavía
El user marcó: *"todavía no puedo mostrar cómo funciona Google Ads y Sheets."* Motivo:
- **Ads:** producción (Explorer) denegada hasta que la app se verifique; solo hay **Test access**.
- **Sheets `drive.file`:** falta la API key del Picker en la consent + el scope; el demo necesita ese setup.
- **GA4 `analytics.readonly`:** SÍ se puede demostrar hoy (anda en `/web`).

**RECOMENDACIÓN ASERTIVA — verificar por rondas:**
- **Ronda 1 (ahora, desbloquea BIP):** reducir la consent screen a **`analytics.readonly`** (lo único
  demostrable hoy) → grabar video GA4 + test creds + responder T&S → la app se **verifica** para el core.
  Ninguno de los scopes está aprobado aún, así que reducir el pedido es válido (y es justo lo que pide
  "permisos mínimos"). El código de Ads/Sheets YA está construido, no se pierde.
- **Ronda 2 (después):** agregar `adwords` (demostrable con **cuenta de PRUEBA de Google Ads**, que el
  nivel Test permite) y `drive.file` (Picker + API key) → segunda verificación. Cuando la app quede
  verificada, además se destraba **Explorer** (Ads producción).
**NO volver a mandar al user a revisar brand verification/dominios/privacy — YA ESTÁN.**

### 🔧 EJECUCIÓN Opción B — estado detallado (14-sep)
**Prerrequisitos EXTERNOS (los hace el user):**
- **Scopes en Nango + consent screen:** en la integración Google de Nango sumar `drive.file` (y, para
  el Picker, mantener el flujo). En la consent screen de Google Cloud: agregar `drive.file`; **dejar**
  `analytics.readonly` + `adwords`; sobre `spreadsheets.readonly` responder al mail (Opción 1
  "Confirming narrower scopes" usando `drive.file`). **No** borrar scopes aprobados; **no** llamar a
  `drive.file` en prod hasta que aprueben (Google lo pide).
- **Google Picker API + API key de navegador:** habilitar "Google Picker API" en el proyecto; crear
  una **API key** restringida por dominio → `NEXT_PUBLIC_GOOGLE_API_KEY`. App id = **279230041069**
  (project number) → `NEXT_PUBLIC_GOOGLE_APP_ID`.

**Lo que construyó Claude (código) — HECHO 14-sep, en `main`:**
- **Sheets vía Picker → dataset** ✅: `components/google-sheet-picker.tsx` (abre el Google Picker con el
  token del cliente; scope `drive.file` → solo el archivo elegido) + `/api/connect/google/token`
  (devuelve el access token para el Picker, owner/admin) + `/api/datasets/google-sheet` (lee el Sheet
  con `getToken` vía Sheets API y lo guarda como `tenant_datasets`, `source:"google_sheet"`). Botón
  **"Conectar Google Sheet"** en el builder, al lado de "Subir". El dataset alimenta los tableros.
- **Google Ads → /performance** ✅ (scaffold funcional, gate por `GOOGLE_ADS_DEVELOPER_TOKEN`):
  `lib/google-ads.ts` (`listAccessibleCustomers` + GAQL `campaign` con `getToken(tenant,"google")` +
  developer token; impresiones/clicks/costo/conversiones últimos 30 días) + sección **"Google Ads ·
  pauta"** (tabla) en `/performance`, best-effort (se muestra sola cuando hay token + cuenta). **Queda
  funcionando apenas exista el developer token** — no requiere más código.

**FALTA (del user) para que funcione y pase la verificación:**
1. **Google Ads developer token (Basic Access)** → Vercel `GOOGLE_ADS_DEVELOPER_TOKEN` (+ opcional
   `GOOGLE_ADS_LOGIN_CUSTOMER_ID` si es MCC). **Es el cuello largo — pedirlo YA.**
2. **Google Picker:** habilitar "Google Picker API" en el proyecto + crear **API key** de navegador
   (restringida a `bip-platform.vercel.app`) → Vercel `NEXT_PUBLIC_GOOGLE_API_KEY` y
   `NEXT_PUBLIC_GOOGLE_APP_ID=279230041069`.
3. **Scopes en Nango + consent screen:** sumar `drive.file` a la integración Google de Nango y a la
   consent screen; responder el mail (Opción 1 "Confirming narrower scopes" por `drive.file` en vez de
   `spreadsheets.readonly`). Mantener `analytics.readonly` + `adwords`. No llamar `drive.file` en prod
   hasta que aprueben.
4. **Video** (los 3 scopes) + **test creds sin bloqueos** + **responder el hilo de T&S**.

**Video (cubre los 3 scopes):** consent → `/web` (GA4) → conectar un Google Sheet vía Picker (drive.file)
→ `/performance` sección Google Ads. Test creds sin bloqueos + pasos, y responder el hilo de T&S.

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
