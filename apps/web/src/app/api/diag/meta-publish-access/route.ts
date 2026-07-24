import { NextResponse } from "next/server";

// Diagnóstico de capacidad de PUBLICACIÓN en Meta (Fase 2 del calendario).
// Con el token que ya usamos para leer (META_SYSTEM_USER_TOKEN), verifica:
//  - qué permisos/scopes tiene el token (¿están pages_manage_posts /
//    instagram_content_publish?),
//  - si podemos obtener un Page access token de la Página de Drean,
//  - si la Página tiene vinculada la cuenta de Instagram Business.
// NO publica nada: sólo lee capacidades.

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v22.0";
const PAGE_ID = "257587170945975";        // Página FB Drean
const IG_ID = "17841404990509161";        // IG @dreanargentina

async function g(path: string, token: string): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { http_status: res.status, body: text.slice(0, 800) };
  }
}

export async function GET() {
  const out: Record<string, unknown> = {};
  try {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!token) return NextResponse.json({ ok: false, error: "META_SYSTEM_USER_TOKEN no configurada." }, { status: 500 });

    // 1) Permisos del token (system user).
    out.debug_token = await g(`/debug_token?input_token=${encodeURIComponent(token)}`, token);
    out.me_permissions = await g(`/me/permissions`, token);

    // 2) Página: nombre, tasks (¿podemos gestionar?), page token, IG vinculado.
    out.page = await g(`/${PAGE_ID}?fields=name,tasks,access_token,instagram_business_account`, token);

    // 3) Cuenta de IG: tipo/username (confirma que es Business y accesible).
    out.instagram = await g(`/${IG_ID}?fields=username,name,profile_picture_url`, token);

    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), ...out }, { status: 500 });
  }
}
