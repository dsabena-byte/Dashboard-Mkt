"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updatePasswordAction } from "@/app/login/actions";
import { MIN_PASSWORD_LEN, validateNewPassword } from "@/lib/auth/safe-next";

const INPUT =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50";
const BUTTON =
  "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50";

export function NewPasswordForm({ email }: { email?: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const invalid = validateNewPassword(String(formData.get("password") ?? ""), String(formData.get("confirm") ?? ""));
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const r = await updatePasswordAction(formData);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {email && (
        <p className="text-sm text-slate-600">
          Cuenta: <span className="font-medium text-slate-900">{email}</span>
        </p>
      )}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Contraseña nueva
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LEN}
          required
          disabled={pending}
          className={INPUT}
        />
        <p className="mt-1 text-[11px] text-slate-400">Mínimo {MIN_PASSWORD_LEN} caracteres.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
          Repetir contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LEN}
          required
          disabled={pending}
          className={INPUT}
        />
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      )}

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Guardando..." : "Guardar contraseña"}
      </button>

      <Link href="/" className="block text-center text-xs text-slate-500 hover:text-slate-900 hover:underline">
        Cancelar
      </Link>
    </form>
  );
}
