# Planning Media Sync — Apps Script (Drive → Supabase)

El sync de la pauta planificada vive en el Apps Script **"Sync Drive Tablero CB"**
que también sincroniza Cuadros Básicos y Floor Share. Sustituye al workflow
viejo de N8N (`drive-planning-media-sync.json`).

**Por qué Apps Script y no GitHub Actions / Vercel**:
- Corre con la cuenta Google del dueño del script → sin OAuth refresh tokens
  para rotar.
- Triggers nativos cada hora sin secrets.
- Tabla `sync_status` trackea cada archivo por `drive_modified` → idempotente.
- Mismo patrón ya validado para CB + Floor Share.

## Arquitectura (importante: 2 proyectos Supabase)

```
                       ┌─────────────────────────────────────┐
                       │  Apps Script "Sync Drive Tablero CB"│
                       │  (corre cada 1h con cuenta Google)  │
                       └──────────────┬──────────────────────┘
                                      │
              ┌───────────────────────┼────────────────────────┐
              ↓                       ↓                        ↓
   ┌───────────────────┐   ┌───────────────────┐   ┌────────────────────┐
   │   Drive folder    │   │   Drive folder    │   │    Drive folder    │
   │  Cuadros Básicos  │   │   Floor Share     │   │   Pauta-omd        │
   │   (CSV semana)    │   │  (CSV por sem)    │   │  (Mes-Pauta.xlsx)  │
   └────────┬──────────┘   └────────┬──────────┘   └────────┬───────────┘
            │                        │                       │
            ↓                        ↓                       ↓
   ┌─────────────────────────────────────────┐   ┌────────────────────────┐
   │       Supabase CB project               │   │ Supabase Principal     │
   │   fsvdcpqzchrezkxflyfi.supabase.co      │   │ vtcrhyyirqexczycuwhe   │
   │                                          │   │ .supabase.co           │
   │  - cuadro_basico_semanal                │   │                        │
   │  - floor_share                          │   │  - planning_media      │
   │  - contactos                            │   │                        │
   │  - sync_status (TODOS los archivos)     │   │                        │
   └─────────────────────────────────────────┘   └────────────────────────┘
```

El script usa **dos ctx**:
- `ctx` (default) — apunta al proyecto CB. CB / FS / contactos / sync_status.
- `planningCtx` — apunta al proyecto principal. Solo se usa para upsertear
  `planning_media`. Las escrituras a `sync_status` siguen al CB.

## Folder de Drive

Default: `1xjV1yy11Mjoz89uCTjNc53l1iNZxgHbp` (property `PLANNING_FOLDER_ID`).

## Convención de archivos

### Formato actual (a partir de Junio 2026)

**Un único archivo `.xlsx` por mes que contiene todo el año**. OMD mantiene
una planilla viva tipo `Junio-Pauta.xlsx` con 12 columnas mensuales
(enero-diciembre), todas las categorías interleavadas (Brand / Cocina /
Refrigeración / Lavado / Promoción / UGC), divididas por sección OFF (TVC,
OOH) y ON (digital), más filas de costos generales al final.

Cada mes recibís una versión nueva con el filename actualizado al mes vigente:
- Junio: `Junio-Pauta.xlsx`
- Julio: `Julio-Pauta.xlsx`
- ...

El parser lee **todas las columnas mensuales** del archivo, así jul-dic se
mantienen actualizados con los forecasts más recientes y los meses pasados se
refrescan si OMD ajustó algo en la planilla.

### Estructura del Excel

| Campaña | Rol Of Comms | Sistema | Formato & Channel | Enero | ... | Diciembre |
|---|---|---|---|---|---|---|
| _vacío_ | Build | **Total OFF** | _vacío_ | $- | ... | $- | ← skip (subtotal) |
| Brand | Build | TVC | Tanda | $- | ... | $- |
| Brand | Build | OOH | Cartel Unicenter | $- | ... | $9.800.000 |
| Cocina | Build | OOH | Kiosco/Totem | ... | ... | ... |
| Refrigeración | Build | OOH | Kiosco/Totem | ... | ... | ... |
| Lavado | Build | OOH | Indoor/Mupis/Totem | ... | ... | ... |
| _vacío_ | Build | **Total ON** | _vacío_ | $- | ... | $- | ← skip (subtotal) |
| Brand | Build | YouTube | Bumper | ... | ... | ... |
| Heladera | Build | YouTube | TrueView | ... | ... | ... | ← mapeo→`Refrigeración` |
| ... | ... | ... | ... | ... | ... | ... |
| _vacío_ | _vacío_ | _vacío_ | PERCEPCIÓN IIBB | $295.835 | ... | ... | ← cost row |
| _vacío_ | _vacío_ | _vacío_ | Impuesto al cheque | ... | ... | ... |
| _vacío_ | _vacío_ | _vacío_ | Tech Fee Programmatic | ... | ... | ... |
| _vacío_ | _vacío_ | _vacío_ | Tech Fee YouTube | ... | ... | ... |
| _vacío_ | _vacío_ | _vacío_ | Comisión Agencia Online | ... | ... | ... |
| _vacío_ | _vacío_ | _vacío_ | Comisión Agencia Offline | ... | ... | ... |
| _vacío_ | _vacío_ | _vacío_ | **Total Campaña** | ... | ... | ... | ← skip (subtotal) |

### Headers detectados (case-insensitive)

| Concepto    | Headers aceptados                                              |
|-------------|----------------------------------------------------------------|
| Categoría   | `Campaña`, `Campana`, `Campania`, `Categoría`, `Categoria`     |
| Rol         | `Rol Of Comms`, `Rol`                                          |
| TouchPoint  | `TouchPoint`, `Touchpoint`, `Touch Point`                      |
| Sistema     | `Sistema`, `Plataforma`, `Platform`                            |
| Formato     | `Formato & Channel`, `Formato`, `Format`                       |
| Inversión   | Nombre del mes (`Junio`) o `Inversion`, `Total`                |

## Reglas del parser (`syncPlanning`)

1. **Filename pattern**: `Mes-Pauta.{csv,xlsx}` (mes en español sin acentos).
   También se acepta el formato legacy `Mes-Categoria.csv` para compatibilidad
   con archivos viejos (ej. `Mayo-Brand.csv`).
2. **XLSX support**: si el archivo es `.xlsx`, el script convierte
   temporalmente a Google Sheets en memoria via Advanced Drive Service
   (`Drive.Files.insert` con `MimeType.GOOGLE_SHEETS`), lee el grid con
   `SpreadsheetApp.openById`, y borra la copia con `Drive.Files.trash`.
   **Requiere Advanced Drive Service v2 habilitado** en el editor.
3. **Detección dinámica del header row**: busca dentro de las primeras 30
   filas la que tenga `Formato` + (`Sistema` o `Rol`) + (`Campaña` o
   `legacyCategoria` del filename). Ignora logo/banners/empty rows arriba.
4. **Mapping de categorías** (`normalizePlanningCategoria`):

   | Input                    | Output            |
   |--------------------------|-------------------|
   | `heladera*`              | `Refrigeración`   |
   | `refriger*`              | `Refrigeración`   |
   | `cocina*`                | `Cocina`          |
   | `lavado`                 | `Lavado`          |
   | `brand`                  | `Brand`           |
   | `promo*`                 | `Promoción`       |
   | `ugc`                    | `UGC`             |
   | Otro                     | Capitalizado raw  |

   ⚠️ El mapeo de `heladera` → `Refrigeración` es crítico: sin él, OMD pasa a
   usar "Heladera" como categoría nueva y los rows quedan duplicados (Heladera
   nueva + Refrigeración vieja del backup).

5. **Detección de subtotales** (`esPlanningSkip`): salta filas donde `sistema`
   o `formato` arranquen con `Total` o `Subtotal` (ej. "Total OFF", "Total
   ON", "TOTAL", "Total Campaña"). **Sin este filtro la inversión se cuenta
   2.2× del valor real**, porque las filas subtotal se suman encima del
   detalle.

   El bug original: `esPlanningSkip` concatenaba `[rol, sistema, formato]` con
   espacios y matcheaba el regex contra ese string concatenado. Como las
   filas-subtotal tienen `rol="Build"` o similar, el resultado quedaba
   `"Build Total OFF"` que **no matcheaba** `/^Total\s/i`. Fix: chequear los
   campos `sistema` y `formato` por separado contra `/^total\b/i`.

6. **Detección de costos** (`esPlanningCosto`): filas cuyo `formato` matchea
   `/iibb|percep|cheque|impuesto|tech\s*fee|comisi/i` se marcan como
   `tipo='costo'`.

7. **Categoría "General" para costos sin marca**: las filas de costo en el
   Excel (IIBB, Cheque, Tech Fee, Comisiones) **no tienen Campaña asignada**
   porque son globales del mes. El parser detecta esa condición (`!campania`
   pero `esPlanningCosto(formato) === true`) y les asigna `campania='General'`
   antes de emitir. Sin este fallback los costos no aparecen en la tarjeta
   "Costos adicionales" del dashboard.

8. **Parsing de moneda** (`parseLocaleNumber`): strippea `$`, espacios, `%` y
   convierte formato AR (`65.253.780,00`) a número JS. **El strip del `$` es
   crítico** — sin él todos los valores quedan en `NaN/null` y el parser emite
   0 filas.

9. **12 columnas mensuales**: para cada (data row × mes con `inversion > 0`),
   emite una fila de `planning_media`. Fecha = `${PLANNING_YEAR}-${mes}-01`
   donde `PLANNING_YEAR` es la property (default: año actual).

10. **Dedup pre-upsert**: agrupa por `(fecha, campania, rol, sistema, formato,
    tipo)` sumando `inversion` y concatenando `touchpoint` con ` / `. Esto es
    importante porque el Excel puede tener varias filas con el mismo
    line-item pero distinto TouchPoint.

11. **Upsert idempotente**: `Prefer: resolution=merge-duplicates` por la
    unique key compuesta `(fecha, campania, rol, sistema, formato, tipo)`.
    Las re-corridas no duplican.

## Script Properties (7 en total)

| Property                          | Para qué                                                        |
|-----------------------------------|-----------------------------------------------------------------|
| `SUPABASE_URL`                    | URL del proyecto **CB** (`fsvdcpqzchrezkxflyfi`)                |
| `SUPABASE_SECRET_KEY`             | service_role del proyecto CB                                    |
| `CB_FOLDER_ID`                    | Folder de Cuadros Básicos                                       |
| `FS_FOLDER_ID`                    | Folder de Floor Share                                           |
| `PLANNING_FOLDER_ID`              | Folder de Pauta-omd (`1xjV1yy11Mjoz89uCTjNc53l1iNZxgHbp`)       |
| `PLANNING_SUPABASE_URL`           | URL del proyecto **Principal** (`vtcrhyyirqexczycuwhe`)         |
| `PLANNING_SUPABASE_SECRET_KEY`    | service_role del proyecto principal                             |

Opcional: `PLANNING_YEAR` (default: año actual).

## Pre-requisitos del entorno

1. **Advanced Drive Service v2** habilitado: Apps Script editor → barra
   lateral "Services" `+` → buscar `Drive API` → Add → Identifier `Drive`,
   Version `v2`.
2. **Permisos OAuth**: primera corrida pide autorización para Drive (lectura
   + creación temporal de Sheets para conversión XLSX) y UrlFetchApp (Supabase
   REST). Aceptar todo.
3. **`sync_status` table en proyecto CB** con columnas: `filename, drive_id,
   drive_modified, synced_at, rows_processed, status, error_msg`.
4. **`planning_media` en proyecto principal** (migration
   `supabase/migrations/0004_planning_media.sql`) con unique key
   `(fecha, campania, rol, sistema, formato, tipo)`.

## Operación

### Subir un mes nuevo

1. OMD te manda la planilla actualizada.
2. Renombrar a `Mes-Pauta.xlsx` (ej. `Julio-Pauta.xlsx`).
3. Arrastrar al folder de Drive `PLANNING_FOLDER_ID` (preferentemente borrar
   los `Mes-Pauta.xlsx` viejos para no acumular).
4. Esperar hasta 1h (trigger horario) o forzar manual: Apps Script → `syncAll`
   → Run.
5. Verificar en `/planning` que el mes nuevo aparezca con totales correctos.

### Forzar re-procesamiento sin esperar al trigger

```sql
-- En el proyecto CB
delete from sync_status where filename = 'Junio-Pauta.xlsx';
```
Luego Apps Script → Run `syncAll`.

### Verificación de integridad

Los totales del DB deben matchear el Excel (sumar "Total OFF" + "Total ON" del
mes, sin contar costos):

```sql
-- En el proyecto principal
select fecha,
       sum(inversion) filter (where tipo = 'media') as media,
       sum(inversion) filter (where tipo = 'costo') as costos
from planning_media
group by fecha
order by fecha;
```

Si los números difieren del Excel:
- ✅ `media` >> Excel real → subtotales contándose 2× (ver regla #5).
- ✅ `media` ≈ Excel pero × 2 → categoría duplicada (ej. Heladera + Refrigeración
  sin mapeo). Ver regla #4.
- ✅ `costos` = 0 → costos sin "General" fallback. Ver regla #7.
- ✅ Todo en 0 → `parseLocaleNumber` no strippea `$`. Ver regla #8.

## Backup defensivo antes de cambios al parser

Cualquier cambio importante al parser debería ir acompañado de:

```sql
-- En proyecto principal, antes de wipear/re-sync
create table planning_media_backup_pre_<descripcion> as
select *, now() as backed_up_at from planning_media;
```

Si algo sale mal, restaurás con:

```sql
delete from planning_media;
insert into planning_media (fecha, campania, rol, touchpoint, sistema, formato, inversion, tipo, source)
select fecha, campania, rol, touchpoint, sistema, formato, inversion, tipo, source
from planning_media_backup_pre_<descripcion>;
```

## Troubleshooting

### "Sync completado" en 2s sin procesar nada

- Verificá que `PLANNING_FOLDER_ID` esté seteado en Script Properties.
- Verificá que haya archivos `.csv` o `.xlsx` en el folder.
- `needsSync` puede estar saltando todo: revisá `sync_status` en el proyecto
  CB y borrá las entries del filename problemático.

### `planning_media` vacío en proyecto principal después del sync

- Confirmá que `PLANNING_SUPABASE_URL` y `PLANNING_SUPABASE_SECRET_KEY` estén
  configuradas. Sin estas, el script intenta escribir al proyecto CB y falla
  silenciosamente (capturado por el try/catch).
- Verificá que `planning_media` exista en el proyecto principal.

### Los totales del dashboard son ~2× del Excel real

- Filas-subtotal ("Total OFF", "Total ON", "Total Campaña") se están sumando
  como datos. Verificá que `esPlanningSkip` tenga las regex
  `/^total\b/i.test(s)` y `/^total\b/i.test(f)` chequeando `sistema` y
  `formato` por separado, **no concatenados con `rol`**.

### Aparece una categoría nueva "Heladera" en vez de mergear con "Refrigeración"

- `normalizePlanningCategoria` no tiene el mapeo. Agregar:
  `if (lower.indexOf('heladera') === 0) return 'Refrigeración';`

### Tarjeta "Costos adicionales" muestra $0 pero el Excel tiene costos

- Las filas de costo en el Excel no tienen Campaña asignada y se están
  descartando. Verificá que el parser tenga el bloque que asigna
  `campania='General'` cuando `!campania` pero `esPlanningCosto(formato)` es
  true.

### Errores tipo `"Drive is not defined"` o `"this.helpers.getBinaryDataBuffer is not a function"`

- Falta habilitar Advanced Drive Service v2. Apps Script editor → Services
  `+` → Drive API → Add con identifier `Drive`, version `v2`.

### Conflictos de fechas (años cruzados)

- Si OMD trabaja con plan multi-año en un solo Excel, el parser usa
  `PLANNING_YEAR` (property) o el año actual para todas las columnas.
  Workaround: cambiar `PLANNING_YEAR` antes de cada sync de año distinto, o
  modificar el parser para detectar el año desde el header del Excel (banner
  "2026", etc.).
