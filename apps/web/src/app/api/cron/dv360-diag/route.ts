import { NextResponse } from "next/server";

// Diagnóstico de acceso a la Display & Video 360 API (SOLO LECTURA, no escribe nada).
// Objetivo: saber si el token de Google (GOOGLE_REFRESH_TOKEN) tiene el scope `display-video` y si la cuenta
// ve el anunciante de Drean, y ver qué trae cada creative (¿hay URL de imagen / youtubeVideoId?) antes de
// armar la sincronización de miniaturas. Los números de DV360 siguen llegando por el mail de OMD.
//
// GET /api/cron/dv360-diag            → scopes del token + partners/anunciantes visibles
// GET /api/cron/dv360-diag?adv=<id>   → además, muestra de creatives de ese anunciante
// Protegido con CRON_SECRET (workflow dv360-diag.yml).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API = "https://displayvideo.googleapis.com/v4";

async function accessToken(): Promise<{ token: string; scopes: string[] }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OAuth refresh ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; scope?: string };
  return { token: data.access_token, scopes: (data.scope ?? "").split(" ").filter(Boolean) };
}

async function dv(token: string, path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const text = await res.text();
  let body: unknown = text.slice(0, 1500);
  try { body = JSON.parse(text); } catch { /* texto */ }
  return { status: res.status, body };
}

type Adv = { advertiserId?: string; displayName?: string; partnerId?: string };
type Creative = {
  creativeId?: string; displayName?: string; creativeType?: string; hostingSource?: string; entityStatus?: string;
  dimensions?: { widthPixels?: number; heightPixels?: number }; youtubeVideoId?: string; thirdPartyUrl?: string;
  assets?: { asset?: { mediaId?: string; content?: string }; role?: string }[];
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const out: Record<string, unknown> = {};
  try {
    const { token, scopes } = await accessToken();
    out.auth = "OK";
    out.scopes = scopes.map((s) => s.replace("https://www.googleapis.com/auth/", ""));
    out.tieneScopeDv360 = scopes.some((s) => s.endsWith("/display-video"));
    if (!out.tieneScopeDv360) return NextResponse.json({ ...out, estado: "no_scope" });

    const partners = await dv(token, "/partners?pageSize=50");
    out.partnersStatus = partners.status;
    if (partners.status !== 200) return NextResponse.json({ ...out, estado: partners.status === 403 ? "api_disabled_o_sin_acceso" : "error", partners: partners.body });
    const ps = ((partners.body as { partners?: { partnerId?: string; displayName?: string }[] }).partners ?? []);
    out.partners = ps.map((p) => ({ id: p.partnerId, nombre: p.displayName }));

    const advs: Adv[] = [];
    for (const p of ps.slice(0, 10)) {
      const r = await dv(token, `/advertisers?partnerId=${p.partnerId}&pageSize=200`);
      if (r.status === 200) advs.push(...(((r.body as { advertisers?: Adv[] }).advertisers) ?? []));
      else out[`advertisers_${p.partnerId}`] = { status: r.status, body: r.body };
    }
    out.anunciantes = advs.map((a) => ({ id: a.advertiserId, nombre: a.displayName, partner: a.partnerId }));
    out.estado = advs.length ? "ok" : "sin_anunciantes";

    const url = new URL(request.url);
    const advId = url.searchParams.get("adv") || advs.find((a) => /drean/i.test(a.displayName ?? ""))?.advertiserId;
    if (advId) {
      const r = await dv(token, `/advertisers/${advId}/creatives?pageSize=30&orderBy=creativeId%20desc`);
      out.creativesStatus = r.status;
      const cs = ((r.body as { creatives?: Creative[] }).creatives ?? []);
      out.creativesMuestra = cs.map((c) => ({
        id: c.creativeId, nombre: c.displayName, tipo: c.creativeType, hosting: c.hostingSource, estado: c.entityStatus,
        tam: c.dimensions ? `${c.dimensions.widthPixels}x${c.dimensions.heightPixels}` : null,
        youtube: c.youtubeVideoId ?? null, thirdParty: c.thirdPartyUrl ? "sí" : null,
        assets: (c.assets ?? []).map((a) => ({ rol: a.role, content: a.asset?.content?.slice(0, 200) ?? null, mediaId: a.asset?.mediaId ?? null })),
      }));
      if (r.status !== 200) out.creativesError = r.body;
    }
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
