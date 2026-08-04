// Compositor por capas para piezas (fondo + logo PNG + texto), en canvas.
// Extraído de la Adaptación de piezas para reusarlo también en el diseño de una
// pieza del generador. Todo corre en el browser (usa canvas / Image / document).
//
//  - LOGO (PNG): se auto-recorta el margen transparente; posición X/Y + tamaño %.
//  - TEXTO/copy: Manrope, **negrita** / _cursiva_, posición X/Y + tamaño % + color.
//  - FRANJA (opcional): banda de color arriba/abajo para formatos apretados.

export interface FmtCfg {
  on: boolean;
  logoX: number; logoY: number; logoPct: number;
  textX: number; textY: number; textPct: number;
  bandPct: number;
}
export interface Word { w: string; bold: boolean; italic: boolean }
export interface Trim { sx: number; sy: number; sw: number; sh: number }

export const defaultCfg = (): FmtCfg => ({ on: true, logoX: 0, logoY: 0, logoPct: 0.12, textX: 0.5, textY: 1, textPct: 0.08, bandPct: 0 });

// Parsea markup liviano: **negrita** y _cursiva_ → lista de palabras con estilo.
export function parseWords(copy: string): Word[] {
  const out: Word[] = [];
  copy.split("**").forEach((boldSeg, bi) => {
    const bold = bi % 2 === 1;
    boldSeg.split("_").forEach((itSeg, ii) => { const italic = ii % 2 === 1; for (const w of itSeg.split(/\s+/).filter(Boolean)) out.push({ w, bold, italic }); });
  });
  return out;
}

export const fontFor = (bold: boolean, italic: boolean, fs: number) => `${italic ? "italic " : ""}${bold ? 800 : 500} ${fs}px "Manrope", Arial, sans-serif`;

// Traduce una fracción 0..1 a un offset en px dentro del espacio disponible.
export function place(frac: number, span: number, size: number): number { const room = span - size; return room <= 0 ? room / 2 : Math.max(0, Math.min(1, frac)) * room; }

// Detecta el bounding box no-transparente de un PNG (para pegar el logo sin su
// margen vacío). Escala a ≤500px para leer píxeles rápido.
export function computeTrim(img: HTMLImageElement): Trim {
  const full: Trim = { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
  const scale = Math.min(1, 500 / Math.max(1, img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas"); c.width = w; c.height = h; const cx = c.getContext("2d"); if (!cx) return full;
  cx.drawImage(img, 0, 0, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  try {
    const data = cx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  } catch { return full; }
  if (maxX < 0) return full;
  const inv = 1 / scale;
  return { sx: Math.floor(minX * inv), sy: Math.floor(minY * inv), sw: Math.ceil((maxX - minX + 1) * inv), sh: Math.ceil((maxY - minY + 1) * inv) };
}

export function loadImg(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); if (cors) i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("img")); i.src = src; });
}

// Dibuja la imagen "cover" (recorta para llenar el destino sin deformar).
export function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const ir = img.naturalWidth / img.naturalHeight, cr = dw / dh;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > cr) { sh = img.naturalHeight; sw = sh * cr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
  else { sw = img.naturalWidth; sh = sw / cr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrapBold(ctx: CanvasRenderingContext2D, words: Word[], maxW: number, fs: number): Word[][] {
  const lines: Word[][] = []; let line: Word[] = []; let lineW = 0;
  for (const tok of words) { ctx.font = fontFor(tok.bold, tok.italic, fs); const ww = ctx.measureText(tok.w).width; const add = (line.length ? ctx.measureText(" ").width : 0) + ww; if (lineW + add > maxW && line.length) { lines.push(line); line = [tok]; lineW = ww; } else { line.push(tok); lineW += add; } }
  if (line.length) lines.push(line); return lines;
}
function lineWidth(ctx: CanvasRenderingContext2D, line: Word[], fs: number): number { let w = 0; line.forEach((t, j) => { ctx.font = fontFor(t.bold, t.italic, fs); w += ctx.measureText(t.w).width + (j ? ctx.measureText(" ").width : 0); }); return w; }

// Render principal de una pieza: fondo (cover) + franja opcional + logo + texto.
export function drawPieza(ctx: CanvasRenderingContext2D, bg: HTMLImageElement, logo: HTMLImageElement | null, trim: Trim | null, words: Word[], W: number, H: number, c: FmtCfg, color: string, bandColor: string) {
  ctx.clearRect(0, 0, W, H);
  const bandH = Math.round(H * (c.bandPct || 0));
  if (bandH > 0) { coverDraw(ctx, bg, 0, bandH, W, H - bandH * 2); ctx.fillStyle = bandColor; ctx.fillRect(0, 0, W, bandH); ctx.fillRect(0, H - bandH, W, bandH); }
  else coverDraw(ctx, bg, 0, 0, W, H);
  const P = Math.round(Math.min(W, H) * 0.035);
  if (logo && trim) {
    const ar = trim.sw / Math.max(1, trim.sh);
    let lh = H * c.logoPct; let lw = lh * ar; if (lw > W) { lw = W; lh = lw / ar; }
    ctx.drawImage(logo, trim.sx, trim.sy, trim.sw, trim.sh, place(c.logoX, W, lw), place(c.logoY, H, lh), lw, lh);
  }
  if (words.length) {
    const fs = Math.max(8, Math.round(H * c.textPct));
    ctx.textBaseline = "top"; ctx.fillStyle = color; ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = fs * 0.22;
    const lines = wrapBold(ctx, words, W - P * 2, fs); const lh = fs * 1.18; const blockH = lines.length * lh;
    const blockW = Math.max(...lines.map((l) => lineWidth(ctx, l, fs)));
    const bx = place(c.textX, W, blockW); const by = place(c.textY, H, blockH);
    lines.forEach((line, i) => { let x = bx; const y = by + i * lh; line.forEach((t, j) => { ctx.font = fontFor(t.bold, t.italic, fs); if (j) x += ctx.measureText(" ").width; ctx.fillText(t.w, x, y); x += ctx.measureText(t.w).width; }); });
    ctx.shadowBlur = 0;
  }
}
