"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Megaphone,
  Target,
  Eye,
  Bell,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview",    label: "Overview",         icon: LayoutDashboard },
  { href: "/web",         label: "Web",              icon: Globe },
  { href: "/funnel",      label: "Funnel",           icon: GitBranch },
  { href: "/campaigns",   label: "Campañas",         icon: Megaphone },
  { href: "/planning",    label: "Planning Pauta",   icon: Target },
  { href: "/competitors", label: "Competencia",      icon: Eye },
  { href: "/alerts",      label: "Alertas",          icon: Bell },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="border-b px-6 py-5">
        <h1 className="text-base font-semibold tracking-tight">Dashboard Mkt</h1>
        <p className="text-xs text-muted-foreground">Monitoreo de campañas</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={item.href as any}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        v0.1.0 · Fase 1
      </div>
    </aside>
  );
}
