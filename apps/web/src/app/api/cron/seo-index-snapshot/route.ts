import { NextResponse } from "next/server";

// Snapshot MENSUAL del índice de posición conglomerado por marca × categoría.
// Lee seo_rankings, calcula el índice con la MISMA fórmula que el dashboard
// (Σ(volumen × posición) / Σ(volumen), no rankea = 100, filtrando basura) y lo
// upsertea en seo_index_history para el mes actual. Corre después del seo-sync.

export const maxDuration = 60;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (init?.method && init.method !== "GET") return {} as T;
  return res.json() as Promise<T>;
}

const CATS = ["lavarropas", "heladeras", "cocinas"];
const ABSENT = 100;
// Misma limpieza que el componente: saca filas "Total:" y keywords muy cortas.
const esValida = (kw: string) => !!kw && !/^total\b/i.test(kw.trim()) && kw.trim().length > 2;

interface Row { marca: string; keyword: string; categoria: string | null; posicion: number | null; search_volume: number | null; }

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows: Row[] = [];
    for (let off = 0; off < 50000; off += 1000) {
      const chunk = await sb<Row[]>(`seo_rankings?select=marca,keyword,categoria,posicion,search_volume&limit=1000&offset=${off}`);
      rows.push(...chunk);
      if (chunk.length < 1000) break;
    }

    const now = new Date();
    const mes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const out: Array<{ categoria: string; marca: string; mes: string; indice: number }> = [];
    for (const cat of CATS) {
      const crows = rows.filter((r) => r.categoria === cat && esValida(r.keyword));
      const uni = new Map<string, number>();
      for (const r of crows) if (!uni.has(r.keyword)) uni.set(r.keyword, r.search_volume ?? 0);
      const total = [...uni.values()].reduce((s, v) => s + v, 0) || 1;
      const pos = new Map<string, number>();
      const marcas = new Set<string>();
      for (const r of crows) {
        marcas.add(r.marca);
        if (r.posicion != null) pos.set(`${r.marca}|${r.keyword}`, r.posicion);
      }
      for (const m of marcas) {
        let num = 0;
        for (const [kw, vol] of uni) num += vol * (pos.get(`${m}|${kw}`) ?? ABSENT);
        out.push({ categoria: cat, marca: m, mes, indice: Math.round((num / total) * 100) / 100 });
      }
    }

    if (out.length) {
      await sb("seo_index_history?on_conflict=categoria,marca,mes", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(out),
      });
    }
    return NextResponse.json({ ok: true, mes, filas: out.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
