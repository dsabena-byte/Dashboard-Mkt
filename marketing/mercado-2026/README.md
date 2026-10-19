# Market Intelligence & Competitive Performance 2026 — Drean

Diagnóstico de mercado de las categorías Lavado, Refrigeración y Cocción, armado con los datos de GfK que usa el tablero de Mercado.

## Entregables

- `market-intelligence-2026.pptx`: presentación ejecutiva de 24 slides (17 de contenido), con gráficos editables.
- `diagnostico-mercado-2026.md` y su versión `.docx`: diagnóstico completo, con auditoría de datos, análisis global, los 3 mercados, análisis transversal, matriz de insights y tablas de cálculo.
- `anexo-market-intelligence-2026.xlsx`: matriz de insights y, por categoría, ranking, serie mensual 2025/2026, MAT histórico y segmentos.

## Cómo regenerarlo

1. `python3 analisis.py`: lee `datos/mercado_share-2026-10-19.json` (el extracto) y escribe `datos/mercado.json`.
2. `NODE_PATH=<dir con pptxgenjs>/node_modules SKILL=<skill pptx> node build.js market-intelligence-2026.pptx`
3. `python3 build-anexo.py`
4. `pandoc diagnostico-mercado-2026.md -o diagnostico-mercado-2026.docx`

Para actualizarlo con datos nuevos, primero hay que bajar un extracto nuevo de `mercado_share` por REST. Los textos de `insights.js` tienen las cifras escritas a mano, así que hay que revisarlos.

## Límites

- La base solo tiene shares e índice de precio, sin volúmenes del mercado. Por eso no hay share global, YTD ni tamaño de mercado.
- El último mes cargado es julio de 2026.
- En Refrigeración y Cocción, el Total mensual arranca en julio de 2025.

Qué falta cargar: `PENDIENTES.md` D18.
