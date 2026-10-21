// npx tsx scripts/indec-ipc.test.ts
import { parseIpcIndec } from "../src/lib/indec-ipc";
let f = 0;
const ok = (c: boolean, m: string) => { if (!c) { f++; console.error("✗", m); } else console.log("✓", m); };
const csv = `﻿Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region
0;NIVEL GENERAL;Nivel general y divisiones COICOP;202312;3533,19;25,5;211,4;Nacional
0;NIVEL GENERAL;Nivel general y divisiones COICOP;202601;10413,0309;2,9;32,4;Nacional
0;NIVEL GENERAL;Nivel general y divisiones COICOP;202601;10000;3,1;30;GBA
01;Alimentos;Nivel general y divisiones COICOP;202601;10000;4,0;30;Nacional
0;NIVEL GENERAL;Nivel general y divisiones COICOP;202609;12514,1508;1,93;33,4;Nacional
0;NIVEL GENERAL;Nivel general y divisiones COICOP;202610;12600;NA;NA;Nacional
`;
const r = parseIpcIndec(csv);
ok(r.length === 2, "solo nivel general nacional, desde 2024, sin NA");
ok(r[0]!.anio === 2026 && r[0]!.mes === 1 && r[0]!.pct === 2.9, "enero 2026 = 2,9");
ok(r[1]!.pct === 1.9, "redondeo a 1 decimal");
let tiro = false; try { parseIpcIndec("a;b\n1;2"); } catch { tiro = true; }
ok(tiro, "columnas inesperadas → error (no escribe basura)");
if (f) process.exit(1);
console.log("OK");
