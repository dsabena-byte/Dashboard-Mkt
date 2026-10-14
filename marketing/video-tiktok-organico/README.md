# Video prototipo "BIP · TikTok orgánico" · 52 s · 16:9 · en inglés

Para la pregunta 8 (Screen Recordings) del **Accounts API Access Application Form** de TikTok (14-oct-2026):
el conector orgánico de BIP todavía no tiene el botón de conexión ni App ID, y el form acepta prototipos.

Flujo: Data sources → "Connect TikTok" → pantalla de consentimiento (ilustración, permisos de solo lectura) →
perfil + insights de cuenta (`user.info.*`, `user.account.type`, `user.insights`) → videos + insights
(`video.list`, `video.insights`) → sentimiento de comentarios (`comment.list`) → solo lectura / desconectar.
Cada escena nombra el scope que usa. Marca ficticia "Aurora Cosmetics", datos ilustrativos. Sin "×" ni nada
que sugiera alianza con TikTok.

Render: `NODE_PATH=/opt/node22/lib/node_modules node render.mjs` → `export/tiktok-organico.mp4`
(`--stills 8.5,17.5` para revisar cuadros sueltos). Mismo motor que `video-mercado`.
