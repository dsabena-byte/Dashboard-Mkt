# BIP · TikTok — registro de app + revisión (plan para NO iterar)

> **Camino elegido: A (PAUTA primero).** Orgánico (Accounts+Mentions) = 2da revisión.
>
> Estado (16-sep-2026): developer registration hecho con email de ROQUÉ
> (`bip@roque-in.com`, tipo **Technology Company**, verticals Service+Technology).
> App **"BIP Connector" CREADA y configurada** — estado TikTok **"pending approval"**
> (App ID/Secret todavía en "--", los libera TikTok al aprobar el registro).
> Callback Nango: `https://nango.bip-go.com/oauth/callback`.
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

Fuentes: developers.tiktok.com/docs (App Review Guidelines, App Review FAQ, Scopes Overview,
Add a Sandbox); business-api.tiktok.com/portal/docs (Marketing/Organic API overview).
