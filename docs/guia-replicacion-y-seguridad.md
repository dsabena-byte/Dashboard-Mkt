# Guía: replicar el tablero para otra empresa + Seguridad

> Documento en lenguaje simple. Explica **qué es el sistema**, **cómo se
> replicaría para otra empresa** y **cómo se protege la confidencialidad de los
> datos** (riesgos de hackeo y cómo evitarlos). Pensado para que lo entienda
> cualquiera, no solo un programador.

---

## 1. Qué es este sistema, en simple

Es un tablero de marketing que hace tres cosas:

1. **Recolecta** datos de muchas fuentes: Meta/Instagram, Google Ads, YouTube/DV360, Google Analytics, TikTok, buscadores (SEO), research de mercado, etc.
2. **Los guarda** ordenados en una base de datos en la nube.
3. **Los muestra** en gráficos y tableros para tomar decisiones.

Las piezas técnicas, cada una explicada en una línea:

| Pieza | Qué es, en criollo |
|---|---|
| **Next.js / React** | El programa que dibuja las pantallas y los gráficos (la parte visible). |
| **Vercel** | El servicio en la nube que mantiene la app "prendida" y online. |
| **Supabase** | La base de datos en la nube (como un archivo gigante y seguro donde se guarda todo) + el sistema de login. |
| **GitHub Actions** | Unos "robots" programados que corren cada tanto y salen a buscar los datos frescos de cada fuente. |
| **APIs de las plataformas** (Meta, Google…) | Las puertas oficiales por donde cada plataforma nos entrega SUS datos. |
| **IA (OpenAI, fal.ai)** | Analiza comentarios, arma insights, mide visibilidad, genera contenido. |

La regla mental clave: **los gráficos son lo fácil. Lo difícil y valioso es la
"cañería" que trae los datos de cada fuente** (los conectores).

---

## 2. Cómo replicarlo para otra empresa

### El concepto central
El **código** (la lógica) se reutiliza casi entero. Lo que cambia de una empresa a
otra son los **datos de configuración**: qué marcas, qué cuentas publicitarias,
qué país. La forma correcta **no** es "copiar todo y cambiarlo a mano" (eso se
vuelve un caos de mantener), sino **separar el código de la configuración** —
como un molde de torta (el código) que usás con distintos ingredientes (la
configuración de cada empresa).

### Los tres caminos posibles

| Camino | Analogía | Cuándo conviene |
|---|---|---|
| **A. Copiar y cambiar a mano** | Hacer cada torta desde cero | Solo si es 1 empresa y nunca más. Después es un dolor de cabeza. |
| **B. Molde configurable** | Un molde reutilizable + ingredientes por empresa | **La recomendada** para 2 a 5 empresas. |
| **C. Fábrica multi-empresa** | Una fábrica que produce para muchos a la vez | Si va a ser un producto para muchos clientes. Más caro de arrancar. |

**Recomendación: el camino B (molde configurable)**, armado de forma que después
pueda crecer al C si se vuelve un producto.

### Qué significa "separar la configuración del código"
Hoy, cosas como "cuáles son las marcas competidoras" o "cuáles son las cuentas de
Google Ads" están escritas **adentro** del código. Para replicar, hay que sacarlas
a un archivo (o tabla) de configuración aparte. Así, **empresa nueva = archivo de
configuración nuevo, mismo código**. Lo que hay que parametrizar:

- Marcas propias y competidoras, y categorías de producto.
- Las cuentas de cada plataforma (los identificadores de Meta, Google Ads, YouTube, Analytics, TikTok).
- El país e idioma (afecta buscadores, mapas, moneda, textos).
- Las palabras clave a monitorear y el set de competidores.
- Los datos de research de mercado.

### Dónde está el trabajo de verdad (importante entender esto)
No son los gráficos —esos ya están hechos—. El esfuerzo real es:

1. **Conseguir los accesos** de la empresa nueva a **sus propias** cuentas
   (Meta, Google Ads, Analytics, etc.). La empresa te tiene que **dar permiso**
   para leer sus cuentas publicitarias. Esto es gestión y permisos, lleva tiempo,
   y **no es programar** — es el cuello de botella real.
2. **Cargar esos accesos** en la configuración.

### Qué conviene mejorar al replicar (aprendido de este sistema)
- **Automatizar las actualizaciones de la base de datos.** Hoy algunos cambios se
  hacen a mano; conviene que sean automáticos para no equivocarse.
- **Mejorar los "robots" que traen datos.** Hoy corren con una herramienta que
  tiene límites de tiempo incómodos (ya tuvimos que hacer arreglos por eso). Para
  un producto conviene una herramienta especializada que reintente sola y avise si
  algo falla.
- **Poner topes de gasto de IA por empresa** (el costo de IA se dispara fácil).
- **Dejar el Monitoreo de base** (ya existe y es muy útil: avisa si una fuente de
  datos se atrasa o se rompe).

### Lo que puede NO transferirse (hay que decirlo de entrada)
- Los tableros que dependen de **research pago específico** (estudios de marca y de
  mercado del rubro). Otra empresa u otro país quizás no lo tiene → esos tableros
  necesitan la fuente equivalente o se dejan afuera.
- Cosas atadas a **Argentina/español** (buscadores, mapa de provincias, textos) →
  hay que adaptarlas si el mercado es otro.

### Plan por fases
- **Fase 0 — Preparar el molde:** sacar del código todo lo específico de la
  empresa actual y llevarlo a configuración. Se hace **una sola vez** y sirve para
  todas las empresas siguientes.
- **Fase 1 — Infraestructura nueva:** base de datos nueva, hosting nuevo, usuarios,
  llaves.
- **Fase 2 — Onboarding (el cuello de botella):** conseguir los accesos de la
  empresa y cargarlos.
- **Fase 3 — Prender los conectores** uno por uno y validar que los datos lleguen
  bien.
- **Fase 4 — Marca y colores**, y listo: los tableros funcionan casi solos con los
  datos fluyendo.

---

## 3. Seguridad y confidencialidad de los datos

Esta es la parte más importante si se lo ofrecés a otra empresa: van a confiarte
datos muy sensibles y van a querer garantías.

### Por qué importa tanto
Un tablero de marketing contiene información **muy delicada**: cuánto gasta la
empresa en publicidad, su estrategia, qué campañas funcionan, datos de la
competencia, a veces datos de clientes. Si se filtra, el daño es serio:
competitivo (que lo vea un rival), legal (leyes de protección de datos) y
reputacional (perder la confianza del cliente).

### Las "llaves" del sistema y por qué cuidarlas
El sistema tiene distintas llaves (contraseñas de máquinas). Entender cada una:

| Llave | Qué abre | Riesgo si se filtra |
|---|---|---|
| **Llave maestra de la base (service_role)** | Leer y escribir **toda** la base sin restricción | Altísimo — es la llave del reino. |
| **Tokens de las plataformas** (Meta, Google) | Acceso a las **cuentas publicitarias** de la empresa | Alto — alguien podría ver, o peor, tocar las campañas. |
| **Llaves de IA** (OpenAI, fal) | Usar esos servicios | Medio — alguien gasta tu crédito. |

**Regla de oro:** los secretos van **siempre** en "variables de entorno" (una
especie de caja fuerte del servidor, separada del código), y **nunca** escritos
dentro del código ni subidos a un repositorio. Si una llave se filtra, se **rota**
(se cambia por una nueva) de inmediato.

### Cómo se protege QUIÉN entra al tablero
- **Login con usuarios autorizados** (hoy, vía Supabase Auth). Solo entran los
  emails habilitados.
- **Las contraseñas están encriptadas de una sola vía** ("hasheadas"): ni el
  administrador puede verlas. Si alguien la olvida, se **resetea**, no se
  recupera. Esto es bueno: aunque roben la base, no obtienen las contraseñas.
- **Permisos por página:** cada usuario ve solo las secciones que le corresponden.
- **Recomendado:** activar **doble factor (2FA)**, exigir contraseñas fuertes, y
  **sacar del sistema a la gente que deja de trabajar** en el proyecto.

### Cómo se protege la BASE de datos
- **Reglas de acceso por fila (RLS):** reglas que dicen "cada quien ve solo lo que
  le corresponde". Es fundamental si varias empresas comparten infraestructura.
- **Aislamiento por empresa (la garantía más fuerte):** la forma más segura de
  garantizar confidencialidad entre clientes es que **cada empresa tenga su propia
  base de datos separada**. Así los datos de una empresa **físicamente no pueden
  mezclarse** con los de otra. Es un poco más caro que compartir, pero es la
  garantía más contundente para venderle confidencialidad a un cliente.
- **Copias de seguridad (backups) automáticas**, por si algo se pierde o se
  corrompe.
- **Conexiones siempre encriptadas** (los datos viajan cifrados, "candadito"
  https).

### Riesgos de hackeo y cómo evitarlos

| Riesgo | Qué es | Cómo se mitiga |
|---|---|---|
| **Filtración de una llave** (el más común) | Un secreto queda expuesto (subido por error al código, en un mail, etc.) | Nunca en el código; rotarlas periódicamente; usar detección automática de secretos filtrados. |
| **Contraseñas débiles / phishing** | Le roban la clave a un usuario o lo engañan | 2FA, contraseñas fuertes, capacitar a la gente para no caer en engaños. |
| **Puertas traseras expuestas** | Los "robots" llaman a direcciones internas que, si quedan abiertas, cualquiera podría disparar | Protegerlas con un secreto (ya se hace) y mantenerlas cerradas. |
| **Librerías desactualizadas** | El sistema usa componentes de terceros que a veces tienen fallas conocidas | Mantener todo actualizado; usar avisos automáticos de vulnerabilidades. |
| **Ex-integrantes con acceso** | Alguien que se fue sigue pudiendo entrar | Revocar accesos apenas alguien deja el proyecto. |
| **Datos que salen a terceros** | Se envía información a servicios de IA/analítica externos | Saber exactamente qué se manda; usar proveedores que **no entrenan** con tus datos; no enviar datos personales sensibles. |

### Confidencialidad con un cliente nuevo (lo técnico + lo contractual)
- **Aislar los datos:** base separada por cliente (lo dicho arriba). Es el punto
  más importante.
- **Acuerdos legales:** firmar un **NDA** (acuerdo de confidencialidad) y un
  acuerdo de tratamiento de datos, y cumplir la ley de protección de datos que
  aplique (en Argentina, la Ley 25.326; si hay datos de Europa, GDPR).
- **Mínimo acceso necesario:** cada persona y cada servicio con el mínimo permiso
  que necesita, nada más.
- **Registro de accesos (auditoría):** poder saber quién entró y qué miró, por si
  hay que investigar algo.

### Checklist rápido de seguridad (para arrancar tranquilos)
- [ ] Todos los secretos en variables de entorno, ninguno en el código.
- [ ] 2FA activado en las cuentas críticas (base de datos, hosting, plataformas).
- [ ] Contraseñas fuertes y usuarios revisados (sacar los que no van).
- [ ] Base de datos **separada por empresa**.
- [ ] Backups automáticos activados.
- [ ] Dependencias actualizadas + avisos de vulnerabilidades prendidos.
- [ ] NDA + acuerdo de datos firmados con el cliente.
- [ ] Plan de rotación de llaves (cambiarlas cada X meses o ante cualquier sospecha).
- [ ] Monitoreo prendido (avisa si algo se rompe).

---

## Resumen en una frase
El código se reutiliza; el trabajo real es **(1)** preparar el molde una vez y
**(2)** conseguir y cargar los accesos de cada empresa nueva. Y para venderlo con
tranquilidad, la seguridad se basa en tres pilares: **secretos bien guardados,
datos aislados por empresa, y control estricto de quién entra**.
