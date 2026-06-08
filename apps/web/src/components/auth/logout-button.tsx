"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/login/actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => logoutAction())}
      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
      title="Cerrar sesión"
    >
      {pending ? "Saliendo..." : "↪ Salir"}
    </button>
  );
}
