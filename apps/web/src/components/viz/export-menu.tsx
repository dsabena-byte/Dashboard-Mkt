"use client";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

// Botón de descarga de un widget de "Mis tableros" (portado de BIP). En Drean solo exporta a
// Excel (los datos agregados del widget, o la <table> de la card); el PNG de BIP necesitaba
// html-to-image, que Drean no tiene. Se auto-posiciona arriba a la derecha de la card.
export function ExportMenu({ name = "tablero", data }: { name?: string; data?: () => unknown[][] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hasTable, setHasTable] = useState(false);

  const card = () => ref.current?.parentElement as HTMLElement | null;
  useEffect(() => {
    const el = card();
    if (el && getComputedStyle(el).position === "static") el.style.position = "relative";
    setHasTable(!!el?.querySelector("table"));
  }, []);

  const fname = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tablero";

  function excelData() {
    if (!data) return;
    const ws = XLSX.utils.aoa_to_sheet(data());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fname}.xlsx`);
    setOpen(false);
  }
  function excel() {
    const t = card()?.querySelector("table");
    if (!t) return;
    const wb = XLSX.utils.table_to_book(t as HTMLTableElement, { raw: true });
    XLSX.writeFile(wb, `${fname}.xlsx`);
    setOpen(false);
  }

  if (!data && !hasTable) return null;
  const item: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12.5, border: 0, background: "none", cursor: "pointer", color: "var(--ink)", fontFamily: "inherit" };
  return (
    <div ref={ref} data-exportbtn="1" data-noprint="1" style={{ position: "absolute", top: 12, right: 14, zIndex: 5 }}>
      <button onClick={() => setOpen((o) => !o)} title="Descargar" style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 30, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 6px 18px rgba(0,0,0,.14)", overflow: "hidden", minWidth: 156 }}>
          {data ? <button onClick={excelData} style={item}>Excel (datos)</button>
            : <button onClick={excel} style={item}>Excel (.xlsx)</button>}
        </div>
      )}
    </div>
  );
}
