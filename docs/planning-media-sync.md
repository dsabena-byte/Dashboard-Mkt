# Planning Media Sync — Drive → Supabase (GitHub Actions)

Reemplaza al workflow viejo de N8N (`drive-planning-media-sync.json`).
Ahora vive todo dentro del repo:

- **Endpoint**: `apps/web/src/app/api/cron/planning-media-sync/route.ts`
- **Schedule**: `.github/workflows/planning-media-sync.yml` (cada 6h + manual)
- **Tabla destino**: `planning_media` (Supabase principal)

## Flujo

```
OMD te manda el CSV ─→ Lo arrastrás al folder de Drive
                          ↓
                  (GitHub Action cada 6h o manual)
                          ↓
            /api/cron/planning-media-sync
                          ↓
              Drive API → parse → upsert
                          ↓
                planning_media (Supabase)
                          ↓
                /planning se repuebla solo
```

## Folder de Drive

ID hardcodeado por default en el endpoint:
`1xjV1yy11Mjoz89uCTjNc53l1iNZxgHbp`

Override opcional vía env var `PLANNING_DRIVE_FOLDER_ID` (no hace falta hoy).

## Convención de archivos

### Formato nuevo (recomendado, a partir de Junio 2026)

Un único archivo por mes con **todas las categorías** adentro:

- Filename: `Mes-Pauta.csv` (ej. `Junio-Pauta.csv`, `Julio-Pauta.csv`)
- Adentro del CSV: una columna `Campaña` (o `Categoria`) indica la marca/categoría
  de cada fila (Brand / Cocina / Refrigeración / Lavado / Promoción / UGC).

Headers aceptados:

| Concepto    | Headers detectados (case-insensitive)                          |
|-------------|----------------------------------------------------------------|
| Categoría   | `Campaña`, `Campana`, `Campania`, `Categoría`, `Categoria`     |
| Rol         | `Rol Of Comms`, `Rol`                                          |
| TouchPoint  | `TouchPoint`, `Touchpoint`, `Touch Point`                      |
| Sistema     | `Sistema`, `Plataforma`, `Platform`                            |
| Formato     | `Formato & Channel`, `Formato`, `Format`                       |
| Inversión   | El nombre del mes (`Junio`) **o** `Inversion` / `Total`        |

### Formato legacy (Abril/Mayo)

Un archivo por (mes, categoría): `Mes-Categoria.csv` (ej. `Mayo-Brand.csv`).
La categoría se sigue extrayendo del filename — el parser detecta este caso
cuando el sufijo del filename no es "Pauta".

**No hay que migrar la data vieja**. El upsert usa `resolution=merge-duplicates`
contra la unique key `(fecha, campania, rol, sistema, formato, tipo)`, así que
abril/mayo quedan intactos aunque borres los archivos viejos del folder.

### Detección de costos

Las filas con `IIBB`, `Percep`, `Cheque`, `Impuesto`, `Tech Fee` o `Comisión`
en la columna Formato se marcan automáticamente como `tipo='costo'` y se
separan de la inversión en medios.

## Secrets / Env vars

Todo lo necesario ya existe en Vercel + GitHub Actions:

| Secret                          | Dónde     | Para qué                    |
|---------------------------------|-----------|------------------------------|
| `GOOGLE_CLIENT_ID`              | Vercel    | OAuth Drive                  |
| `GOOGLE_CLIENT_SECRET`          | Vercel    | OAuth Drive                  |
| `GOOGLE_REFRESH_TOKEN`          | Vercel    | OAuth Drive (compartido GA4) |
| `NEXT_PUBLIC_SUPABASE_URL`      | Vercel    | Destino upsert               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Vercel    | Auth Supabase                |
| `CRON_SECRET`                   | GitHub    | Bearer del endpoint          |

⚠️ Si el `GOOGLE_REFRESH_TOKEN` actual no tiene scope `drive.readonly` (porque
se generó solo para Analytics), el endpoint va a fallar con 403 al listar el
folder. Regenerá el refresh token en OAuth Playground sumando el scope
`https://www.googleapis.com/auth/drive.readonly` y pegá el nuevo valor en
Vercel — un solo token sirve para GA4 + Drive.

## Subir un mes nuevo

1. OMD te manda el CSV de Julio.
2. Lo subís al folder de Drive con el nombre `Julio-Pauta.csv`.
3. Esperás hasta la próxima corrida (máximo 6h) o forzás manual:
   - GitHub → Actions → "Planning media sync" → Run workflow
4. `/planning` muestra Julio automáticamente.

## Verificar manualmente

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://dashboard-mkt-seven.vercel.app/api/cron/planning-media-sync
```

Respuesta esperada:

```json
{
  "ok": true,
  "folder": "1xjV1yy11Mjoz89uCTjNc53l1iNZxgHbp",
  "year": 2026,
  "files": [
    { "name": "Junio-Pauta.csv", "rows": 42 }
  ],
  "total_rows_parsed": 42,
  "total_rows_upserted": 42,
  "timestamp": "2026-06-08T..."
}
```

## Troubleshooting

- **`OAuth refresh failed: 400`** → refresh token revocado o sin scope Drive.
  Regenerar en OAuth Playground (ver sección Secrets).
- **`Drive list failed: 404`** → el folder ID no es accesible para la cuenta
  Google del refresh token. Compartir el folder con esa cuenta.
- **`rows: 0` en algún archivo** → el parser no encontró la fila de headers
  o la columna de inversión. Verificá que el CSV tenga `Formato` + (`Sistema`
  o `Rol`) + (`Campaña` o sufijo categórico en el filename).
- **Categorías raras (todas "Sin clasificar")** → la columna `Campaña` tiene
  valores que no matchean el `normalizeCategoria`. Ajustar el switch en
  `route.ts` si OMD introduce categorías nuevas.
