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

// Nunca prerenderear en build: llama a Graph API en runtime.
export const dynamic = "force-dynamic";

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

    // 2. Info del System User (id, name)
    const meRes = await gget(`${GRAPH}/me?fields=id,name&access_token=${token}`);
    const me = meRes.body as { id?: string; name?: string; error?: unknown };

    // 3. Businesses a los que pertenece este System User (varios endpoints)
    const [meBizRes, ownedRes, clientRes] = await Promise.all([
      gget(`${GRAPH}/me/businesses?fields=id,name,verification_status&limit=50&access_token=${token}`),
      gget(`${GRAPH}/me/owned_businesses?fields=id,name&limit=50&access_token=${token}`),
      gget(`${GRAPH}/me/client_businesses?fields=id,name&limit=50&access_token=${token}`),
    ]);
    const bizBody = meBizRes.body as {
      data?: Array<{ id: string; name: string; verification_status?: string }>;
      error?: unknown;
    };
    const ownedBody = ownedRes.body as { data?: Array<{ id: string; name: string }>; error?: unknown };
    const clientBody = clientRes.body as { data?: Array<{ id: string; name: string }>; error?: unknown };
    const businesses = bizBody.data ?? [];

    // 3b. Acceso directo al BM esperado (122350585916257 = Alladio - Negocio Drean)
    const EXPECTED_BM = "122350585916257";
    const bmDirectRes = await gget(
      `${GRAPH}/${EXPECTED_BM}?fields=id,name,verification_status&access_token=${token}`,
    );
    const bmDirect = bmDirectRes.body as Record<string, unknown>;

    // 3c. Intentar listar ad accounts directamente del BM esperado
    const bmClientAccRes = await gget(
      `${GRAPH}/${EXPECTED_BM}/client_ad_accounts?fields=id,name,account_id,account_status,business{id,name}&limit=100&access_token=${token}`,
    );
    const bmOwnedAccRes = await gget(
      `${GRAPH}/${EXPECTED_BM}/owned_ad_accounts?fields=id,name,account_id,account_status&limit=100&access_token=${token}`,
    );

    // 4. Ad Accounts CLIENTES (compartidas por terceros como OMD vía BM)
    // El endpoint /me/adaccounts trae solo las owned por businesses del user.
    // Para ver las shared, hay que pedir /BMID/client_ad_accounts.
    const clientAdAccountsByBiz: Array<Record<string, unknown>> = [];
    for (const biz of businesses) {
      const cliRes = await gget(
        `${GRAPH}/${biz.id}/client_ad_accounts?fields=id,name,account_id,account_status,business{id,name},currency&limit=100&access_token=${token}`,
      );
      const cliBody = cliRes.body as {
        data?: Array<Record<string, unknown>>;
        error?: unknown;
      };
      clientAdAccountsByBiz.push({
        business_id: biz.id,
        business_name: biz.name,
        status: cliRes.status,
        count: cliBody.data?.length ?? 0,
        accounts: cliBody.data ?? [],
        error: cliBody.error ?? null,
      });
    }

    // 5. Ad Accounts OWNED (las del user directamente — fallback)
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

    const adAccounts = adAccBody.data ?? [];

    // 6. Test de insights para cada Ad Account owned + shared (últimos 7 días)
    const allTestableAccounts: Array<{ id: string; name: string; source: string }> = [
      ...adAccounts.map((a) => ({ id: a.id, name: a.name, source: "owned" })),
      ...clientAdAccountsByBiz.flatMap((b) =>
        ((b.accounts as Array<{ id: string; name: string }>) ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          source: `shared:${b.business_name}`,
        })),
      ),
    ];
    const insightsTest: Array<Record<string, unknown>> = [];
    for (const acc of allTestableAccounts) {
      const insRes = await gget(
        `${GRAPH}/${acc.id}/insights?fields=spend,impressions,clicks&date_preset=last_7d&access_token=${token}`,
      );
      const body = insRes.body as { data?: Array<Record<string, unknown>>; error?: unknown };
      insightsTest.push({
        ad_account_id: acc.id,
        name: acc.name,
        source: acc.source,
        status: insRes.status,
        insights_sample: body.data?.[0] ?? null,
        error: body.error ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      system_user: { id: me.id, name: me.name },
      permissions: granted,
      businesses_via_me: {
        me_businesses: { count: businesses.length, data: businesses, error: bizBody.error ?? null },
        owned_businesses: { count: ownedBody.data?.length ?? 0, data: ownedBody.data ?? [], error: ownedBody.error ?? null },
        client_businesses: { count: clientBody.data?.length ?? 0, data: clientBody.data ?? [], error: clientBody.error ?? null },
      },
      expected_bm_check: {
        bm_id: EXPECTED_BM,
        bm_info: bmDirect,
        client_ad_accounts: bmClientAccRes.body,
        owned_ad_accounts: bmOwnedAccRes.body,
      },
      ad_accounts_owned_count: adAccounts.length,
      ad_accounts_owned: adAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        business: a.business?.name,
        status_code: a.account_status,
        currency: a.currency,
      })),
      ad_accounts_shared_by_business: clientAdAccountsByBiz,
      insights_test: insightsTest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
