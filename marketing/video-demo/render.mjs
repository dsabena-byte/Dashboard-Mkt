#!/usr/bin/env node
/**
 * Render del demo: Chromium avanza la animación frame a frame (window.__seek)
 * y cada captura se pipea a ffmpeg. Determinístico: no depende del reloj real.
 *
 *   node render.mjs                      -> export/demo-50s.mp4 (1920x1080 @30fps, 50 s)
 *   node render.mjs --fps 30 --scale 1   -> opciones
 *   node render.mjs --stills 0.8,4,11.5  -> PNGs sueltos en export/stills (revisión)
 */
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'export');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) {
    try { return require(p); } catch {}
  }
  throw new Error('No se encontró playwright. Instalalo con: npm i -g playwright');
}

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FPS = +arg('fps', 30);
const SCALE = +arg('scale', 1);
const STILLS = arg('stills', null);
const FILE = 'file://' + resolve(HERE, 'index.html');

const { chromium } = loadPlaywright();

const browser = await chromium.launch({
  args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text',
         '--hide-scrollbars', '--disable-gpu']
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: SCALE,
});
await page.goto(FILE, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true');
await page.evaluate(() => document.fonts.ready);
const DUR = await page.evaluate(() => window.__DURATION);

mkdirSync(OUT, { recursive: true });

if (STILLS) {
  const dir = resolve(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  for (const s of STILLS.split(',').map(Number)) {
    await page.evaluate(t => window.__seek(t), s);
    const buf = await page.screenshot({ type: 'png' });
    writeFileSync(resolve(dir, `t${s.toFixed(2)}.png`), buf);
    process.stdout.write(`still ${s}s\n`);
  }
  await browser.close();
  process.exit(0);
}

const total = Math.round(DUR * FPS);
const mp4 = resolve(OUT, 'demo-50s.mp4');
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
  '-movflags', '+faststart', mp4,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const write = buf => new Promise(res => ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res));

const t0 = Date.now();
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.__seek(t), f / FPS);
  await write(await page.screenshot({ type: 'png' }));
  if (f % 60 === 0 || f === total - 1) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`frame ${f + 1}/${total}  ${(f / DUR / FPS * 100).toFixed(0)}%  ${el.toFixed(0)}s\n`);
  }
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('OK ->', mp4);
