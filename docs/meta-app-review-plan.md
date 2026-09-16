# BIP · App Review de Meta — ANÁLISIS PROFUNDO + PLAN (dic-2026)

> Objetivo: verificar la app multi-tenant **"BIP Connector"** para Advanced Access de los
> permisos de **LECTURA** (orgánico + pauta), sin publicación. Análisis hecho leyendo TODO el
> código (`bip-platform`), los docs, y los requisitos oficiales de Meta. **No re-litigar sin leer esto.**
> Complementa (no reemplaza) `docs/meta-app-review-guion.md` (guion de video con las 12 justificaciones).

## ✅✅✅ APP REVIEW DE META ENVIADO (16-sep-2026)
Submit hecho con los **9 permisos de lectura** (Tanda A). Detalles del envío:
- **Video:** `https://youtu.be/js1IwBJIWfc` (YouTube no listado). Subtítulos EN = `bip-meta-review-en.srt`.
- **Cuenta de prueba para el revisor:** `bip.explore@gmail.com` (tenant con **Drean/Meta conectado** →
  dashboards poblados). Se le **seteó contraseña** en Mi cuenta → Contraseña (BIP entra por magic link;
  el revisor necesita email+password). **⚠️ CAMBIAR la contraseña después de que aprueben.** NO
  desconectar Drean/Meta ni tocar bip.explore hasta que termine la revisión (el revisor debe entrar).
- **Instagram — gotcha clave:** `instagram_manage_comments` NO aparecía en App Review hasta configurar
  el producto **"Instagram API con inicio de sesión de Facebook"** (NO la variante "Instagram Business
  Login", que usa otros nombres `instagram_business_*`). BIP accede a IG vía la Página de FB (FLB).
- **Data deletion:** URL de instrucciones = `https://bip-go.com/privacy` (se corrigió el placeholder
  `facebook.com`). Plataforma declarada: Website `bip-platform.vercel.app`. Login del revisor:
  `bip-platform.vercel.app/login`.
- **Tratamiento de datos:** processors declarados = Supabase, Vercel, Nango, OpenAI (GitHub NO — no
  accede a datos de Meta). Responsable = razón social legal de ROQUÉ. País = Argentina.
- **PENDIENTE en paralelo:** **Verificación de acceso (Tech Provider)** — el banner de App Review dice
  que el acceso avanzado la requiere para proveedores de tecnología (BIP lo es). Business Verification
  ya está ✅. Iniciar la Access Verification (Config app → Portfolio comercial → Verificación de acceso).
- **Tiempos:** ~2-7 días hábiles (2026 puede tardar más). Ronda 2 futura: `leads_retrieval`,
  `pages_manage_engagement`, `pages_manage_metadata` (necesitan features + demo).

## 0. Encuadre crítico: DOS apps de Meta
| | **"BIP Connector"** (bip-platform, multi-tenant) | "Dashboard-mkt" (legacy Drean) |
|---|---|---|
| App ID | **1413533137383885**, FLB `config_id 1349490046995897`, portfolio ROQUÉ | app aparte |
| Auth | OAuth self-serve por **Nango** (provider `facebook`), Facebook Login for Business | **system-user token** en env (`META_SYSTEM_USER_TOKEN`) |
| Qué hace | **SOLO LECTURA** (insights/analítica) — verificado: 0 llamadas de escritura a Graph | LECTURA **+ PUBLICACIÓN** orgánica (`lib/meta-publish.ts`, feature `/contenido`) |
| Este review | **SÍ, es esta** | NO (no se toca) |

**La publicación (`pages_manage_posts`, `instagram_content_publish`) vive SOLO en la app legacy.**
"BIP Connector" no publica → la decisión "sin generador de contenido" ya está dada por diseño.
Graph API v22.0 en todo `bip-platform`.

## 1. Scopes mapeados al código real (qué se usa, dónde, para qué)
Todas las llamadas de "BIP Connector" son **GET (lectura)**. Fuentes: `lib/meta-assets.ts`,
`lib/meta-social.ts`, `lib/meta-pauta.ts` (+ diags). Mapeo permiso → uso real:

| Permiso | Uso real en el código | Dashboard | Núcleo "orgánico+pauta"? |
|---|---|---|---|
| `pages_show_list` | listar Páginas del usuario (`/me/accounts`, owned/client_pages) | Conexiones (selector) | **SÍ** |
| `pages_read_engagement` | posts FB + reactions/comments/shares count; page access token | Redes | **SÍ** |
| `read_insights` | insights de posts y Página (reach/impresiones/clicks/video) | Redes | **SÍ** |
| `instagram_basic` | cuenta IG (username, followers, media) | Redes | **SÍ** |
| `instagram_manage_insights` | insights por post IG + demografía de seguidores | Redes | **SÍ** |
| `ads_read` | insights de pauta (`/act_/insights`), campañas, creativos, VTR | Plan de Medios | **SÍ** |
| `business_management` | enumerar Páginas/IG/ad accounts por Business Manager | ambos | **SÍ** (habilitador) |
| `pages_read_user_content` | leer **texto** de posts/comentarios FB → **análisis de sentimiento (FB)** | (falta feature en UI) | **SÍ (VITAL, sentimiento)** |
| `instagram_manage_comments` | leer **texto** de comentarios IG → **análisis de sentimiento (IG)** | (falta feature en UI) | **SÍ (VITAL, sentimiento)** |

**Decisión del user (dic-2026):** el **análisis de sentimiento de comentarios** (IG + FB) es una
feature **vital** de BIP → los 2 permisos de comentarios **ENTRAN** en esta ronda. Set = **9 (Tanda A)**.

**⚠️ GAP verificado:** en bip-platform los comentarios hoy solo se muestran como **conteo**; el
**texto** de comentarios solo se lee en rutas **diag**. **No existe la feature de sentimiento** en la
plataforma multi-tenant (vive en el legacy Drean: cron `ugc-comments-analysis`). Meta exige **mostrar
cada permiso en uso** → **hay que construir la feature de sentimiento en bip-platform** para poder
demostrar `instagram_manage_comments` + `pages_read_user_content` en el video. (Ver §4, build nuevo.)

**Tanda B del guion** (`pages_manage_engagement`, `pages_manage_metadata`, `leads_retrieval`):
**cero llamadas en el código** — declarados pero no ejercidos. NO pedir todavía.

## 2. Set para ESTA ronda: 9 permisos (Tanda A, todo lectura)
`pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`,
`instagram_manage_insights`, `ads_read`, `business_management` (7 núcleo orgánico+pauta) **+**
`pages_read_user_content`, `instagram_manage_comments` (sentimiento de comentarios FB+IG, vital).

**Diferir:** solo la Tanda B (3, sin código). Todos los de esta ronda son de **lectura**.

> Regla de Meta: hay que hacer **≥1 llamada exitosa por permiso dentro de los 30 días** previos al
> submit. Los 7 se ejercen conectando la cuenta de prueba y abriendo Redes + Plan de Medios. El diag
> `/api/diag/meta` valida contra `/me/permissions` qué está concedido.

## 3. Requisitos oficiales de Meta (2026) — qué exige
- **Business Verification de ROQUÉ (PRIMERO, bloqueante):** Advanced Access no se otorga sin la
  empresa verificada. Documento legal (AFIP) cuya **razón social + dirección/teléfono** coincidan
  **exactamente** con el Business Manager (no nombre de fantasía). 1-5 días hábiles.
- **App en modo LIVE:** en Development Mode no dan Advanced Access. Pasar la app a Live antes de submit.
- **Screen recording POR PERMISO:** Meta pide **un video por permiso** mostrando el flujo que usa ese
  permiso (o segmentos claros por permiso). Un permiso sin su clip **no se aprueba**. Meta "sigue" el
  video para testear.
- **Cadena de permisos completa:** si falta un permiso dependiente (ej. `business_management` para
  enumerar ad accounts), el submit entero falla aunque la justificación principal esté bien.
- **Data Deletion Callback (o Instructions URL):** obligatorio para apps con Facebook Login. **Hoy NO
  existe** en bip-platform (ver §4). Sin esto, rechazo silencioso.
- **Política de privacidad + Términos:** ya publicados (bip-go.com) y cubren Meta. ✓
- **Tiempos 2026:** el review se enlenteció — reportes de ~20 días (antes 2-7 días hábiles).

## 4. GAPS a resolver antes de submit (lo que falta construir/hacer)
0. **Feature de SENTIMIENTO de comentarios en bip-platform — ✅ CONSTRUIDA (dic-2026).**
   Se agregó al final de **/redes** la sección **"Sentimiento de comentarios"**: `lib/meta-comments.ts`
   (lee texto de comentarios IG con `instagram_manage_comments` + FB con `pages_read_user_content`
   usando el token del tenant, page token; análisis con OpenAI gpt-4o-mini, SOLO lectura) +
   `app/api/meta/comment-sentiment` + `components/social/comment-sentiment.tsx`. **Requiere
   `OPENAI_API_KEY` en Vercel** (sin key lee comentarios pero no analiza). Demuestra los 2 permisos
   de comentarios en el video. Historia previa (por si hace falta contexto):
   **Contexto (user, dic-2026):** BIP va a **replicar el 100% de la funcionalidad de los dashboards de
   Drean** → el análisis de sentimiento de comentarios (UGC) llega como parte de eso, no es un build
   aislado. Hoy en bip-platform los comentarios son solo conteo + texto en diag; la feature de
   sentimiento vive en el legacy Drean (`app/api/cron/ugc-comments-analysis` + dashboard **/influencia**,
   NO /contenido). Para demostrar `instagram_manage_comments` + `pages_read_user_content` en el video,
   esa feature tiene que estar **portada y visible en bip-platform** con la cuenta conectada. Sincronizar
   el submit de Meta con ese hito de la replicación (o portar al menos la vista de sentimiento antes del
   video). Mapa de la funcionalidad Meta de Drean a portar: ver relevamiento en curso.
1. **Data Deletion de Meta — FALTA (build).** Hoy hay disconnect por fuente
   (`api/connections/disconnect`, revoca token en Nango + borra `redes_snapshot`) y baja total
   (`api/account/delete`). Pero **no existe el callback/URL que Meta exige**. Dos opciones:
   - **(A) Callback firmado** (`/api/meta/data-deletion`): recibe el signed_request de Meta, arranca
     la purga (reusar la lógica de disconnect/delete por app-scoped user id) y responde
     `{ url, confirmation_code }`. Es lo robusto y lo que Meta prefiere. **Recomendado.**
   - **(B) Data Deletion Instructions URL**: una página (ej. `bip-go.com/data-deletion`) con
     instrucciones de cómo pedir el borrado. Más rápido, menos robusto. Aceptable como mínimo.
   → **Recomiendo construir (A)** (lo hace Claude; es acotado). Config en la app: Facebook Login →
     Settings → User Data Deletion.
2. **App a modo Live** (config del user en el App Dashboard).
3. **Business Verification de ROQUÉ** (config del user: subir doc AFIP que matchee el BM).
4. **Cuenta de prueba** con Página FB + IG Business (vinculado) + ad account, sin bloqueos, con datos.
5. **`META_LOGIN_CONFIG_ID`** no está en `.env.example` (documentarla; ya se usa en `lib/nango.ts`).

## 4-ter. ✅ RESUELTO — FB orgánico "reduce amount of data" era SNAPSHOT VIEJO (dic-2026)
El error persistía en `/redes` **aunque las llamadas live de FB funcionan** (diag `posts_full_50: ok`).
Causa raíz validada: los insights de `getFbOrganicLive` están en try/catch → no propagan; la función
no tira el error. El dash mostraba un `redes_snapshot` **viejo** que un cron guardó con `fb.ok=false`
(corrió antes del fix de retry). Fixes (bip-platform):
- **Self-heal en `app/(app)/redes/page.tsx`:** si el snapshot trae una fuente en error, se re-trae
  LIVE en el momento (`getFbOrganicLive`/`getIgOrganicLive`) → un error viejo nunca queda pegado.
- **Guard en el cron `sync-redes`:** si una fuente falla pero la anterior estaba OK, se conserva (no
  se degrada el snapshot). Diag permanente: `/api/diag/fb-organic` (snapshot vs live).
- **Patrón:** todo dash que lea de un snapshot debería self-healear las fuentes en error a live.

## 4-quater. Sentimiento de comentarios — arquitectura final (dic-2026)
NO se procesa en tiempo real en el dash (era carísimo: OpenAI en cada refresh). Ahora:
- **Cron GitHub `sync-comment-sentiment.yml`** (cada 12h) analiza y guarda en `meta_comment_sentiment`
  (mig 0016). Analiza con OpenAI SOLO los posts cuya cantidad de comentarios cambió (los demás reusan).
- El dash **solo lee** la tabla (costo cero). La **barra de sentimiento va DEBAJO de cada post** (IG+FB),
  expandible a conteos+resumen+temas (`components/social/sentiment-bar.tsx`), no como sección aparte.
- Requiere `OPENAI_API_KEY` en Vercel. Lee texto de comentarios → ejerce `instagram_manage_comments`
  + `pages_read_user_content` (los 2 permisos vitales del App Review).

**PENDIENTES (el user pidió "luego"):**
- Portar la barra de sentimiento por post a **Drean `/redes`** (IG + FB orgánico; Drean usa system-user
  token; FB orgánico no tiene sentimiento hoy). El componente `sentiment-bar` se reusa.
- **Pauta en redes:** barra de sentimiento por creativo/ad (los ads son posts reales con comentarios;
  en Drean ya existe algo para UGC en `/influencia` — generalizar). Aplica en BIP `/performance` + Drean.

## 4-bis. ✅ RESUELTO — robustez Meta "reduce amount of data" (dic-2026)
El error **"Please reduce the amount of data you're asking for"** (Graph API: la respuesta con
campos anidados pesados excede el límite) se tapó en las **3 lecturas pesadas** de Meta, cada una
reintentando la MISMA página con un `limit` menor antes de rendirse:
- **FB posts** (`lib/meta-social.ts` `getFbOrganicLive`): 25→10→5.
- **IG media** (`getIgOrganicLive`): 50→25→10.
- **Ads/creativos de pauta** (`lib/meta-pauta.ts`): 50→25→10.
Sumado a la degradación elegante existente (cada sección en su try/catch, `.catch(() => [])`), un
cliente con cuenta grande no pierde la sección entera. **Patrón para futuras lecturas Meta:** si el
fetch trae edges/campos anidados, envolver la página en un retry con limit decreciente sobre el match
`/reduce the amount of data/i`.

## 5. Plan de video (un tramo/clip por permiso, cuenta de prueba conectada)
1. **Login FLB** → selección de Página / IG / ad account (`pages_show_list`, `business_management`).
2. **/redes** — alcance/engagement/seguidores FB+IG (`pages_read_engagement`, `read_insights`,
   `instagram_basic`, `instagram_manage_insights`).
3. **/performance** — inversión, impresiones, VTR, creativos de pauta (`ads_read`).
4. **Desconexión + borrado de datos** (muestra el control de privacidad / data deletion).
El guion detallado (con textos de justificación por permiso) está en `docs/meta-app-review-guion.md`.

## 6. Orden de ejecución (sin iterar)
1. **Claude:** construir el **data-deletion callback** (`/api/meta/data-deletion`) + reusar la purga
   por app-scoped user id. Documentar `META_LOGIN_CONFIG_ID` en `.env.example`.
2. **User:** Business Verification de ROQUÉ (doc AFIP) — el cuello más largo, arrancar YA.
3. **User:** app "BIP Connector" a **Live**; configurar el data-deletion URL en Facebook Login.
4. **User:** armar la cuenta de prueba (Página + IG Business + ad account con datos).
5. **Ambos:** conectar la cuenta en BIP, abrir Redes + Plan de Medios (ejerce los 7 permisos <30d),
   verificar con `/api/diag/meta` que los 7 estén concedidos/funcionando.
6. **Grabar** el video (7 permisos), completar el submit por permiso en App Review, reenviar.

## 7. Decisiones (RESUELTAS dic-2026)
- **A) Set de permisos:** ✅ **9 (Tanda A)** — incluye los 2 de comentarios (sentimiento IG+FB, vital).
- **B) Data deletion:** ✅ **callback firmado** (`/api/meta/data-deletion`).
- **C) Business Verification:** ✅ **ROQUÉ ya verificado** como negocio en Meta.

**Builds pendientes en bip-platform (Claude):**
1. Feature de **sentimiento de comentarios** (IG+FB) en la UI — para demostrar los 2 perms de comentarios.
2. **Data-deletion callback** (`/api/meta/data-deletion`) + captura del app-scoped user id de Meta al
   conectar + endpoint de status + migración. Requiere env `META_APP_SECRET` (para verificar el
   signed_request) — la carga el user en Vercel.
**Del user:** app "BIP Connector" a Live; configurar el data-deletion URL en Facebook Login; cuenta de
prueba (Página+IG Business+ad account con datos y comentarios); cargar `META_APP_SECRET`.

## Fuentes oficiales (Meta, 2026)
- App Review / Permissions Reference — developers.facebook.com/docs/permissions/
- Advanced Access (qué permisos requieren review) + screencast por permiso.
- Business Verification (documentos que matcheen el BM legal).
- Data Deletion Request Callback — developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback
