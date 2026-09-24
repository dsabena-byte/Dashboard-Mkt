"use client";
import { Fragment, type ReactNode } from "react";

// Markdown MÍNIMO para las respuestas del copiloto (sin dependencias): títulos (#..###),
// **negrita**, *itálica*, `código`, listas (- * • y 1.), tablas simples con pipes,
// separador (---) y links http(s). Las imágenes se descartan. (Portado de BIP.)

const AZUL = "#1e40af";

function inline(text: string, kb: string): ReactNode[] {
  const clean = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of clean.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(<Fragment key={`${kb}t${i++}`}>{clean.slice(last, idx)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${kb}b${i++}`} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={`${kb}c${i++}`} className="rounded bg-slate-100 px-1 text-[0.92em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const href = lm?.[2] ?? "";
      out.push(/^https?:\/\//.test(href)
        ? <a key={`${kb}a${i++}`} href={href} target="_blank" rel="noreferrer" style={{ color: AZUL }} className="underline-offset-2 hover:underline">{lm?.[1]}</a>
        : <Fragment key={`${kb}a${i++}`}>{lm?.[1]}</Fragment>);
    } else out.push(<em key={`${kb}i${i++}`}>{tok.slice(1, -1)}</em>);
    last = idx + tok.length;
  }
  if (last < clean.length) out.push(<Fragment key={`${kb}t${i++}`}>{clean.slice(last)}</Fragment>);
  return out;
}

const esFilaTabla = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const esSeparador = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const celdas = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const esNumero = (s: string) => /^[-+]?[$€US\s]*[\d.,]+\s*(%|x|pts|k|m|M)?$/.test(s.trim());

export function MiniMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const t = raw.trim();
    if (!t) { blocks.push(<div key={i} className="h-1.5" />); continue; }
    if (esFilaTabla(t) && i + 1 < lines.length && esSeparador(lines[i + 1] ?? "")) {
      const head = celdas(t);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && esFilaTabla(lines[j] ?? "")) { rows.push(celdas(lines[j] ?? "")); j++; }
      blocks.push(
        <div key={i} className="my-1.5 overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>{head.map((h, k) => <th key={k} className={`whitespace-nowrap border-b border-slate-200 px-2 py-1 font-semibold text-slate-500 ${k === 0 ? "text-left" : "text-right"}`}>{inline(h, `h${i}-${k}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{head.map((_, k) => <td key={k} className={`border-t border-slate-100 px-2 py-1 tabular-nums ${k === 0 || !esNumero(r[k] ?? "") ? "text-left" : "text-right"}`}>{inline(r[k] ?? "", `c${i}-${ri}-${k}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j - 1;
      continue;
    }
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = (h[1] ?? "").length;
      blocks.push(<div key={i} className={`mb-0.5 mt-2.5 font-semibold ${lvl <= 2 ? "text-[14px]" : "text-[13px]"}`} style={{ color: lvl <= 3 ? AZUL : undefined }}>{inline(h[2] ?? "", `h${i}`)}</div>);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(t)) { blocks.push(<hr key={i} className="my-2 border-slate-200" />); continue; }
    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    const b = t.match(/^[-*•]\s+(.*)$/);
    if (b) {
      blocks.push(<div key={i} className="flex gap-1.5" style={{ paddingLeft: 2 + Math.min(indent, 6) * 4 }}><span style={{ color: AZUL }}>•</span><span className="flex-1">{inline(b[1] ?? "", `l${i}`)}</span></div>);
      continue;
    }
    const n = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (n) {
      blocks.push(<div key={i} className="flex gap-1.5" style={{ paddingLeft: Math.min(indent, 6) * 4 }}><span className="min-w-[14px] font-semibold" style={{ color: AZUL }}>{n[1]}.</span><span className="flex-1">{inline(n[2] ?? "", `n${i}`)}</span></div>);
      continue;
    }
    blocks.push(<div key={i}>{inline(t, `p${i}`)}</div>);
  }
  return <div className="flex flex-col gap-0.5">{blocks}</div>;
}
