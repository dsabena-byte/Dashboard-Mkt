import "server-only";
import { getServerSupabase } from "./supabase-server";
import { getFloorShareRows, getAvailableWeeks, type FloorShareRow } from "./floor-share-queries";

// ============================================================================
// Salud de Marca — posicionamiento competitivo por categoría.
// Indicadores con data comparativa Drean vs competencia:
//   - Mercado (GFK): value share e índice de precio por segmento (High/Mid/Low),
//     serie mensual, último mes. SIN total (se muestran los segmentos definidos).
//   - Floor share (góndola): share de unidades por marca, total categoría,
//     últimas semanas (valor único, sin segmento).
// ============================================================================

export type Seg = "High" | "Mid" | "Low";

export interface PosBrand {
  marca: string;
  // value share e índice de precio por segmento
  vs: Record<Seg, number | null>;
  ip: Record<Seg, number | null>;
  floor: number | null; // floor share % (total categoría, valor único)
}

export interface Posicionamiento {
  mesMercado: string | null;
  rows: PosBrand[];
}

function floorKind(categoria: string): "lavado" | "refri" | "coccion" | null {
  const v = categoria.toLowerCase();
  if (v.includes("lava")) return "lavado";
  if (v.includes("refrig") || v.includes("frio")) return "refri";
  if (v.includes("cocc") || v.includes("cocin")) return "coccion";
  return null;
}
function rowKind(c: string | null | undefined): "lavado" | "refri" | "coccion" | null {
  if (!c) return null;
  const v = c.toLowerCase();
  if (v.includes("lava") || v.includes("seca")) return "lavado";
  if (v.includes("refrig") || v.includes("freezer") || v.includes("frio")) return "refri";
  if (v.includes("cocci") || v.includes("cocina")) return "coccion";
  return null;
}

async function floorShareByBrand(categoria: string): Promise<Map<string, number>> {
  const kind = floorKind(categoria);
  const out = new Map<string, number>();
  if (!kind) return out;
  const { weeks } = await getAvailableWeeks();
  const rows: FloorShareRow[] = weeks.length > 0 ? await getFloorShareRows({ semanas: weeks.slice(0, 12) }) : await getFloorShareRows();
  const cat = rows.filter((r) => rowKind(r.categoria) === kind);
  let total = 0;
  const perBrand = new Map<string, number>();
  for (const r of cat) {
    const u = r.unidades ?? 0;
    total += u;
    const key = (r.marca ?? "").trim().toUpperCase();
    perBrand.set(key, (perBrand.get(key) ?? 0) + u);
  }
  if (total > 0) for (const [k, u] of perBrand) out.set(k, (u / total) * 100);
  return out;
}

export async function getPosicionamiento(categoria: string, brands: string[]): Promise<Posicionamiento> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("mercado_share")
    .select("mes, segmento, marca, value_share, index_price")
    .eq("categoria", categoria)
    .in("segmento", ["High", "Mid", "Low"])
    .eq("agregacion", "mensual")
    .order("mes", { ascending: false })
    .limit(8000);
  const all = (data ?? []) as Array<{ mes: string; segmento: Seg; marca: string; value_share: number | null; index_price: number | null }>;
  const mes = all.length ? all[0]!.mes : null;
  // marca (upper) → segmento → { vs, ip }
  const mkt = new Map<string, Record<Seg, { vs: number | null; ip: number | null }>>();
  for (const r of all) {
    if (r.mes !== mes) continue;
    const key = r.marca.trim().toUpperCase();
    const seg = (mkt.get(key) ?? { High: { vs: null, ip: null }, Mid: { vs: null, ip: null }, Low: { vs: null, ip: null } });
    seg[r.segmento] = { vs: r.value_share, ip: r.index_price };
    mkt.set(key, seg);
  }
  const fs = await floorShareByBrand(categoria);

  const rows: PosBrand[] = brands.map((b) => {
    const key = b.trim().toUpperCase();
    const m = mkt.get(key);
    const f = fs.get(key);
    return {
      marca: b,
      vs: { High: m?.High.vs ?? null, Mid: m?.Mid.vs ?? null, Low: m?.Low.vs ?? null },
      ip: { High: m?.High.ip ?? null, Mid: m?.Mid.ip ?? null, Low: m?.Low.ip ?? null },
      floor: f != null ? Math.round(f * 10) / 10 : null,
    };
  });
  return { mesMercado: mes, rows };
}
