// CB Ventas · vigencia del cuadro básico (0140): `cd apps/web && npx tsx scripts/cb-ventas-vigencia.test.ts`
// Prueba con datos inventados que (1) sin ediciones el cálculo da EXACTAMENTE lo mismo que antes y (2) una edición en el
// mes N no cambia los meses < N (aplicando las ediciones igual que app/api/cb-ventas/editar con planEdicion).
import { expandirCatalogo, type CatalogoRow } from "../src/lib/cb-ventas/core";
import { calcularPorcentajes, evolucionMensualCB } from "../src/lib/cb-ventas/metrics";
import { planEdicion, vigenteEnFecha, vigenteEnMes } from "../src/lib/cb-ventas/vigencia";
import type { ClasificacionCliente, VentaRow } from "../src/lib/cb-ventas/types";

let fallas = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fallas++; console.error("✗", msg); } };
const eq = (a: unknown, b: unknown, msg: string) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}\n  obtuve ${JSON.stringify(a)}\n  esperaba ${JSON.stringify(b)}`);

// planEdicion
eq(planEdicion({ desde: "2026-01-01" }, "2026-10-27"), { modo: "cerrar", hasta: "2026-09-30", desde: "2026-10-01" }, "renglón viejo → se cierra fin del mes anterior");
eq(planEdicion({ desde: "2026-10-01" }, "2026-10-27"), { modo: "en_lugar" }, "renglón nacido este mes → en el lugar");
eq(planEdicion({}, "2027-01-05"), { modo: "cerrar", hasta: "2026-12-31", desde: "2027-01-01" }, "enero cierra en diciembre del año anterior");
check(vigenteEnMes({ desde: "2026-01-01", hasta: "2026-07-31" }, 2026, 7) && !vigenteEnMes({ desde: "2026-01-01", hasta: "2026-07-31" }, 2026, 8), "vigente en el mes");
check(vigenteEnFecha({}, "2026-10-27"), "sin fechas = siempre vigente (sin 0140)");

const clasif: ClasificacionCliente[] = [
  { id: "1", cliente: "CLI A", pesoFacturacion: 0.1, tipologia: "TOP 10", vendedor: "V1", gerente: "G1" },
  { id: "2", cliente: "CLI B", pesoFacturacion: 0.1, tipologia: "SMALL RETAILERS", vendedor: "V2", gerente: "G2" },
  { id: "3", cliente: "CLI C", pesoFacturacion: 0.1, tipologia: "SMALL RETAILERS", vendedor: "V2", gerente: "G2" },
];
const base: CatalogoRow[] = [
  { id: 1, tipologia: "TOP 10", cliente: "CLI A", tipo: "INFALTABLE", categoria: "LAVADO", modelo: "M1", homologos: ["H1"], orden: 0 },
  { id: 2, tipologia: "TOP 10", cliente: "CLI A", tipo: "ESTRATEGICO", categoria: "COCCION", modelo: "M2", homologos: [], orden: 1 },
  { id: 3, tipologia: "SMALL RETAILERS", cliente: null, tipo: "INFALTABLE", categoria: "REFRIGERACION", modelo: "M3", homologos: [], orden: 2 },
  { id: 4, tipologia: "SMALL RETAILERS", cliente: null, tipo: "ESTRATEGICO", categoria: "LAVADO", modelo: "M4", homologos: ["H4"], orden: 3 },
];
const v = (cliente: string, sku: string, tipo: "FC" | "BO", mes: number): VentaRow =>
  ({ documentoVentas: "d", cliente, sku, tipo, unidades: 1, fecha: `2026-${String(mes).padStart(2, "0")}-01`, mes, vendedor: "x" });
const ventas: VentaRow[] = [
  v("CLI A", "H1", "FC", 2), v("CLI A", "M2", "FC", 3), v("CLI A", "M5", "FC", 9), v("CLI A", "M1", "FC", 8),
  v("CLI B", "M3", "FC", 1), v("CLI B", "H4", "FC", 4), v("CLI C", "M4", "BO", 6), v("CLI B", "H9", "FC", 9), v("CLI C", "M3", "FC", 7),
];
const gen = "2026-10-15T12:00:00Z";
const evo = (cat: CatalogoRow[]) => evolucionMensualCB(expandirCatalogo(cat, clasif), ventas, { generatedAt: gen });
const kpiHoy = (cat: CatalogoRow[], hoy: string) =>
  calcularPorcentajes(expandirCatalogo(cat, clasif).filter((i) => vigenteEnFecha(i, hoy)), ventas, { hayFiltroMes: false, mesEnCurso: 10 });

// (1) Sin ediciones: con las fechas por defecto de 0140 todo da igual que sin migración.
const conDefault = base.map((r) => ({ ...r, vigente_desde: "2026-01-01", vigente_hasta: null }));
const evoAntes = evo(base);
eq(evo(conDefault), evoAntes, "sin ediciones: evolución idéntica a hoy");
const sinFechas = (k: ReturnType<typeof kpiHoy>) => ({ ...k, itemsFaltantes: k.itemsFaltantes.map(({ desde: _d, hasta: _h, ...i }) => i) });
eq(sinFechas(kpiHoy(conDefault, "2026-10-27")), kpiHoy(base, "2026-10-27"), "sin ediciones: KPIs de hoy idénticos (salvo las fechas que viajan en cada ítem)");
eq(expandirCatalogo(base, clasif).every((i) => !("desde" in i)), true, "sin 0140 los ítems no llevan fechas (objetos iguales a antes)");

// (2) Ediciones en agosto (mes N=8), aplicadas como la API.
const hoy = "2026-08-12";
let next = 100;
const aplicar = (cat: CatalogoRow[], id: number, cambio: Partial<CatalogoRow> | "borrar"): CatalogoRow[] => {
  const r = cat.find((x) => x.id === id)!;
  const plan = planEdicion({ desde: r.vigente_desde }, hoy);
  if (plan.modo === "en_lugar") return cambio === "borrar" ? cat.filter((x) => x.id !== id) : cat.map((x) => (x.id === id ? { ...x, ...cambio } : x));
  const cerrado = cat.map((x) => (x.id === id ? { ...x, vigente_hasta: plan.hasta } : x));
  return cambio === "borrar" ? cerrado : [...cerrado, { ...r, ...cambio, id: next++, vigente_desde: plan.desde, vigente_hasta: null }];
};
let ed = aplicar(conDefault, 2, "borrar");                                   // sale M2 de CLI A
ed = aplicar(ed, 1, { tipo: "ESTRATEGICO", homologos: [] });                 // M1 pasa a estratégico y pierde H1
ed = aplicar(ed, 4, { homologos: ["H4", "H9"] });                            // M4 suma homólogo H9
ed = [...ed, { id: next++, tipologia: "TOP 10", cliente: "CLI A", tipo: "INFALTABLE", categoria: "LAVADO", modelo: "M5", homologos: [], orden: 9, vigente_desde: "2026-08-01", vigente_hasta: null }]; // alta
const pid = next - 1;
ed = aplicar(ed, pid, { homologos: ["M6"] });                                // edición del renglón nacido este mes → en el lugar
check(ed.filter((x) => x.id === pid).length === 1, "renglón nacido este mes se edita en el lugar (no duplica)");
check(ed.some((x) => x.id === 2 && x.vigente_hasta === "2026-07-31"), "borrar un renglón viejo lo cierra, no lo elimina");

const evoDesp = evo(ed);
eq(evoDesp.slice(0, 7), evoAntes.slice(0, 7), "enero–julio: idénticos después de editar en agosto");
check(JSON.stringify(evoDesp.slice(7)) !== JSON.stringify(evoAntes.slice(7)), "agosto en adelante usa el cuadro nuevo");
eq(evoDesp[8]!.totalCB, 6, "septiembre: CLI A (M1, M5) + Small Retailers (M3, M4) × 2 clientes");
const kh = kpiHoy(ed, "2026-10-27");
eq([kh.totalCB, kh.totalInf, kh.totalEst], [6, 3, 3], "KPIs de hoy: solo lo vigente (M1 est., M5 inf., M3 ×2 inf., M4 ×2 est.)");

if (fallas) { console.error(`\n${fallas} falla(s)`); process.exit(1); }
console.log("OK cb-ventas-vigencia");
