import type { PostCard, ToolCtx } from "./types";

// Registra una tarjeta de post/creativo en el contexto del request y devuelve su `ref`.
// El modelo después pasa solo los refs a render_posts (no puede inventar links/imágenes).
export function registrarCard(ctx: ToolCtx, prefijo: string, card: Omit<PostCard, "ref">): string {
  const ref = `${prefijo}${ctx.posts.size + 1}`;
  ctx.posts.set(ref, { ref, ...card });
  return ref;
}
