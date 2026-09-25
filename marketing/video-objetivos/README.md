# Video "Definí tus objetivos en BIP" · 78 s · 16:9

Mapa Estratégico de BIP de punta a punta: plantilla sugerida por sector → pesos de cada objetivo (suman 100%) →
qué KPIs explican cada objetivo (matriz con pesos inbound) → composición + Guardar mapa → metas mensuales por KPI
(MetaPanel) → seguimiento con semáforo → cierre "Listo. Tu estrategia, medida.". Réplica de
`components/mapa/mapa-editor.tsx`, `mapa-plantilla.tsx` y `components/web/meta-panel.tsx` de BIP. Datos ilustrativos.

Mismo motor que `video-primeros-pasos` / `video-planillas`. Render:
`NODE_PATH=/opt/node22/lib/node_modules PATH=$HOME/bin:$PATH node render.mjs` → `export/objetivos.mp4`.
Se publica en BIP como `public/videos/objetivos.mp4` (+ poster) y se muestra en /mapa-estrategico.
