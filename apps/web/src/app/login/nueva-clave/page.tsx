import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { getServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Requiere sesión: viene del link de recuperación (/auth/callback la crea) o de un usuario logueado
// que quiere cambiar su contraseña ("Cambiar contraseña" en el pie del menú).
export default async function NuevaClavePage() {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");

  return (
    <AuthCard subtitle="Crear contraseña nueva">
      <NewPasswordForm email={user.email ?? undefined} />
    </AuthCard>
  );
}
