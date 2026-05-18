"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Target,
  Share2,
  Globe,
  Megaphone,
  LayoutGrid,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview",    label: "Overview",         icon: LayoutDashboard },
  { href: "/funnel",      label: "BGT Mkt",          icon: GitBranch },
  { href: "/planning",    label: "Planning Pauta",   icon: Target },
  { href: "/web",         label: "Análisis Web",     icon: Globe },
  { href: "/redes",       label: "Análisis Redes",   icon: Share2 },
  { href: "/influencia",  label: "Mkt de Influencia", icon: Megaphone },
  { href: "/cuadros-basicos", label: "Cuadros Básicos", icon: LayoutGrid },
  { href: "/floor-share",     label: "Floor Share",     icon: PieChart },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="border-b px-6 py-5">
        <Image
          src="/drean-logo.png"
          alt="Drean"
          width={240}
          height={64}
          priority
          className="h-14 w-auto"
        />
        <p className="mt-2 text-xs text-muted-foreground">Marketing Management</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={{ pathname: item.href }}
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
