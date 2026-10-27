import "server-only";

// Token de Google para las APIs de DV360. Prueba DV360_REFRESH_TOKEN (token propio de DV360, opcional) y después
// GOOGLE_REFRESH_TOKEN (el de GA4/Ads/Search Console); se queda con el PRIMERO que tenga el scope pedido. Así un
// DV360_REFRESH_TOKEN con solo `doubleclickbidmanager` no rompe las miniaturas (que piden `display-video`).

export class OauthError extends Error {}

export type Dv360Token = { token: string; scopes: string[]; fuente: "DV360_REFRESH_TOKEN" | "GOOGLE_REFRESH_TOKEN"; tieneScope: boolean };

async function refresh(refreshToken: string): Promise<{ token: string; scopes: string[] }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new OauthError(`OAuth refresh ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; scope?: string };
  return { token: data.access_token, scopes: (data.scope ?? "").split(" ").filter(Boolean) };
}

/** `scopeSuffix` = final del scope requerido (ej. "/doubleclickbidmanager", "/display-video"). */
export async function dv360AccessToken(scopeSuffix: string): Promise<Dv360Token> {
  const fuentes = (["DV360_REFRESH_TOKEN", "GOOGLE_REFRESH_TOKEN"] as const).filter((k) => process.env[k]);
  if (!fuentes.length) throw new OauthError("Falta GOOGLE_REFRESH_TOKEN (o DV360_REFRESH_TOKEN)");
  let ultimo: Dv360Token | null = null, err: unknown = null;
  for (const fuente of fuentes) {
    try {
      const t = await refresh(process.env[fuente]!);
      ultimo = { ...t, fuente, tieneScope: t.scopes.some((s) => s.endsWith(scopeSuffix)) };
      if (ultimo.tieneScope) return ultimo;
    } catch (e) { err = e; }
  }
  if (ultimo) return ultimo;
  throw err instanceof Error ? err : new OauthError(String(err));
}
