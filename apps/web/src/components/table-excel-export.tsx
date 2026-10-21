"use client";
import { useEffect } from "react";
import { tituloDeTabla, valorCelda } from "@/lib/table-excel";

// Agrega un botón "Excel" arriba de CADA <table> de los tableros (pedido del user, oct-2026), sin tocar
// cada componente: se monta una vez en el layout y observa el DOM. Los botones se insertan como hermanos
// de la tabla (fuera de lo que React renderiza); si la tabla desaparece, su botón se borra.
// No aplica a: tablas dentro de `.bip-viz` (Mis tableros ya tiene su menú), `[data-noexcel]`, ni tablas
// de menos de 2 filas. Tampoco llega a iframes (ej. Mkt Canal) ni a "tablas" armadas con divs.
const MARK = "data-excel-btn";

export function TableExcelExport() {
  useEffect(() => {
    const botones = new Map<HTMLTableElement, HTMLElement>();

    const exportar = async (t: HTMLTableElement) => {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.table_to_sheet(t, { raw: true });
      for (const k of Object.keys(ws)) {
        if (k.startsWith("!")) continue;
        const c = ws[k] as { t: string; v: unknown; z?: string };
        if (c.t !== "s") continue;
        const v = valorCelda(String(c.v));
        if (v) { c.t = "n"; c.v = v.n; if (v.z) c.z = v.z; }
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Datos");
      const nombre = tituloDeTabla(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "tabla";
      XLSX.writeFile(wb, `${nombre}.xlsx`);
    };

    const scan = () => {
      for (const [t, b] of botones) if (!t.isConnected || b.nextElementSibling !== t) { b.remove(); botones.delete(t); }
      document.querySelectorAll<HTMLTableElement>("main table").forEach((t) => {
        if (botones.has(t) || t.rows.length < 2 || t.closest(".bip-viz,[data-noexcel]")) return;
        const b = document.createElement("div");
        b.setAttribute(MARK, "1");
        b.style.cssText = "display:flex;justify-content:flex-end;margin:0 0 4px";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "⬇ Excel";
        btn.title = "Descargar esta tabla en Excel";
        btn.style.cssText = "font:inherit;font-size:11.5px;line-height:1;padding:5px 9px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;cursor:pointer";
        btn.onclick = () => { void exportar(t); };
        b.appendChild(btn);
        t.parentElement?.insertBefore(b, t);
        botones.set(t, b);
      });
    };

    let pend = 0;
    const obs = new MutationObserver((muts) => {
      if (muts.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => n instanceof HTMLElement && n.hasAttribute(MARK)))) return;
      cancelAnimationFrame(pend);
      pend = requestAnimationFrame(scan);
    });
    scan();
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(pend); botones.forEach((b) => b.remove()); };
  }, []);
  return null;
}
