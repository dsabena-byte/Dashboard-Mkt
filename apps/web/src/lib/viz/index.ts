// Motor de tableros de planilla (v2). Puro y client-safe: lo usan el runtime del tablero
// (cliente), el builder, la API de IA (server) y los tests. Ver CLAUDE.md → "Motor de tableros".
export * from "./types";
export * from "./parse";
export * from "./format";
export { compile, evaluate, ExprError, FUNCS } from "./expr";
export * from "./schema";
export * from "./query";
export * from "./dashboard";
export * from "./suggest";
export * from "./ai-schema";
export * from "./export";
