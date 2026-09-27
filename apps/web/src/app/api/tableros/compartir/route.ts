import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { canUseTableros, getDashboardConfig, TablerosMissingError } from "@/lib/tableros-server";
import { emailEnabled } from "@/lib/notify";
import { clampDias, cleanDest } from "@/lib/tablero-share";
import { allowedDomains, createLink, getShareState, linkUrl, revokeLink, saveShareState, shareSecret, validRecipients } from "@/lib/tablero-share-server";

// Links de SOLO LECTURA de un tablero de Mis tableros + envío programado por mail (portado de BIP).
//   GET ?slug=                                   → { link: { url, exp } | null, envio, dominios, ... }
//   POST { slug, action: "link", dias }          → crea/rota el link (los anteriores dejan de andar)
//   POST { slug, action: "envio", frecuencia, destinatarios } → programa el envío (lunes / día 1)
//   DELETE { slug, what: "link" | "envio" }      → revoca el link / desactiva el envío
// Acceso: quien puede usar Mis tableros (dashboard_access). Destinatarios: solo dominios conocidos.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const denied = () => NextResponse.json({ error: "Tu usuario no tiene acceso a Mis tableros." }, { status: 403 });

async function userEmail(): Promise<string | null> {
  try { return (await getServerSupabase().auth.getUser()).data.user?.email ?? null; } catch { return null; }
}
async function tableroOk(slug: string): Promise<boolean> {
  if (!SLUG_RE.test(slug)) return false;
  const cfg = await getDashboardConfig(slug).catch(() => null);
  return Boolean(cfg && cfg.widgets.length);
}
function errRes(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: e instanceof TablerosMissingError ? 503 : 500 });
}

export async function GET(req: Request) {
  if (!(await canUseTableros())) return denied();
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "tablero inválido" }, { status: 400 });
  const st = await getShareState();
  const l = st.links[slug];
  return NextResponse.json({
    link: l && l.exp * 1000 > Date.now() ? { url: linkUrl(slug, st), exp: l.exp } : null,
    envio: st.envios[slug] ?? null,
    dominios: await allowedDomains(await userEmail()),
    emailReady: emailEnabled(),
    enabled: Boolean(shareSecret()),
  });
}

export async function POST(req: Request) {
  if (!(await canUseTableros())) return denied();
  const body = (await req.json().catch(() => ({}))) as { slug?: string; action?: string; dias?: number; frecuencia?: string; destinatarios?: unknown };
  const slug = String(body.slug ?? "");
  if (!(await tableroOk(slug))) return NextResponse.json({ error: "Ese tablero no existe o todavía no tiene gráficos (guardalo primero)." }, { status: 400 });
  try {
    if (body.action === "link") {
      if (!shareSecret()) return NextResponse.json({ error: "Los links compartidos no están habilitados en este entorno." }, { status: 503 });
      return NextResponse.json({ ok: true, link: await createLink(slug, clampDias(body.dias)) });
    }
    if (body.action === "envio") {
      const frecuencia = body.frecuencia === "mensual" ? "mensual" : body.frecuencia === "semanal" ? "semanal" : null;
      if (!frecuencia) return NextResponse.json({ error: "Elegí semanal o mensual." }, { status: 400 });
      const email = await userEmail();
      const { ok, rejected } = await validRecipients(cleanDest(body.destinatarios), email);
      if (!ok.length) return NextResponse.json({ error: rejected.length ? `Solo se puede enviar a casillas de los dominios del equipo (rechazados: ${rejected.join(", ")}).` : "Sumá al menos un email." }, { status: 400 });
      const st = await getShareState();
      st.envios[slug] = { frecuencia, destinatarios: ok, ultimo: st.envios[slug]?.ultimo ?? null, por: email };
      await saveShareState(st);
      return NextResponse.json({ ok: true, envio: st.envios[slug], rejected });
    }
    return NextResponse.json({ error: "acción inválida" }, { status: 400 });
  } catch (e) { return errRes(e); }
}

export async function DELETE(req: Request) {
  if (!(await canUseTableros())) return denied();
  const { slug, what } = (await req.json().catch(() => ({}))) as { slug?: string; what?: string };
  if (!slug || !SLUG_RE.test(slug)) return NextResponse.json({ error: "tablero inválido" }, { status: 400 });
  try {
    if (what === "envio") {
      const st = await getShareState();
      delete st.envios[slug];
      await saveShareState(st);
    } else await revokeLink(slug);
    return NextResponse.json({ ok: true });
  } catch (e) { return errRes(e); }
}
