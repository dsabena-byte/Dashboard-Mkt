# Template del Google Sheet de Planning

Estructura **exacta** que tiene que tener el Sheet para que el workflow de N8N
lo lea correctamente y lo escriba en la tabla `planning` de Supabase.

## Encabezados de columnas

La primera fila del Sheet debe tener estos **7 encabezados** (en este orden,
con esta capitalización exacta):

| Columna           | Tipo       | Obligatorio | Descripción                                              |
|-------------------|------------|-------------|----------------------------------------------------------|
| `fecha`           | Date       | ✅           | Fecha del plan (formato `YYYY-MM-DD`, ej: `2026-05-04`) |
| `canal`           | Texto      | ✅           | Canal de marketing — valores permitidos abajo            |
| `campania`        | Texto      | ✅           | Nombre interno de la campaña                             |
| `inversion_plan`  | Número     | ✅           | Inversión planificada en moneda local (ej: `5000`)      |
| `kpi_target`      | Número     | ✅           | Valor target del KPI (ej: `200000`)                     |
| `metric_type`     | Texto      | ✅           | Métrica del KPI — valores permitidos abajo               |
| `notas`           | Texto      | ❌           | Comentarios libres                                       |

### Valores permitidos para `canal`

Tiene que ser **exactamente uno** de:

```
google_ads
meta_ads
tiktok_ads
linkedin_ads
youtube_ads
programmatic
tv
radio
ooh
print
influencer
email
other
```

⚠️ Si ponés algo distinto (ej: `Google Ads` con mayúsculas o `googleads` sin
guión bajo) el workflow va a tirar error de validación.

### Valores permitidos para `metric_type`

Tiene que ser **exactamente uno** de:

```
impressions
clicks
sessions
conversions
leads
sales
revenue
cpa
cpc
ctr
roas
```

## Unicidad

Cada fila representa **un plan** identificado por la combinación
`(fecha, canal, campania, metric_type)`. Si querés planear varias métricas
para la misma campaña en el mismo día, hacés **una fila por métrica**:

| fecha       | canal       | campania              | inversion_plan | kpi_target | metric_type   |
|-------------|-------------|-----------------------|----------------|------------|---------------|
| 2026-06-01  | google_ads  | Campaña Q3 — Search   | 5000           | 200000     | impressions   |
| 2026-06-01  | google_ads  | Campaña Q3 — Search   | 5000           | 8000       | clicks        |
| 2026-06-01  | google_ads  | Campaña Q3 — Search   | 5000           | 250        | conversions   |

> Notá que `inversion_plan` se repite — eso está bien. El workflow agrega
> la inversión por campaña, no la suma por métrica.

## Ejemplo completo

```
| fecha       | canal     | campania                 | inversion_plan | kpi_target | metric_type | notas                  |
|-------------|-----------|--------------------------|----------------|------------|-------------|------------------------|
| 2026-06-01  | google_ads| Lanzamiento Q3 — Search  | 8000           | 350000     | impressions | Foco en marca          |
| 2026-06-01  | google_ads| Lanzamiento Q3 — Search  | 8000           | 14000      | clicks      |                        |
| 2026-06-01  | google_ads| Lanzamiento Q3 — Search  | 8000           | 450        | conversions |                        |
| 2026-06-01  | meta_ads  | Lanzamiento Q3 — Awareness | 5000         | 800000     | impressions | Reels + Stories        |
| 2026-06-01  | meta_ads  | Lanzamiento Q3 — Awareness | 5000         | 20000      | clicks      |                        |
| 2026-06-01  | tv        | Spot Junio               | 20000          | 3000000    | impressions | 2 semanas, prime time  |
| 2026-06-01  | radio     | Cuña Junio               | 5000           | 1200000    | impressions | AM y FM                |
```

## Comportamiento del workflow

Cada vez que corre (cada hora por default):

1. **Lee toda la hoja**.
2. **Valida** que `canal` y `metric_type` estén en los enums permitidos.
   Filas inválidas se loguean pero **no rompen** el workflow — sigue con el resto.
3. **Upsert a Supabase** por la clave `(fecha, canal, campania, metric_type)`:
   - Si la fila ya existe → actualiza `inversion_plan`, `kpi_target`, `notas`.
   - Si no existe → inserta.
4. **No borra** filas en Supabase aunque las saques del Sheet (para no perder
   historial sin querer). Si querés invalidar un plan, borralo manualmente
   desde Supabase o cambialo a 0.

## Buenas prácticas

- **Una sola hoja activa**: si tu archivo tiene varias pestañas, configurá
  el workflow para que apunte solo a la pestaña "planning" (lo vemos en el setup).
- **Sin filas vacías** entre datos: el workflow las saltea pero ensucia los logs.
- **No renombres columnas**: si cambian los encabezados, el workflow no las
  encuentra y empieza a fallar.
- **Fechas como Date, no Texto**: en Sheets formateá la columna `fecha`
  como Date para que Google la serialice bien. Si querés escribirlas a mano,
  usá siempre `YYYY-MM-DD` (no `04/06/2026`).
