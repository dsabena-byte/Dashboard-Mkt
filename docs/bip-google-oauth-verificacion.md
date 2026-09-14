# BIP · Verificación OAuth de Google — diagnóstico definitivo (14-sep-2026)

> Objetivo del user: resolverlo **de una, sin iterar**. Este doc es el diagnóstico profundo +
> el plan de remediación en orden de causa-raíz. Contexto: la app OAuth de BIP (**BIP-GO**, cuenta
> `bip.explore@gmail.com`) pide **scopes SENSIBLES** de Google (Analytics/GA4, Google Ads, etc. vía
> Nango) → Google exige **verificación de la app** para sacar el cartel "Google no verificó esta app"
> y escalar >100 usuarios. La cuenta de **Meta (Roque) ya está verificada como negocio**; esto es
> aparte (es la verificación de la **app OAuth de Google**).

## ⚠️ Regla de oro (por qué venías a iterar)
La verificación de Google evalúa **varias cosas a la vez** y te devuelve el rechazo **item por item**.
Si arreglás uno y dejás otro roto, volvés a la cola y **iterás para siempre**. Hay que mandar el
paquete **completo y consistente** de una: **dominio propio + política de privacidad conforme +
scopes mínimos + homepage + video + in-product disclosure**. Y sobre todo: hay **una causa-raíz
ESTRUCTURAL** que, si no se resuelve, hace que **NINGÚN** otro arreglo pase la verificación.

## 🔴 CAUSA-RAÍZ #1 (estructural, bloquea todo): dominio autorizado `nango.dev`
- La app usa el redirect OAuth de **Nango Cloud**: `https://api.nango.dev/oauth/callback`. Google, al
  ver ese redirect, mete **`nango.dev`** como **dominio autorizado** en la consent screen.
- **Google exige que TODOS los dominios autorizados estén verificados a TU nombre** en Search Console.
  `bip-go.com` es tuyo (verificable); **`nango.dev` NO es tuyo → es IMPOSIBLE verificarlo** → la
  verificación **no puede pasar jamás** mientras ese dominio esté ahí.
- **Esto explica por qué "iterabas":** aunque arregles la política de privacidad, los permisos, etc.,
  el dominio ajeno sigue trabando. **Es el primer arreglo, sí o sí.**
- **Fix definitivo:** **self-hostear Nango en dominio propio** → `https://nango.bip-go.com/oauth/callback`.
  Nango es open source; correrlo en Railway (~$5-20/mes) da callback en dominio **tuyo, verificable** y
  conexiones ilimitadas. (Pagar Nango Cloud NO resuelve: el callback en dominio propio recién viene en
  el plan Enterprise.) Detalle del runbook en la sección "Sacar el cartel 'app no verificada'" de
  `bip-platform-handoff.md`.
  - Pasos: deploy Nango self-host → `nango.bip-go.com` (CNAME + SSL) → recrear integración Google con
    **tu** Client ID/Secret + los scopes → en el OAuth client de Google **cambiar el redirect** a
    `https://nango.bip-go.com/oauth/callback` y **BORRAR** el de `api.nango.dev` → en la consent screen,
    **dominios autorizados = solo `bip-go.com`** (sacar `nango.dev`) → app en Vercel:
    `NANGO_HOST=https://nango.bip-go.com` + `NANGO_SECRET_KEY` nuevo.

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
