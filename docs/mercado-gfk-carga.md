# Carga mensual de mercado (GfK) → `mercado_share`

Cómo actualizar el dashboard **Análisis de Mercado** con los exports de GfK. Es
carga **manual de datos** (no DDL): se hace por REST con la service key (las
migraciones las corre el usuario en el SQL Editor; esto no).

## Fuente: export "Brands Timeseries" de GfK
Un archivo `.xlsx` por **(mercado, agregación, segmento, KPI)**. Hoja `time series`:
- Filas de metadata: `Market`, `Timestamp`, **`Filters`** (define el segmento), `Channel`.
- Fila header `KPI | Brand | <2 cols MAT resumen> | <cols de la serie>`.
- Filas de datos: `<KPI> | <Brand> | ...valores`. La fila `Brand=Market` es el
  denominador absoluto (revenue/unidades totales) → **se ignora**.

### Un set completo por categoría = 12 archivos
- **3 segmentos + Total** × **3 KPIs**:
  - KPIs: `Revenue Share` → `value_share`, `Units Share` → `unit_share`,
    `Price Index (Units)` → `index_price`.
  - Segmentos: los 3 del `Filters` + **Total** (`Filters` vacío).
- Y esto **por cada agregación** (mensual y MAT) → el export mensual y el MAT son
  archivos distintos (ver abajo). La numeración de archivos (`_1`.. `_11`) **no es
  estable** entre exports; identificá cada archivo por su `Filters` + `KPI`, no por
  el número.

## Mapeo de segmentos (por categoría)
El segmento sale del string `Filters`:

| Categoría (Market) | Low | Mid | High |
|---|---|---|---|
| **Lavado** (Washing Machines) | `LOADING KG: to 7.4` | `LOADING KG: 7.5-8.9` | `LOADING KG: from 9` |
| **Refrigeración** (Cooling) | `NOFROST SYSTEM: NO` | `NOFROST YES` + `2 DR FRZ. TOP` / `1 DOOR…` | `NOFROST YES` + `SIDE BY SIDE` / `4+ DOORS` / `3 DOORS` / `2 DR FRZ. BTM` |
| **Cocción** (Cooking) | `WIDTH IN CM: to 54` | `WIDTH IN CM: 55-56` | `WIDTH IN CM: from 57` |

`Total` = `Filters` vacío. (Lavado va con `AUTOMATIC: FULLAUTOM.` de base.)

## Mapeo de columnas (agregación)
En la fila header, las columnas de datos:
- **Mensual** (archivos `...Jul_2026`): columnas de **un mes** → `MMM YYYY`
  (ej. `Jul 2025` … `Jul 2026`). `mes` = ese mes (`YYYY-MM-01`).
- **MAT-12** (archivos `...Aug_2025Jul_2026`): columnas de **ventana rodante** →
  `MMM YYYY MMM YYYY` (ej. `Aug 2024 Jul 2025` … `Aug 2025 Jul 2026`). `mes` = el
  **mes final** (el 2º par). **Ojo:** las 2 primeras cols "resumen" llevan guion
  (`Aug 2025-Jul 2026`) — ignorarlas; usar solo las de 4 tokens con espacios.

## Transformaciones
- `Revenue Share` / `Units Share`: vienen en fracción (0-1) → **×100** (redondeo 2 dec).
- `Price Index (Units)`: ya es base 100 → tal cual (redondeo 1 dec). La fila
  `Brand=Market` del Price Index es el precio absoluto, no el índice → ignorar.
- Celdas `-` o vacías → `null` (dato genuinamente ausente, no forzar 0).

## Escritura: clean-replace acotado
Por cada (categoria, agregacion, segmento(s), rango de meses) del set:
`DELETE` del scope → `INSERT` de las filas nuevas. Columnas de `mercado_share`:
`mes, categoria, segmento, marca, unit_share, value_share, index_price, agregacion`.
Acotar el `DELETE` al rango cargado (ej. `mes >= 2025-07-01 AND mes <= 2026-07-01`)
para **no** pisar meses previos ni las proyecciones a futuro (ej. MAT nov-26).

## Reglas / gotchas (lo que costó tiempo)
- **Verificar la matriz COMPLETA antes de escribir.** Un set = 3 KPIs × cada
  segmento. Si falta un KPI de un segmento, `INSERT` mete `null` en esa métrica y,
  como se hizo `DELETE` antes, se **pierde** el dato que había. Chequear que cada
  (segmento) tenga los 3 KPIs, y contar nulos por KPI/segmento post-parse. Los
  archivos suelen llegar en tandas con duplicados y faltantes.
- **`Total` no es la suma de los segmentos**: es un pull aparte (`Filters` vacío).
  Cargarlo con sus propios archivos.
- **La definición de segmento puede diferir de lo ya cargado.** Ago-2026: el `High`
  de Cocción que había en la DB **no** estaba con `Width from 57` (0 match contra el
  export nuevo, sistemático en todos los meses) — se corrigió sobrescribiendo con la
  definición documentada. Validar siempre un par de celdas contra la DB en meses de
  overlap: Low/Mid suelen matchear exacto; si un segmento entero no matchea, es señal
  de definición distinta, no de revisión.
- **`marca`**: se guarda en MAYÚSCULA como viene del export (`DREAN`, `MIDEA`,
  `Others`, `Tradebrands and exclusives`). Distintos segmentos listan distinto set
  de marcas (las chicas caen en `Others`).

## Estado
- **Ago-2026:** cargado Jul 2025→Jul 2026 para Lavado, Refrigeración y Cocción, en
  los 4 segmentos (Low/Mid/High/Total) y ambas agregaciones (mensual + MAT).
