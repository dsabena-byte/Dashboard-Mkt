import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { GlobalDataChat } from "@/components/global-data-chat";
import { KnowledgePanel } from "@/components/knowledge/knowledge-panel";
import { PasswordChangedNotice } from "@/components/auth/password-changed-notice";
import { TableExcelExport } from "@/components/table-excel-export";
import { esAdminActual, getAllowedPaths, getMiPerfil } from "@/lib/usuarios-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard Mkt",
  description: "Monitoreo unificado de campañas digitales y offline",
};

// Dashboards del menú (null = ve todo). Sin sesión (pantalla de login) se deja el menú como antes.
async function menu(): Promise<{ allowed: string[] | null; esAdmin: boolean }> {
  const p = await getMiPerfil().catch(() => null);
  if (!p?.user) return { allowed: null, esAdmin: false };
  const [allowed, admin] = await Promise.all([getAllowedPaths(), esAdminActual()]);
  return { allowed, esAdmin: !!admin };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { allowed, esAdmin } = await menu();
  return (
    <html lang="es">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar allowed={allowed} esAdmin={esAdmin} />
          <main className="min-w-0 flex-1 overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
        <GlobalDataChat />
        <KnowledgePanel />
        <PasswordChangedNotice />
        <TableExcelExport />
      </body>
    </html>
  );
}
