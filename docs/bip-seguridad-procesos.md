# BIP · Procesos y controles de seguridad (respaldo de la Política de Privacidad)

> Documento de ingeniería de seguridad. Describe los **controles reales** que respaldan cada claim de
> `docs/bip-legal-privacidad.md`. Regla: la política **solo puede afirmar lo que este documento
> garantiza**. Items marcados *(PENDIENTE)* deben implementarse **antes** de reenviar la verificación
> de Google/Meta, o la política sería falsa. **Rol: senior security engineer.** Actualizado 14-sep-2026.

## 0. Modelo de datos y flujo (qué protegemos)
- **Datos de cuenta** (email, nombre, empresa) → Supabase Auth + `tenant_profile`.
- **Tokens OAuth** de las plataformas del cliente (Google/Meta) → **Nango** (nunca en nuestra DB ni en
  el navegador). La app pide el token en runtime con `getToken(tenant, provider)` y lo usa server-side.
- **Datos de reporte** (GA4, Ads, Sheets elegido, Meta) → se leen con el token del cliente y se muestran
  en sus tableros; los agregados/mirrors viven en Supabase, **segregados por `tenant_id`**.
- **Pagos** → Mercado Pago (BIP no ve ni guarda datos de tarjeta).
- **IA** → OpenAI (solo inferencia, sin entrenamiento).

## 1. Cifrado
- **En tránsito:** TLS/HTTPS forzado en toda la cadena (Vercel, Supabase, Nango, APIs de Google/Meta,
  OpenAI, Mercado Pago). Sin endpoints HTTP en producción. **[OK]**
- **En reposo:** Supabase/Postgres cifra en reposo (AES-256). Nango cifra las credenciales/tokens en
  reposo. **[OK]**

## 2. Gestión de secretos
- Claves de servicio y API keys **solo en variables de entorno** de Vercel + GitHub Actions secrets;
  **nunca en el repo** (verificable: no hay secretos hardcodeados; `.env` en `.gitignore`). **[OK]**
- **`SUPABASE_SERVICE_ROLE_KEY` se usa solo server-side** (`lib/supabase/server`); el cliente usa la
  publishable/anon key. **[OK]**
- Rotación de claves ante sospecha de exposición; el runbook de rotación es *(PENDIENTE de escribir)*.

## 3. Identidad, acceso y mínimo privilegio
- **Auth**: Supabase (email+contraseña y magic link); 2FA disponible en la cuenta operativa. **[OK]**
- **RBAC**: roles por tenant (`owner`/`admin`/`member`) en `tenant_users`; el CRM interno se restringe
  a un **allowlist de staff** (`BIP_STAFF_EMAILS`). **[OK]**
- **Mínimo privilegio en scopes**: Google **solo lectura** (`analytics.readonly`, `adwords` de reporte,
  `drive.file` = solo archivos que el cliente elige). Sin scopes de escritura salvo la publicación de
  contenido de Meta que el usuario activa explícitamente. **[OK/por scope]**

## 4. Aislamiento multi-tenant
- **Row-Level Security (RLS)** habilitado en las tablas de datos; el acceso de cliente pasa por
  `is_member(tenant_id)`/`is_owner`. Las tablas de servicio (mapa, dashboards, perfil, CRM) se acceden
  **solo con service-role del lado servidor**, que resuelve el tenant por sesión. **[OK]**
- Una **conexión Nango por `tenant+provider`**: el token de un cliente no es alcanzable por otro. **[OK]**
- **Test recomendado (PENDIENTE):** prueba automatizada de aislamiento (un tenant no lee filas de otro).

## 5. Ciclo de vida de tokens y revocación
- Tokens almacenados/rotados por Nango; refresh automático. **[OK]**
- **Desconexión** desde *Conexiones* → `api/connections/disconnect`: **revoca el token en Nango**
  (`deleteConnection`) + borra la conexión + **purga los datos derivados** de esa fuente
  (`web_snapshot`/`redes_snapshot`). **[OK — implementado 14-sep]** (pauta_snapshot es mixto Meta+Google
  → se purga en la baja total, no en la desconexión de una sola fuente.)

## 6. Retención y eliminación de datos
- **Baja total de cuenta** → `api/account/delete` (solo owner): revoca **todas** las conexiones en
  Nango, purga logs sin FK (connection_events, billing_events), **borra el tenant → cascada de TODAS
  las tablas por-tenant** y borra los usuarios de Auth. UI en *Mi cuenta → Zona de peligro* (confirma
  con "ELIMINAR"). **[OK — implementado 14-sep]**
- Borrado a pedido por email (bip.explore@gmail.com) dentro de 30 días. **[OK]**
- Eliminación/desautorización de Meta: mismo canal + **(PENDIENTE)** el data-deletion callback de Meta
  (webhook aparte; menor).

## 7. IA / Limited Use
- Datos a OpenAI **solo para inferencia**; la API de OpenAI **no entrena** con datos de API. **No** se
  envían datos de Google/Meta a entrenar modelos. Declarado en la política §6/§8. **[OK]**

## 8. Registro, auditoría y monitoreo
- Eventos de conexión (`connection_events`), facturación (`billing_events`) y actividad
  (`lead_events`). Logs de plataforma (Vercel) y DB (Supabase). **[OK, básico]**
- **PENDIENTE:** alerta ante accesos anómalos / errores de auth repetidos.

## 9. Consentimiento (gap detectado 14-sep — RESUELTO)
- **Aceptación de Términos + Política de Privacidad en el alta**: checkbox **obligatorio** en
  `SignupForm` (bloquea el alta si no se acepta); se guarda `legal_version` + `legal_accepted_at` en
  user_metadata y se espeja al tenant (migración **0015**). **[OK]**
- **Consentimiento de comunicaciones** (email / WhatsApp): **opt-in** separado (`comms_email_optin`/
  `comms_wa_optin`), revocable; las comunicaciones solo van a quienes optaron. **[OK — capturado; falta
  respetarlo en el motor de envíos cuando se construya Alertas/reportes]**
- **Disclosure in-product**: bloque "Cómo protegemos tus datos" en *Conexiones* (solo lectura, cifrado,
  tokens revocables, aislamiento, no venta/IA, Drive/SharePoint acotado) + links legales. **[OK]**
- **Web**: sección "Seguridad y privacidad" (8 cards) + links legales en el footer + `privacy.html`
  publicable. **[OK]**

## 10. Ciclo de desarrollo seguro (SDLC)
- Revisión de código; gate de `tsc`/`build` antes de deploy; dependencias actualizadas. **[OK]**
- **PENDIENTE:** escaneo de dependencias (Dependabot) + revisión de PRs con checklist de seguridad.

## 11. Subprocesadores (acuerdos de tratamiento)
Supabase, Vercel, Nango, OpenAI, Mercado Pago. Cada uno con sus propios controles; se listan en la
política §9. **PENDIENTE:** registro formal de subprocesadores + DPA donde aplique.

## 12. Respuesta a incidentes
- Contacto: bip.explore@gmail.com. **PENDIENTE:** runbook de incidentes (detección → contención →
  erradicación → notificación a afectados y a las plataformas según sus plazos).

## 13. Microsoft / SharePoint (app de Microsoft Graph) — cumplimiento futuro
> Cuando se active el conector de SharePoint/Excel, la app de Microsoft Graph tendrá su propio proceso
> (análogo a Google). Lo que Microsoft pide y hay que cumplir:
- **Registro de app en Microsoft Entra ID (Azure AD)** con **permisos de Graph de mínimo privilegio**,
  delegados (en nombre del usuario). Para leer **solo el archivo que el cliente elige**, usar el
  **Microsoft File Picker (OneDrive/SharePoint)** + permisos acotados (evitar `Files.Read.All`/
  `Sites.Read.All` amplios; preferir el picker que otorga acceso al ítem elegido).
- **Publisher Verification (Verified Publisher / MPN)** para sacar el cartel de "app no verificada" en
  el consentimiento (equivalente al de Google) y habilitar consentimiento de admin en organizaciones.
- **URLs de Política de Privacidad y Términos** en el registro de la app (las mismas de `bip-go.com`).
- **Microsoft APIs Terms of Use** + **cumplimiento de manejo de datos** (cifrado, retención, borrado,
  no reventa, no entrenamiento de IA) — ya cubierto por §1-§12 y la política publicada.
- **Consentimiento del usuario/administrador** (delegado o admin-consent) según el tenant de Microsoft
  del cliente; disclosure in-product antes de conectar (ya está el patrón en *Conexiones*).
- **Data handling / DSR:** atender solicitudes de acceso/borrado por el mismo canal (§6/§10).
> Estado: **conector SharePoint en desarrollo**; este bloque es el checklist para cuando se publique la
> app de Graph. Ver también `docs/bip-platform-handoff.md` (SharePoint) y `docs/bip-google-oauth-verificacion.md`.

---
## ✅ Checklist para reenviar la verificación (lo que hay que cerrar sí o sí)
1. **Política redactada** con §7 (protección de datos sensibles) + §8 (no IA training). **[OK]** ·
   `privacy.html` publicable listo en `apps/web/public/bip-privacy.html` → **falta PUBLICARLO en
   `bip-go.com/privacy`** (copiar a `privacy.html` del bip-site/Netlify). **(acción del user)**
2. **Consentimiento en el alta** (legal obligatorio + comunicaciones opt-in). **[OK]** (migración 0015).
3. **Purgado/borrado** al desconectar (`api/connections/disconnect`) y baja total (`api/account/delete`).
   **[OK]**
4. **Disclosure in-product** en Conexiones + web (8 cards). **[OK]**
5. **Google Option B** (pendiente de build): demostrar **Ads** + **Sheets (`drive.file` + Picker)**
   funcionando con el token del cliente + **video** + **test creds** + responder el hilo de T&S.
   → ver `docs/bip-google-oauth-verificacion.md`.
6. **Menores pendientes:** Meta data-deletion callback; respetar el opt-in de comms en el motor de
   envíos (cuando se construya Alertas/reportes); automatizaciones del §2/§8/§10/§12 marcadas PENDIENTE.
