// Cliente / promotor / supervisor de cada fila de Floor Share — misma lógica que la app vieja de
// cuadros-basicos (lib/dataset-floorshare.ts), para que las tablas den igual. Puro (client-safe).
// OJO: el número de tienda NO es único entre cadenas ("1" = varias tiendas) → la clave es número + nombre.
// Los nombres de personas NO van en el código (repo público): las asignaciones viven en tr_tienda_asignacion.

export type Contacto = { numero: string; nombre: string; cadena: string; promotor: string; supervisor: string; zona?: string; geo?: string };
/** `geo` = "id|lat|lon|provincia" de la tienda (master con direcciones); sin geo el mapa la ubica en su zona. */
export type FsPersonas = { cliente: string; promotor: string; supervisor: string; zona: string; geo?: string };
export const ZONA_SIN = "Sin zona";

export const PROMOTOR_NO_MAPEO = "Tienda sin mapeo";
export const PROMOTOR_SIN = "Sin promotor";
export const SUPERVISOR_SIN = "Sin supervisor";
export const PERSONA_PLACEHOLDERS = new Set(["Sin asignar", PROMOTOR_SIN, SUPERVISOR_SIN, PROMOTOR_NO_MAPEO]);

export function norm(s: string | null | undefined): string {
  return (s ?? "").toString().trim().toUpperCase()
    .replace(/[ÁÀÄÂ]/g, "A").replace(/[ÉÈËÊ]/g, "E").replace(/[ÍÌÏÎ]/g, "I")
    .replace(/[ÓÒÖÔ]/g, "O").replace(/[ÚÙÜÛ]/g, "U").replace(/Ñ/g, "N")
    .replace(/[^\w ]/g, "").replace(/\s+/g, " ");
}

export function normalizeStoreNumber(raw: string | number | null | undefined): string {
  const digits = String(raw ?? "").trim().replace(/\D/g, "");
  return digits ? digits.replace(/^0+/, "") || "0" : "";
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const canonKey = (s: string) => sinAcentos(s || "").replace(/\./g, "").replace(/\s+/g, " ").trim();

// Variantes de nombre de cliente → canónico (claves sin acentos ni puntos).
const CLIENTE_ALIASES: Record<string, string> = {
  walmater: "Changomas", chango: "Changomas", changomas: "Changomas", walmart: "Changomas",
  authogar: "Autohogar", autohogar: "Autohogar",
  casa: "La Casa Del Audio", "casa del audio": "La Casa Del Audio", "la casa del audio": "La Casa Del Audio",
  fravega: "Frávega", "fravega sa": "Frávega", "fravega s a": "Frávega",
  electronica: "On City", "on city": "On City",
  "radio sapienza": "Radio Sapienza", "radio sapienza sa": "Radio Sapienza",
  "saturno hogar": "Saturno Hogar", "saturno hogar sa": "Saturno Hogar",
  tevelin: "Tevelín",
  av: "Naldo Lombardi", naldo: "Naldo Lombardi", "naldo lombardi": "Naldo Lombardi",
  tio: "Tio Musa", "tio musa": "Tio Musa",
  ama: "Ama Hogar", "ama hogar": "Ama Hogar",
  cetrogar: "Cetrogar Sa", "cetrogar sa": "Cetrogar Sa",
  castillojujuy: "Castillo",
  mi: "Mi Casa", mia: "Mi Casa", "mi casa": "Mi Casa",
};
export const canonicalizeCliente = (s: string) => (s ? CLIENTE_ALIASES[canonKey(s)] ?? s : s);

// Tiendas cuyo nombre no empieza con la cadena (número + parte del nombre).
const STORE_OVERRIDES = [{ number: "772", nameContains: "av. san martin", cliente: "Cetrogar Sa" }];
// Tiendas que no son de un cliente (se excluyen del Floor Share).
const EXCLUDED = ["m y a representaciones", "manuel y ricardo braude"];
export const isExcludedStore = (name: string) => !!name && EXCLUDED.some((p) => sinAcentos(name).trim().includes(p));

const MULTI_WORD = [
  "La Casa Del Audio", "Casa Del Audio", "Radio Sapienza", "Oscar Barbieri", "Genesio Hogar", "Petenatti Hogar",
  "Saturno Hogar", "Rodo Hogar", "On City", "Tio Musa", "Ama Hogar", "Mi Casa",
];

function inferCliente(storeName: string, byFirstWord: Map<string, string>): string {
  const lower = (storeName || "").trim().toLowerCase();
  if (!lower) return "Sin asignar";
  for (const b of MULTI_WORD) { const bl = b.toLowerCase(); if (lower === bl || lower.startsWith(bl + " ")) return b; }
  const first = lower.split(/\s+/)[0] ?? "";
  if (!first) return "Sin asignar";
  return byFirstWord.get(first) ?? first.charAt(0).toUpperCase() + first.slice(1);
}

// "Nombre Apellido" vs "Apellido Nombre" → la variante más frecuente (empate: alfabética).
function canonPersonas(names: string[]): (s: string) => string {
  const key = (s: string) => sinAcentos(s).split(/\s+/).filter(Boolean).sort().join(" ");
  const groups = new Map<string, Map<string, number>>();
  for (const n of names) {
    if (!n || n.split(" ").length < 2) continue;
    const g = groups.get(key(n)) ?? new Map<string, number>();
    g.set(n, (g.get(n) ?? 0) + 1); groups.set(key(n), g);
  }
  const best = new Map<string, string>();
  for (const [k, g] of groups) best.set(k, [...g].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))[0]![0]);
  return (s) => (s ? best.get(key(s)) ?? s : s);
}

/** Arma el resolvedor (número, nombre de tienda) → cliente/promotor/supervisor; null = tienda excluida. */
export function crearEnriquecedorFs(contactos: Contacto[]): (numero: string, nombre: string) => FsPersonas | null {
  const limpio = (s: string) => (s || "").trim().replace(/\s+/g, " ");
  const canonP = canonPersonas(contactos.map((c) => limpio(c.promotor)));
  const byKey = new Map<string, Contacto>();
  const byName = new Map<string, Contacto>();
  const byFirstWord = new Map<string, string>();
  for (const c of contactos) {
    const numero = normalizeStoreNumber(c.numero), nn = norm(c.nombre);
    if (!numero || !nn) continue;
    const v = { ...c, numero, promotor: canonP(limpio(c.promotor)), supervisor: limpio(c.supervisor) };
    byKey.set(`${numero}|${nn}`, v);
    if (!byName.has(nn)) byName.set(nn, v);
    const cad = (c.cadena || "").trim(), fw = cad.toLowerCase().split(/\s+/)[0];
    if (fw && !byFirstWord.has(fw)) byFirstWord.set(fw, cad);
  }
  const lookup = (numero: string, nombre: string): Contacto | undefined => {
    const num = normalizeStoreNumber(numero), nn = norm(nombre);
    const direct = byKey.get(`${num}|${nn}`);
    if (direct) return direct;
    if (num) for (const [k, v] of byKey) if (k.startsWith(num + "|")) return v; // = app vieja
    const m = nombre.trim().match(/^(\d+)\s*[-–]\s*(.+)$/);
    if (m) { const fb = byKey.get(`${normalizeStoreNumber(m[1])}|${norm(m[2])}`); if (fb) return fb; }
    return byName.get(nn);
  };
  const cache = new Map<string, FsPersonas | null>();
  return (numero, nombre) => {
    const ck = `${numero}|${nombre}`;
    if (cache.has(ck)) return cache.get(ck)!;
    let out: FsPersonas | null = null;
    if (!isExcludedStore(nombre)) {
      const ln = sinAcentos(nombre);
      const ov = STORE_OVERRIDES.find((o) => o.number === numero && ln.includes(o.nameContains))?.cliente;
      const c = lookup(numero, nombre);
      out = {
        cliente: canonicalizeCliente(ov ?? inferCliente(nombre, byFirstWord)),
        promotor: !c ? PROMOTOR_NO_MAPEO : c.promotor || PROMOTOR_SIN,
        supervisor: !c ? PROMOTOR_NO_MAPEO : c.supervisor || SUPERVISOR_SIN,
        zona: c?.zona?.trim() || ZONA_SIN,
        ...(c?.geo ? { geo: c.geo } : {}),
      };
    }
    cache.set(ck, out);
    return out;
  };
}
