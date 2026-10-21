// Parser PURO del CSV oficial de INDEC (serie_ipc_divisiones.csv): variación mensual % del IPC NIVEL GENERAL
// Nacional. Lo usa el cron inflacion-indec para cargar la inflación REAL. Test: scripts/indec-ipc.test.ts.
export const INDEC_IPC_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv";

export function parseIpcIndec(csv: string, desdeAnio = 2024): { anio: number; mes: number; pct: number }[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
  const cols = (lines[0] ?? "").split(";").map((c) => c.trim().toLowerCase());
  const i = (n: string) => cols.indexOf(n);
  const [iCod, iPer, iVm, iReg] = [i("codigo"), i("periodo"), i("v_m_ipc"), i("region")];
  if ([iCod, iPer, iVm, iReg].some((x) => x < 0)) throw new Error(`CSV de INDEC con columnas inesperadas: ${lines[0]?.slice(0, 120)}`);
  const out = new Map<string, { anio: number; mes: number; pct: number }>();
  for (const l of lines.slice(1)) {
    const c = l.split(";");
    if (c[iCod]?.trim() !== "0" || c[iReg]?.trim() !== "Nacional") continue;
    const per = c[iPer]?.trim() ?? "";
    const pct = Number((c[iVm] ?? "").trim().replace(",", "."));
    if (!/^\d{6}$/.test(per) || !Number.isFinite(pct) || (c[iVm] ?? "").trim() === "") continue;
    const anio = Number(per.slice(0, 4)), mes = Number(per.slice(4));
    if (anio >= desdeAnio && mes >= 1 && mes <= 12) out.set(per, { anio, mes, pct: Math.round(pct * 10) / 10 });
  }
  return [...out.values()].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
}
