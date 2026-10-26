// Test puro de usuarios y grupos (migración 0136): grupos → tableros, APIs de los restringidos, CSV.
// Correr: cd apps/web && npx tsx scripts/usuarios.test.ts
import { isPathAllowed } from "../src/lib/dashboard-access";
import { apiPermitida, areaDeDash, esColumnaInexistente, estadoDe, esTablaInexistente, parseCsvUsuarios, puedeEditar, rutasPermitidas } from "../src/lib/usuarios-core";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
}

// grupos → rutas
eq("admin ve todo", rutasPermitidas({ grupos: [], es_admin: true }), null);
eq("marketing ve todo", rutasPermitidas({ grupos: ["marketing"], es_admin: false }), null);
eq("marketing + trade ve todo", rutasPermitidas({ grupos: ["trade", "marketing"], es_admin: false }), null);
eq("trade", rutasPermitidas({ grupos: ["trade"], es_admin: false }), ["/cuadros-basicos", "/floor-share", "/guia"]);
eq("ventas", rutasPermitidas({ grupos: ["ventas"], es_admin: false }), ["/cb-ventas", "/guia"]);
eq("trade + ventas", rutasPermitidas({ grupos: ["trade", "ventas"], es_admin: false }), ["/cuadros-basicos", "/floor-share", "/cb-ventas", "/guia"]);
eq("sin grupo = nada", rutasPermitidas({ grupos: [], es_admin: false }), []);
eq("grupo desconocido = nada", rutasPermitidas({ grupos: ["otro"], es_admin: false }), []);

const trade = rutasPermitidas({ grupos: ["trade"], es_admin: false });
eq("trade ve CB", isPathAllowed("/cuadros-basicos", trade), true);
eq("trade ve FS subruta", isPathAllowed("/floor-share/x", trade), true);
eq("trade no ve web", isPathAllowed("/web", trade), false);
eq("trade no ve raíz", isPathAllowed("/", trade), false);
eq("trade no ve usuarios", isPathAllowed("/usuarios", trade), false);
eq("trade ve guía", isPathAllowed("/guia/x", trade), true);
eq("prefijo no engaña", isPathAllowed("/floor-share-x", trade), false);

// APIs
eq("api sin restricción", apiPermitida("/api/usuarios", null), true);
eq("api chat", apiPermitida("/api/chat", trade), true);
eq("api chat feedback", apiPermitida("/api/chat/feedback", trade), true);
eq("api insights signals", apiPermitida("/api/insights/signals", trade), true);
eq("api anotaciones", apiPermitida("/api/anotaciones", trade), true);
eq("api recomendaciones", apiPermitida("/api/recomendaciones/seguimiento", trade), true);
eq("api metas", apiPermitida("/api/metas/historia", trade), true);
eq("api usuarios no", apiPermitida("/api/usuarios", trade), false);
eq("api presupuesto no", apiPermitida("/api/presupuesto", trade), false);
eq("api mkt-canal no", apiPermitida("/api/mkt-canal", trade), false);
eq("api prefijo no engaña", apiPermitida("/api/chatx", trade), false);
eq("api sin grupos no", apiPermitida("/api/chat", []), false);

// tabla inexistente → legacy; otro error no
eq("PGRST205", esTablaInexistente({ code: "PGRST205", message: "x" }), true);
eq("42P01", esTablaInexistente({ code: "42P01", message: "x" }), true);
eq("404", esTablaInexistente({ code: "", message: "x" }, 404), true);
eq("permiso no es legacy", esTablaInexistente({ code: "42501", message: "permission denied" }, 403), false);
eq("sin error", esTablaInexistente(null), false);

// edición por área (0137)
const base = { activo: true, es_admin: false, es_editor: false, edita_marketing: false };
eq("admin edita marketing", puedeEditar({ ...base, es_admin: true }, "marketing"), true);
eq("admin edita trade", puedeEditar({ ...base, es_admin: true }, "trade"), true);
eq("edita marketing → marketing", puedeEditar({ ...base, edita_marketing: true }, "marketing"), true);
eq("edita marketing no toca trade", puedeEditar({ ...base, edita_marketing: true }, "trade"), false);
eq("editor CB → trade", puedeEditar({ ...base, es_editor: true }, "trade"), true);
eq("editor CB no toca marketing", puedeEditar({ ...base, es_editor: true }, "marketing"), false);
eq("solo ve", puedeEditar(base, "marketing") || puedeEditar(base, "trade"), false);
eq("inactivo admin no edita", puedeEditar({ ...base, activo: false, es_admin: true }, "marketing"), false);
eq("sin 0137 (columna ausente) = no marketing", puedeEditar({ activo: true, es_admin: false, es_editor: true }, "marketing"), false);
eq("sin perfil", puedeEditar(null, "trade"), false);
eq("área CB", areaDeDash("cuadros-basicos"), "trade");
eq("área FS", areaDeDash("floor-share"), "trade");
eq("área CB Ventas", areaDeDash("cb-ventas"), "trade");
eq("área web", areaDeDash("web"), "marketing");
eq("columna 42703", esColumnaInexistente({ code: "42703", message: "x" }), true);
eq("columna PGRST204", esColumnaInexistente({ code: "PGRST204", message: "x" }), true);
eq("otro error no es columna", esColumnaInexistente({ code: "42501", message: "permission denied" }), false);

// estado
eq("activo", estadoDe({ activo: true, cuenta: true }), "activo");
eq("sin cuenta", estadoDe({ activo: true, cuenta: false }), "sin_cuenta");
eq("desactivado", estadoDe({ activo: false, cuenta: true }), "desactivado");

// CSV
const csv = parseCsvUsuarios("email;nombre;rol;vendedor\nA@x.com;Ana;VENDEDOR;V12\nb@x.com;Beto;all;\nmalo;X;;\na@x.com;Ana;;\n\nc@x.com,Caro,vendedor,V3");
eq("csv filas", csv.filas, [
  { email: "a@x.com", nombre: "Ana", grupos: ["ventas"], vendedor: "V12" },
  { email: "b@x.com", nombre: "Beto", grupos: [], vendedor: null },
  { email: "c@x.com", nombre: "Caro", grupos: ["ventas"], vendedor: "V3" },
]);
eq("csv errores", csv.errores.length, 2);

if (fails) { console.error(`${fails} fallas`); process.exit(1); }
console.log("usuarios: OK");
