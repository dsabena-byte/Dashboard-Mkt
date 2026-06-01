import { NextResponse } from "next/server";

// Diagnóstico de acceso a Meta Ads API. Útil para confirmar si el System User
// Token + asignación de Ad Account ya está habilitado para hacer sync directo
// de paid creatives (sin pasar por Looker / OMD).
//
// Uso:
//   GET /api/diag/meta-ads-access
//
// Devuelve:
//   - permissions: scopes activos del token
//   - ad_accounts: cuentas de anuncios accesibles + status + business
//   - insights_test: para cada Ad Account, intenta traer spend/impressions
//     de los últimos 7 días. Si trae > 0 → tenés todo lo necesario.

const GRAPH = "https://graph.facebook.com/v22.0";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function gget(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

export async function GET() {
  try {
    const token = env("META_SYSTEM_USER_TOKEN");

    // 1. Permisos del token
    const permsRes = await gget(`${GRAPH}/me/permissions?access_token=${token}`);
    const perms = permsRes.body as { data?: Array<{ permission: string; status: string }> };
    const granted = (perms.data ?? [])
      .filter((p) => p.status === "granted")
      .map((p) => p.permission);

    // 2. Listar Ad Accounts accesibles
    const adAccRes = await gget(
      `${GRAPH}/me/adaccounts?fields=id,name,account_id,account_status,business{id,name},currency,timezone_name&limit=100&access_token=${token}`,
    );
    const adAccBody = adAccRes.body as {
      data?: Array<{
        id: string;
        name: string;
        account_id: string;
        account_status: number;
        currency?: string;
        timezone_name?: string;
        business?: { id: string; name: string };
      }>;
      error?: unknown;
    };

    if (adAccRes.status !== 200) {
      return NextResponse.json({
        ok: false,
        permissions: granted,
        ad_accounts_error: adAccBody.error ?? adAccBody,
      });
    }

    const adAccounts = adAccBody.data ?? [];

    // 3. Test de insights para cada Ad Account (últimos 7 días)
    const insightsTest: Array<Record<string, unknown>> = [];
    for (const acc of adAccounts) {
      const insRes = await gget(
        `${GRAPH}/${acc.id}/insights?fields=spend,impressions,clicks&date_preset=last_7d&access_token=${token}`,
      );
      const body = insRes.body as { data?: Array<Record<string, unknown>>; error?: unknown };
      insightsTest.push({
        ad_account_id: acc.id,
        name: acc.name,
        business: acc.business?.name,
        status: insRes.status,
        insights_sample: body.data?.[0] ?? null,
        error: body.error ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      permissions: granted,
      ad_accounts_count: adAccounts.length,
      ad_accounts: adAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        business: a.business?.name,
        status_code: a.account_status, // 1 = active, 2 = disabled, 3 = unsettled, etc.
        currency: a.currency,
      })),
      insights_test: insightsTest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
