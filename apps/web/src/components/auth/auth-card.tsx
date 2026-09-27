import { getTenant } from "@/lib/tenant/current";

/** Tarjeta centrada de las pantallas de auth (login, recuperar, nueva clave): mismo look. */
export function AuthCard({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  const tenant = getTenant();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">{tenant.displayName.toUpperCase()}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle ?? tenant.branding.tagline}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
