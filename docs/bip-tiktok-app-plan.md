# BIP · TikTok — registro de app + revisión (plan para NO iterar)

> **Camino elegido: A (PAUTA primero).** Orgánico (Accounts+Mentions) = 2da revisión.
>
> Estado (16-sep-2026): developer registration hecho con **Communication Email** de ROQUÉ
> (`bip@roque-in.com`, tipo **Technology Company**, verticals Service+Technology).
> **⚠️ LOGIN al portal TikTok = `bip.explore@gmail.com`** (confirmado por el user 18-sep). El
> `bip@roque-in.com` es SOLO el email de comunicación del perfil de negocio, NO el usuario de
> ingreso. Portal: `https://business-api.tiktok.com` → login con `bip.explore@gmail.com`.
> **DOS apps creadas, ambas "pending approval"** (App ID/Secret en "--" hasta aprobar):
> **"BIP Connector"** (pauta, Marketing API) + **"BIP Organic"** (orgánico, Accounts API).
> Revisiones en paralelo. Callback Nango (ambas, los 2 redirect fields):
> `https://nango.bip-go.com/oauth/callback`. Logo 512×512 subido.
> **Dominios TikTok bloqueados desde el sandbox de Claude** (business-api / developers) →
> proceso verificado vía guías + resúmenes oficiales (fuentes al pie).
>
> **Scopes VALIDADOS (read-only, mínimos):** Ad account management → *Ad account
> information* (cubre `/oauth2/advertiser/get/` + `/advertiser/info/`) · Reporting →
> *Consolidated report* (`/report/integrated/get/`) · Ads management = VACÍO. El buscador
> de scopes de TikTok NO indexa todas las rutas (dio vacío para info/ e integrated/get/)
> → validar por sub-nodo tildado, no por el buscador.
>
> **Reader construido (BIP):** `lib/tiktok-pauta.ts` — mismas shapes que Meta
> (PautaSummary/PautaFull) para reusar los componentes de `/performance`. Token del cliente
> por Nango (`tiktok-ads`) en header `Access-Token`; `/oauth2/advertiser/get/` además pide
> `TIKTOK_APP_ID`+`TIKTOK_APP_SECRET` (env Vercel, se cargan cuando TikTok libere las creds).
> **Pendiente de wiring:** API route de selección de advertiser + picker en Conexiones +
> sección TikTok en `/performance` + diag. Test recién con App ID/Secret + Sandbox Ad Account.

## Lo que confirmé de la doc oficial (lo que evita iterar)

1. **Sandbox Mode = la clave anti-iteración.** Las apps nuevas arrancan en **Sandbox**:
   entorno restringido donde probás **todo el flujo OAuth + llamadas a la API con una
   Sandbox Ad Account SIN enviar a revisión**. Se valida que el conector funcione ANTES
   de someterlo → la causa #1 de rechazo (mandar algo que no anda) se elimina acá.
2. **Scope overreach = motivo de rechazo.** "Pedir scopes que no demostrás usar rebota la
   revisión." → **NO tildar "All"** (mete endpoints de escritura que no usamos) ni scopes
   sin feature. Pedir SOLO lo que el video demuestra.
3. **El video de demo tiene que mostrar el flujo end-to-end de CADA scope pedido.** Máx 5
   videos, 50 MB c/u. Si sobra un scope sin demo → demora/rechaza.
4. **Agregar scopes después está soportado oficialmente** (Edit Scope → agregar → enviar a
   revisión = revisión adicional). O sea **fasear NO es "iterar mal"**: es entrega por
   etapas, cada una aprobada limpia.
5. **Marketing API (pauta) y Organic API (orgánico) son familias SEPARADAS.** Orgánico =
   **Accounts** (insights de videos/cuenta) + **Mentions** (comentarios/menciones) + TTO/
   Discovery. En BIP el conector de TikTok **hoy solo hace pauta** (reporting de ads); el
   conector orgánico NO está construido.
6. Requisitos de submission: privacy URL (`bip-go.com/privacy`), redirect URI, descripción
   de manejo de datos, demo video. Producción a volumen: Business Center onboarding +
   business verification + data-security compliance check. Tiempo: ~1-2 semanas si está limpio.

## Scopes exactos que usa el conector (validado contra el código)

El sync (`api/cron/tiktok-sync`) llama SOLO:
- `/oauth2/advertiser/get/` → lista de advertisers autorizados
- `/advertiser/info/` → nombre + moneda de la cuenta
- `/report/integrated/get/` → TODO el reporting (spend, impresiones, alcance, clicks, VTR,
  cuartiles de video; los nombres de campaign/adgroup/ad vienen como métricas del reporte)

→ Scopes mínimos: **Ad account management** (solo "Ad account information") + **Reporting**
(solo el reporte integrado/consolidado). **Ads management NO se usa** (los nombres vienen en
el reporte) → NO pedirlo. **Método sin adivinar:** usar el buscador "Enter an API name or
path" del selector de scopes y agregar exactamente esas 3 rutas.

## Paridad con Meta (qué lado da cada cosa en TikTok)

| En Meta (BIP) | TikTok API | Scope | ¿Construido en BIP? |
|---|---|---|---|
| Pauta: spend/impr/alcance/clicks/VTR | Marketing · Reporting | Ad account info + Reporting | ✅ conector pauta |
| Sentimiento comentarios en PAUTA | Ad comments API | Ad comments | ❌ (feature a construir) |
| Orgánico: alcance/engagement/seguidores | Organic · Accounts | TikTok accounts (⚠️) | ❌ conector a construir |
| Sentimiento comentarios ORGÁNICOS / menciones | Organic · Mentions | Mentions | ❌ conector a construir |

## Plan para NO iterar — dos caminos

- **A) Pauta primero (recomendado):** app con scopes SOLO de pauta (Ad account info +
  Reporting) → probar en **Sandbox Ad Account** → grabar demo → enviar. Aprobación rápida y
  limpia. Orgánico (Accounts+Mentions) + Ad comments = **segunda revisión** cuando estén los
  conectores construidos y demostrables (Edit Scope → agregar). Es el camino con menor riesgo
  de rechazo.
- **B) Todo en una sola revisión:** construir ANTES los conectores orgánico + comentarios en
  BIP, probar los cuatro scopes en sandbox, y enviar UNA sola revisión con todo demostrado.
  Una sola aprobación y paridad total, pero se demora el submit (hay que construir el orgánico
  + el ⚠️ de "TikTok accounts" puede pedir qualification extra + el orgánico necesita una
  cuenta business real con Analytics activado para poder demostrarlo).

## ORGÁNICO (Accounts API) — VERIFICADO + CONSTRUIDO (16-sep-2026)

Investigado con agente (dominios TikTok bloqueados → SDKs + mirror de la doc del portal:
`sns-sdks/python-tiktok`, `henry-md/ad-mcps`, SDK Rust). **Es un producto OAuth SEPARADO del
Marketing API** (mismo console "My Apps", distinto producto):
- Autoriza un **titular de cuenta TikTok** (no advertiser). Identidad `business_id` (== `open_id`
  del token — ÚNICO punto a confirmar en sandbox). Token endpoint `/tt_user/oauth2/token/`.
  Provider Nango = **`tiktok-accounts`**.
- **Scopes (producto "TikTok Accounts", read-only):** `user.info.basic/username/profile/stats`,
  `user.account.type`, `user.insights`, `video.list`, `video.insights`, `comment.list`.
  (`comment.list.manage` = moderar → NO. `biz.brand.insights` = Mentions → opcional/después.)
- **Endpoints:** `/business/get/` (perfil+stats+métricas diarias), `/business/video/list/`
  (videos con insights, cursor, max 20), `/business/comment/list/` (comentarios, max 30).
- **Construido en BIP:** `lib/tiktok-organic.ts` (reader + `getTikTokBusinessId`/`set`), sentimiento
  reusa `analyzeSentiment` de Meta → tabla `meta_comment_sentiment` `network='TT'` (SIN migración).
  Cron `sync-comment-sentiment` extendido. Diag `/api/diag/tiktok-organic`. Gate `TIKTOK_ORGANIC_ENABLED=1`.
- **Gotchas:** delay 24-48h; cuenta debe ser Business/Creator con Analytics activado; reach/retención
  requieren actividad del video en 7 días; retención de data 365 días; paginación por cursor.
- **Sección `/redes` HECHA:** `TikTokOrganicSection` (perfil+stats, KPIs de cuenta, grilla de videos con
  métricas + barra de sentimiento por video estilo Meta). Gated por `tiktokOrganicEnabled()`+`tt.ok`.
- **ÚNICO pendiente (sandbox):** botón "Conectar TikTok orgánico" para `tiktok-accounts` + **captura de
  `business_id` en el callback** (== open_id del token — cómo lo expone Nango se ve en sandbox). Es el
  único punto que NO se construye blind por la regla validá-no-asumas.

## Pasos para SOLICITAR el orgánico ahora (ganar tiempo, sin arriesgar la pauta)

1. En la app **"BIP Connector"** (o una app nueva "BIP Organic" si se prefiere aislar la revisión):
   agregar el **producto "TikTok Accounts"** y tildar los scopes read-only de arriba.
2. Copiar la **"TikTok account holder authorization URL"** (App Detail → Basic Information) y la
   redirect `https://nango.bip-go.com/oauth/callback`.
3. En **Nango** (`nango.bip-go.com` → Integrations): crear/configurar la integración **`tiktok-accounts`**
   con el App ID/Secret (cuando TikTok los libere) y esos scopes.
4. **NO enviar orgánico a revisión hasta tener el wiring UI + una cuenta business real para demostrarlo**
   (regla TikTok: cada scope debe verse en el video). El orgánico se envía como **revisión aparte** para
   no frenar la aprobación de pauta.

Fuentes: developers.tiktok.com/docs (App Review Guidelines, App Review FAQ, Scopes Overview,
Add a Sandbox); business-api.tiktok.com/portal/docs (Marketing/Organic API overview); SDKs
`sns-sdks/python-tiktok`, `aoyagikouhei/tiktok-business`; mirror `henry-md/ad-mcps`.
