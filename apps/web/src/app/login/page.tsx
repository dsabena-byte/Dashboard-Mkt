import { LoginForm } from "@/components/auth/login-form";
import { AuthCard } from "@/components/auth/auth-card";
import { safeNext } from "@/lib/auth/safe-next";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { redirect?: string; error?: string };
}

const ERRORS: Record<string, string> = {
  link: "El link venció o ya se usó. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”.",
};

export default function LoginPage({ searchParams }: PageProps) {
  const error = searchParams.error ? (ERRORS[searchParams.error] ?? searchParams.error) : undefined;
  return (
    <AuthCard>
      <LoginForm redirectTo={safeNext(searchParams.redirect)} initialError={error} />
    </AuthCard>
  );
}
