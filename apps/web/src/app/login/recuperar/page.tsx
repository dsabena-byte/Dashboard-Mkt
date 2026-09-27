import { AuthCard } from "@/components/auth/auth-card";
import { RecoverForm } from "@/components/auth/recover-form";

export const dynamic = "force-dynamic";

export default function RecuperarPage() {
  return (
    <AuthCard subtitle="Recuperar contraseña">
      <RecoverForm />
    </AuthCard>
  );
}
