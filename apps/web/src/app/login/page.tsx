import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { redirect?: string; error?: string };
}

export default function LoginPage({ searchParams }: PageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">DREAN</h1>
          <p className="mt-1 text-sm text-slate-500">Marketing Management</p>
        </div>
        <LoginForm redirectTo={searchParams.redirect ?? "/"} initialError={searchParams.error} />
      </div>
    </div>
  );
}
