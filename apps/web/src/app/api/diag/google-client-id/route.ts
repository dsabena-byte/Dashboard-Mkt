import { NextResponse } from "next/server";

// Diagnóstico: muestra el GOOGLE_CLIENT_ID que el dashboard usa en producción,
// para verificarlo contra el que hay que pasarle a OMD (form de Basic Access de
// Google Ads). El Client ID NO es secreto (aparece en los flujos de OAuth), por
// eso es seguro exponerlo. NUNCA se expone el client secret ni el refresh token.

export const dynamic = "force-dynamic";

export async function GET() {
  const cid = process.env.GOOGLE_CLIENT_ID ?? null;
  return NextResponse.json({
    google_client_id: cid,
    project_number: cid ? cid.split("-")[0] : null,
    configurado: !!cid,
  });
}
