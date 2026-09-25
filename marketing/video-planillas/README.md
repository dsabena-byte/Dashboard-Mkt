# Video "Sumá tus planillas a BIP" · 80 s · 16:9

Explica cómo sumar una planilla (Resultados Comerciales, Inversión, Trade o Mis tableros) por los tres caminos
del paso "¿Dónde está tu planilla?" de BIP (`components/sheet-adder.tsx` + `tablero-setup.tsx`):
Google Sheets (Google Picker), Excel en OneDrive/SharePoint (Nango + ventanas reales de Microsoft) y archivo de
la compu → revisar columnas → tablero armado solo. Marca ficticia "Aurora", números ilustrativos.

Mismo motor que `marketing/video-primeros-pasos` (copia de `index.html` + `render.mjs`; `app.js` reusa sus
helpers `flowScene`, `ng`, `lead`, etc.). Tiempos en segundos reales.

| # | Escena | Rango (s) |
|---|---|---|
| 1 | Intro "Sumá tus planillas a BIP. Bien simple." | 0 – 4 |
| 2 | Tres caminos (se resaltan de a uno) | 4 – 11 |
| 3 | Google Sheets: Elegir de mi Drive → Select a file → Listo | 11 – 25 |
| 4 | Excel: Conectar Microsoft → Nango → Selección de la cuenta → Permitir → Éxito → pegar link → Sumar Excel | 25 – 45 |
| 5 | Archivo de tu computadora | 45 – 53 |
| 6 | Paso 2: columnas reconocidas → Armar el tablero | 53 – 61 |
| 7 | Tablero Resultados Comerciales | 61 – 72 |
| 8 | Cierre "Listo. Tus datos, juntos." | 72 – 80 |

Render: `NODE_PATH=../../apps/web/node_modules PATH=$HOME/bin:$PATH node render.mjs` → `export/planillas.mp4`.
Stills: `node render.mjs --stills 13,31,57`. Se publica en BIP como `public/videos/planillas.mp4` (+ poster).
