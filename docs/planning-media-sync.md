# Planning Media Sync — Apps Script (Drive → Supabase)

El sync de la pauta planificada vive en el mismo **Apps Script "Sync Drive Tablero CB"**
que ya sincroniza Cuadros Básicos y Floor Share. Sustituye al workflow viejo de N8N
(`drive-planning-media-sync.json`).

**Por qué Apps Script y no GitHub Actions / Vercel**:
- Corre con la cuenta Google del dueño del script → sin OAuth refresh tokens que rotar.
- Triggers nativos (cada hora, etc.) sin secrets adicionales.
- Mismo patrón ya validado para CB + Floor Share (sync_status, dedup, idempotente).

## Flujo

```
OMD te manda el CSV ─→ Lo arrastrás al folder de Drive "Pauta"
                                ↓
                  (Apps Script trigger cada 1h)
                                ↓
                       syncPlanning()
                                ↓
                  Drive API → parse → upsert
                                ↓
                  planning_media (Supabase)
                                ↓
                    /planning se repuebla solo
```

## Folder de Drive

ID configurable en Script Properties como `PLANNING_FOLDER_ID`. Hoy:
`1xjV1yy11Mjoz89uCTjNc53l1iNZxgHbp`

## Convención de archivos

### Formato nuevo (a partir de Junio 2026)

Un archivo por mes con todas las categorías adentro:

- Filename: `Mes-Pauta.csv` (ej. `Junio-Pauta.csv`)
- Columna `Campaña` (o `Categoria`) indica la marca de cada fila.

Headers detectados (case-insensitive):

| Concepto    | Headers aceptados                                              |
|-------------|----------------------------------------------------------------|
| Categoría   | `Campaña`, `Campana`, `Campania`, `Categoría`, `Categoria`     |
| Rol         | `Rol Of Comms`, `Rol`                                          |
| TouchPoint  | `TouchPoint`, `Touchpoint`, `Touch Point`                      |
| Sistema     | `Sistema`, `Plataforma`, `Platform`                            |
| Formato     | `Formato & Channel`, `Formato`, `Format`                       |
| Inversión   | El nombre del mes (`Junio`) **o** `Inversion` / `Total`        |

### Formato legacy (Abril/Mayo)

Un archivo por (mes,categoría): `Mes-Categoria.csv` (ej. `Mayo-Brand.csv`).
El parser detecta este caso por el sufijo del filename.

**La data vieja no se pisa**. El upsert va por la unique key
`(fecha, campania, rol, sistema, formato, tipo)` con `merge-duplicates`.

## Cómo agregarlo al Apps Script

1. Abrí el Apps Script "Sync Drive Tablero CB" (Drive → doble click).
2. Agregá `planning: 'planning_media'` al objeto `SB_TABLES`.
3. Agregá la línea `if (ctx.planningFolderId) syncPlanningFolder(ctx, syncStatus);`
   al final de `syncAll()`, después del bloque de Floor Share.
4. Agregá `planningFolderId: props.getProperty('PLANNING_FOLDER_ID')` al objeto `ctx`.
5. Pegá las funciones `syncPlanningFolder` y `syncPlanning` (ver código abajo o
   en el chat de claude.ai).
6. Extendé `upsertBatch` para aceptar `onConflict` opcional (el planning_media
   necesita unique key compuesta explícita).
7. **Project Settings → Script Properties**: agregá
   `PLANNING_FOLDER_ID = 1xjV1yy11Mjoz89uCTjNc53l1iNZxgHbp`.
8. Save y correr `syncAll` manual para validar.

## Subir un mes nuevo

1. OMD te manda el CSV de Julio.
2. Lo subís al folder de Drive con el nombre `Julio-Pauta.csv`.
3. El trigger horario lo levanta automático (o corrés `syncAll` manual).

## Verificar en Supabase

```sql
select fecha, campania, count(*), sum(inversion)
from planning_media
group by fecha, campania
order by fecha desc, campania;
```
