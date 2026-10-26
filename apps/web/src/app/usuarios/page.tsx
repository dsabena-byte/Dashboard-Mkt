import { notFound } from "next/navigation";
import { esAdminActual } from "@/lib/usuarios-server";
import { UsuariosAdmin } from "@/components/usuarios/usuarios-admin";

// Usuarios del tablero (migración 0136): quién entra, a qué grupo pertenece y sus permisos. Solo admins.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function UsuariosPage() {
  const admin = await esAdminActual();
  if (!admin) notFound();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Cada persona entra con su email y su clave. El grupo define qué tableros ve: Marketing ve todos, Trade ve Cuadros Básicos y Floor Share, Ventas ve CB Ventas.
        </p>
      </header>
      <UsuariosAdmin yo={admin.email} />
    </div>
  );
}
