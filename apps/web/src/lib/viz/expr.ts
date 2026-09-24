// Parser de expresiones SEGURO (sin eval) para campos calculados.
// Sintaxis tipo planilla/Tableau: [Campo], números, "texto", + - * / %, & (concatenar),
// comparaciones (= <> != < <= > >=), AND / OR / NOT, paréntesis y funciones.
// Dos niveles:
//   - fila:      [Ventas] - [Costo], IF([Canal] = "Online", 1, 0), YEAR([Fecha])
//   - agregado:  SUM([Ventas]) / SUM([Inversión])  → se evalúa DESPUÉS de agrupar (ratio correcto)
import type { Agg } from "./types";

export type Val = number | string | boolean | Date | null;
export type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "null" }
  | { k: "field"; id: string }
  | { k: "un"; op: "-" | "not"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; fn: string; args: Node[] }
  | { k: "agg"; fn: Agg; arg: Node | null; idx: number };

export class ExprError extends Error {
  constructor(msg: string, public pos = -1) { super(msg); }
}

// Funciones de agregación (MIN/MAX con 1 argumento = agregación; con 2+ = mínimo de fila).
const AGG_FN: Record<string, Agg> = { SUM: "sum", AVG: "avg", PROMEDIO: "avg", SUMA: "sum", MIN: "min", MAX: "max", COUNT: "count", CONTAR: "count", COUNTD: "countd", MEDIAN: "median", MEDIANA: "median" };

export const FUNCS: { name: string; sig: string; desc: string; agg?: boolean }[] = [
  { name: "SUM", sig: "SUM([Campo])", desc: "Suma (agregación)", agg: true },
  { name: "AVG", sig: "AVG([Campo])", desc: "Promedio (agregación)", agg: true },
  { name: "MIN", sig: "MIN([Campo])", desc: "Mínimo (agregación; con 2 argumentos, el menor)", agg: true },
  { name: "MAX", sig: "MAX([Campo])", desc: "Máximo (agregación; con 2 argumentos, el mayor)", agg: true },
  { name: "COUNT", sig: "COUNT([Campo])", desc: "Cantidad de valores", agg: true },
  { name: "COUNTD", sig: "COUNTD([Campo])", desc: "Cantidad de valores distintos", agg: true },
  { name: "MEDIAN", sig: "MEDIAN([Campo])", desc: "Mediana (agregación)", agg: true },
  { name: "IF", sig: "IF(condición, si, si_no)", desc: "Condicional" },
  { name: "IFNULL", sig: "IFNULL(valor, alternativa)", desc: "Reemplaza vacíos" },
  { name: "AND", sig: "a AND b", desc: "Y lógico" },
  { name: "OR", sig: "a OR b", desc: "O lógico" },
  { name: "NOT", sig: "NOT a", desc: "Negación" },
  { name: "ABS", sig: "ABS(n)", desc: "Valor absoluto" },
  { name: "ROUND", sig: "ROUND(n, decimales)", desc: "Redondeo" },
  { name: "FLOOR", sig: "FLOOR(n)", desc: "Redondeo hacia abajo" },
  { name: "CEIL", sig: "CEIL(n)", desc: "Redondeo hacia arriba" },
  { name: "SQRT", sig: "SQRT(n)", desc: "Raíz cuadrada" },
  { name: "DIV", sig: "DIV(a, b)", desc: "División segura (vacío si b = 0)" },
  { name: "CONTAINS", sig: "CONTAINS(texto, buscado)", desc: "¿Contiene? (sin mayúsculas)" },
  { name: "LEFT", sig: "LEFT(texto, n)", desc: "Primeros n caracteres" },
  { name: "RIGHT", sig: "RIGHT(texto, n)", desc: "Últimos n caracteres" },
  { name: "CONCAT", sig: "CONCAT(a, b, …)", desc: "Une textos" },
  { name: "UPPER", sig: "UPPER(texto)", desc: "Mayúsculas" },
  { name: "LOWER", sig: "LOWER(texto)", desc: "Minúsculas" },
  { name: "TRIM", sig: "TRIM(texto)", desc: "Quita espacios" },
  { name: "LEN", sig: "LEN(texto)", desc: "Largo del texto" },
  { name: "YEAR", sig: "YEAR([Fecha])", desc: "Año" },
  { name: "QUARTER", sig: "QUARTER([Fecha])", desc: "Trimestre (1–4)" },
  { name: "MONTH", sig: "MONTH([Fecha])", desc: "Mes (1–12)" },
  { name: "WEEK", sig: "WEEK([Fecha])", desc: "Semana ISO" },
  { name: "DAY", sig: "DAY([Fecha])", desc: "Día del mes" },
];
const ROW_FN = new Set(["IF", "IFNULL", "AND", "OR", "NOT", "ABS", "ROUND", "FLOOR", "CEIL", "SQRT", "DIV", "CONTAINS", "LEFT", "RIGHT", "CONCAT", "UPPER", "LOWER", "TRIM", "LEN", "YEAR", "QUARTER", "MONTH", "WEEK", "DAY", "MIN", "MAX", "SI", "Y", "O", "NO"]);
const ALIAS: Record<string, string> = { SI: "IF", Y: "AND", O: "OR", NO: "NOT" };

type Tok = { t: "num" | "str" | "field" | "id" | "op" | "(" | ")" | ","; v: string; pos: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c!)) { i++; continue; }
    if (c === "[") {
      const j = src.indexOf("]", i + 1);
      if (j < 0) throw new ExprError("Falta cerrar el corchete ]", i);
      out.push({ t: "field", v: src.slice(i + 1, j).trim(), pos: i }); i = j + 1; continue;
    }
    if (c === '"' || c === "'" || c === "“" || c === "”") {
      const close = c === "“" ? "”" : c;
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== close && !(close === "”" && src[j] === '"')) { s += src[j]; j++; }
      if (j >= src.length) throw new ExprError("Falta cerrar las comillas", i);
      out.push({ t: "str", v: s, pos: i }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c!) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      out.push({ t: "num", v: src.slice(i, j), pos: i }); i = j; continue;
    }
    if (/[A-Za-z_ÁÉÍÓÚáéíóúñÑ]/.test(c!)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_ÁÉÍÓÚáéíóúñÑ]/.test(src[j]!)) j++;
      out.push({ t: "id", v: src.slice(i, j), pos: i }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "<>", "!=", "==", "&&", "||"].includes(two)) { out.push({ t: "op", v: two, pos: i }); i += 2; continue; }
    if ("+-*/%<>=&!".includes(c!)) { out.push({ t: "op", v: c!, pos: i }); i++; continue; }
    if (c === "(" || c === ")" || c === ",") { out.push({ t: c, v: c, pos: i }); i++; continue; }
    if (c === ";") { out.push({ t: ",", v: ",", pos: i }); i++; continue; } // separador estilo Excel es-AR
    throw new ExprError(`Carácter inesperado “${c}”`, i);
  }
  return out;
}

export interface Compiled { ast: Node; aggregate: boolean; refs: string[]; aggs: Extract<Node, { k: "agg" }>[] }

/** Compila una expresión. resolve(nombre) → id de campo o null. Lanza ExprError. */
export function compile(src: string, resolve: (name: string) => string | null): Compiled {
  const toks = tokenize(src);
  let p = 0;
  const refs = new Set<string>();
  const aggs: Extract<Node, { k: "agg" }>[] = [];
  let aggDepth = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const isKw = (v: string) => peek()?.t === "id" && peek()!.v.toUpperCase() === v && toks[p + 1]?.t !== "(";
  const expect = (t: Tok["t"]) => {
    const tk = toks[p];
    if (!tk || tk.t !== t) throw new ExprError(t === ")" ? "Falta cerrar un paréntesis" : `Se esperaba “${t}”`, tk?.pos ?? src.length);
    p++; return tk;
  };

  function parseOr(): Node {
    let a = parseAnd();
    while (isKw("OR") || isKw("O") || isOp("||")) { p++; a = { k: "bin", op: "or", a, b: parseAnd() }; }
    return a;
  }
  function parseAnd(): Node {
    let a = parseNot();
    while (isKw("AND") || isKw("Y") || isOp("&&")) { p++; a = { k: "bin", op: "and", a, b: parseNot() }; }
    return a;
  }
  function parseNot(): Node {
    if (isKw("NOT") || isOp("!")) { p++; return { k: "un", op: "not", a: parseNot() }; }
    return parseCmp();
  }
  function parseCmp(): Node {
    const a = parseAdd();
    const t = peek();
    if (t?.t === "op" && ["=", "==", "<>", "!=", "<", "<=", ">", ">="].includes(t.v)) {
      p++;
      const op = t.v === "==" ? "=" : t.v === "!=" ? "<>" : t.v;
      return { k: "bin", op, a, b: parseAdd() };
    }
    return a;
  }
  function parseAdd(): Node {
    let a = parseMul();
    while (peek()?.t === "op" && ["+", "-", "&"].includes(peek()!.v)) { const op = toks[p++]!.v; a = { k: "bin", op, a, b: parseMul() }; }
    return a;
  }
  function parseMul(): Node {
    let a = parseUnary();
    while (peek()?.t === "op" && ["*", "/", "%"].includes(peek()!.v)) { const op = toks[p++]!.v; a = { k: "bin", op, a, b: parseUnary() }; }
    return a;
  }
  function parseUnary(): Node {
    if (isOp("-")) { p++; return { k: "un", op: "-", a: parseUnary() }; }
    if (isOp("+")) { p++; return parseUnary(); }
    return parsePrimary();
  }
  function parsePrimary(): Node {
    const t = peek();
    if (!t) throw new ExprError("La expresión está incompleta", src.length);
    if (t.t === "num") { p++; const v = Number(t.v); if (!Number.isFinite(v)) throw new ExprError(`Número inválido “${t.v}”`, t.pos); return { k: "num", v }; }
    if (t.t === "str") { p++; return { k: "str", v: t.v }; }
    if (t.t === "field") {
      p++;
      const id = resolve(t.v);
      if (!id) throw new ExprError(`No existe el campo [${t.v}]`, t.pos);
      if (aggs.length && aggDepth === 0) { /* se valida al final */ }
      refs.add(id);
      return { k: "field", id: aggDepth ? id : `@row:${id}` };
    }
    if (t.t === "(") { p++; const e = parseOr(); expect(")"); return e; }
    if (t.t === "id") {
      const up = t.v.toUpperCase();
      if (up === "TRUE" || up === "VERDADERO") { p++; return { k: "bool", v: true }; }
      if (up === "FALSE" || up === "FALSO") { p++; return { k: "bool", v: false }; }
      if (up === "NULL") { p++; return { k: "null" }; }
      if (toks[p + 1]?.t !== "(") throw new ExprError(`“${t.v}” no es un campo: los campos van entre corchetes, ej. [${t.v}]`, t.pos);
      p += 2;
      const args: Node[] = [];
      const fn = ALIAS[up] ?? up;
      const isAgg = fn in AGG_FN && !((fn === "MIN" || fn === "MAX") && countArgs() > 1);
      if (isAgg) {
        if (aggDepth) throw new ExprError("No se pueden anidar agregaciones (ej. SUM(SUM(…)))", t.pos);
        aggDepth++;
        let arg: Node | null = null;
        if (peek()?.t !== ")") arg = parseOr();
        aggDepth--;
        expect(")");
        const node = { k: "agg" as const, fn: AGG_FN[fn]!, arg, idx: aggs.length };
        if (!arg && node.fn !== "count") throw new ExprError(`${fn} necesita un campo`, t.pos);
        aggs.push(node!);
        return node;
      }
      if (!ROW_FN.has(fn) && !(fn in AGG_FN)) throw new ExprError(`Función desconocida “${t.v}”`, t.pos);
      if (peek()?.t !== ")") {
        args.push(parseOr());
        while (peek()?.t === ",") { p++; args.push(parseOr()); }
      }
      expect(")");
      const need: Record<string, [number, number]> = { IF: [2, 3], IFNULL: [2, 2], ABS: [1, 1], ROUND: [1, 2], FLOOR: [1, 1], CEIL: [1, 1], SQRT: [1, 1], DIV: [2, 2], CONTAINS: [2, 2], LEFT: [2, 2], RIGHT: [2, 2], UPPER: [1, 1], LOWER: [1, 1], TRIM: [1, 1], LEN: [1, 1], YEAR: [1, 1], QUARTER: [1, 1], MONTH: [1, 1], WEEK: [1, 1], DAY: [1, 1], NOT: [1, 1] };
      const r = need[fn];
      if (r && (args.length < r[0] || args.length > r[1])) throw new ExprError(`${fn} lleva ${r[0] === r[1] ? r[0] : `${r[0]} a ${r[1]}`} argumento(s)`, t.pos);
      return { k: "call", fn, args };
    }
    throw new ExprError(`No se esperaba “${t.v}”`, t.pos);
  }
  // Cuenta argumentos de la llamada que empieza en p (para MIN/MAX de 1 vs 2+ args).
  function countArgs(): number {
    let depth = 0, n = 1;
    for (let j = p; j < toks.length; j++) {
      const tk = toks[j];
      if (tk!.t === "(") depth++;
      else if (tk!.t === ")") { if (depth === 0) return n; depth--; }
      else if (tk!.t === "," && depth === 0) n++;
    }
    return n;
  }

  if (!toks.length) throw new ExprError("La expresión está vacía", 0);
  const ast = parseOr();
  if (p < toks.length) throw new ExprError(`No se esperaba “${toks[p]!.v}”`, toks[p]!.pos);
  const aggregate = aggs.length > 0;
  // En un cálculo agregado, las referencias a filas tienen que estar dentro de una agregación.
  const strip = (n: Node): Node => {
    if (n.k === "field") {
      if (n.id.startsWith("@row:")) {
        if (aggregate) throw new ExprError("En un cálculo con SUM/AVG/… todos los campos van dentro de una agregación (ej. SUM([Ventas]) / SUM([Inversión]))");
        return { k: "field", id: n.id.slice(5) };
      }
      return n;
    }
    if (n.k === "un") return { ...n, a: strip(n.a) };
    if (n.k === "bin") return { ...n, a: strip(n.a), b: strip(n.b) };
    if (n.k === "call") return { ...n, args: n.args.map(strip) };
    if (n.k === "agg") { const r = { ...n, arg: n.arg ? strip(n.arg) : null }; aggs[n.idx] = r; return r; }
    return n;
  };
  return { ast: strip(ast), aggregate, refs: [...refs], aggs };
}

// ── Evaluación ──
const toN = (v: Val): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const toS = (v: Val): string => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "boolean" ? (v ? "Sí" : "No") : String(v));
const truthy = (v: Val): boolean => (v == null ? false : typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : typeof v === "string" ? v !== "" : true);
const asDate = (v: Val): Date | null => (v instanceof Date ? v : typeof v === "number" && v > 1e11 ? new Date(v) : null);

function cmp(a: Val, b: Val): number | null {
  if (a == null || b == null) return null;
  if (typeof a === "string" || typeof b === "string") {
    const na = toN(a), nb = toN(b);
    if (typeof a !== "string" || typeof b !== "string") { if (na != null && nb != null) return na - nb; }
    return toS(a).toLowerCase().localeCompare(toS(b).toLowerCase(), "es");
  }
  const na = toN(a), nb = toN(b);
  return na == null || nb == null ? null : na - nb;
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

/** Evalúa un nodo. get(id) devuelve el valor del campo en la fila; aggVals[idx] los agregados. */
export function evaluate(n: Node, get: (id: string) => Val, aggVals?: (number | null)[]): Val {
  switch (n.k) {
    case "num": return n.v;
    case "str": return n.v;
    case "bool": return n.v;
    case "null": return null;
    case "field": return get(n.id);
    case "agg": return aggVals ? aggVals[n.idx] ?? null : null;
    case "un": {
      const a = evaluate(n.a, get, aggVals);
      if (n.op === "not") return !truthy(a);
      const x = toN(a); return x == null ? null : -x;
    }
    case "bin": {
      if (n.op === "and") return truthy(evaluate(n.a, get, aggVals)) && truthy(evaluate(n.b, get, aggVals));
      if (n.op === "or") return truthy(evaluate(n.a, get, aggVals)) || truthy(evaluate(n.b, get, aggVals));
      const a = evaluate(n.a, get, aggVals), b = evaluate(n.b, get, aggVals);
      if (n.op === "&") return toS(a) + toS(b);
      if (["=", "<>", "<", "<=", ">", ">="].includes(n.op)) {
        if (n.op === "=" && (a == null || b == null)) return a == null && b == null;
        if (n.op === "<>" && (a == null || b == null)) return !(a == null && b == null);
        const c = cmp(a, b);
        if (c == null) return null;
        return n.op === "=" ? c === 0 : n.op === "<>" ? c !== 0 : n.op === "<" ? c < 0 : n.op === "<=" ? c <= 0 : n.op === ">" ? c > 0 : c >= 0;
      }
      if (n.op === "+" && (typeof a === "string" || typeof b === "string") && (toN(a) == null || toN(b) == null)) return toS(a) + toS(b);
      const x = toN(a), y = toN(b);
      if (x == null || y == null) return null;
      if (n.op === "+") return x + y;
      if (n.op === "-") return x - y;
      if (n.op === "*") return x * y;
      if (n.op === "/") return y === 0 ? null : x / y;
      if (n.op === "%") return y === 0 ? null : x % y;
      return null;
    }
    case "call": {
      const A = (i: number) => evaluate(n.args[i]!, get, aggVals);
      switch (n.fn) {
        case "IF": return truthy(A(0)) ? A(1) : n.args.length > 2 ? A(2) : null;
        case "IFNULL": { const a = A(0); return a == null || a === "" ? A(1) : a; }
        case "AND": return n.args.every((_, i) => truthy(A(i)));
        case "OR": return n.args.some((_, i) => truthy(A(i)));
        case "NOT": return !truthy(A(0));
        case "ABS": { const x = toN(A(0)); return x == null ? null : Math.abs(x); }
        case "ROUND": { const x = toN(A(0)); const d = n.args.length > 1 ? toN(A(1)) ?? 0 : 0; if (x == null) return null; const f = 10 ** d; return Math.round(x * f) / f; }
        case "FLOOR": { const x = toN(A(0)); return x == null ? null : Math.floor(x); }
        case "CEIL": { const x = toN(A(0)); return x == null ? null : Math.ceil(x); }
        case "SQRT": { const x = toN(A(0)); return x == null || x < 0 ? null : Math.sqrt(x); }
        case "DIV": { const x = toN(A(0)), y = toN(A(1)); return x == null || y == null || y === 0 ? null : x / y; }
        case "MIN": case "MAX": {
          const xs = n.args.map((_, i) => toN(A(i))).filter((x): x is number => x != null);
          return xs.length ? (n.fn === "MIN" ? Math.min(...xs) : Math.max(...xs)) : null;
        }
        case "CONTAINS": return toS(A(0)).toLowerCase().includes(toS(A(1)).toLowerCase());
        case "LEFT": return toS(A(0)).slice(0, Math.max(0, toN(A(1)) ?? 0));
        case "RIGHT": { const s = toS(A(0)); const k = Math.max(0, toN(A(1)) ?? 0); return k ? s.slice(-k) : ""; }
        case "CONCAT": return n.args.map((_, i) => toS(A(i))).join("");
        case "UPPER": return toS(A(0)).toUpperCase();
        case "LOWER": return toS(A(0)).toLowerCase();
        case "TRIM": return toS(A(0)).trim();
        case "LEN": return toS(A(0)).length;
        case "YEAR": case "QUARTER": case "MONTH": case "WEEK": case "DAY": {
          const d = asDate(A(0)); if (!d) return null;
          if (n.fn === "YEAR") return d.getUTCFullYear();
          if (n.fn === "QUARTER") return Math.floor(d.getUTCMonth() / 3) + 1;
          if (n.fn === "MONTH") return d.getUTCMonth() + 1;
          if (n.fn === "WEEK") return isoWeek(d);
          return d.getUTCDate();
        }
      }
      return null;
    }
  }
}

export const valToNumber = toN;
export const valToString = toS;
