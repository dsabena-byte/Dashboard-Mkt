"use client";
import type { PostCard } from "@/lib/chat/types";

// Tarjetas de posts/creativos del copiloto (miniatura + texto + métricas + link).
// La tarjeta la arma el servidor a partir de los `ref` que devolvieron las tools.
export function PostCards({ posts }: { posts: PostCard[] }) {
  if (!posts?.length) return null;
  return (
    <div className="my-2 flex flex-col gap-1.5">
      {posts.map((p) => {
        const inner = (
          <>
            {p.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-md bg-slate-100 object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] text-slate-400">sin imagen</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 text-[10.5px] text-slate-500">
                <b className="font-semibold" style={{ color: "#1e40af" }}>{p.red}</b>
                {p.formato && <span>· {p.formato}</span>}
                {p.fecha && <span>· {p.fecha}</span>}
                {p.badge && <span className="rounded-full bg-slate-100 px-1.5 text-slate-600">{p.badge}</span>}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-foreground">{p.titulo}</div>
              <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] tabular-nums text-slate-500">
                {p.metricas.map((m, i) => (
                  <span key={i}>
                    <b className="font-semibold text-foreground">{m.valor}</b> {m.label}
                  </span>
                ))}
              </div>
            </div>
          </>
        );
        const cls = "flex gap-2.5 rounded-lg border border-slate-200 bg-white p-2 text-inherit no-underline";
        return p.url ? (
          <a key={p.ref} href={p.url} target="_blank" rel="noreferrer" className={`${cls} transition hover:bg-slate-50`}>{inner}</a>
        ) : (
          <div key={p.ref} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}
