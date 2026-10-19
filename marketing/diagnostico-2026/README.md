# Diagnóstico integral de Marketing 2026 (Drean)

Generador del PowerPoint del diagnóstico (19-oct-2026) + anexo analítico y resumen ejecutivo.

- `datos/` — snapshot de los datos usados (series ene–dic con `null` = sin dato, y tablas), leídos de la base por REST en modo lectura:
  `social.json` (redes orgánicas), `pauta.json` (pauta digital; modelo del tablero, sep = $198,0M), `web.json` (GA4; usuarios sep = 562.088,
  igual que el Seguimiento), `sentimiento-mensual.json` (social_posts por mes).
- `lib.js` — sistema visual (layouts, líneas, barras, apiladas, dispersión, tablas tipo heatmap, KPIs, panel "Qué significa / Qué decisión habilita").
- `cap-*.js` — capítulos; `matriz.js` — top 10, campañas, conclusiones, matriz de insights y limitaciones.
- `diagnostico-ejecutivo.md` — resumen ejecutivo (→ .docx con pandoc).

Build (en un dir con `npm i pptxgenjs`; SKILL = carpeta de la skill pptx):

    NODE_PATH=<dir>/node_modules SKILL=<skill pptx> node build.js diagnostico-marketing-2026.pptx
    python3 build-anexo.py anexo-analitico-diagnostico-2026.xlsx
    pandoc diagnostico-ejecutivo.md -o diagnostico-ejecutivo-2026.docx

Reglas del diagnóstico: solo resultados reales (sin metas), sin salud de marca/TOM/SOM/intención/CB/FS, meses sin dato marcados (`*` futuro,
`†` octubre parcial), 2025 solo donde la fuente es comparable. Gotcha PowerPoint: la serie de línea en combos no puede heredar `dLblPos` outEnd/inEnd.
