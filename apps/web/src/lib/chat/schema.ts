// ============================================================================
// Schemas ESTRICTOS de las tools del copiloto (puro, sin server-only: lo usan el motor y el eval).
// Portado de BIP (sep-2026) sin cambios de lógica.
//
// 1) `validateArgs(schema, args)`: valida y normaliza los argumentos que manda el modelo ANTES de
//    correr la tool. Errores "duros" (falta un requerido, tipo imposible, valor fuera del enum) → la
//    tool NO corre y el modelo recibe el detalle para corregirse en el próximo paso. Ajustes "blandos"
//    (número como texto → número, entero con decimales → redondeo, fuera de mínimo/máximo → al borde,
//    propiedad desconocida → se descarta) se aplican y se informan.
// 2) `toOpenAiStrict(schema)`: versión compatible con `strict: true` de OpenAI (todas las propiedades
//    en `required`, opcionales como `[tipo, "null"]`, `additionalProperties: false` en todo objeto).
//    Devuelve null si el schema no se puede expresar estricto (ej. objetos libres de render_chart).
//    Se activa con env CHAT_STRICT_TOOLS=1 (no se pudo verificar contra la API desde el sandbox; la
//    validación del punto 1 corre SIEMPRE).
// Subconjunto de JSON Schema soportado: type (string o lista), enum, properties, required,
// additionalProperties, items, anyOf, minimum, maximum, maxItems.
// ============================================================================

export type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  maxItems?: number;
  description?: string;
  [k: string]: unknown;
};

export interface ValidationResult {
  ok: boolean;
  /** Argumentos normalizados (solo tiene sentido si ok). */
  args: Record<string, unknown>;
  /** Errores duros: la tool no se corre. */
  errores: string[];
  /** Ajustes aplicados (informativos). */
  ajustes: string[];
}

const tiposDe = (s: JsonSchema): string[] => (s.type == null ? [] : Array.isArray(s.type) ? s.type : [s.type]);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function tipoDeValor(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

// Valida un valor contra un schema; devuelve el valor normalizado o `undefined` + error.
function validar(s: JsonSchema, v: unknown, path: string, errores: string[], ajustes: string[]): unknown {
  if (s.anyOf?.length) {
    for (const alt of s.anyOf) {
      const e: string[] = [], a: string[] = [];
      const out = validar(alt, v, path, e, a);
      if (!e.length) { ajustes.push(...a); return out; }
    }
    errores.push(`${path}: no coincide con ninguno de los formatos permitidos`);
    return undefined;
  }
  const tipos = tiposDe(s);
  let val = v;
  // Coerciones blandas.
  if (tipos.length && typeof val === "string" && (tipos.includes("number") || tipos.includes("integer")) && !tipos.includes("string")) {
    const t = val.trim().replace(",", ".");
    if (t !== "" && Number.isFinite(Number(t))) { val = Number(t); ajustes.push(`${path}: "${v}" → ${val}`); }
  }
  if (tipos.length && typeof val === "string" && tipos.includes("boolean") && !tipos.includes("string") && /^(true|false)$/i.test(val.trim())) {
    val = val.trim().toLowerCase() === "true"; ajustes.push(`${path}: texto → booleano`);
  }
  if (tipos.length) {
    const t = tipoDeValor(val);
    const okTipo = tipos.includes(t) || (t === "integer" && tipos.includes("number"));
    if (!okTipo) {
      if (t === "number" && tipos.includes("integer")) { val = Math.round(val as number); ajustes.push(`${path}: redondeado a ${val}`); }
      else { errores.push(`${path}: se esperaba ${tipos.join(" o ")} y llegó ${t}`); return undefined; }
    }
  }
  if (typeof val === "number" && !Number.isFinite(val)) { errores.push(`${path}: número inválido`); return undefined; }
  if (s.enum && !s.enum.includes(val)) {
    // Tolerancia de mayúsculas/acentos: "meta" → "Meta".
    const norm = (x: unknown) => String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const hit = typeof val === "string" ? s.enum.find((e) => typeof e === "string" && norm(e) === norm(val)) : undefined;
    if (hit !== undefined) { ajustes.push(`${path}: "${val}" → "${hit}"`); val = hit; }
    else { errores.push(`${path}: "${String(val).slice(0, 40)}" no es válido (opciones: ${s.enum.map(String).join(", ")})`); return undefined; }
  }
  if (typeof val === "number") {
    let x: number = val;
    if (s.minimum != null && x < s.minimum) { ajustes.push(`${path}: ${x} → ${s.minimum} (mínimo)`); x = s.minimum; }
    if (s.maximum != null && x > s.maximum) { ajustes.push(`${path}: ${x} → ${s.maximum} (máximo)`); x = s.maximum; }
    val = x;
  }
  if (Array.isArray(val)) {
    let arr = val;
    if (s.maxItems != null && arr.length > s.maxItems) { ajustes.push(`${path}: recortado a ${s.maxItems} elementos`); arr = arr.slice(0, s.maxItems); }
    if (s.items) {
      const out: unknown[] = [];
      arr.forEach((x, i) => { const r = validar(s.items!, x, `${path}[${i}]`, errores, ajustes); out.push(r); });
      return out;
    }
    return arr;
  }
  if (isObj(val) && (s.properties || tipos.includes("object"))) return validarObjeto(s, val, path, errores, ajustes);
  return val;
}

function validarObjeto(s: JsonSchema, obj: Record<string, unknown>, path: string, errores: string[], ajustes: string[]): Record<string, unknown> {
  const props = s.properties ?? {};
  const out: Record<string, unknown> = {};
  const libre = !s.properties || s.additionalProperties === true;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in props)) {
      if (libre) out[k] = v;
      else ajustes.push(`${p}: propiedad desconocida, se ignora`);
      continue;
    }
    // null en un opcional = "sin valor" (así lo manda el modo strict de OpenAI).
    if (v === null && !tiposDe(props[k]!).includes("null")) {
      if ((s.required ?? []).includes(k)) errores.push(`${p}: es obligatorio`);
      continue;
    }
    const r = validar(props[k]!, v, p, errores, ajustes);
    if (r !== undefined) out[k] = r;
  }
  for (const k of s.required ?? []) if (!(k in out) && !errores.some((e) => e.startsWith(path ? `${path}.${k}` : k))) errores.push(`${path ? `${path}.${k}` : k}: es obligatorio`);
  return out;
}

/** Valida los argumentos de una tool contra su schema (raíz = objeto). */
export function validateArgs(schema: JsonSchema, args: unknown): ValidationResult {
  const errores: string[] = [], ajustes: string[] = [];
  if (args != null && !isObj(args)) return { ok: false, args: {}, errores: ["los argumentos deben ser un objeto JSON"], ajustes };
  const out = validarObjeto(schema, (args ?? {}) as Record<string, unknown>, "", errores, ajustes);
  return { ok: errores.length === 0, args: out, errores, ajustes };
}

/** Mensaje compacto para devolverle al modelo cuando los argumentos no pasan. */
export function errorDeArgs(tool: string, v: ValidationResult): { error: string; detalles: string[] } {
  return { error: `Argumentos inválidos para ${tool}: corregí y volvé a llamar.`, detalles: v.errores.slice(0, 8) };
}

// ── Conversión a OpenAI strict ────────────────────────────────────────────────────────────────
function strictNodo(s: JsonSchema, opcional: boolean): JsonSchema | null {
  if (s.anyOf?.length) {
    const alts = s.anyOf.map((a) => strictNodo(a, false));
    if (alts.some((a) => a == null)) return null;
    return { ...(s.description ? { description: s.description } : {}), anyOf: opcional ? [...(alts as JsonSchema[]), { type: "null" }] : (alts as JsonSchema[]) };
  }
  const tipos = tiposDe(s);
  if (!tipos.length) return null; // sin tipo: no expresable en strict
  const out: JsonSchema = { type: tipos.length === 1 ? tipos[0] : [...tipos] };
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = [...s.enum];
  if (tipos.includes("object")) {
    if (!s.properties || !Object.keys(s.properties).length) return null; // objeto libre
    const r = strictObjeto(s);
    if (!r) return null;
    Object.assign(out, r);
  }
  if (tipos.includes("array")) {
    if (!s.items) return null;
    const it = strictNodo(s.items, false);
    if (!it) return null;
    out.items = it;
  }
  if (opcional && !tipos.includes("null")) {
    out.type = [...(Array.isArray(out.type) ? out.type : [out.type as string]), "null"];
    if (out.enum && !out.enum.includes(null)) out.enum = [...out.enum, null];
  }
  return out;
}

function strictObjeto(s: JsonSchema): JsonSchema | null {
  const props: Record<string, JsonSchema> = {};
  const req = new Set(s.required ?? []);
  for (const [k, p] of Object.entries(s.properties ?? {})) {
    const r = strictNodo(p, !req.has(k));
    if (!r) return null;
    props[k] = r;
  }
  return { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
}

/** Schema compatible con `strict: true` o null si no se puede (la tool queda no estricta). */
export function toOpenAiStrict(schema: JsonSchema): JsonSchema | null {
  if (tiposDe(schema)[0] !== "object") return null;
  if (!schema.properties) return null;
  if (!Object.keys(schema.properties).length) return { type: "object", properties: {}, required: [], additionalProperties: false };
  return strictObjeto(schema);
}

/** Chequeo estructural de que un schema cumple las reglas de strict (para el eval). */
export function esStrictValido(s: JsonSchema): string[] {
  const errs: string[] = [];
  const visit = (n: JsonSchema, p: string) => {
    if (n.anyOf) { n.anyOf.forEach((a, i) => visit(a, `${p}.anyOf[${i}]`)); return; }
    const t = tiposDe(n);
    if (!t.length) errs.push(`${p}: sin type`);
    if (t.includes("object")) {
      if (n.additionalProperties !== false) errs.push(`${p}: additionalProperties debe ser false`);
      const keys = Object.keys(n.properties ?? {});
      const req = n.required ?? [];
      if (keys.length !== req.length || keys.some((k) => !req.includes(k))) errs.push(`${p}: todas las propiedades deben ser required`);
      for (const k of keys) visit(n.properties![k]!, `${p}.${k}`);
    }
    if (t.includes("array")) { if (!n.items) errs.push(`${p}: array sin items`); else visit(n.items, `${p}[]`); }
  };
  visit(s, "$");
  return errs;
}
