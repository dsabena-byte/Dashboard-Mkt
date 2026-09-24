import { NextResponse } from "next/server";
import { canUseTableros, customSlug, deleteDashboard, listDashboards, renameDashboard, saveDashboardConfig, TablerosMissingError } from "@/lib/tableros-server";

// Mis tableros (motor v2 de BIP) — CRUD de tableros.
//   GET                                          → lista
//   POST { slug, config }                        → guarda la config (se sanea a v2)
//   POST { action: "create", title, datasetId? } → crea un tablero → { slug }
//   PATCH { slug, title }                        → renombra
//   DELETE { slug }                              → borra (las planillas no se borran)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

function errRes(e: unknown) {
  const status = e instanceof TablerosMissingError ? 503 : 500;
  return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status });
}
const denied = () => NextResponse.json({ error: "Tu usuario no tiene acceso a Mis tableros." }, { status: 403 });

export async function GET() {
  if (!(await canUseTableros())) return denied();
  try { return NextResponse.json({ dashboards: await listDashboards() }); } catch (e) { return errRes(e); }
}

export async function POST(req: Request) {
  if (!(await canUseTableros())) return denied();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "create") {
    const title = String(body.title ?? "").trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "Poné un nombre para el tablero." }, { status: 400 });
    const slug = customSlug(title);
    try {
      await saveDashboardConfig(slug, { v: 2, title, datasetId: typeof body.datasetId === "string" && body.datasetId ? body.datasetId : null, datasets: {}, widgets: [], filters: [] });
      return NextResponse.json({ ok: true, slug });
    } catch (e) { return errRes(e); }
  }

  const slug = String(body.slug ?? "").trim();
  const config = body.config as { widgets?: unknown } | undefined;
  if (!SLUG_RE.test(slug) || !config || !Array.isArray(config.widgets)) return NextResponse.json({ error: "config inválida" }, { status: 400 });
  if (JSON.stringify(config).length > 400_000) return NextResponse.json({ error: "El tablero es demasiado grande." }, { status: 413 });
  try { await saveDashboardConfig(slug, config); return NextResponse.json({ ok: true }); } catch (e) { return errRes(e); }
}

export async function PATCH(req: Request) {
  if (!(await canUseTableros())) return denied();
  const { slug, title } = (await req.json().catch(() => ({}))) as { slug?: string; title?: string };
  if (!slug || !SLUG_RE.test(slug) || !title?.trim()) return NextResponse.json({ error: "datos inválidos" }, { status: 400 });
  try { await renameDashboard(slug, title.trim().slice(0, 120)); return NextResponse.json({ ok: true }); } catch (e) { return errRes(e); }
}

export async function DELETE(req: Request) {
  if (!(await canUseTableros())) return denied();
  const { slug } = (await req.json().catch(() => ({}))) as { slug?: string };
  if (!slug || !SLUG_RE.test(slug)) return NextResponse.json({ error: "datos inválidos" }, { status: 400 });
  try { await deleteDashboard(slug); return NextResponse.json({ ok: true }); } catch (e) { return errRes(e); }
}
