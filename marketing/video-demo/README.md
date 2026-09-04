# Video demo · 30 s · 16:9

Video de producto (sin personas) que recorre el ciclo completo del modelo estratégico:
**objetivos → KPIs → pesos → metas mensuales → seguimiento real vs meta → insights →
optimización → recalibración anual**, mostrando el cursor y la escritura real en los formularios.

Cierre: **“Learn what matters. Drive results.”**

## Salida

| Archivo | Detalle |
|---|---|
| `export/demo-30s.mp4` | 1920×1080, 30 fps, 30,000 s exactos, H.264 yuv420p, `+faststart` (~2 MB) |
| `export/poster.jpg` | Frame de cierre, para thumbnail |

## Cómo se genera

No es una captura de pantalla ni un screen recording: es una animación HTML **determinística**.
Todo el estado visual sale de `window.__seek(t)`; Chromium avanza frame a frame y cada captura
se pipea a ffmpeg. El resultado no depende del reloj real, así que es reproducible al frame.

```bash
node render.mjs                          # -> export/demo-30s.mp4
node render.mjs --fps 60                 # más fluido (el doble de frames)
node render.mjs --stills 5.5,22,28.4     # PNGs sueltos en export/stills para revisar
```

Requisitos: `playwright` (Chromium) y `ffmpeg` con `libx264`. En un entorno limpio:
`npm i -g playwright && npx playwright install chromium && apt-get install -y ffmpeg`.
Para que los textos rendericen igual conviene tener la familia **Inter** instalada
(`apt-get install -y fonts-inter fonts-inter-variable`); si falta, cae al sans del sistema.

## Archivos

- `index.html` — sistema visual (paleta, tipografía, componentes de UI del dashboard).
- `app.js` — timeline y escenas. Cada escena se registra con `scene(id, start, end, html, init)`
  y devuelve un `draw(lt, alpha)` que posiciona todo en función del tiempo local.
- `render.mjs` — captura y encodeo.

## Timeline (segundos)

| # | Escena | Rango | Contenido |
|---|---|---|---|
| 1 | Intro | 0,0 – 2,4 | “De tu estrategia a mejores resultados.” |
| 2 | Objetivos + pesos | 2,4 – 9,4 | Se tipean **Top of Mind**, **Intención de Compra** y **Facturación**; se asignan pesos 40/30/30 |
| 3 | KPIs → objetivos | 9,4 – 14,0 | Matriz de aportes; cada objetivo cierra en 100% |
| 4 | Metas mensuales | 14,0 – 19,2 | Meta en `%` y en `personas` (el número crudo se formatea al confirmar); `$` para Facturación |
| 5 | Modelo listo | 19,2 – 20,3 | 3 objetivos · 5 KPIs · 12 meses |
| 6 | Seguimiento | 20,3 – 25,1 | Ene→Sep, real vs meta, GAPs y estado general |
| 7 | Insights | 25,1 – 26,9 | Aprendizajes detectados |
| 8 | Optimizar + recalibrar | 26,9 – 28,9 | Reasignación de inversión y cierre del ciclo anual |
| 9 | Cierre | 28,9 – 30,0 | “Learn what matters. Drive results.” |

Para reajustar el ritmo alcanza con mover `start`/`end` de cada `scene(...)` y `DUR` en `app.js`.

## Convenciones respetadas

- **Color:** real en azul `#1E40AF`, meta en gris pizarra `#CBD5E1`/`#94A3B8`;
  verde/rojo **solo** como semáforo (GAP, totales OK), nunca decorativo.
- **Modelo:** la suma de aportes inbound por objetivo se capa en **100%**, igual que el
  editor del Mapa Estratégico.
- Los números son ilustrativos (no salen de Supabase); si se quiere una versión con datos
  reales, se reemplazan los arrays `TOM_META` / `TOM_REAL` / `ALC_*` y la matriz `MX` en `app.js`.
