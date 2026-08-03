import { NextResponse } from "next/server";
import { falImage } from "@/lib/fal-client";

// Adapta una imagen de referencia a otro ratio/tamaño con outpainting generativo
// (Ideogram v3 Reframe en fal). Devuelve la URL de la imagen adaptada.
// El reframe extiende la imagen para llenar el nuevo lienzo sin deformar el foco.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { image_url, width, height } = (await request.json()) as { image_url?: string; width?: number; height?: number };
    if (!image_url) return NextResponse.json({ ok: false, error: "Falta la imagen de referencia." }, { status: 400 });
    if (!width || !height) return NextResponse.json({ ok: false, error: "Falta el tamaño destino." }, { status: 400 });
    const img = await falImage("fal-ai/ideogram/v3/reframe", {
      image_url,
      image_size: { width, height },
      rendering_speed: "QUALITY",
      num_images: 1,
    });
    const url = img.images[0]?.url;
    if (!url) return NextResponse.json({ ok: false, error: "El reframe no devolvió imagen." }, { status: 500 });
    // Devolvemos la imagen como data-URI (misma-origen) para que el cliente pueda
    // componerla en canvas sin "contaminar" el canvas (CORS) al hacer toBlob.
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return NextResponse.json({ ok: true, url }); // fallback: URL directa
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") ?? "image/png";
    return NextResponse.json({ ok: true, url: `data:${ct};base64,${buf.toString("base64")}` });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
