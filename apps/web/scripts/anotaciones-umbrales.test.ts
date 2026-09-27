// Anotaciones en gráficos + umbrales propios de alertas (portado de BIP, sep-2026). Puro.
// Correr: cd apps/web && npx tsx scripts/anotaciones-umbrales.test.ts
import { anotacionesParaPrompt, cleanAnotacion, marcasEnEje, paraTablero, type Anotacion } from "../src/lib/anotaciones-core";
import { cleanUmbrales, describirUmbral, evaluarUmbrales, seriesDesdeNativos, UMBRAL_METRICAS } from "../src/lib/umbrales";
import { pautaMensual, redesIgMensual, webMensual } from "../src/lib/native-datasets-core";
import type { PautaMesMedios } from "../src/lib/pauta-medios-model";

let fails = 0, passes = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) passes++; else { fails++; console.error(`✗ ${name}${extra !== undefined ? `\n   ${JSON.stringify(extra)}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }
const hoy = new Date("2026-09-27T12:00:00Z");

// ── Anotaciones ──
eq("alta válida", cleanAnotacion({ fecha: "2026-03-10", texto: "  Lanzamiento   TV ", tablero: "performance" }, hoy), { ok: true, value: { fecha: "2026-03-10", tablero: "performance", texto: "Lanzamiento TV" } });
ok("fecha inexistente", !cleanAnotacion({ fecha: "2026-02-30", texto: "x" }, hoy).ok);
ok("texto vacío", !cleanAnotacion({ fecha: "2026-02-10", texto: "  " }, hoy).ok);
ok("texto largo", !cleanAnotacion({ fecha: "2026-02-10", texto: "x".repeat(281) }, hoy).ok);
ok("tablero con inyección", !cleanAnotacion({ fecha: "2026-02-10", texto: "x", tablero: "a,tablero.eq.b" }, hoy).ok);
ok("muy en el futuro", !cleanAnotacion({ fecha: "2028-01-01", texto: "x" }, hoy).ok);
const sinTb = cleanAnotacion({ fecha: "2026-02-10", texto: "x", tablero: "" }, hoy);
eq("sin tablero = todo el dashboard", sinTb.ok ? sinTb.value.tablero : "err", null);
ok("slug de Mis tableros válido", cleanAnotacion({ fecha: "2026-02-10", texto: "x", tablero: "t-ventas-ab12" }, hoy).ok);

const notas: Anotacion[] = [
  { id: "1", fecha: "2026-03-10", tablero: "performance", texto: "Lanzamiento TV" },
  { id: "2", fecha: "2026-03-25", tablero: null, texto: "Corte de stock" },
  { id: "3", fecha: "2026-05-02", tablero: "web", texto: "Nuevo sitio" },
];
eq("filtra por tablero + generales", paraTablero(notas, "performance").map((n) => n.id), ["1", "2"]);
const marks = marcasEnEje(notas, [{ key: "2026-02", label: "Feb 26" }, { key: "2026-03", label: "Mar 26" }], "month");
eq("marcas agrupadas en el bucket del eje", marks, [{ key: "2026-03", label: "Mar 26", textos: ["Lanzamiento TV", "Corte de stock"] }]);
eq("fuera del eje no marca", marcasEnEje(notas, [{ key: "2026-01", label: "Ene" }], "month").length, 0);
ok("prompt: más recientes primero", anotacionesParaPrompt(notas).startsWith("- 2026-05-02 [web]: Nuevo sitio"));

// ── Umbrales ──
const us = cleanUmbrales([
  { id: "a", metrica: "cpm", cond: "mayor", valor: "1.500" },
  { id: "b", metrica: "sesiones", cond: "cae_pct", valor: 20 },
  { metrica: "inventada", cond: "mayor", valor: 1 },
  { metrica: "ctr", cond: "cae_pct", valor: 500 },
  { metrica: "ctr", cond: "raro", valor: 1 },
]);
eq("saneo", us.map((u) => [u.id, u.metrica, u.cond, u.valor]), [["a", "cpm", "mayor", 1500], ["b", "sesiones", "cae_pct", 20]]);
eq("descripción", describirUmbral(us[0]!), "CPM supera $ 1.500");
ok("métricas de Drean (sin transacciones/ingresos de BIP)", UMBRAL_METRICAS.every((m) => !["transacciones", "ingresos"].includes(m.id)) && UMBRAL_METRICAS.some((m) => m.id === "conversiones"));

const mm = (inv: number, impr: number) => ({ inv, alc: 0, impr, clic: 5000, v50: 0, vbase: 0 });
const meses: (PautaMesMedios | null)[] = Array.from({ length: 12 }, () => null);
const mes = (i: number, inv: number, sinImpr = 0): PautaMesMedios => ({ mesIdx: i, mesLabel: "", iso: "", tot: mm(inv + sinImpr, 1_000_000), medios: { Meta: { ...mm(inv, 1_000_000), fuente: "api" }, ...(sinImpr ? { TikTok: { ...mm(sinImpr, 0), fuente: "omd" as const } } : {}) } });
meses[6] = mes(6, 1_000_000); // CPM 1000
meses[7] = mes(7, 2_000_000, 5_000_000); // CPM 2000 (la fila OMD sin impresiones NO infla el CPM)
meses[8] = mes(8, 9_000_000); // sep = mes en curso → no cuenta
const pauta = pautaMensual([{ anio: 2026, meses }]);
const web = webMensual([{ mes: "2026-07-01", sesiones: 1000, pageviews: 0, avg_session_duration: 0 }, { mes: "2026-08-01", sesiones: 700, pageviews: 0, avg_session_duration: 0 }, { mes: "2026-09-01", sesiones: 10, pageviews: 0, avg_session_duration: 0 }], [], []);
const redes = redesIgMensual([{ fecha_post: "2026-08-03T00:00:00Z", reach: 2000, engagement: 60, reactions: 50, clicks: 5 }]);
const series = seriesDesdeNativos({ pauta, web, redes });
eq("CPM mensual", series.cpm!.map((p) => p.valor), [1000, 2000, 9000]);
eq("ER Instagram = Σinteracciones ÷ Σalcance", series.engagement![0]!.valor, 3);
const d = evaluarUmbrales(us, series, hoy);
eq("disparan CPM (ago, no sep en curso) y caída de sesiones 30%", d.map((x) => [x.umbral.id, x.mes, Math.round(x.cambioPct ?? 0)]), [["a", "2026-08", 100], ["b", "2026-08", -30]]);
ok("título con mes y variación", d[1]!.titulo.includes("agosto 2026") && d[1]!.titulo.includes("-30"), d[1]!.titulo);
eq("no dispara si no se cumple", evaluarUmbrales(cleanUmbrales([{ metrica: "cpm", cond: "mayor", valor: 5000 }]), series, hoy).length, 0);
eq("sin serie no dispara", evaluarUmbrales(cleanUmbrales([{ metrica: "conversiones", cond: "menor", valor: 5 }]), {}, hoy).length, 0);

console.log(`anotaciones-umbrales: ${passes} OK, ${fails} fallas`);
if (fails) process.exit(1);
