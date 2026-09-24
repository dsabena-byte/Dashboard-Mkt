import { Fragment, type ReactNode } from "react";

// Renderer "markdown-lite" del contenido del Método BIP (sin dependencias, sin HTML crudo):
// párrafos (separados por línea en blanco), viñetas "- ", numeradas "1. ", **negrita** y `código`.

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`${keyBase}-t${i++}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("**"))
      out.push(
        <strong key={`${keyBase}-b${i++}`} className="font-semibold text-slate-900">
          {tok.slice(2, -2)}
        </strong>,
      );
    else
      out.push(
        <code key={`${keyBase}-c${i++}`} className="break-words rounded bg-slate-100 px-1 py-px text-[0.92em]">
          {tok.slice(1, -1)}
        </code>,
      );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={`${keyBase}-t${i++}`}>{text.slice(last)}</Fragment>);
  return out;
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const ul = /^- (.*)$/.exec(line);
    const ol = /^\d+\. (.*)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const item = (ul ?? ol)![1]!;
      if (!cur || cur.kind !== kind) {
        flush();
        cur = { kind, items: [] };
      }
      (cur as { items: string[] }).items.push(item);
    } else {
      if (!cur || cur.kind !== "p") {
        flush();
        cur = { kind: "p", lines: [] };
      }
      (cur as { lines: string[] }).lines.push(line);
    }
  }
  flush();
  return blocks;
}

export function MdLite({ text }: { text: string }) {
  const blocks = parse(text);
  const base = "mb-3 text-[14px] leading-relaxed text-slate-600";
  return (
    <>
      {blocks.map((b, bi) => {
        if (b.kind === "p")
          return (
            <p key={bi} className={base}>
              {inline(b.lines.join(" "), `p${bi}`)}
            </p>
          );
        const Tag = b.kind;
        return (
          <Tag key={bi} className={`${base} pl-5 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}>
            {b.items.map((it, ii) => (
              <li key={ii} className="my-1">
                {inline(it, `l${bi}-${ii}`)}
              </li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}

/** Solo el inline (para textos cortos: pasos, checklist, "En la plataforma"). */
export function MdInline({ text }: { text: string }) {
  return <>{inline(text, "i")}</>;
}
