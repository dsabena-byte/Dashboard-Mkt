#!/usr/bin/env node
/**
 * Render: Chromium avanza la animación cuadro a cuadro (window.__seek) y pipea a ffmpeg.
 * La pista de sonido sale de window.__AUDIO (audio.py) y se mezcla al final.
 *
 *   node render.mjs                     -> export/bip-aguja.mp4 (1080x1350 @30fps)
 *   node render.mjs --stills 0.5,5,7.2  -> PNG sueltos en export/stills
 *
 * Salida apta para WhatsApp: H.264 Main sin B-frames + AAC.
 */
import { createRequire } from 'module';
import { spawn, spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'export');
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch {} }
  throw new Error('No se encontró playwright.');
}
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FPS = +arg('fps', 30), STILLS = arg('stills', null), NAME = arg('out', 'bip-aguja');

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
await page.goto('file://' + resolve(HERE, 'index.html'), { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true');
const DUR = await page.evaluate(() => window.__DURATION);
const stage = await page.$('#stage');
mkdirSync(OUT, { recursive: true });

if (STILLS) {
  mkdirSync(resolve(OUT, 'stills'), { recursive: true });
  for (const s of STILLS.split(',').map(Number)) {
    await page.evaluate(t => window.__seek(t), s);
    writeFileSync(resolve(OUT, 'stills', `t${s.toFixed(2)}.png`), await stage.screenshot({ type: 'png' }));
  }
  await browser.close(); process.exit(0);
}

const events = await page.evaluate(() => window.__AUDIO);
writeFileSync(resolve(OUT, 'audio-events.json'), JSON.stringify({ dur: DUR, events }));
const wav = resolve(OUT, 'audio.wav');
const py = spawnSync('python3', ['-I', resolve(HERE, 'audio.py'), resolve(OUT, 'audio-events.json'), wav], { stdio: 'inherit' });
if (py.status) throw new Error('audio.py falló');

const mp4 = resolve(OUT, NAME + '.mp4');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', wav,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-bf', '0',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = b => new Promise(r => ff.stdin.write(b) ? r() : ff.stdin.once('drain', r));
const total = Math.round(DUR * FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.__seek(t), f / FPS);
  await write(await stage.screenshot({ type: 'png' }));
  if (f % 60 === 0) process.stdout.write(`frame ${f + 1}/${total}\n`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
console.log('OK ->', mp4);
