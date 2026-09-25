# Video "Armá tu Mapa Estratégico en BIP" · 35,5 s · 16:9

Solo el armado del Mapa (las metas van en `video-metas`): plantilla sugerida → pesos de cada objetivo (+ Agregar
objetivo "Preferencia de marca") → primero se suma el PLAN (+ Agregar plan / dashboard… → "Mercado y competencia")
y después sus KPIs (+ Agregar KPI… → "Share of Search") con su peso → composición + Guardar mapa → cierre
"Listo. Tu mapa, armado." Réplica de `components/mapa/mapa-editor.tsx` + `mapa-plantilla.tsx` de BIP (planes y KPIs
reales de `lib/mapa-catalogo.ts`). Ritmo ágil a pedido del user (la v1 de 78 s era "lentísima").

Render: `NODE_PATH=/opt/node22/lib/node_modules PATH=$HOME/bin:$PATH node render.mjs` → `export/objetivos.mp4`.
En BIP: `public/videos/objetivos.*`, en /mapa-estrategico.
