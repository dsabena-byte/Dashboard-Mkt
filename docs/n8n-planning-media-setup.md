# Setup del workflow: Planning Media desde Drive folder

Workflow N8N que cada hora **lee TODOS los CSVs de un folder de Drive** y
los sincroniza con la tabla `planning_media` de Supabase. Cero edición manual:
vos solo subís los archivos al folder cuando OMD te los manda.

## El flujo mensual del usuario

```
OMD te manda los CSVs ─→ Los arrastrás al folder de Drive "Pauta-omd"
                                ↓
                         (N8N cada 1h lee el folder)
                                ↓
                            Supabase actualizado
                                ↓
                         /planning se actualiza solo
```

**Eso es todo**. Si en Junio te llegan 6 archivos (`Junio-Brand.csv`,
`Junio-Lavado.csv`, etc.), los subís al mismo folder y el dashboard los toma.

## Estructura esperada

### Folder de Drive

`Mi unidad / Dash-Mkt / Pauta-omd /` (o donde lo tengas — solo necesitamos el ID).

### Nombre de archivos

**Patrón obligatorio**: `Mes-Categoria.csv` (case-insensitive, separador `-` o `_`).

Ejemplos válidos:
- `Mayo-Brand.csv`
- `Mayo-Refrigeracion.csv` → se normaliza a "Refrigeración"
- `Mayo-UGC.csv`
- `Mayo-Cocinas.csv` → se normaliza a "Cocina"
- `Junio-Promocion.csv` → se normaliza a "Promoción"

El **mes** debe ser el nombre completo en español (Enero–Diciembre). Sin
acentos en el filename (los acentos se agregan al normalizar la categoría).

### Contenido de cada CSV

El workflow es flexible con los headers. Detecta automáticamente columnas
con estos nombres (case-insensitive):

| Concepto | Headers aceptados |
|----------|-------------------|
| Rol | `Rol Of Comms`, `Rol` |
| TouchPoint | `TouchPoint`, `Touchpoint`, `Touch Point` |
| Sistema | `Sistema`, `Plataforma`, `Platform` |
| Formato | `Formato & Channel`, `Formato`, `Format` |
| Inversión | el nombre del mes (`Mayo`, `Junio`, etc.) **o** `Inversion` / `Invertido` / `Total` |

**Importante**: el workflow PRIMERO busca una columna con el nombre del mes
(formato wide-format con 12 columnas mensuales). Si no la encuentra, busca
una columna genérica `Inversion`.

### Ejemplo de CSV válido (formato genérico)

```csv
Rol Of Comms,TouchPoint,Sistema,Formato & Channel,Inversion
Build,,YouTube,Bumper,1098470
Build,,YouTube,TrueView,3019200
Build,,TikTok,InFeed,1098354
Consider,,GeoMobile,Display,1076716
Consider,,Google Search,Txt,439476
```

### Ejemplo de CSV válido (formato wide con todos los meses)

```csv
Rol Of Comms,TouchPoint,Sistema,Formato & Channel,Enero,Febrero,Marzo,Abril,Mayo,...
Build,,YouTube,Bumper,$ -,$ -,$ -,$ -,$ 1.098.470
Build,,YouTube,TrueView,$ -,$ -,$ -,$ -,$ 3.019.200
```

En este caso, si el filename es `Mayo-Refrigeracion.csv`, toma solo los
valores de la columna **Mayo**.

### Costos (IIBB, Tech Fee, etc.)

Las líneas que tengan en `Formato & Channel` palabras como `IIBB`,
`PERCEPCIÓN`, `Cheque`, `Impuesto`, `Tech Fee`, `Comisión` se detectan
automáticamente como **costos** (`tipo='costo'`) y se separan del cálculo
de inversión en medios. No requieren ninguna marca especial — solo respetá
los nombres.

## Pre-requisitos

- Migración aplicada: `supabase/migrations/0004_planning_media.sql`
- **Credencial Google Drive OAuth2** en N8N (puede ser nueva — no necesariamente
  la misma de Sheets, aunque podés usar la misma cuenta de Google).
- Folder de Drive con los CSVs.

## Paso 1 — Conseguir el Folder ID de Drive

1. Abrí el folder en Drive (https://drive.google.com).
2. Andá al folder donde tenés tus CSVs (ej: "Pauta-omd").
3. Mirá la URL: `https://drive.google.com/drive/folders/1xjV1yy11Mjoz...`
4. **El folder ID** es la parte después de `/folders/`. Copialo.

## Paso 2 — Importar el workflow en N8N

1. Bajate `n8n-workflows/drive-planning-media-sync.json` del repo.
2. N8N → **Workflows → Create → ⋮ → Import from File**.
3. Renombrá a **"Drive Planning Media Sync"**.

## Paso 3 — Configurar el folder ID

Doble-click en el nodo **"Set Config"**. Vas a ver:

```js
return [{
  json: {
    folderId: 'REPLACE_WITH_DREAN_PAUTA_FOLDER_ID',
    year: 2026,
  }
}];
```

Reemplazá:
- `REPLACE_WITH_DREAN_PAUTA_FOLDER_ID` por tu folder ID del Paso 1.
- Si necesitás cambiar el año (cuando arranque 2027), editá el `year`.

## Paso 4 — Conectar Google Drive

Para los dos nodos de Google Drive (`Drive — List CSVs` y `Drive — Download each`):

1. Doble-click en el nodo.
2. **Credential** → **+ Create new credential** → **Google Drive OAuth2 API**.
3. Sign in with Google → usá la cuenta que tiene acceso al folder.
4. Guardá la credencial.
5. Aplicá la misma credencial al segundo nodo Drive (no hay que crearla de nuevo).

## Paso 5 — Configurar Supabase

Mismas dos opciones que los otros workflows:

### A) Variables de entorno (Pro/Enterprise)

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya configuradas.

### B) Hardcodear (Starter/Free)

En el nodo **"Supabase — Upsert planning_media"**:

- **URL**: `https://TU-PROJECT.supabase.co/rest/v1/planning_media?on_conflict=fecha,campania,rol,sistema,formato,tipo`
- **Headers**: `apikey` y `Authorization: Bearer` con tu `sb_secret_...`.

## Paso 6 — Probar

1. Save.
2. **Manual trigger → Execute workflow**.
3. Observá el flujo:
   - **Drive — List CSVs**: debería devolver tantos items como CSVs tengas en el folder (5-6).
   - **Drive — Download each**: para cada item, descarga el binary.
   - **Parse CSVs**: el output debería ser una lista de filas con `fecha`, `campania`, `sistema`, `formato`, `inversion`, etc.
   - **Supabase Upsert**: status 201.
4. Verificá Supabase → `planning_media` debería tener filas.
5. Abrí `/planning` en el dashboard → debería poblarse.

## Paso 7 — Activar

Toggle del workflow a **Active**. Cada hora N8N relee el folder y sincroniza.

## Subir un mes nuevo

Cuando OMD te mande los CSVs de Junio:

1. Subílos al mismo folder de Drive.
2. Asegurate que los filenames sigan el patrón `Junio-Brand.csv`, `Junio-Lavado.csv`, etc.
3. Esperá hasta la próxima hora (o forzá Execute manual en N8N).
4. `/planning` muestra Junio automáticamente.

## Troubleshooting

### El workflow no encuentra archivos
- Verificá que el folder ID esté bien en Set Config.
- Verificá que la credencial de Drive tenga acceso al folder (compartilo con
  el email de la cuenta de Google que autorizaste).

### "Filename no matchea patrón Mes-Categoria.csv"
El parser exige `Mes-Categoria.csv` (mes en español, completo). Si tus
filenames son distintos (ej: "Refrigeracion_Mayo.csv" o "RefriMayo.csv"),
ajustá el regex `m = filename.match(...)` en el Code node.

### "No encontré columna de inversión"
El parser busca una columna con el nombre del mes (Mayo, Junio, etc.) o
una columna genérica `Inversion`/`Invertido`/`Total`. Si tu CSV usa otro
header (ej: `Pesos`, `Monto`), agregalo al array `idx('Inversion', 'Inv', ...)`.

### Mes mal detectado
El mes se extrae del filename. Si tenés "Mayo" o "mayo", funciona.
"MAYO" tambén. Acentos en el filename (rara vez) pueden fallar — usá los
nombres sin acentos en filenames.

### Costos no se separan bien
Los detectores son `IIBB`, `PERCEPCIÓN`, `Cheque`, `Impuesto`, `Tech Fee`,
`Comisión` (case-insensitive, sustring). Si OMD usa otro nombre, agregalo
a `COSTO_PATTERNS` en el Code node.
