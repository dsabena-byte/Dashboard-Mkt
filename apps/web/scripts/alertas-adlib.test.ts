// Test de las partes PURAS de Alertas (lib/alerts-shared) y Pauta de la competencia
// (lib/ad-library-shared). Correr: cd apps/web && npx tsx scripts/alertas-adlib.test.ts
import { modoDelDia, selectDigest, isFirstBusinessDay, cleanRecipients, sortItems, type AlertItem } from "../src/lib/alerts-shared";
import { matchesBrand, parseAdItem, adLibraryBrands, brandSummary, isNewSince, MAX_COMPETIDORES } from "../src/lib/ad-library-shared";

let fails = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fails++; console.error("  ✗", msg); } else console.log("  ✓", msg); };

console.log("1 · frecuencia / día");
const lunes = new Date("2026-09-28T11:00:00Z"), martes = new Date("2026-09-29T11:00:00Z");
ok(modoDelDia("auto", lunes) === "semanal" && modoDelDia("auto", martes) === "diaria", "auto: lunes semanal, resto diaria");
ok(modoDelDia("semanal", martes) === null && modoDelDia("diaria", lunes) === "diaria" && modoDelDia("off", lunes) === null, "semanal solo lunes · diaria todos los días · off nunca");
ok(isFirstBusinessDay(new Date("2026-11-02T11:00:00Z")) && !isFirstBusinessDay(new Date("2026-11-01T11:00:00Z")), "nov-2026: 1er día hábil = lunes 2 (el 1 es domingo)");
ok(isFirstBusinessDay(new Date("2026-10-01T11:00:00Z")), "oct-2026: jueves 1");

console.log("2 · selección del digest");
const it = (key: string, prioridad: AlertItem["prioridad"], tipo: AlertItem["tipo"] = "alerta"): AlertItem => ({ key, fuente: "senal", dash: "web", tipo, prioridad, titulo: key, descripcion: "", href: "/web" });
const items = sortItems([it("b", "media"), it("a", "alta"), it("c", "baja"), it("d", "alta", "oportunidad")]);
ok(items[0]!.key === "a" && items[1]!.key === "d", "orden: alta+alerta primero");
ok(selectDigest(items, new Set(["a", "d"]), "diaria").length === 0, "diaria: sin altas nuevas → no se envía");
const d = selectDigest(items, new Set(["a"]), "diaria");
ok(d.length === 2 && d[0]!.key === "d" && d[1]!.key === "b", "diaria: altas nuevas + medias nuevas");
const s = selectDigest(items, new Set(["a"]), "semanal");
ok(s.map((x) => x.key).join() === "d,b,a" && s[2]!.nueva === false, "semanal: nuevas primero, después las abiertas; sin 'baja'");
ok(cleanRecipients("A@x.com, b@y.com;nope, a@x.com").join() === "a@x.com,b@y.com", "destinatarios: limpia, valida y dedup");

console.log("3 · Ad Library");
const brands = adLibraryBrands();
ok(brands[0]!.own && brands[0]!.marca === "Drean" && brands.length === 1 + MAX_COMPETIDORES, `marca propia + ${MAX_COMPETIDORES} competidores (${brands.map((b) => b.marca).join(", ")})`);
ok(!brands.some((b) => ["Hisense", "Midea"].includes(b.marca)), "sin marcas emergentes");
ok(matchesBrand("LG Electronics Argentina", "LG") && !matchesBrand("Algo Lindo", "LG"), "LG: por palabra completa, no substring");
ok(matchesBrand("Whirlpool Argentina", "Whirlpool") && !matchesBrand("Tienda Mia", "Whirlpool"), "Whirlpool");
const flo = brands.find((b) => b.marca === "Florencia")!;
ok(matchesBrand("Cocinas Florencia", flo.marca, flo.ctx) && !matchesBrand("Florencia Gómez", flo.marca, flo.ctx), "Florencia (ambigua): exige contexto");
const now = new Date("2026-09-24T12:00:00Z");
const ad = parseAdItem({ adArchiveID: "123", pageName: "Samsung Argentina", startDate: Math.floor(Date.parse("2026-09-20T00:00:00Z") / 1000), isActive: true, publisherPlatform: ["FACEBOOK", "INSTAGRAM"], snapshot: { displayFormat: "VIDEO", body: { text: "<b>Hola</b> mundo" }, videos: [{ videoPreviewImageUrl: "https://scontent.fbcdn.net/x.jpg" }] } }, now.toISOString())!;
ok(ad.id === "123" && ad.format === "Video" && ad.body === "Hola mundo" && ad.platforms.join() === "facebook,instagram" && ad.thumb!.includes("fbcdn"), "parseAdItem normaliza el item del actor");
ok(isNewSince(ad, 7, now.getTime()), "fecha de inicio (epoch s) → nuevo en 7 días");
const sum = brandSummary({ marca: "Samsung", own: false, ads: [ad, { ...ad, id: "9", active: false, startDate: "2026-01-01T00:00:00Z" }], fetchedAt: null }, now.getTime());
ok(sum.activos === 1 && sum.nuevos7 === 1 && sum.formatos[0]![0] === "Video", "resumen por marca");

if (fails) { console.error(`\n${fails} test(s) fallaron`); process.exit(1); }
console.log("\nOK — todos los tests pasaron");
