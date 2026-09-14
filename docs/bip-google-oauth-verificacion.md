# BIP · Verificación OAuth de Google — diagnóstico definitivo (14-sep-2026)

> Objetivo del user: resolverlo **de una, sin iterar**. Este doc es el diagnóstico profundo +
> el plan de remediación en orden de causa-raíz. Contexto: la app OAuth de BIP (**BIP-GO**, cuenta
> `bip.explore@gmail.com`) pide **scopes SENSIBLES** de Google (Analytics/GA4, Google Ads, etc. vía
> Nango) → Google exige **verificación de la app** para sacar el cartel "Google no verificó esta app"
> y escalar >100 usuarios. La cuenta de **Meta (Roque) ya está verificada como negocio**; esto es
> aparte (es la verificación de la **app OAuth de Google**).

## ⚡ RECHAZO EXACTO DE GOOGLE (captura del user, 14-sep-2026) — esto es lo que hay que resolver
Pantalla "Progreso de la verificación" (OAuth app verification, hilo con Trust & Safety):
- ✅ **Requisitos de la página principal** → PASÓ (verde). ⇒ el **homepage y el dominio están OK**;
  el tema `nango.dev` NO es el blocker actual (ver nota al final).
- ✅ **Lineamientos de desarrollo de la marca** → PASÓ (verde).
- ❌ **Requisitos de la política de privacidad** — *"Tu política de privacidad no especifica ningún
  mecanismo de protección de datos sensibles."* → **Causa A (abajo). ES EL ITEM PRINCIPAL.**
- ❌ **Funciones de la app** → **Causa B** (video demostrativo del flujo + uso de datos).
- ❌ **Solicita los permisos mínimos** → **Causa C** (scopes demasiado amplios).

**Regla de oro:** Google rechaza item por item. Hay que resolver **los 3 rojos juntos** y **responder
el hilo de correo** de Trust & Safety confirmando cada uno; si mandás uno y dejás otro, volvés a la
cola. Los 3 son 100% resolubles sin infra nueva (no requieren el self-host).

## 🔴 CAUSA A (item principal): Política de privacidad sin "mecanismo de protección de datos sensibles"
Google usó una frase textual: *no especifica ningún mecanismo de protección de datos sensibles*. Tu
política actual es genérica; falta una **sección explícita de seguridad/protección** + la divulgación
completa del manejo de datos de Google. La política debe cumplir TODO esto (y estar en `bip-go.com`,
pública, linkeada en la consent screen):
1. **Sección de MECANISMOS DE PROTECCIÓN DE DATOS SENSIBLES** (lo que falta y disparó el rechazo):
   nombrar explícitamente — **cifrado en tránsito (TLS/HTTPS)** y **en reposo**; **tokens OAuth
   almacenados cifrados y revocables** (vía Nango); **control de acceso por roles**; **aislamiento por
   cliente (RLS multi-tenant en Supabase)**; **acceso restringido al personal necesario**; **retención
   limitada y borrado a pedido / al desconectar la cuenta**.
2. **Divulgación por cada dato de Google** que tocás (GA4/Analytics, Google Ads): **qué** accedés,
   **cómo** lo usás (mostrarlo en el dashboard del cliente dueño del dato), **dónde** lo guardás
   (Supabase), **con quién** lo compartís (subprocesadores nombrados: Supabase/Vercel/Nango/OpenAI),
   **cómo se borra**.
3. **Cláusula de Limited Use textual:** el uso de datos de Google se limita a lo divulgado; **no se
   venden**, **no se usan para publicidad**, **no se usan para entrenar modelos de IA** (aclarar que
   los datos de Google NO se envían a OpenAI para entrenamiento), y solo personal autorizado los ve.
> Claude puede **redactar esta política completa** (Google + Meta en una) cuando el user lo pida.

## 🔴 CAUSA B: "Funciones de la app" → falta el video demostrativo
Google pide un **video** (YouTube, no listado) que muestre: (a) el **flujo OAuth completo** desde la app
con la **URL/dominio visible**, (b) la **pantalla de consentimiento** con los scopes que pide, (c) **cómo
se usan esos datos dentro de la app** (el dashboard mostrando la data de GA4/Ads del cliente). Sin ese
video, "Funciones de la app" queda en rojo. **Fix:** grabarlo en `bip-platform.vercel.app` → Conexiones
→ Conectar Google → consent → dashboard con la data, y adjuntarlo/linkearlo en el hilo.

## 🔴 CAUSA C: "Solicita los permisos mínimos" → scopes demasiado amplios
Google detectó que pedís **más scope del necesario**. **Fix:** en la consent screen dejar **solo** los
scopes read-only que los dashboards realmente consumen (p.ej. `analytics.readonly` de GA4 y el
read-only de Google Ads) y **borrar** cualquier scope de escritura o de más. Por **cada** scope, tener
la **justificación** lista (qué función lo usa) para el hilo. **Acción del user:** decir qué scopes pide
hoy BIP-GO (consent screen) → Claude arma la lista mínima + la justificación por scope.

## 🔎 ESTADO VALIDADO CONTRA EL CÓDIGO (14-sep-2026) — qué está hecho y qué no
> Antes de dar la secuencia, se validó en los repos (no se asumió):
- **Uso real de Google en BIP = SOLO GA4 (Analytics) en READ-ONLY.** El código llama a
  `analyticsadmin.googleapis.com` (accountSummaries) y `analyticsdata.googleapis.com` (runReport),
  archivos `lib/ga4-monthly.ts`, `lib/ga4-reports.ts`, `app/api/cron/sync-web`. **No hay una sola
  llamada a Google Ads / DV360** en el código. ⇒ el **único scope que la app usa hoy es
  `https://www.googleapis.com/auth/analytics.readonly`** (+ `openid email profile` para login).
  **Implicancia directa de la Causa C:** si la consent screen pide scopes de **Google Ads** u otros
  que el código NO usa, Google lo marca como "permisos no mínimos". **Fix concreto: dejar solo
  `analytics.readonly`** (y sacar Ads/otros hasta que efectivamente se consuman por API).
- **NO existe política de privacidad en los repos** ni link a una en `bip.html` (el footer solo tiene
  el ©). ⇒ la Causa A **no está resuelta**: hay que **escribir y publicar** la política conforme (con
  la sección de mecanismos de protección) en `bip-go.com/privacidad` y linkearla en la consent screen
  y en la web. Claude la puede redactar.
- **Homepage/dominio:** PASÓ en verde ⇒ pasos "verificar dominio / homepage" **ya están OK** (no
  rehacer). El self-host de Nango / sacar `nango.dev` **NO es necesario para esta verificación** (no
  está flagueado); queda para escalar.
- **Nango:** `lib/nango.ts` usa `NANGO_HOST` (default `api.nango.dev`, cambiable a `nango.bip-go.com`).
  El self-host es solo cambiar esa env — pero **no hace falta tocarlo ahora**.

### Respuesta directa a "¿la secuencia de 7 pasos ya la habíamos hecho?"
NO toda, y **no todos esos pasos aplican al rechazo actual**. Estado real:
1. Self-host Nango + sacar `nango.dev` → **NO hace falta ahora** (homepage pasó verde).
2. Verificar `bip-go.com` en Search Console → **ya OK** (implícito en el verde de "página principal").
3. **Política de privacidad conforme → PENDIENTE (item rojo A).** ← hay que hacerlo.
4. **Scopes mínimos → PENDIENTE (item rojo C).** ← dejar solo `analytics.readonly`.
5. Homepage → **ya OK** (verde).
6. **Video "Funciones de la app" → PENDIENTE (item rojo B).**
7. Reenviar + responder el hilo → recién después de 3, 4 y 6.
**En criollo: quedan 3 cosas — política de privacidad, scopes mínimos y video. El resto ya está.**

## 🟢 Nota — dominio `nango.dev` (NO es el blocker actual, sí para escalar)
En la captura, **"Requisitos de la página principal" pasó en verde**, así que el dominio/homepage NO es
lo que traba ahora. El tema del callback `api.nango.dev` como dominio autorizado (que sí traba la
verificación cuando aparece, porque no es verificable a tu nombre) **queda para el momento de escalar**
(self-host Nango en `nango.bip-go.com`, runbook en `bip-platform-handoff.md`). Si en un reenvío Google
vuelve a marcar "dominios autorizados" o "página principal", ahí sí es prioridad. Hoy: enfocarse en A/B/C.

## 🔴 CAUSA-RAÍZ #2: Política de privacidad NO conforme (mismo síntoma que te marcó Meta)
Meta te marcó *"tu política de privacidad no especifica ningún mecanismo de protección de datos
sensibles"* — **Google exige lo MISMO** (Google API Services User Data Policy + Limited Use). Una
política genérica **no pasa**. La política de privacidad de BIP debe cumplir TODO esto:
1. **Estar alojada en tu dominio verificado** (`https://bip-go.com/privacidad` o similar), **pública**
   (sin login) y **linkeada en la consent screen** (mismo dominio que el homepage).
2. **Divulgar explícitamente, por cada tipo de dato de Google que tocás** (Analytics, Ads, etc.):
   - **QUÉ** datos accedés (nombrar los scopes/datos: métricas de GA4, campañas de Google Ads, etc.).
   - **CÓMO los usás** (mostrarlos en dashboards del cliente dueño de esos datos).
   - **CÓMO los almacenás** (Supabase, cifrado en tránsito/reposo, tokens vía Nango, etc.).
   - **CON QUIÉN los compartís** (nadie / subprocesadores nombrados: Supabase, Vercel, Nango, OpenAI).
   - **CÓMO se BORRAN** (retención + mecanismo de eliminación a pedido + al desconectar).
3. **Cláusula de "Limited Use" textual:** declarar que el uso de los datos de Google se limita a lo
   divulgado, que **no se venden**, **no se usan para publicidad**, **no para entrenar modelos de IA**
   (ojo con OpenAI: aclarar que los datos de Google NO se mandan a entrenar), y solo el personal
   necesario los ve. (Google linkea esta política literal; conviene parafrasear su "Limited Use".)
4. **Mecanismos de protección de datos sensibles** (lo que faltó en Meta y falta en Google):
   cifrado en tránsito (HTTPS) y en reposo, control de acceso, tokens revocables, aislamiento por
   tenant (RLS), etc. **Nombrarlos explícitamente** en la política.

## 🟠 CAUSA-RAÍZ #3: Permisos/Scopes no mínimos ("Solicita los permisos mínimos")
- Google (y Meta te lo marcó igual) exige **el scope más angosto** que cubra la función real. Si BIP
  pide scopes amplios de Analytics/Ads "por las dudas", **rechazan** y te mandan a pedir uno más chico.
- **Fix:** en la consent screen dejar **solo** los scopes que los dashboards realmente consumen
  (ej: `analytics.readonly` de GA4, el read-only de Google Ads) y **borrar** cualquier scope de
  escritura o extra. Por **cada** scope, tener lista la **justificación** (qué función lo necesita).

## 🟠 CAUSA-RAÍZ #4: Homepage / "Requisitos de la página principal"
- El **homepage** de la consent screen debe: estar en el **dominio verificado**, ser **público**,
  **describir con precisión** qué hace la app y **qué datos de Google usa y para qué**, y **linkear la
  política de privacidad**. Un landing que no menciona el uso de datos de Google **no pasa**.
- **Fix:** en `bip-go.com` (o `/bip`) que el texto diga claramente "BIP conecta tus cuentas de Google
  (Analytics, Ads) en modo **solo lectura** para mostrarte tus métricas en tu dashboard" + link a la
  política. (Ya tenemos copy parecido en `bip.html`: reforzarlo y ponerlo en el dominio verificado.)

## 🟠 CAUSA-RAÍZ #5: "Funciones de la app" — video demostrativo
- Google pide un **video** (YouTube, no listado) que muestre: (a) el **flujo OAuth completo** desde tu
  app (URL visible del dominio), (b) la pantalla de consentimiento con los scopes, (c) **cómo se usan
  esos datos dentro de la app** (el dashboard mostrando la data de GA4/Ads). Sin eso, "Funciones de la
  app" queda en rojo.
- **Fix:** grabar el video con la app en `bip-platform.vercel.app` (o dominio propio), mostrando
  Conexiones → Conectar Google → consent → dashboard con la data. Guión ya bocetado en las notas de
  sesión previa (`scratchpad/bip-verificacion-google.md`, en el zip).

## 🟢 In-product disclosure (requisito extra de Limited Use)
Antes o durante el pedido de OAuth, la app debe **avisar en pantalla** qué datos de Google va a usar y
para qué (no alcanza solo la política). La pantalla de **Conexiones** de BIP ya tiene la guía "acceso
de solo lectura"; reforzarla con una línea explícita del uso de datos cubre esto.

## ✅ SECUENCIA DEFINITIVA (hacer TODO junto, en este orden, y recién ahí reenviar)
1. **Self-host Nango en `nango.bip-go.com`** y **sacar `nango.dev`** de dominios autorizados. *(sin esto
   nada pasa)*
2. **Verificar `bip-go.com` en Google Search Console** con `bip.explore@gmail.com` (TXT en DonWeb).
3. **Publicar la política de privacidad conforme** en `bip-go.com/privacidad` (los 4 puntos de arriba).
4. **Dejar solo los scopes mínimos** en la consent screen + justificación por scope.
5. **Homepage** en el dominio verificado, describiendo el uso de datos de Google + link a privacidad.
6. **Video** demostrativo (flujo OAuth + uso de datos en la app).
7. **Reenviar la verificación** y **responder el hilo de correo** de Trust & Safety confirmando que
   resolviste cada item.

## ❓ Lo único que falta para cerrar el diagnóstico al 100%
El **texto EXACTO del rechazo de Google** (el mail de "Trust & Safety" o los items en rojo de la
pantalla "Progreso de la verificación" de Google, como los que mostraste de Meta). Con ese texto
confirmo **cuál** de estas 5 causas te marcaron puntualmente. Pero la #1 (dominio `nango.dev`) es
estructural y hay que hacerla igual — es la razón por la que no cerraba.

## Nota sobre Meta (screenshot 2)
Los items rojos que te dio **Meta** ("política de privacidad sin mecanismo de protección de datos
sensibles", "funciones de la app", "permisos mínimos") son **la misma familia** de requisitos que
Google. **La política de privacidad conforme (causa #2) + scopes mínimos (causa #3) resuelven los dos
a la vez.** Conviene escribir UNA política que cumpla Google y Meta juntas.
