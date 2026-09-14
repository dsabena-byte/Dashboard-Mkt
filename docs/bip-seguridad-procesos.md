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
- **Desconexión** desde *Conexiones* → revocar el token en Nango + **purgar** los datos derivados de esa
  fuente. La revocación existe; el **purgado automático de datos derivados es (PENDIENTE)**.

## 6. Retención y eliminación de datos
- **Baja de cuenta / borrado a pedido** (bip.explore@gmail.com) dentro de 30 días. **Flujo de borrado
  end-to-end (auth + tenant + datos + conexiones) es (PENDIENTE)** — hoy se haría manual; hay que
  automatizarlo (endpoint + cascada `on delete` ya existe en las FKs, falta el disparador y el revoke
  de Nango).
- Eliminación/desautorización de Meta: mismo canal + (PENDIENTE) el data-deletion callback de Meta.

## 7. IA / Limited Use
- Datos a OpenAI **solo para inferencia**; la API de OpenAI **no entrena** con datos de API. **No** se
  envían datos de Google/Meta a entrenar modelos. Declarado en la política §6/§8. **[OK]**

## 8. Registro, auditoría y monitoreo
- Eventos de conexión (`connection_events`), facturación (`billing_events`) y actividad
  (`lead_events`). Logs de plataforma (Vercel) y DB (Supabase). **[OK, básico]**
- **PENDIENTE:** alerta ante accesos anómalos / errores de auth repetidos.

## 9. Consentimiento (NUEVO — gap detectado 14-sep)
- **Aceptación de Términos + Política de Privacidad en el alta** (checkbox obligatorio, con versión y
  timestamp guardados). **(IMPLEMENTANDO — migración 0015 + SignupForm.)**
- **Consentimiento de comunicaciones** (email / WhatsApp) como **opt-in** separado y revocable; las
  comunicaciones de marketing solo se envían a quienes optaron. **(IMPLEMENTANDO.)**
- **Disclosure in-product en la conexión OAuth**: antes de conectar, se informa qué datos se acceden y
  para qué (solo lectura). Reforzar el texto en *Conexiones*. **(IMPLEMENTANDO.)**

## 10. Ciclo de desarrollo seguro (SDLC)
- Revisión de código; gate de `tsc`/`build` antes de deploy; dependencias actualizadas. **[OK]**
- **PENDIENTE:** escaneo de dependencias (Dependabot) + revisión de PRs con checklist de seguridad.

## 11. Subprocesadores (acuerdos de tratamiento)
Supabase, Vercel, Nango, OpenAI, Mercado Pago. Cada uno con sus propios controles; se listan en la
política §9. **PENDIENTE:** registro formal de subprocesadores + DPA donde aplique.

## 12. Respuesta a incidentes
- Contacto: bip.explore@gmail.com. **PENDIENTE:** runbook de incidentes (detección → contención →
  erradicación → notificación a afectados y a las plataformas según sus plazos).

---
## ✅ Checklist para reenviar la verificación (lo que hay que cerrar sí o sí)
1. **Política publicada** con §7 (protección de datos sensibles) + §8 (no IA training). **[hecha,
   falta publicar en `bip-go.com/privacidad`]**
2. **Consentimiento en el alta** (legal + comunicaciones) implementado. **(en curso)**
3. **Purgado/borrado** de datos al desconectar y en baja de cuenta (automatizar). **(PENDIENTE)**
4. **Disclosure in-product** reforzada en Conexiones. **(en curso)**
5. Para Google Option B: demostrar Ads + Sheets(`drive.file`) funcionando (build) + video + test creds.
