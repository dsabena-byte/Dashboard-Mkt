# Meta App Review — guion listo para "BIP Connector"

> App **BIP Connector** (App ID `1413533137383885`), portfolio **ROQUÉ Marketing Insights** (nombre anterior de **ROQUÉ Research Solutions**),
> tipo Negocios, **Facebook Login for Business** (`config_id 1349490046995897`).
> Objetivo: pasar de **Standard/Development** a **Advanced Access** de los 12 permisos para
> que clientes externos conecten sus propias cuentas por OAuth (self-serve).

## Orden obligatorio (validado sep-2026)
1. **Business Verification** de ROQUÉ (business.facebook.com → Centro de seguridad →
   Verificación del negocio). Sin esto, App Review NO concede Advanced Access aunque el submit
   sea perfecto. Necesita: razón social + dirección + documento oficial (AFIP/inscripción/
   factura de servicio a nombre de la empresa) + código de confirmación.
2. **App Review** de cada permiso (esta guía). Turnaround ~2-7 días hábiles.

## Antes de grabar (checklist)
- App en **modo Live** (o al menos con el flujo probado en dev con la cuenta admin).
- Tener a mano una cuenta de prueba con **Página FB + Instagram Business + cuenta de anuncios**
  para mostrar data real en el screencast (sirve la de ROQUÉ o Drean en dev).
- URL del flujo OAuth funcionando: `https://nango.bip-go.com/oauth/callback`.
- Política de privacidad publicada y linkeada en la app (Meta la exige): `bip-go.com/privacidad`.

## Cómo se completa cada permiso en el panel
Meta → App → **Revisión de la app** → **Permisos y funciones** → por cada permiso: **Solicitar
acceso avanzado** → completar (1) **para qué lo usás**, (2) **cómo lo obtenés en el flujo**,
(3) **screencast** que lo demuestre. Abajo, el texto sugerido + qué mostrar en el video.

---

## Screencast maestro (un solo video que cubre casi todo)
Grabá UN recorrido de ~3-4 min y reusalo (o cortalo) para cada permiso. Guion:

1. **Login for Business (obtención del consentimiento).** Mostrá BIP → "Conectar Meta" →
   se abre el diálogo de Facebook Login for Business → el usuario elige su Página + IG + cuenta
   de anuncios → concede permisos → vuelve a BIP con la conexión OK. *(Cubre el how-obtained de
   TODOS los permisos: el consent screen los lista.)*
2. **Redes Sociales (`/redes`).** Mostrá el dashboard trayendo **alcance, engagement,
   seguidores** de IG y FB de la cuenta conectada + el **texto de comentarios** (IG y FB).
3. **Plan de Medios (`/performance`).** Mostrá inversión, alcance, impresiones, clicks, VTR y
   los **creativos con sus métricas** de la cuenta de anuncios.
4. **Community management.** Mostrá responder/ocultar un comentario desde BIP (si esa UI está;
   si no, mencionar que el permiso habilita esa acción).
5. **Alertas / webhooks.** Mostrá la config de suscripción a eventos de la Página (metadata).

Narralo en inglés o español; Meta acepta ambos. Mostrá SIEMPRE data real en pantalla.

---

## Justificación por permiso (copiá/pegá y ajustá)

### 1. `ads_read`
- **Uso:** leer métricas de campañas/anuncios (spend, impresiones, alcance, clicks, video views)
  para el dashboard "Plan de Medios" del cliente.
- **How obtained:** el usuario concede `ads_read` en el diálogo de Login for Business al conectar.
- **Screencast:** parte 3 (Plan de Medios con data de la ad account).

### 2. `read_insights`
- **Uso:** leer insights de Página e Instagram (alcance orgánico, impresiones, engagement) para
  el dashboard "Redes Sociales".
- **Screencast:** parte 2.

### 3. `pages_show_list`
- **Uso:** listar las Páginas que el usuario administra para que elija cuál analizar en BIP.
- **Screencast:** parte 1 (el selector de Página en el consent + en Conexiones).

### 4. `pages_read_engagement`
- **Uso:** leer engagement de los posts de la Página (reacciones, comentarios, compartidos) para
  las métricas orgánicas de FB.
- **Screencast:** parte 2 (métricas FB).

### 5. `pages_read_user_content`
- **Uso:** leer el **contenido de los posts y el texto de los comentarios** de la Página para el
  análisis cualitativo (sentimiento, feedback de clientes).
- **Screencast:** parte 2 (mostrar texto de comentarios FB).

### 6. `instagram_basic`
- **Uso:** identificar la cuenta de IG Business vinculada a la Página y leer su perfil/medios.
- **Screencast:** parte 1 + 2.

### 7. `instagram_manage_insights`
- **Uso:** leer insights de IG (alcance, impresiones, guardados, engagement por post y de la
  cuenta) para "Redes Sociales".
- **Screencast:** parte 2 (métricas IG).

### 8. `instagram_manage_comments`
- **Uso:** leer y (opcional) responder/ocultar comentarios de posts de IG para community
  management y análisis de sentimiento.
- **Screencast:** parte 2 (texto de comentarios IG) + parte 4 si hay UI de respuesta.
- **OJO:** es `instagram_manage_comments` (comments), NO `..._contents`.

### 9. `business_management`
- **Uso:** resolver a qué Business pertenecen las Páginas/cuentas de anuncios del usuario para
  agruparlas correctamente en BIP (multi-cuenta).
- **Screencast:** parte 1 (mostrar que BIP descubre los assets del Business del usuario).

### 10. `pages_manage_engagement`
- **Uso:** responder y ocultar comentarios en posts de la Página (community management) desde BIP.
- **Screencast:** parte 4.

### 11. `pages_manage_metadata`
- **Uso:** suscribir la Página a webhooks para alertas en tiempo real (nuevos comentarios/menciones)
  que BIP notifica al cliente.
- **Screencast:** parte 5.

### 12. `leads_retrieval`
- **Uso:** traer los leads generados por los formularios de Lead Ads de la cuenta para que el
  cliente los vea/exporte en BIP.
- **Screencast:** mostrar la sección de leads (si está construida; si no, diferir este permiso a
  una segunda tanda — no bloquea a los otros 11).

---

## Tips de aprobación (evitan rechazos típicos)
- **Un permiso = un uso claro mostrado en video.** Si Meta no ve el permiso "en acción", rechaza.
- **No pidas permisos que no usás todavía.** `leads_retrieval` y los de community management
  (`pages_manage_engagement`, `pages_manage_metadata`) requieren que la **UI exista** en el
  screencast. Si aún no están, **mandá primero la tanda de solo-lectura** (permisos 1-9) y estos
  3 en una segunda submission cuando la UI esté lista.
- **Data real, no mocks.** Meta rechaza screencasts con data de ejemplo.
- **Política de privacidad + eliminación de datos** deben estar publicadas y linkeadas en la app.
- **App en modo Live** antes de enviar (algunos permisos no se revisan en modo Development).

## Recomendación de tandas
- **Tanda A (ya, solo lectura, cubre el 100% del valor core):** `ads_read`, `read_insights`,
  `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `instagram_basic`,
  `instagram_manage_insights`, `instagram_manage_comments`, `business_management`.
- **Tanda B (cuando exista la UI):** `pages_manage_engagement`, `pages_manage_metadata`,
  `leads_retrieval`.
