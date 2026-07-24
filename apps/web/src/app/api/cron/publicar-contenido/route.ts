import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { getPageToken, publicarImagenIG, publicarReelIG, publicarImagenFB, publicarVideoFB } from "@/lib/meta-publish";

// Publica en IG/FB las piezas APROBADAS del calendario cuya fecha/hora ya llegó.
// Trigger: GitHub Actions (.github/workflows/publicar-contenido.yml).
// ?dry=1 → no publica, sólo lista las que publicaría.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TABLE = "contenido_calendario";

interface Row {
  id: string;
  fecha: string;
  hora: string | null;
  caption: string | null;
  hashtags: string[] | null;
  imagen_final_url: string | null;
  imagen_url: string | null;
  video_url: string | null;
  redes: string[] | null;
  publicado_ig_id: string | null;
  publicado_fb_id: string | null;
}

function caption(r: Row): string {
  const tags = (r.hashtags ?? []).join(" ");
  return [r.caption ?? "", tags].filter(Boolean).join("\n\n");
}

function vencida(r: Row, now: Date): boolean {
  const hoy = now.toISOString().slice(0, 10);
  if (r.fecha < hoy) return true;
  if (r.fecha > hoy) return false;
  if (!r.hora) return true; // mismo día, sin hora → publicar
  return r.hora.slice(0, 5) <= now.toISOString().slice(11, 16);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const out: Record<string, unknown> = {};
  try {
    const dry = new URL(request.url).searchParams.get("dry") === "1";
    const now = new Date();
    const hoy = now.toISOString().slice(0, 10);

    // Aprobadas, no publicadas todavía, con fecha <= hoy.
    const res = await sbAdmin(`${TABLE}?select=*&estado=eq.aprobado&fecha=lte.${hoy}`, { method: "GET" });
    if (!res.ok) return NextResponse.json({ ok: false, error: `read ${res.status}` }, { status: 500 });
    const all = (await res.json()) as Row[];
    const pend = all.filter((r) => vencida(r, now) && (r.redes ?? []).length > 0 && !r.publicado_ig_id && !r.publicado_fb_id);
    out.candidatas = pend.length;

    if (dry) {
      out.muestra = pend.map((r) => ({ id: r.id, fecha: r.fecha, redes: r.redes, tiene_imagen: !!(r.imagen_final_url || r.imagen_url), tiene_video: !!r.video_url }));
      return NextResponse.json({ ok: true, dry: true, ...out });
    }

    if (pend.length === 0) return NextResponse.json({ ok: true, publicadas: 0, ...out });

    const pageToken = await getPageToken();
    let publicadas = 0;
    const errores: Record<string, string> = {};

    for (const r of pend) {
      try {
        const cap = caption(r);
        const imagen = r.imagen_final_url ?? r.imagen_url;
        const esVideo = !imagen && !!r.video_url;
        const redes = r.redes ?? [];
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (redes.includes("instagram")) {
          patch.publicado_ig_id = esVideo && r.video_url
            ? await publicarReelIG(r.video_url, cap, pageToken)
            : await publicarImagenIG(imagen!, cap, pageToken);
        }
        if (redes.includes("facebook")) {
          patch.publicado_fb_id = esVideo && r.video_url
            ? await publicarVideoFB(r.video_url, cap, pageToken)
            : await publicarImagenFB(imagen!, cap, pageToken);
        }
        patch.estado = "publicado";
        patch.publicado_at = new Date().toISOString();
        patch.publish_error = null;
        await sbAdmin(`${TABLE}?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify(patch) });
        publicadas++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errores[r.id] = msg;
        await sbAdmin(`${TABLE}?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ publish_error: msg.slice(0, 500), updated_at: new Date().toISOString() }) });
      }
    }
    out.publicadas = publicadas;
    if (Object.keys(errores).length) out.errores = errores;
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
