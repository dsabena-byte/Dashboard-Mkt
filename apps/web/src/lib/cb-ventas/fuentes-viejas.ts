import "server-only";
import { createSign } from "node:crypto";

// Lectura de las fuentes de la app vieja (cuadros-basicos) para la migración, SIN dependencias nuevas:
//   Drive (cuenta de servicio, solo lectura): GOOGLE_SERVICE_ACCOUNT_JSON + DRIVE_CB_FOLDER_ID (carpeta "cuadro-basico-ventas").
//   Vercel Blob privado de la app vieja (claves cambiadas por los usuarios): CBV_OLD_BLOB_TOKEN.
// Mismo criterio de archivo que la app vieja: el CSV más reciente por fecha de modificación que matchee el nombre.

const DRIVE = "https://www.googleapis.com/drive/v3/files";

async function driveToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON");
  const sa = JSON.parse(raw) as { client_email: string; private_key: string; token_uri?: string };
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface ArchivoDrive { id: string; name: string; modifiedTime: string; bytes: Uint8Array }

/** Último CSV de la carpeta cuyo nombre matchee `patron` (o null). */
export async function ultimoCsvDrive(patron: RegExp): Promise<ArchivoDrive | null> {
  const folder = process.env.DRIVE_CB_FOLDER_ID;
  if (!folder) throw new Error("Falta DRIVE_CB_FOLDER_ID");
  const token = await driveToken();
  const auth = { authorization: `Bearer ${token}` };
  const files: { id: string; name: string; modifiedTime: string }[] = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed = false`, fields: "nextPageToken, files(id, name, modifiedTime)",
      pageSize: "200", supportsAllDrives: "true", includeItemsFromAllDrives: "true", ...(pageToken ? { pageToken } : {}),
    });
    const r = await fetch(`${DRIVE}?${q}`, { headers: auth });
    if (!r.ok) throw new Error(`Drive list ${r.status}`);
    const j = (await r.json()) as { files?: typeof files; nextPageToken?: string };
    files.push(...(j.files ?? []));
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  const f = files.filter((x) => patron.test(x.name) && /\.csv$/i.test(x.name)).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))[0];
  if (!f) return null;
  const d = await fetch(`${DRIVE}/${encodeURIComponent(f.id)}?alt=media&supportsAllDrives=true`, { headers: auth });
  if (!d.ok) throw new Error(`Drive download ${d.status}`);
  return { ...f, bytes: new Uint8Array(await d.arrayBuffer()) };
}

export const PATRON_CB = /^cuadros?[\s\-_]*basicos?/i;
export const PATRON_CLASIF = /^clasificacion[\s\-_]*clientes?/i;
export const PATRON_USUARIOS = /^usuarios?[\s\-_]*/i;

/**
 * Claves que los usuarios cambiaron en la app vieja (blob privado `users-password-overrides.json`:
 * { email: { hash bcrypt, updatedAt } }). REST de Vercel Blob (list + GET con el token). Sin token → null.
 * shortcut: REST de Blob sin el SDK @vercel/blob, no probado contra la API real; si falla, la ruta corta (fail closed).
 */
export async function overridesBlobViejo(): Promise<Record<string, { hash: string }> | null> {
  const token = process.env.CBV_OLD_BLOB_TOKEN;
  if (!token) return null;
  const auth = { authorization: `Bearer ${token}` };
  const l = await fetch(`https://blob.vercel-storage.com?prefix=${encodeURIComponent("users-password-overrides.json")}`, { headers: auth });
  if (!l.ok) throw new Error(`Blob list ${l.status}`);
  const blob = ((await l.json()) as { blobs?: { pathname: string; url: string }[] }).blobs?.find((x) => x.pathname === "users-password-overrides.json");
  if (!blob) return {};
  const g = await fetch(blob.url, { headers: auth });
  if (!g.ok) throw new Error(`Blob get ${g.status}`);
  return (await g.json()) as Record<string, { hash: string }>;
}
