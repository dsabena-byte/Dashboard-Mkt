import { NextResponse } from "next/server";

// Sincroniza la pauta planificada desde un folder de Google Drive a la tabla
// planning_media de Supabase. Sustituye al workflow N8N
// `drive-planning-media-sync.json`.
//
// Formato nuevo (a partir de Junio 2026): un archivo por mes, todas las
// categorías adentro. Filename `Mes-Pauta.csv`, con columna `Campaña`.
//
// Formato legacy (Abril/Mayo): un archivo por (mes,categoría). Filename
// `Mes-Categoria.csv` (ej. `Mayo-Brand.csv`). Se sigue soportando por si
// quedan archivos viejos en el folder — la data vieja ya está en Supabase y
// el upsert con `merge-duplicates` no la pisa con ceros.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FOLDER_ID = process.env.PLANNING_DRIVE_FOLDER_ID ?? "1xjV1yy11Mjoz89uCTjNc53l1iNZxgHbp";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Row = {
  fecha: string;
  campania: string;
  rol: string | null;
  touchpoint: string | null;
  sistema: string | null;
  formato: string | null;
  inversion: number;
  tipo: "media" | "costo";
};

async function getDriveAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth refresh failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function listFolderCsvs(token: string, folderId: string) {
  const q = `'${folderId}' in parents and trashed = false and (mimeType = 'text/csv' or name contains '.csv')`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,modifiedTime)",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { files: { id: string; name: string }[] };
  return data.files;
}

async function downloadFile(token: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download ${fileId} failed: ${res.status}`);
  return await res.text();
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseCurrency(v: string): number | null {
  if (!v) return null;
  const s = v.trim();
  if (!s || s === "-" || /^\$?\s*-+\s*$/.test(s)) return 0;
  const cleaned = s.replace(/[\s$]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeCategoria(raw: string): string {
  const s = (raw || "").replace(/[-_]/g, " ").trim();
  const lower = s.toLowerCase();
  if (!lower) return "";
  if (lower.startsWith("cocina")) return "Cocina";
  if (lower.startsWith("refriger")) return "Refrigeración";
  if (lower.startsWith("lavado")) return "Lavado";
  if (lower.startsWith("brand")) return "Brand";
  if (lower.startsWith("promo")) return "Promoción";
  if (lower.startsWith("ugc")) return "UGC";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const COSTO_PATTERNS = [/iibb/i, /percep/i, /cheque/i, /impuesto/i, /tech\s*fee/i, /comisi/i];
const SKIP_PATTERNS = [/^Total\s/i, /^Total$/i, /^Subtotal/i, /Vs\s*Forecast/i, /^Forecast$/i, /^Dif$/i, /Diferencia/i];

function esCosto(formato: string): boolean {
  return !!formato && COSTO_PATTERNS.some((re) => re.test(formato));
}

function esSkip(sistema: string, formato: string, rol: string): boolean {
  const txt = [rol, sistema, formato].filter(Boolean).join(" ");
  if (SKIP_PATTERNS.some((re) => re.test(txt))) return true;
  const isDash = (v: string) => !v || /^\$?\s*-+\s*$/.test(v);
  if (isDash(sistema) && isDash(formato)) return true;
  return false;
}

function parseCsv(filename: string, csvText: string, year: number): Row[] {
  const m = filename.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ]+)[-_\s]+(.+?)\.csv$/i);
  if (!m) return [];
  const mesRaw = m[1]!.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const mesNum = MONTHS[mesRaw];
  if (!mesNum) return [];
  const fecha = `${year}-${String(mesNum).padStart(2, "0")}-01`;
  const mesCap = MONTH_NAMES[mesNum - 1]!;
  const suffix = m[2]!.trim();
  const legacyCategoria = /^pauta$/i.test(suffix) ? null : normalizeCategoria(suffix);

  const lines = csvText.split(/\r?\n/);

  let headerIdx = -1;
  let headers: string[] = [];
  for (let r = 0; r < Math.min(lines.length, 30); r++) {
    const cells = parseCsvLine(lines[r] ?? "");
    const hasFmt = cells.some((c) => /Formato/i.test(c));
    const hasSis = cells.some((c) => /^Sistema$/i.test(c) || /^Plataforma$/i.test(c) || /^Platform$/i.test(c));
    const hasRol = cells.some((c) => /Rol\s*Of\s*Comms/i.test(c) || /^Rol$/i.test(c));
    const hasCamp = cells.some((c) => /^Campa[ñn]a$/i.test(c) || /^Categor[íi]a$/i.test(c));
    const minCols = hasFmt && (hasSis || hasRol);
    if (minCols && (hasCamp || legacyCategoria)) {
      headerIdx = r;
      headers = cells;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const findCol = (...names: string[]): number => {
    for (const n of names) {
      const k = headers.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (k >= 0) return k;
    }
    return -1;
  };

  const iCamp = findCol("Campaña", "Campana", "Campania", "Categoría", "Categoria");
  const iRol = findCol("Rol Of Comms", "Rol", "Rol of Comms");
  const iTouch = findCol("TouchPoint", "Touchpoint", "Touch Point");
  const iSis = findCol("Sistema", "Plataforma", "Platform");
  const iFmt = findCol("Formato & Channel", "Formato", "Formato y Channel", "Format");
  const iInvMes = findCol(mesCap, mesRaw, mesCap.toUpperCase());
  const iInvGen = findCol("Inversion", "Inversión", "Inv", "Invertido", "Total");

  if (iInvMes < 0 && iInvGen < 0) return [];

  const rows: Row[] = [];
  for (let r = headerIdx + 1; r < lines.length; r++) {
    const line = lines[r];
    if (!line || !line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length === 0) continue;

    const campRaw = iCamp >= 0 ? cols[iCamp] ?? "" : "";
    const campania = normalizeCategoria(campRaw) || legacyCategoria || "";
    if (!campania) continue;

    const rol = iRol >= 0 ? cols[iRol] ?? "" : "";
    const touch = iTouch >= 0 ? cols[iTouch] ?? "" : "";
    const sistema = iSis >= 0 ? cols[iSis] ?? "" : "";
    const formato = iFmt >= 0 ? cols[iFmt] ?? "" : "";
    const invStr = iInvMes >= 0 ? cols[iInvMes] ?? "" : iInvGen >= 0 ? cols[iInvGen] ?? "" : "";

    if (esSkip(sistema, formato, rol)) continue;
    if (!sistema && !formato) continue;

    const inversion = parseCurrency(invStr);
    if (inversion === null || inversion === 0) continue;

    rows.push({
      fecha,
      campania,
      rol: rol || null,
      touchpoint: touch || null,
      sistema: sistema || null,
      formato: formato || null,
      inversion,
      tipo: esCosto(formato) ? "costo" : "media",
    });
  }
  return rows;
}

function dedupe(rows: Row[]): Row[] {
  const agg = new Map<string, Row>();
  for (const r of rows) {
    const key = [r.fecha, r.campania, r.rol ?? "", r.sistema ?? "", r.formato ?? "", r.tipo].join("|");
    const prev = agg.get(key);
    if (prev) {
      prev.inversion += r.inversion;
      if (r.touchpoint && prev.touchpoint && !prev.touchpoint.includes(r.touchpoint)) {
        prev.touchpoint = `${prev.touchpoint} / ${r.touchpoint}`;
      } else if (r.touchpoint && !prev.touchpoint) {
        prev.touchpoint = r.touchpoint;
      }
    } else {
      agg.set(key, { ...r });
    }
  }
  return Array.from(agg.values());
}

async function upsertRows(rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const url = `${env("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/planning_media?on_conflict=fecha,campania,rol,sistema,formato,tipo`;
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase upsert ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") ?? process.env.PLANNING_YEAR ?? new Date().getUTCFullYear());

  try {
    const token = await getDriveAccessToken();
    const files = await listFolderCsvs(token, FOLDER_ID);
    const summaries: { name: string; rows: number }[] = [];
    let allRows: Row[] = [];
    for (const f of files) {
      const csv = await downloadFile(token, f.id);
      const parsed = parseCsv(f.name, csv, year);
      summaries.push({ name: f.name, rows: parsed.length });
      allRows = allRows.concat(parsed);
    }
    const deduped = dedupe(allRows);
    await upsertRows(deduped);
    return NextResponse.json({
      ok: true,
      folder: FOLDER_ID,
      year,
      files: summaries,
      total_rows_parsed: allRows.length,
      total_rows_upserted: deduped.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
