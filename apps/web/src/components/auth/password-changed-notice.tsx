"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PASSWORD_OK_COOKIE } from "@/lib/auth/safe-next";

/** Aviso "Contraseña actualizada" tras /login/nueva-clave (cookie flash de 60s que setea la action). */
export function PasswordChangedNotice() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!document.cookie.split("; ").some((c) => c === `${PASSWORD_OK_COOKIE}=1`)) return;
    document.cookie = `${PASSWORD_OK_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    setShow(true);
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      Contraseña actualizada.
      <button type="button" onClick={() => setShow(false)} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}
