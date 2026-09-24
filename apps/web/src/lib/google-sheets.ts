import "server-only";

// Lectura de Google Sheets para "Mis tableros" con el OAuth de Google que YA usa Drean
// (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN, el del cron de GA4).
// Ese token se generó con scope analytics.readonly (y adwords): si no incluye un scope de
// Sheets/Drive, getSheetsAccess() devuelve "no_scope" y la UI ofrece solo la subida de archivo.
// Para habilitarlo: regenerar el refresh token sumando spreadsheets.readonly (ver CLAUDE.md).

export const SHEET_MAX_ROWS = 20_000;
const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive",
];

export type SheetsAccess = { state: "ok"; token: string } | { state: "no_env" | "no_scope" | "error"; detail?: string };

export async function getSheetsAccess(): Promise<SheetsAccess> {
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET, refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return { state: "no_env" };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
      cache: "no-store",
    });
    if (!res.ok) return { state: "error", detail: `OAuth ${res.status}` };
    const tok = (await res.json()) as { access_token?: string; scope?: string };
    if (!tok.access_token) return { state: "error", detail: "sin access_token" };
    let scope = tok.scope ?? "";
    if (!scope) {
      const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(tok.access_token)}`, { cache: "no-store" });
      if (info.ok) scope = ((await info.json()) as { scope?: string }).scope ?? "";
    }
    const granted = scope.split(/\s+/);
    if (!SHEETS_SCOPES.some((s) => granted.includes(s))) return { state: "no_scope" };
    return { state: "ok", token: tok.access_token };
  } catch (e) {
    return { state: "error", detail: (e as Error).message.slice(0, 120) };
  }
}

/** Extrae el spreadsheetId de un link de Google Sheets (o acepta el id pelado). */
export function spreadsheetIdFrom(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m) return m[1]!;
  return /^[a-zA-Z0-9-_]{20,}$/.test(s) ? s : null;
}

/** Primera hoja completa: fila 1 = columnas, resto = filas. */
export async function readGoogleSheet(token: string, spreadsheetId: string): Promise<{ title: string; columns: string[]; rows: unknown[][] }> {
  const h = { Authorization: `Bearer ${token}` };
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`, { headers: h, cache: "no-store" });
  if (!metaRes.ok) throw new Error(metaRes.status === 403 || metaRes.status === 404 ? "la cuenta Google del dashboard no tiene acceso a esa planilla (compartila con esa cuenta)" : `Sheets ${metaRes.status}`);
  const meta = (await metaRes.json()) as { properties?: { title?: string }; sheets?: { properties?: { title?: string } }[] };
  const first = meta.sheets?.[0]?.properties?.title;
  if (!first) throw new Error("la planilla no tiene hojas");
  const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(first)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`, { headers: h, cache: "no-store" });
  if (!valRes.ok) throw new Error(`Sheets values ${valRes.status}`);
  const aoa = ((await valRes.json()) as { values?: unknown[][] }).values ?? [];
  return { title: meta.properties?.title ?? "Google Sheet", columns: (aoa[0] ?? []).map((c) => String(c ?? "")), rows: aoa.slice(1, 1 + SHEET_MAX_ROWS) };
}
