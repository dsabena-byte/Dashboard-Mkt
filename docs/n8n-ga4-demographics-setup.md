# Setup del workflow: GA4 Demographics Sync

Workflow N8N que cada día (4 AM) trae datos demográficos desde Google
Analytics 4 y los escribe en tablas de Supabase para alimentar el card
**Audiencia (GA4)** del dashboard `/web`.

## Tablas que llena

- `ga4_demo_age_gender` → device × (age × gender si están disponibles)
- `ga4_demo_geo` → country × region (× city opcional)
- `ga4_demo_interest` → categorías de interés in-market (opcional, ver más abajo)

## Lecciones aprendidas en la primera puesta a punto

Los defaults del JSON traen las dimensiones "ideales" pero hay que ajustar
según la propiedad GA4 real. En la propiedad de Drean nos pasó:

1. **`userAgeBracket` y `userGender` vienen todos como `unknown`** por data
   thresholding (poco volumen de usuarios logueados en Google). **Decisión**:
   sacamos esas dimensiones del nodo 1; quedó como `date, deviceCategory`.
2. **`city` infla las filas exponencialmente** (~20k por 30 días) y revienta
   n8n.cloud Starter por memory. **Decisión**: sacamos `city`; quedó
   `date, country, region` (~1200 filas).
3. **Aún con 1200 filas, el upsert directo a PostgREST falla** porque
   excede el límite de payload (~1MB). **Solución**: agregamos un nodo
   `Loop Over Items` (batch size 100) entre `Normalize geo` y el upsert.
4. **`brandingInterest` se rompe igual** con strings largos. **Decisión**:
   borramos la rama entera de interest. La tabla `ga4_demo_interest` queda
   creada pero vacía — opcional reactivarla con un workflow propio.

El JSON exportado en este repo refleja la versión que funcionó.

## Pre-requisitos

- Migration `0026_ga4_demographics.sql` aplicada en Supabase.
- **Google Signals** activado en la propiedad GA4 (Admin → Data Settings →
  Data Collection → Google signals data collection).
- **Granular location and device data** activado en la misma pantalla.
- Cuenta de Google con rol Viewer o superior en la propiedad GA4.
- Property ID de GA4 (9 dígitos).

## Paso 1 — Aplicar la migration

En el SQL Editor de Supabase, correr `0026_ga4_demographics.sql`. Es
idempotente (`CREATE TABLE IF NOT EXISTS`) — re-ejecutarla no rompe nada.

## Paso 2 — Importar el workflow

1. Bajate `n8n-workflows/ga4-demographics-sync.json` del repo.
2. En n8n.cloud: **Workflows → Create Workflow → ⋮ → Import from File**.
3. Renombralo a **GA4 Demographics Sync** y guardalo.

## Paso 3 — Conectar Google Analytics (OAuth2)

1. En el primer nodo GA4, **Credential to connect with** → **+ Create new credential**.
2. Tipo: **Google Analytics OAuth2 API**.
3. **Sign in with Google** → elegí la cuenta que tiene acceso a la propiedad.
4. Reusá la misma credencial en los otros nodos GA4.

> **No necesitás Service Account ni proyecto GCP propio**. El OAuth nativo
> de n8n alcanza para esto.

## Paso 4 — Configurar los 3 nodos GA4

n8n.cloud a veces ignora las dimensions/metrics del JSON al importar. Si
después de importar el nodo está vacío o devuelve solo `date + totalUsers`,
configurá a mano según la propiedad real.

### Nodo 1: "GA4 — Age × Gender × Device"

| Campo | Valor |
|---|---|
| Property ID | tu número de 9 dígitos |
| Date Range | `30daysAgo` → `yesterday` (bajar a `7daysAgo` para test) |
| Return All | ON |
| Dimensions | `date`, `deviceCategory` |
| Metrics | `sessions`, `totalUsers`, `newUsers`, `engagedSessions` |

> **Heads up**: el JSON original incluye `userAgeBracket` y `userGender`.
> Probá una corrida con esas dimensiones. Si vienen mayormente `unknown`
> (lo normal en propiedades sin gran volumen de usuarios logueados),
> sacálas — quedaría como arriba.

### Nodo 2: "GA4 — Country × Region × City"

| Campo | Valor |
|---|---|
| Property ID | el mismo |
| Date Range | `30daysAgo` → `yesterday` |
| Return All | ON |
| Dimensions | `date`, `country`, `region` |
| Metrics | `sessions`, `totalUsers`, `newUsers`, `engagedSessions` |

> **Heads up**: el JSON original incluye `city`. Si tu propiedad tiene mucho
> volumen (>5k sesiones/día), `city` puede generar 20k+ filas y reventar
> el upsert por memoria. **Recomendación**: empezar sin `city`.

### Nodo 3: "GA4 — Interest categories" (opcional)

Si querés activarlo, configurá:

| Campo | Valor |
|---|---|
| Property ID | el mismo |
| Date Range | `30daysAgo` → `yesterday` |
| Return All | ON |
| Dimensions | `brandingInterest` (sin `date` — ver nota) |
| Metrics | `sessions`, `totalUsers` |

> **Nota**: sin `date` la tabla `ga4_demo_interest` queda como snapshot
> (sobreescribe cada día). Hay que ajustar el Code node de Normalize para
> setear `fecha = today`. Si en tu propiedad las categorías son pocas
> (<200), podés mantener `date` y agregar Loop Over Items.

> **Si tu propiedad no tiene Google Ads conectado con audiencias activas**,
> `brandingInterest` puede venir mayormente vacío. En ese caso, mejor
> borrar la rama entera del workflow y dejar la tabla vacía.

## Paso 5 — Configurar batching del nodo 2

Por defecto el upsert manda todas las filas en una request. Para `ga4_demo_geo`
con 30 días puede exceder el límite de PostgREST (~1MB). **Insertar un nodo
"Loop Over Items"** entre `Normalize geo` y `Supabase — Upsert ga4_demo_geo`:

1. Click en "+" entre los dos nodos
2. Buscar **Loop Over Items (Split in Batches)**
3. Batch Size: `100`
4. Cableado:
   - `Normalize geo` → `Loop Over Items` (input)
   - **`loop` output** (no `done`) → `Supabase Upsert` (input)
   - Output del Supabase → vuelve al input del Loop Over Items (loop back)
   - `done` queda desconectado

Resultado: manda 100 filas por request, ~13 requests secuenciales para 1200
filas. Tarda ~30s pero no rompe nada.

## Paso 6 — Configurar Supabase URL

Cada uno de los nodos HTTP de upsert tiene el query param `on_conflict=...`
que le indica a PostgREST cuál unique constraint usar para resolver el
upsert. Si lo sacás, PostgREST hace INSERT puro y revienta con duplicate
key cuando GA4 devuelve filas con dimensiones en NULL.

| Tabla | URL completa |
|---|---|
| `ga4_demo_age_gender` | `{{ $env.SUPABASE_URL }}/rest/v1/ga4_demo_age_gender?on_conflict=fecha,age_bracket,gender,device_category` |
| `ga4_demo_geo` | `{{ $env.SUPABASE_URL }}/rest/v1/ga4_demo_geo?on_conflict=fecha,country,region,city,device_category` |
| `ga4_demo_interest` | `{{ $env.SUPABASE_URL }}/rest/v1/ga4_demo_interest?on_conflict=fecha,interest_category` |

Para auth, dos opciones según tu plan:
- **Pro/Enterprise/self-hosted**: usar `{{ $env.SUPABASE_URL }}` +
  `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` como variables.
- **Starter/Free**: hardcodear los valores en cada nodo.

## Paso 7 — Probar

1. **Execute Workflow** (botón naranja, no el de cada paso).
2. Los nodos deben pasar a verde uno por uno.
3. En Supabase → Table Editor, verificar filas en `ga4_demo_age_gender` y
   `ga4_demo_geo`.
4. Abrir `/web` en el dashboard — el card **Audiencia (GA4)** debería
   mostrar el mix de devices y top provincias.

## Paso 8 — Activar el schedule

Toggle del workflow a **Active**. Corre cada día a las 4 AM trayendo los
últimos 30 días. Los datos viejos se sobreescriben (upsert), los nuevos
se insertan.

## Troubleshooting

### "Out of memory" / "Execution stopped"
n8n.cloud Starter tiene RAM limitada. Soluciones:
- Bajar el Date Range a `7daysAgo` para test.
- Agregar Loop Over Items con batch size más chico (50 o 25).
- Si el nodo problemático es `geo` con `city`, sacar `city`.

### "duplicate key value violates unique constraint"
PostgREST está haciendo INSERT en vez de UPSERT. Verificar que la URL del
nodo HTTP tenga `?on_conflict=...` con las columnas exactas del unique
constraint de la tabla.

### `userAgeBracket` y `userGender` vienen todos `unknown`
Es data thresholding de GA4. No es bug del workflow — la propiedad no
tiene suficiente volumen de usuarios autenticados. Sacar esas dimensiones
del nodo 1 (queda como `date, deviceCategory`).

### El card `/web` muestra "Sin datos demográficos"
- Verificar que la migration 0026 se aplicó.
- Verificar que las tablas `ga4_demo_*` tienen filas.
- Verificar que el rango de fechas seleccionado en `/web` cubre fechas
  que el workflow ya cargó.
