// "Mis acciones" (ids estables, validación, cruce con las tarjetas de hoy) + guarda del Diagnóstico IA.
// Correr: cd apps/web && npx tsx scripts/recomendacion-seguimiento.test.ts
import { fromSignal, fromPlanAccion, fromOportunidad, fromHallazgo, type Recomendacion } from "../src/lib/recomendacion";
import { idSenal, idIa, ID_ACCION_RE, sanearAccion, misAcciones, estadoPorId, aplicarCambio, snapshotDe, type AccionSeguida } from "../src/lib/recomendacion-seguimiento";
import { debeReusarDiagnostico, haceTexto, fechaCorta, GUARD_HORAS } from "../src/lib/insights/guard";
import { DIAG_DASHES } from "../src/lib/insights/types";
import type { Signal } from "../src/lib/signals/types";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${extra !== undefined ? `\n   ${JSON.stringify(extra)}` : ""}`); }
}

// ── Ids estables ──
const sig: Signal = { key: "pauta_cpm_outlier_123", dash: "performance", tipo: "alerta", prioridad: "alta", titulo: "Título A", descripcion: "x", acciones: ["Pausala"], datos: {} };
const r1 = fromSignal(sig);
const r2 = fromSignal({ ...sig, titulo: "Otro texto (cambió la redacción)", descripcion: "y", acciones: ["Otra"] });
ok("señal: id = senal:<dash>:<clave>", r1.id === idSenal("performance", "pauta_cpm_outlier_123") && r1.id.startsWith("senal:performance:pauta_cpm_outlier_123"), r1.id);
ok("señal: el id NO depende del texto (reescribir la señal no pierde el seguimiento)", r1.id === r2.id);
ok("señal: otra clave → otro id", fromSignal({ ...sig, key: "pauta_cpm_outlier_124" }).id !== r1.id);
ok("señal: claves con símbolos siguen siendo ids válidos", ID_ACCION_RE.test(idSenal("redes", "redes_IG_Reels/Video_reach drop")), idSenal("redes", "redes_IG_Reels/Video_reach drop"));
const ia = fromPlanAccion({ accion: "Subir el presupuesto de Meta", prioridad: "alta", porque: "", impactoEsperado: "" }, "performance");
ok("IA plan: id = ia:<dash>:<hash del título>", ia.id === idIa("performance", "Subir el presupuesto de Meta"), ia.id);
ok("IA: mismo título con tildes/mayúsculas → mismo id", idIa("web", "Revisar la página ÚNICA") === idIa("web", "revisar la pagina unica"));
ok("IA: otro título → otro id", idIa("web", "A") !== idIa("web", "B"));
ok("IA oportunidad e hallazgo usan la misma fórmula", fromOportunidad({ palanca: "X", impacto: "", calculo: "", prioridad: "media" }, "web").id === idIa("web", "X") && fromHallazgo({ titulo: "Y", evidencia: "", tipo: "negativo", porque: "" }, "web")!.id === idIa("web", "Y"));
ok("todos los ids generados pasan la validación", [r1, ia].every((r) => ID_ACCION_RE.test(r.id)));

// ── Validación del POST ──
const body = { id: r1.id, dash: "performance", estado: "planificada", titulo: r1.titulo, snapshot: snapshotDe({ ...r1, impactoTexto: null }) };
const s1 = sanearAccion(body, DIAG_DASHES);
ok("sanear: válido", s1.ok && s1.value.estado === "planificada" && s1.value.snapshot?.pasos[0] === "Pausala", s1);
ok("sanear: estado inválido", !sanearAccion({ ...body, estado: "borrada" }, DIAG_DASHES).ok);
ok("sanear: tablero desconocido", !sanearAccion({ ...body, dash: "otro" }, DIAG_DASHES).ok);
ok("sanear: id de otro tablero", !sanearAccion({ ...body, dash: "web" }, DIAG_DASHES).ok);
ok("sanear: id con formato raro", !sanearAccion({ ...body, id: "drop table;" }, DIAG_DASHES).ok);
ok("sanear: sin título", !sanearAccion({ ...body, titulo: "  " }, DIAG_DASHES).ok);
ok("sanear: body nulo", !sanearAccion(null, DIAG_DASHES).ok);
const largo = sanearAccion({ ...body, titulo: "x".repeat(900), snapshot: { ...body.snapshot, pasos: Array(20).fill("p".repeat(900)), prioridad: "rarísima" } }, DIAG_DASHES);
ok("sanear: recorta textos, máximo 6 pasos y prioridad desconocida → media", largo.ok && largo.value.titulo.length === 300 && largo.value.snapshot!.pasos.length === 6 && largo.value.snapshot!.pasos[0]!.length === 400 && largo.value.snapshot!.prioridad === "media");

// ── "Mis acciones": cruce con las tarjetas de hoy ──
const A = (id: string, estado: AccionSeguida["estado"], updatedAt: string): AccionSeguida => ({ id, dash: "performance", estado, titulo: id, snapshot: null, autor: "a@drean.com.ar", updatedAt });
const seguidas = [A("senal:performance:vieja-1", "planificada", "2026-09-01T10:00:00Z"), A(r1.id, "hecha", "2026-09-20T10:00:00Z"), A("ia:performance:zz", "descartada", "2026-09-25T10:00:00Z"), A("senal:performance:nueva-2", "planificada", "2026-09-26T10:00:00Z")];
const hoy: Recomendacion[] = [r1, ia];
const mias = misAcciones(seguidas, hoy);
ok("mis acciones: muestra TODAS las marcadas aunque ya no salgan", mias.length === 4);
ok("mis acciones: vigente = sigue saliendo hoy", mias.find((m) => m.id === r1.id)?.vigente === true && mias.find((m) => m.id === "senal:performance:vieja-1")?.vigente === false);
ok("mis acciones: la vigente trae la tarjeta de hoy", mias.find((m) => m.id === r1.id)?.actual?.titulo === r1.titulo);
ok("mis acciones: orden planificadas → hechas → descartadas, lo más nuevo primero", mias.map((m) => m.id).join("|") === ["senal:performance:nueva-2", "senal:performance:vieja-1", r1.id, "ia:performance:zz"].join("|"), mias.map((m) => m.id));
ok("estadoPorId", estadoPorId(seguidas).get(r1.id) === "hecha" && !estadoPorId(seguidas).has(ia.id));
const cambiado = aplicarCambio(seguidas, { ...seguidas[0]!, estado: "hecha" });
ok("aplicarCambio: no duplica y reemplaza", cambiado.length === 4 && cambiado.filter((a) => a.id === "senal:performance:vieja-1").length === 1 && cambiado[0]!.estado === "hecha");

// ── Guarda del Diagnóstico IA ──
const ahora = new Date("2026-09-27T20:00:00Z");
ok("guarda: sin diagnóstico previo → genera", !debeReusarDiagnostico(null, ahora, false).reusar);
ok("guarda: de hace 3 h → reusa", debeReusarDiagnostico("2026-09-27T17:00:00Z", ahora, false).reusar && debeReusarDiagnostico("2026-09-27T17:00:00Z", ahora, false).edadMs === 3 * 3_600_000);
ok("guarda: de hace 3 h con force → genera", !debeReusarDiagnostico("2026-09-27T17:00:00Z", ahora, true).reusar);
ok(`guarda: de hace ${GUARD_HORAS} h justas → genera`, !debeReusarDiagnostico(new Date(ahora.getTime() - GUARD_HORAS * 3_600_000).toISOString(), ahora, false).reusar);
ok("guarda: de hace 11 h 59 min → reusa", debeReusarDiagnostico(new Date(ahora.getTime() - (GUARD_HORAS * 60 - 1) * 60_000).toISOString(), ahora, false).reusar);
ok("guarda: fecha rota → genera", !debeReusarDiagnostico("no-es-fecha", ahora, false).reusar);
ok("guarda: horas configurables", debeReusarDiagnostico("2026-09-27T17:00:00Z", ahora, false, 2).reusar === false);
ok("haceTexto", haceTexto(30_000) === "menos de un minuto" && haceTexto(5 * 60_000) === "5 minutos" && haceTexto(3_600_000) === "1 hora" && haceTexto(3 * 3_600_000 + 1) === "3 horas" && haceTexto(3 * 86_400_000) === "3 días" && haceTexto(null) === "un rato");
ok("fechaCorta dd/mm hh:mm en hora argentina", fechaCorta("2026-09-27T17:05:00Z") === "27/09 14:05", fechaCorta("2026-09-27T17:05:00Z"));

console.log(`recomendacion-seguimiento: ${pass} OK, ${fail} FAIL`);
if (fail) process.exit(1);
