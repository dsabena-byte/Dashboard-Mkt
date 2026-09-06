# Handoff · Video tour de la plataforma

Estado al cierre (dic-2026) y qué falta. Para retomar: leer esto + `README.md`, editar `app.js`
(y `index.html` para CSS de componentes), verificar con stills, re-render, commit/push, republicar
el artifact si aplica.

## Estado actual
- **v2 terminada y pusheada** (`main` + rama `claude/sweet-galileo-nxlzes`). MP4 versionado en
  `export/tour-plataforma.mp4` (1920×1080, 30fps, ~117s, ~6.9MB).
- 11 escenas, réplica fiel de cada dashboard, datos/marca ficticios (Novara). Ver `README.md`.
- Enviado al user; validado visualmente escena por escena con stills.

## PENDIENTE — lo que pidió el user (retomar acá)
> "me gustaría mejorar el video, algunas pantallas, hacerlo más ágil"

1. **Más ágil (ritmo):** hoy dura ~117s con `SPEED=1` (tiempos en segundos reales). Opciones:
   - Bajar la duración de escenas más largas (Redes IG 9s, Redes competitivo 9s, Web 13s, Trade 13s,
     Copiloto 13s) — varias tienen más tiempo del que necesita la lectura.
   - Acelerar los reveals internos: los `S(lt, a, b)` de stagger/inUp y las ventanas de `grow`/dash
     draws están algo lentos; comprimir los sub-tiempos (menos gap entre cards, draws más cortos).
   - El cursor `runCursor`/`navCursor` se mueve lento (keyframes hasta t≈6); acortar.
   - Meta sugerida: ~85–95s sin perder legibilidad. Ajustar `DUR` + start/end de cada `scene(...)`
     (están en segundos) y re-chequear que ninguna escena quede con el contenido a medio revelar.
2. **Mejorar algunas pantallas:** definir con el user CUÁLES. Candidatas observadas:
   - **Redes competitivo** y **Trade** todavía dejan algo de aire abajo (paneles no llenan del todo).
   - **Mapa Estratégico**: se puede sumar micro-animación en las cajas de objetivo (barras de peso) o
     resaltar un camino KPI→objetivo al final.
   - **Copiloto**: el gráfico inline podría animar el count de los números que menciona.
   - Revisar densidad vs. tiempo: si se acelera, quizás simplificar paneles muy cargados.

## Cómo trabajar (rápido)
```bash
cd marketing/video-tour
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
export PATH="$HOME/bin:$PATH"                 # ffmpeg libx264 (imageio-ffmpeg → ~/bin/ffmpeg)
# stills de revisión (mid-escena, en segundos reales):
node render.mjs --stills 2.5,11,24,38,48,57,68,81,95,106,114
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
- **ffmpeg**: el de Playwright solo hace VP8/webm. Se usa `imageio-ffmpeg` (PyPI) symlinkeado a
  `~/bin/ffmpeg` (tiene libx264). `export PATH="$HOME/bin:$PATH"` antes de renderizar.
- **Timing**: `SPEED=1`, todo en segundos reales. Cada `scene(id, start, end, ...)` en segundos; los
  reveals internos usan `lt` (tiempo local 0-based de la escena) con `S(lt,a,b)`.
- **Barras**: `data-w` (ancho %) y `data-h` (alto %) los anima `grow(node,p)`. Líneas SVG: clase `rl`
  + `dash()` para el "draw".
- **Fuentes**: embebidas base64 en `index.html` (`@font-face` Inter/Poppins) para render idéntico.

## Datos ficticios (dónde tocar)
Arrays en `app.js`: `SEG_OBJ`, `SEG_SC` (Seguimiento), `MED_MEDIA` (Plan de Medios), `M_OBJ/M_KPI/M_LINK`
(Mapa), `R_BENCH` (Redes), tablas inline en Web/Trade/Inversión. Marca ficticia en `shell()` (topbar
"Novara"). No tocar el motor (`scene`, `window.__seek`, cursor).
