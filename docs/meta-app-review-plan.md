# BIP · App Review de Meta — ANÁLISIS PROFUNDO + PLAN (dic-2026)

> Objetivo: verificar la app multi-tenant **"BIP Connector"** para Advanced Access de los
> permisos de **LECTURA** (orgánico + pauta), sin publicación. Análisis hecho leyendo TODO el
> código (`bip-platform`), los docs, y los requisitos oficiales de Meta. **No re-litigar sin leer esto.**
> Complementa (no reemplaza) `docs/meta-app-review-guion.md` (guion de video con las 12 justificaciones).

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
| `pages_read_user_content` | leer **texto** de posts/comentarios FB | solo diag (no en dashboards) | opcional (community/UGC) |
| `instagram_manage_comments` | leer **texto** de comentarios IG | solo diag (no en dashboards) | opcional (community/UGC) |

**7 permisos NÚCLEO** cubren 100% de los dashboards Redes (orgánico) + Plan de Medios (pauta).
**2 permisos de comentarios** (`pages_read_user_content`, `instagram_manage_comments`) hoy solo se
usan en rutas de diagnóstico, NO en los dashboards → son para una feature de **community/UGC** futura.

**Tanda B del guion** (`pages_manage_engagement`, `pages_manage_metadata`, `leads_retrieval`):
**cero llamadas en el código** — declarados pero no ejercidos. NO pedir todavía.

## 2. Set recomendado para ESTA ronda
**Pedir los 7 núcleo** (orgánico + pauta, todo lectura demostrable hoy en los dashboards):
`pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`,
`instagram_manage_insights`, `ads_read`, `business_management`.

**Diferir:** los 2 de comentarios (hasta que haya feature de community management en la UI) y la
Tanda B. Menos permisos = review más liviano y menos superficie de rechazo. (Si el user quiere
community management ya, se suman los 2 de comentarios + un tramo de video que lea comentarios.)

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

## 7. Decisiones pendientes del user
- **A) Set de permisos:** ¿los **7 núcleo** (recomendado), o sumamos los 2 de comentarios para
  community management ya?
- **B) Data deletion:** ¿callback firmado (A, recomendado) o instructions URL (B)?
- **C) Business Verification:** ¿ROQUÉ ya está verificado en Meta, o hay que hacerlo? (definir la
  entidad legal + doc AFIP que matchee el Business Manager).

## Fuentes oficiales (Meta, 2026)
- App Review / Permissions Reference — developers.facebook.com/docs/permissions/
- Advanced Access (qué permisos requieren review) + screencast por permiso.
- Business Verification (documentos que matcheen el BM legal).
- Data Deletion Request Callback — developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback
