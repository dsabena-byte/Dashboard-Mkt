// Paridad Business Discovery ↔ scraper: BD nunca deja una fila con menos información.
// Correr: cd apps/web && npx tsx scripts/bd-paridad.test.ts
import { bdMetricPatch, pilarPrompt, parsePilares, pickPilar } from "../src/lib/bd-paridad";

let p = 0, f = 0;
function ok(name: string, cond: boolean, extra?: unknown) { if (cond) p++; else { f++; console.error("FALLA:", name, extra ?? ""); } }

const row = { likes: 100, comentarios: 10, views: 5000, followers: 150000 };
ok("no baja contadores ni pisa views con un valor menor", JSON.stringify(bdMetricPatch(row, { likes: 90, comentarios: 9, views: 4000 }, 151000)) === "{}");
ok("sube lo que creció", JSON.stringify(bdMetricPatch(row, { likes: 120, comentarios: 10, views: 6000 }, 151000)) === JSON.stringify({ likes: 120, views: 6000 }));
ok("likes ocultos (null) no se tocan", !("likes" in bdMetricPatch(row, { likes: null, comentarios: 11, views: 0 }, null)));
ok("views 0 de BD (foto/carrusel) no pisa", !("views" in bdMetricPatch({ ...row, views: 0 }, { likes: 1, comentarios: 1, views: 0 }, null)));
ok("completa views si la fila no tenía", bdMetricPatch({ ...row, views: null }, { likes: 1, comentarios: 1, views: 300 }, null).views === 300);
ok("followers: no reemplaza el del momento del post", !("followers" in bdMetricPatch(row, { likes: 1, comentarios: 1, views: 0 }, 999)));
ok("followers: completa si era 0", bdMetricPatch({ ...row, followers: 0 }, { likes: 1, comentarios: 1, views: 0 }, 999).followers === 999);
ok("likes -1 (sin dato) se completa", bdMetricPatch({ ...row, likes: -1 }, { likes: 5, comentarios: 1, views: 0 }, null).likes === 5);
ok("nunca escribe null", Object.values(bdMetricPatch({ likes: null, comentarios: null, views: null, followers: null }, { likes: null, comentarios: null, views: null }, null)).every((v) => v != null));

const pr = pilarPrompt([{ i: 1, marca: "philco.arg", copy: "Eternamente\nagradecidos" }]);
ok("prompt: 5 pilares, JSON y numerado", pr.includes("Branding, Producto, Promo, Influencer, Educacional") && pr.includes('"pilares"') && pr.includes("1. [philco.arg] Eternamente agradecidos"));
const pp = parsePilares('{"pilares":[{"i":1,"pilar":"producto"},{"i":2,"pilar":"Promo/Branding"},{"i":3,"pilar":"cualquiera"},{"i":"x","pilar":"Promo"}]}');
ok("parse: normaliza caso, combinado y desconocido", pp.get(1) === "Producto" && pp.get(2) === "Promo" && pp.get(3) === "Branding" && pp.size === 3, [...pp]);
ok("parse: JSON inválido → vacío", parsePilares("nope").size === 0);
ok("pickPilar vacío → Branding", pickPilar("") === "Branding");

console.log(`bd-paridad: ${p} OK, ${f} fallas`);
if (f) process.exit(1);
