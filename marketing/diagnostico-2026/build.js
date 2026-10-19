// Diagnóstico integral de Marketing 2026 — Drean.
// Build: NODE_PATH=<dir con pptxgenjs>/node_modules SKILL=<skill pptx> node build.js salida.pptx
const L = require('./lib');
const X = require('./cap-sintesis');
const ctx = L.nuevo();
X.portada(ctx);
X.ejecutivo(ctx);
require('./cap-social')(ctx);
require('./cap-pauta')(ctx);
require('./cap-web')(ctx);
X.campanas(ctx);
X.conclusiones(ctx);
X.anexos(ctx);
L.guardar(ctx, process.argv[2] || 'diagnostico-marketing-2026.pptx').then(() => console.log('ok'));
