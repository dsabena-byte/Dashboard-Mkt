# Guía completa: replicar el tablero, modelo de negocio, seguridad y la brújula de marca

> Documento en lenguaje simple. Explica **qué es el sistema**, **cómo se
> replicaría para otra empresa**, **cómo cobrarlo (modelo de alquiler)**, **cómo
> se protege la confidencialidad de los datos**, y **la capacidad diferencial:
> el modelo que predice la salud de marca entre mediciones**. Pensado para que lo
> entienda cualquiera, no solo un programador.

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

La regla mental clave: **los gráficos son lo fácil. Lo difícil y valioso es la "cañería" que trae los datos de cada fuente** (los conectores).

---

## 2. Cómo replicarlo para otra empresa

### El concepto central
El **código** (la lógica) se reutiliza casi entero. Lo que cambia de una empresa a otra son los **datos de configuración**: qué marcas, qué cuentas publicitarias, qué país. La forma correcta **no** es "copiar todo y cambiarlo a mano" (eso se vuelve un caos de mantener), sino **separar el código de la configuración** — como un molde de torta (el código) que usás con distintos ingredientes (la configuración de cada empresa).

### Los tres caminos posibles

| Camino | Analogía | Cuándo conviene |
|---|---|---|
| **A. Copiar y cambiar a mano** | Hacer cada torta desde cero | Solo si es 1 empresa y nunca más. Después es un dolor de cabeza. |
| **B. Molde configurable** | Un molde reutilizable + ingredientes por empresa | **La recomendada** para 2 a 5 empresas. |
| **C. Fábrica multi-empresa** | Una fábrica que produce para muchos a la vez | Si va a ser un producto para muchos clientes. Más caro de arrancar. |

**Recomendación: el camino B (molde configurable)**, armado de forma que después pueda crecer al C si se vuelve un producto.

### Qué significa "separar la configuración del código"
Hoy, cosas como "cuáles son las marcas competidoras" o "cuáles son las cuentas de Google Ads" están escritas **adentro** del código. Para replicar, hay que sacarlas a un archivo (o tabla) de configuración aparte. Así, **empresa nueva = archivo de configuración nuevo, mismo código**. Lo que hay que parametrizar:

- Marcas propias y competidoras, y categorías de producto.
- Las cuentas de cada plataforma (los identificadores de Meta, Google Ads, YouTube, Analytics, TikTok).
- El país e idioma (afecta buscadores, mapas, moneda, textos).
- Las palabras clave a monitorear y el set de competidores.
- Los datos de research de mercado.

### Dónde está el trabajo de verdad (importante entender esto)
No son los gráficos —esos ya están hechos—. El esfuerzo real es:

1. **Conseguir los accesos** de la empresa nueva a **sus propias** cuentas (Meta, Google Ads, Analytics, etc.). La empresa te tiene que **dar permiso** para leer sus cuentas publicitarias. Esto es gestión y permisos, lleva tiempo, y **no es programar** — es el cuello de botella real.
2. **Cargar esos accesos** en la configuración.

### Qué conviene mejorar al replicar (aprendido de este sistema)
- **Automatizar las actualizaciones de la base de datos.** Hoy algunos cambios se hacen a mano; conviene que sean automáticos para no equivocarse.
- **Mejorar los "robots" que traen datos.** Hoy corren con una herramienta que tiene límites de tiempo incómodos (ya tuvimos que hacer arreglos por eso). Para un producto conviene una herramienta especializada que reintente sola y avise si algo falla.
- **Poner topes de gasto de IA por empresa** (el costo de IA se dispara fácil).
- **Dejar el Monitoreo de base** (ya existe y es muy útil: avisa si una fuente de datos se atrasa o se rompe).

### Lo que puede NO transferirse (hay que decirlo de entrada)
- Los tableros que dependen de **research pago específico** (estudios de marca y de mercado del rubro). Otra empresa u otro país quizás no lo tiene → esos tableros necesitan la fuente equivalente o se dejan afuera.
- Cosas atadas a **Argentina/español** (buscadores, mapa de provincias, textos) → hay que adaptarlas si el mercado es otro.

### Plan por fases
- **Fase 0 — Preparar el molde:** sacar del código todo lo específico de la empresa actual y llevarlo a configuración. Se hace **una sola vez** y sirve para todas las empresas siguientes.
- **Fase 1 — Infraestructura nueva:** base de datos nueva, hosting nuevo, usuarios, llaves.
- **Fase 2 — Onboarding (el cuello de botella):** conseguir los accesos de la empresa y cargarlos.
- **Fase 3 — Prender los conectores** uno por uno y validar que los datos lleguen bien.
- **Fase 4 — Marca y colores**, y listo: los tableros funcionan casi solos con los datos fluyendo.

---

## 3. El modelo de negocio (alquiler de la plataforma)

La idea: vos sos el dueño de la plataforma y de las herramientas; el cliente
**solo usa el tablero**, paga un abono mensual, y si deja de pagar le cortás el
acceso. Es el modelo clásico de "software como servicio". Funciona muy bien, con
un matiz clave.

### Hay DOS tipos de cuentas
**1. Tus herramientas (SÍ quedan a tu nombre):** Apify, fal.ai, Claude/OpenAI,
DataForSEO, n8n, Vercel, Supabase, GitHub. Son tu caja de herramientas operativa.
El cliente **nunca las toca ni las ve**. Vos las pagás y ese costo va dentro del
abono.

**2. Las cuentas de marketing del propio cliente (NO son tuyas):** Meta Ads,
Google Ads, YouTube/DV360, Analytics, TikTok, su Instagram/Facebook. Son **del
cliente**; vos solo conseguís **permiso de lectura** para traer sus datos. No te
podés "adueñar" de la cuenta publicitaria del cliente; si se va, te saca el
permiso.

> Resumen: **las herramientas son tuyas; las fuentes de datos siguen siendo del
> cliente, vos solo tenés la llave para leerlas.**

### Cómo responde el modelo a lo importante
- **El cliente solo ve el tablero, nada más.** Correcto y recomendable: un login
  al tablero y punto. No ve la base, ni el hosting, ni los robots, ni las llaves.
  Menos accesos = más seguro.
- **"Le alquilo la plataforma".** Sí. El abono cubre tus costos de herramientas +
  tu trabajo + margen.
- **"Si deja de pagar, no ve más nada".** Sí, y es **inmediato**: deshabilitás su
  usuario y no entra más; podés además pausar los robots que actualizan sus datos.
  Los datos quedan en tu base (si vuelve, están; o los borrás según contrato). Es
  el clásico "cerrar la canilla", muy fácil de hacer cumplir porque **la
  infraestructura es tuya**.

### 4 cuidados para no comerte un problema
1. **Los datos son del cliente, aunque vos los guardes.** Legalmente la data de
   marketing suele ser del cliente. "No ve más nada" está bien para el **acceso**,
   pero el contrato debe decir **qué pasa con sus datos al terminar** (se devuelven
   o se borran). No se puede "retener datos de rehén".
2. **El costo variable te lo tenés que cubrir.** La IA de imágenes/video/insights
   escala con el uso; un cliente intensivo te dispara la factura. Poné **topes de
   gasto por cliente** y precificá con ese riesgo cubierto.
3. **Cuentas compartidas entre clientes = ojo.** Si varios clientes usan tu misma
   cuenta de IA/SEO, el gasto se mezcla y un problema de uno puede afectar a todos.
   Para los **datos**, base separada por cliente (ver seguridad). Para las
   herramientas, cuenta compartida con topes suele estar bien.
4. **Todo a tu nombre = sos el punto único de falla.** Si le pasa algo a tus
   cuentas, caen todos los clientes. Tené backups, un segundo administrador y los
   pagos al día.

---

## 4. Seguridad y confidencialidad de los datos

Esta es la parte más importante si se lo ofrecés a otra empresa: van a confiarte datos muy sensibles y van a querer garantías.

### Por qué importa tanto
Un tablero de marketing contiene información **muy delicada**: cuánto gasta la empresa en publicidad, su estrategia, qué campañas funcionan, datos de la competencia, a veces datos de clientes. Si se filtra, el daño es serio: competitivo (que lo vea un rival), legal (leyes de protección de datos) y reputacional (perder la confianza del cliente).

### Las "llaves" del sistema y por qué cuidarlas

| Llave | Qué abre | Riesgo si se filtra |
|---|---|---|
| **Llave maestra de la base (service_role)** | Leer y escribir **toda** la base sin restricción | Altísimo — es la llave del reino. |
| **Tokens de las plataformas** (Meta, Google) | Acceso a las **cuentas publicitarias** de la empresa | Alto — alguien podría ver, o peor, tocar las campañas. |
| **Llaves de IA** (OpenAI, fal) | Usar esos servicios | Medio — alguien gasta tu crédito. |

**Regla de oro:** los secretos van **siempre** en "variables de entorno" (una especie de caja fuerte del servidor, separada del código), y **nunca** escritos dentro del código ni subidos a un repositorio. Si una llave se filtra, se **rota** (se cambia por una nueva) de inmediato.

### Cómo se protege QUIÉN entra al tablero
- **Login con usuarios autorizados** (hoy, vía Supabase Auth). Solo entran los emails habilitados.
- **Las contraseñas están encriptadas de una sola vía** ("hasheadas"): ni el administrador puede verlas. Si alguien la olvida, se **resetea**, no se recupera. Esto es bueno: aunque roben la base, no obtienen las contraseñas.
- **Permisos por página:** cada usuario ve solo las secciones que le corresponden.
- **Recomendado:** activar **doble factor (2FA)**, exigir contraseñas fuertes, y **sacar del sistema a la gente que deja de trabajar** en el proyecto.

### Cómo se protege la BASE de datos
- **Reglas de acceso por fila (RLS):** reglas que dicen "cada quien ve solo lo que le corresponde". Es fundamental si varias empresas comparten infraestructura.
- **Aislamiento por empresa (la garantía más fuerte):** la forma más segura de garantizar confidencialidad entre clientes es que **cada empresa tenga su propia base de datos separada**. Así los datos de una empresa **físicamente no pueden mezclarse** con los de otra. Es un poco más caro que compartir, pero es la garantía más contundente para venderle confidencialidad a un cliente.
- **Copias de seguridad (backups) automáticas**, por si algo se pierde o se corrompe.
- **Conexiones siempre encriptadas** (los datos viajan cifrados, "candadito" https).

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
- **Aislar los datos:** base separada por cliente (lo dicho arriba). Es el punto más importante.
- **Acuerdos legales:** firmar un **NDA** (acuerdo de confidencialidad) y un acuerdo de tratamiento de datos, y cumplir la ley de protección de datos que aplique (en Argentina, la Ley 25.326; si hay datos de Europa, GDPR).
- **Mínimo acceso necesario:** cada persona y cada servicio con el mínimo permiso que necesita, nada más.
- **Registro de accesos (auditoría):** poder saber quién entró y qué miró, por si hay que investigar algo.

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

## 5. La capacidad diferencial: predecir la salud de marca entre mediciones (la "brújula")

Esto es lo más valioso que puede ofrecer la plataforma, y lo que la diferencia de
cualquier dashboard común.

### El problema que resuelve
Las marcas miden su "salud" (qué tan fuerte es la marca en la cabeza del
consumidor) con estudios como **Kantar**, pero esos estudios se hacen **una vez al
año**. El resto del año la empresa ejecuta campañas **a ciegas**: no sabe si lo que
hace mueve la aguja hasta que llega el próximo estudio, doce meses después. Este
modelo es una **brújula**: estima, mes a mes, hacia dónde va la salud de marca,
para **corregir el rumbo a tiempo**.

### Qué predice (las variables de salud de marca)
- **Top of Mind:** ¿la marca es la primera que se le viene a la cabeza a la gente?
- **Share of Mind:** ¿cuánta presencia mental tiene vs las otras marcas?
- **Intención de compra:** ¿la gente la considera y la quiere comprar?
- **Poder de marca:** el indicador resumen de fuerza de marca.

Honestamente: Top of Mind, Share of Mind e Intención de compra se estiman bien; el
**Poder de marca** (que tiene una parte más emocional/cualitativa) es el más
difícil de predecir.

### Con qué se predice: las 5 familias de señales
En vez de adivinar, se usan señales reales del mercado, agrupadas en 5 familias.
**Todo se mide en relación a la competencia** (una marca sube cuando se mueve más
que el resto, no en el vacío):

1. **Atención y notoriedad** — cuánto se busca la marca en Google vs las otras
   (Share of Search), su alcance en redes, su presencia publicitaria. → mueve el
   **Top of Mind** y el **Share of Mind**.
2. **Afinidad y conversación** — el sentimiento (positivo/negativo) y el engagement
   en redes vs competidores, y las reseñas de productos. → mueve el **Poder de
   marca** y la **Intención**.
3. **Realidad comercial** — las ventas y el precio de la marca en el mercado
   (participación, índice de precio por segmento). Es el "piso": dónde debería
   estar la marca solo por su fuerza comercial. → mueve **todo**.
4. **Diferenciación** — qué tan distinta/única se percibe (premium de precio
   sostenido, atributos que la destacan). → mueve el **Poder de marca**. Es la más
   difícil de medir.
5. **Voz directa del consumidor** — preguntarle directo a la gente (ver abajo). →
   **ancla y valida** todo lo demás.

### La pieza clave: las encuestas intermedias entre las olas
La familia más valiosa —y lo que convierte esto de "estimación indirecta" a algo
confiable— son las **micro-encuestas** (o "pulse"): encuestas **cortas y baratas**
que se hacen **cada mes o cada trimestre**, preguntando **lo mismo que Kantar**
(¿qué marca se te viene a la cabeza?, ¿cuál comprarías?), pero mucho más seguido.

Llenan el hueco entre las olas anuales del estudio grande y funcionan como un
**"mini-Kantar continuo"** que le da precisión a la brújula. Sin esto, la brújula
es una estimación indirecta; con esto, se acerca mucho a una medición real.

### Cómo se valida y mejora con el tiempo
- **Al arrancar:** el modelo usa relaciones ya conocidas (ej. más búsqueda → más
  notoriedad) y compara marcas entre sí dentro de la misma foto.
- **Cada año, cuando llega la ola de Kantar:** se controla si la brújula había
  acertado el movimiento, se ajustan los pesos y se afina. Con dos o tres olas, la
  brújula se gana la confianza con evidencia.
- **Regla de uso:** es una brújula **direccional** ("vas para el lado correcto" /
  "estás gastando en algo que no mueve la aguja"), no un adivino de números
  exactos. Sirve para **corregir el rumbo dentro del año**, no para reemplazar la
  medición anual.

### Por qué es un diferencial para vender la plataforma
La mayoría de los dashboards muestran lo que **ya pasó**. Este además **anticipa**
si el marketing está construyendo (o no) la marca, meses antes de que el estudio
anual lo confirme. Le permite al cliente **reaccionar dentro del año** en vez de
enterarse tarde. Es de las cosas más valiosas —y difíciles de copiar— que puede
ofrecer la plataforma.

> Nota técnica: el detalle fino del modelo (arquitectura, señales, tablas,
> calibración) está en `docs/brujula-salud-marca.md`. Acá va la versión explicada
> en simple.

---

## Resumen en pocas frases
- **Replicar:** el código se reutiliza; el trabajo real es preparar el molde una
  vez y conseguir/cargar los accesos de cada empresa nueva.
- **Negocio:** modelo de alquiler — vos dueño de la plataforma y las herramientas,
  el cliente solo usa el tablero; si no paga, se corta el acceso al instante. Cuidá
  el contrato de datos, los topes de gasto de IA y no depender de una sola cuenta.
- **Seguridad:** tres pilares — secretos bien guardados, datos aislados por
  empresa, y control estricto de quién entra.
- **Diferencial:** la brújula que predice la salud de marca entre mediciones, con
  las 5 familias de señales y las encuestas intermedias como pieza clave.
