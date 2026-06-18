import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows } from "@/lib/dashboard-access";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard Mkt",
  description: "Monitoreo unificado de campañas digitales y offline",
};

// Dashboards permitidos para el usuario actual (null = ve todo).
async function getAllowedPaths(): Promise<string[] | null> {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("dashboard_access").select("dashboard_path");
    return allowedFromRows(data as { dashboard_path: string }[] | null);
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const allowed = await getAllowedPaths();
  return (
    <html lang="es">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar allowed={allowed} />
          <main className="min-w-0 flex-1 overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
