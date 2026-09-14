# Política de Privacidad — BIP (Business Impact Platform)

> **Publicar en `https://bip-go.com/privacidad` (editar `privacy.html` del `bip-site`).** Cumple la
> **Google API Services User Data Policy** (incl. Limited Use y protección de datos sensibles) y las
> **Meta Platform Terms / Developer Policies**. Redactada para los scopes que BIP solicita: Google
> `analytics.readonly`, `adwords`, `drive.file` (o `spreadsheets.readonly`); y los permisos de Meta
> (páginas, Instagram, anuncios y gestión de contenido). **Última actualización: 14-sep-2026.**
>
> Nota de implementación: donde diga *(en implementación)*, el control debe estar activo **antes** de
> reenviar la verificación, para que la política sea veraz (requisito de Google y de este rol).

---

## 1. Responsable del tratamiento
BIP (Business Impact Platform) es un servicio operado por **ROQUÉ Marketing Insights** ("BIP",
"nosotros"). Contacto de privacidad y ejercicio de derechos: **bip.explore@gmail.com**.

## 2. Qué es BIP y principio rector
BIP es una **plataforma de analítica e integración de marketing**: cada cliente **conecta sus propias
cuentas** (Google, Meta) y BIP le muestra sus métricas en tableros, sobre **su propia operación**.
Operamos bajo **mínimo privilegio**: pedimos el acceso más acotado necesario para la función y, en
Google, **solo lectura** de datos de reporte (más `drive.file`, que accede **únicamente a los archivos
que el usuario elige explícitamente**).

## 3. Datos que tratamos
**a) Datos de tu cuenta BIP:** nombre, apellido, email, empresa/marca, sector, rol y datos de
facturación (gestionados por el proveedor de pagos; BIP **no almacena datos de tarjeta**).

**b) Datos de las plataformas que conectás (con tu consentimiento OAuth explícito):**
- **Google Analytics 4 (`analytics.readonly`):** métricas y dimensiones de tus propiedades GA4
  (sesiones, usuarios, conversiones, canales, etc.). **Solo lectura.**
- **Google Ads (`adwords`):** métricas de tus campañas de pauta (inversión, impresiones, clicks,
  conversiones, creatividades). **Solo lectura/reporte.**
- **Google Drive / Sheets (`drive.file`):** el contenido de **las planillas que vos seleccionás**
  mediante el selector de Google (Google Picker) — p. ej. Cuadros Básicos o Floor Share. Accedemos
  **solo a esos archivos elegidos**, no a todo tu Drive.
- **Meta (Facebook / Instagram):** datos de tus Páginas, cuentas de Instagram Business y cuentas de
  anuncios (alcance, engagement, seguidores, métricas de pauta, comentarios) para mostrarlos en tus
  tableros; y, **si activás la publicación de contenido**, la creación/publicación de posteos que vos
  aprobás.

## 4. Para qué usamos estos datos (finalidad)
Únicamente para **prestarte el servicio**: mostrarte tus datos en tus tableros, calcular tus KPIs vs
metas, generar **insights y alertas** (incluida asistencia con IA) sobre **tu propia** información, y
—si lo activás— publicar el contenido que apruebes. **No usamos tus datos para ningún otro fin.**

## 5. Base del tratamiento
Tu **consentimiento explícito** al conectar cada plataforma por OAuth. Podés **revocarlo** en cualquier
momento (ver §10).

## 6. Uso limitado (Google Limited Use + Meta Platform Terms)
El uso que BIP hace de la información recibida de las APIs de Google se **ajusta a la
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
incluidos los requisitos de Limited Use**. En particular, y de forma equivalente para los datos de Meta:
- **No vendemos** tus datos ni los de tus usuarios.
- **No los usamos para publicidad** ni para perfilado con fines publicitarios.
- **No los usamos, ni los compartimos, para entrenar ni mejorar modelos de IA/ML generalizados**
  (ver §8).
- **No los transferimos** salvo (i) para prestarte el servicio, (ii) por obligación legal, (iii) con
  tu consentimiento, o (iv) a los subprocesadores estrictamente necesarios listados en §9.
- Solo el **personal autorizado** accede a datos, cuando es necesario para operar o soportar el
  servicio, o por seguridad/cumplimiento.

## 7. Mecanismos de protección de datos sensibles (seguridad)
BIP aplica controles técnicos y organizativos para proteger los datos, en especial los datos sensibles
obtenidos vía las APIs de Google y Meta:
- **Cifrado en tránsito:** todo el tráfico viaja sobre **TLS/HTTPS** (extremo a extremo: navegador ↔
  plataforma ↔ base de datos ↔ APIs de Google/Meta).
- **Cifrado en reposo:** los datos almacenados están **cifrados en reposo (AES-256)** por nuestro
  proveedor de base de datos (Supabase/PostgreSQL).
- **Tokens OAuth protegidos:** los tokens de acceso a tus cuentas se almacenan **cifrados** y se
  gestionan mediante un servicio dedicado de conexiones (Nango); **la aplicación nunca los expone al
  navegador** y son **revocables**.
- **Aislamiento por cliente (multi-tenant):** los datos de cada cliente están **segregados a nivel de
  fila con Row-Level Security (RLS)** en la base de datos; un cliente **no puede** acceder a datos de
  otro.
- **Control de acceso por roles (RBAC) y mínimo privilegio:** el acceso se otorga por rol
  (dueño/administrador/miembro) y se limita a lo necesario; los scopes de Google son **de solo
  lectura**.
- **Gestión de secretos:** las claves de servicio y credenciales viven en **variables de entorno
  cifradas** del proveedor de hosting, **nunca en el código ni en el repositorio**; la clave de
  service-role se usa **solo del lado del servidor**.
- **Registro y auditoría:** registramos eventos de conexión, facturación y actividad para detectar uso
  indebido y dar trazabilidad.
- **Revocación y baja:** al **desconectar** una plataforma o **eliminar** tu cuenta, revocamos el token
  y **purgamos** los datos asociados (ver §10). *(purgado automático en implementación)*
- **Ciclo de desarrollo seguro:** revisión de código, verificación de tipos/build previa a cada
  despliegue y actualización de dependencias.

## 8. Inteligencia artificial (IA)
BIP puede generar insights y respuestas asistidas por IA (proveedor: **OpenAI**), enviando datos
**exclusivamente para la inferencia que te devuelve el resultado**. **No** usamos —ni permitimos que se
usen— tus datos de Google/Meta para **entrenar ni mejorar modelos de IA/ML** generalizados. Los datos
enviados a la API de IA **no se utilizan para entrenamiento** por parte del proveedor.

## 9. Subprocesadores
Para prestar el servicio usamos proveedores que tratan datos por cuenta de BIP, bajo obligaciones de
confidencialidad y seguridad:
- **Supabase** — base de datos, autenticación y almacenamiento (cifrado en reposo, RLS).
- **Vercel** — hosting de la aplicación (TLS).
- **Nango** — gestión cifrada de conexiones/tokens OAuth.
- **OpenAI** — generación de insights por IA (inferencia; sin entrenamiento).
- **Mercado Pago** — procesamiento de pagos (BIP no almacena datos de tarjeta).
- **Google / Meta** — como fuentes de los datos que vos conectás.

## 10. Retención y eliminación de datos
Conservamos tus datos mientras tu cuenta esté activa y la conexión vigente. Podés:
- **Desconectar** una plataforma desde *Conexiones*: revocamos el token y **eliminamos los datos
  derivados** de esa fuente.
- **Solicitar la eliminación** de tu cuenta y de todos tus datos escribiendo a
  **bip.explore@gmail.com**; la procesamos **dentro de los 30 días**.
- La instrucción de **eliminación/desautorización de Meta** se atiende por el mismo canal. *(flujo de
  purga automatizado en implementación)*

## 11. Tus derechos
Podés solicitar **acceso, rectificación, eliminación** de tus datos y **revocar** el consentimiento en
cualquier momento, escribiendo a **bip.explore@gmail.com**.

## 12. Transferencias internacionales
Los proveedores mencionados pueden procesar datos fuera de tu país; en todos los casos exigimos medidas
de seguridad adecuadas y el cumplimiento de las políticas de las plataformas.

## 13. Cambios en esta política
Podemos actualizar esta política; publicaremos la versión vigente en esta URL con su fecha de
actualización.

## 14. Contacto
Consultas de privacidad y ejercicio de derechos: **bip.explore@gmail.com**.

---
### Nota para el submit de Google (no va en la web publicada)
Google exige que la política: (a) esté en el **mismo dominio** que el homepage del consent
(`bip-go.com`), (b) esté **linkeada en la pantalla de consentimiento**, (c) divulgue acceso/uso/
almacenamiento/compartición **de cada dato de Google** (§3-4), (d) incluya el texto de **Limited Use**
(§6) y (e) el **mecanismo de protección de datos sensibles** (§7) — que era el item textual rechazado.
Para Meta: divulgación de datos de Plataforma + **eliminación de datos** (§10) + no uso para fines no
declarados (§6).
