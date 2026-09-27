"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPasswordResetAction } from "@/app/login/actions";

const INPUT =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50";
const BUTTON =
  "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50";

export function RecoverForm() {
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const r = await requestPasswordResetAction(formData);
      if (r.error) setError(r.error);
      if (r.ok) setOk(r.ok);
    });
  }

  if (ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">{ok}</div>
        <Link href="/login" className="block text-center text-xs text-slate-500 hover:text-slate-900 hover:underline">
          ← Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Ingresá el email con el que accedés y te mandamos un link para crear una contraseña nueva.
      </p>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required disabled={pending} className={INPUT} />
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      )}

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Enviando..." : "Enviar link"}
      </button>

      <Link href="/login" className="block text-center text-xs text-slate-500 hover:text-slate-900 hover:underline">
        ← Volver a ingresar
      </Link>
    </form>
  );
}
