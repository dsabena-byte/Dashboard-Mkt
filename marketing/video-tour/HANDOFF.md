# Handoff · Video tour de la plataforma

Estado al cierre y qué falta. Para retomar: leer esto + `README.md`, editar `app.js`
(y `index.html` para CSS de componentes), verificar con stills, re-render, commit/push, republicar
el artifact si aplica.

## Estado actual (v4 — scroll por dash, ~61s)
- **v4 pusheada** (`main` + rama `claude/sweet-galileo-nxlzes`). MP4 versionado en
  `export/tour-plataforma.mp4` (1920×1080, 30fps, **~61s**, ~11.7MB).
- Reescritura grande sobre v2: cada escena ahora es un **dash real con scroll** (no pantallas
  sueltas). Marca/data ficticia (Novara). Ver `README.md`.
- **Cambios v4 (pedidos del user):**
  1. **Scroll por dash:** el contenido es más alto que el viewport (`.scrollinner`) y se anima con
     `translateY` (`pageScroll`) + barra indicadora (`.sbar`). Se muestra la parte principal arriba
     y se escrolea hacia abajo para revelar el resto → da profundidad y conexión KPI↔objetivo dentro
     de un mismo dash.
  2. **Gráficos con ejes y leyendas (no "volando"):** helpers SVG con ejes reales —
     `svgBars` (Y ticks/gridlines/labels de valor/meses X), `svgLine` (eje Y + línea meta punteada +
     línea real sólida con dash-draw + labels de punto), `svgCombo` (doble eje: barras apiladas de
     interacciones a la derecha + línea real/meta % a la izquierda, gridlines).
  3. **Más ágil:** `DUR = 61.0`, `SPEED = 1.0`, transiciones más rápidas. Escenas (en segundos):
     intro 0→3, mapa 3→8, seg 8→15.5, medios 15.5→22, redes1 22→28, redes2 28→33, web 33→39.5,
     trade 39.5→45, ia 45→50.5, inv 50.5→57, outro 57→61.
  4. **Piezas con performance real:** `pieceCard` (thumbnail + métricas de pauta: impresiones, VTR,
     guardados, etc.) en Plan de Medios y Redes.
  5. **Copiloto IA sacado del menú lateral** (pedido del user: "eso no va"). El `NAV` tiene **8
     items** (Seguimiento, Mapa, Plan de Medios, Redes, Web, Trade, Salud de Marca, Inversión). La
     escena `ia` (Copiloto, insight cross-dashboard) **sigue en el video** pero monta `shell('web')`
     (no resalta ítem de menú) — no está atada a un ítem del NAV.
- Validado escena por escena con stills (medios, redes1, web, inv confirmados con scroll OK, sin
  overlap). **Trade se armó desde memoria** (aún no hubo screenshot del user para calibrar).

## PENDIENTE — lo que sigue (el user dijo "luego seguimos con más cambios")
- El MP4 commiteado (d7cfd97) todavía tiene Copiloto IA en el menú → **re-render pendiente** para
  reflejar la baja del ítem. Se difirió a propósito para batchear con los próximos cambios.
- El user quiere seguir mejorando pantallas / ajustando. Candidatas:
  - **Trade:** calibrar con screenshot real (hoy es data de memoria).
  - Revisar densidad vs. tiempo si se quiere aún más ágil.
  - Mapa Estratégico: micro-animación de barras de peso o resaltar un camino KPI→objetivo.

## Cómo trabajar (rápido)
```bash
cd marketing/video-tour
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
export PATH="$HOME/bin:$PATH"                 # ffmpeg libx264 (imageio-ffmpeg → ~/bin/ffmpeg)
# stills de revisión (mid-escena, en segundos reales):
node render.mjs --stills 1.5,5,12,19,25,31,36,42,48,54,59
# still de un recorte (ej sidebar): node render.mjs --stills 5 --clip 0,0,270,600
# render completo (~6-7 min):
node render.mjs                               # -> export/tour-plataforma.mp4
```
Verificar stills leyéndolos (Read) antes de gastar el render completo.

## Gotchas técnicos (no re-tropezar)
- **SVG paths creados con `mk('<path/>')` NO funcionan**: en contexto HTML quedan como
  HTMLUnknownElement (sin `getTotalLength`, no renderizan). Los paths van **dentro del `<svg>` del
  template string** (ahí el parser los trata como SVG). Ver `M_PATHS` en la escena `mapa`.
- **`getTotalLength()` tira en `display:none`**: los trazos animados calculan la longitud **lazy**
  en el primer draw visible (helper `dash(el)` con try/catch, se llama dentro del `draw`).
- **Scroll:** `pageScroll(node, lt, from, to)` mide `inner.offsetHeight - body.offsetHeight` y aplica
  `translateY`. Si una escena queda con contenido cortado abajo, o el scroll no llega, es porque el
  `.scrollinner` no es lo bastante alto o el rango `from→to` está mal. Retimar SIEMPRE mapa+seg
  juntos (una vez mapa quedó overlapando a seg por retimar solo una).
- **ffmpeg**: el de Playwright solo hace VP8/webm. Se usa `imageio-ffmpeg` (PyPI) symlinkeado a
  `~/bin/ffmpeg` (tiene libx264). `export PATH="$HOME/bin:$PATH"` antes de renderizar.
- **Timing**: `SPEED=1`, todo en segundos reales. Cada `scene(id, start, end, ...)` en segundos; los
  reveals internos usan `lt` (tiempo local 0-based de la escena) con `S(lt,a,b)`.
- **Fuentes**: embebidas base64 en `index.html` (`@font-face` Inter/Poppins) para render idéntico.

## Datos ficticios (dónde tocar)
Arrays en `app.js`: `SEG_OBJ` (objetivos TOM/SOM/Intención de Compra/Poder de Marca, 25% c/u),
`SEG_GROUPS` (grupos del scorecard), `MED_MEDIA` (Plan de Medios), `M_OBJ/M_KPI/M_LINK` (Mapa),
`R_BENCH` (Redes competitivo), tablas inline en Web/Trade/Inversión. Marca ficticia en `shell()`
(topbar "Novara"). No tocar el motor (`scene`, `window.__seek`, `pageScroll`, cursor).
