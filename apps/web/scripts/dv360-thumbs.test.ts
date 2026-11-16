// Miniaturas DV360: normalización de nombres + matcheo reporte ↔ API.
// cd apps/web && npx tsx scripts/dv360-thumbs.test.ts
import {
  buildThumbIndex,
  categoryOf,
  matchThumb,
  normalizeCreativeName,
  resolveThumbs,
  sizeOf,
  thumbCandidates,
  type Dv360ThumbEntry,
} from "../src/lib/dv360-thumbs-shared";

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.error(`✗ ${m}`); } };

// Normalización
ok(normalizeCreativeName("Imagen_Refrigeración_Heladera SbS 610 (300X600) - Banner") === "imagen refrigeracion heladera sbs 610 300x600", "acentos, mayúsculas, puntuación y sufijo Banner");
ok(normalizeCreativeName("Imagen_Refrigeración_Heladera SbS 610 (320X480)- Banner") === normalizeCreativeName("Imagen_Refrigeración_Heladera SbS 610 (320X480) - Banner"), "')- Banner' = ') - Banner'");
ok(normalizeCreativeName("Refri-300×600") === "refri 300x600", "× → x");
ok(normalizeCreativeName("  Coccion  -  General - Banners 320x50 ") === "coccion general banners 320x50", "espacios colapsados, 'Banners' NO es sufijo");
ok(normalizeCreativeName(null) === "", "null → ''");
ok(sizeOf("Imagen_lavado_General lavado (320X50) - Banner") === "320x50" && sizeOf("Lavado-1080x1920") === "1080x1920" && sizeOf("Drean_Tokio_15seg_9.16") === null, "sizeOf");
ok(categoryOf("Refri-300x600") === "refrigeracion" && categoryOf("Imagen_Refrigeración_General Heladeras (300X250)") === "refrigeracion", "categoría refri");
ok(categoryOf("Coccion-320x250") === "coccion" && categoryOf("COCINA 01 - 10 SEG (1080x1080)") === "coccion", "categoría cocción");
ok(categoryOf("Lavado-320x480") === "lavado" && categoryOf("DREAN-JUL-26-PAUTA-ID01-Lavarropas Tres Productos-Estatico 320X50") === "lavado", "categoría lavado");
ok(categoryOf("CD7609EI - 10 SEG (1080x1080)") === null, "sin palabra clave → null");

// Manifiesto con los nombres reales vistos en la API (28-sep-2026)
const e = (id: string, name: string, w: number, h: number): Dv360ThumbEntry => ({ creativeId: id, name, url: `https://x/dv360/${id}.jpg`, w, h, type: "image" });
const items: Dv360ThumbEntry[] = [
  e("1", "Imagen_Refrigeración_Heladera SbS 610 (300X600) - Banner", 300, 600),
  e("2", "Refrigeracion-Omnet_320x50 (no encontre nomenclatura)", 320, 50),
  e("3", "DREAN-JUL-26-PAUTA-ID01-Lavarropas Tres Productos-Estatico 320X50", 320, 50),
  e("4", "Imagen_lavado_General lavado (320X50) - Banner", 320, 50),
  e("5", "Imagen_Refrigeración_General Heladeras (300X600) - Banner", 300, 600),
  e("6", "Coccion - General - Banners 320x50", 320, 50),
  e("7", "Coccion - Air Fryer - Omnet 320x250", 320, 250),
  e("8", "Lavado - General 320x480", 320, 480),
  e("9", "Lavado - CS 320x480", 320, 480),
];
const idx = buildThumbIndex(items);

// Exacto (nombre del reporte = displayName de la API, con variaciones de formato)
ok(matchThumb("Imagen_Refrigeración_Heladera SbS 610 (300X600) - Banner", idx)?.url.endsWith("/1.jpg"), "exacto: SbS 610 300x600");
ok(matchThumb("Imagen_Refrigeracion_Heladera SbS 610 (300x600)- Banner", idx)?.via === "exacto", "exacto tolera acento/mayúsc./guion");
ok(matchThumb("Refrigeracion-Omnet_320x50 (no encontre nomenclatura)", idx)?.url.endsWith("/2.jpg"), "exacto: Omnet 320x50");
ok(matchThumb("DREAN-JUL-26-PAUTA-ID01-Lavarropas Tres Productos-Estatico 320X50", idx)?.url.endsWith("/3.jpg"), "exacto: ID01 320x50");
ok(matchThumb("Imagen_lavado_General lavado (320X50) - Banner", idx)?.url.endsWith("/4.jpg"), "exacto: grid 'General lavado 320x50'");
ok(matchThumb("Coccion - General - Banners 320x50", idx)?.url.endsWith("/6.jpg"), "exacto: grid 'Coccion - General - Banners 320x50'");

// Fallback categoría + tamaño: solo si hay UN candidato
const coc = matchThumb("Coccion-320x250", idx);
ok(coc?.url.endsWith("/7.jpg") && coc.via === "categoria+tamano", "fallback único: Coccion-320x250 → Air Fryer 320x250");
ok(matchThumb("Refri-300x600", idx) === null, "fallback ambiguo (2 refri 300x600) → sin match");
ok(matchThumb("Lavado-320x480", idx) === null, "fallback ambiguo (2 lavado 320x480) → sin match");
ok(matchThumb("Refri-320x480", idx) === null, "sin candidato → sin match");
ok(matchThumb("CD7609EI - 10 SEG (1080x1080)", idx) === null, "sin categoría → sin match");

// Mismo archivo en 2 creatives → cuenta como 1 candidato
const dup = buildThumbIndex([e("a", "Refri A 300x600", 300, 600), { ...e("b", "Refri B 300x600", 300, 600), url: "https://x/dv360/a.jpg" }]);
ok(matchThumb("Refri-300x600", dup)?.url === "https://x/dv360/a.jpg", "misma url duplicada → único");

// resolveThumbs
const r = resolveThumbs(["Imagen_lavado_General lavado (320X50) - Banner", "Refri-300x600", "Unknown", "Coccion-320x250", "Refri-300x600"], items);
ok(Object.keys(r.map).length === 2 && r.unmatched.join() === "Refri-300x600", `resolveThumbs: 2 matcheos, 'Unknown' ignorado (${JSON.stringify(r.unmatched)})`);

// URLs candidatas desde la API
const img = thumbCandidates({ creativeId: "1", assets: [{ asset: { content: "/simgad/1796611342726180471", mediaId: "9" }, role: "ASSET_ROLE_MAIN" }] });
ok(img?.type === "image" && img.urls[0] === "https://tpc.googlesyndication.com/simgad/1796611342726180471" && img.urls[1] === "https://s0.2mdn.net/simgad/1796611342726180471", "simgad → tpc + 2mdn");
const yt = thumbCandidates({ creativeId: "2", youtubeVideoId: "abc123" });
ok(yt?.type === "youtube" && yt.urls[0] === "https://i.ytimg.com/vi/abc123/hqdefault.jpg", "youtube → i.ytimg.com");
ok(thumbCandidates({ creativeId: "3", assets: [{ asset: { content: "https://gcdn.2mdn.net/videoplayback/x.mp4" } }] }) === null, "video alojado (mp4) → sin miniatura");
const bk = thumbCandidates({ creativeId: "4", assets: [{ asset: { content: "https://s0.2mdn.net/a/index.html" }, role: "ASSET_ROLE_MAIN" }, { asset: { content: "/simgad/55" }, role: "ASSET_ROLE_BACKUP" }] });
ok(bk?.urls[0] === "https://tpc.googlesyndication.com/simgad/55", "HTML5 → imagen de backup");

console.log(`dv360-thumbs: ${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
