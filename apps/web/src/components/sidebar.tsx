"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  GitBranch,
  Target,
  BarChart3,
  Share2,
  Globe,
  Megaphone,
  Store,
  LayoutGrid,
  PieChart,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";

const NAV = [
  { href: "/overview",    label: "Objetivos Marketing", icon: LayoutDashboard },
  { href: "/funnel",      label: "BGT Inversión",       icon: GitBranch },
  { href: "/planning",    label: "Planning Pauta",   icon: Target },
  { href: "/performance", label: "Performance Pauta", icon: BarChart3 },
  { href: "/influencia",  label: "Mkt de Influencia", icon: Megaphone },
  { href: "/web",         label: "Análisis Web",     icon: Globe },
  { href: "/redes",       label: "Análisis Redes",   icon: Share2 },
  { href: "/mkt-canal",   label: "Mkt de Canal",     icon: Store },
  { href: "/cuadros-basicos", label: "Cuadros Básicos", icon: LayoutGrid },
  { href: "/floor-share",     label: "Floor Share",     icon: PieChart },
  { href: "/mercado",         label: "Análisis de Mercado", icon: TrendingUp },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cerrar drawer al navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock scroll cuando el drawer está abierto en mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const navContent = (
    <>
      <div className="border-b px-4 py-4">
        <Image
          src="/drean-logo.png"
          alt="Drean"
          width={1239}
          height={387}
          priority
          className="w-3/5 h-auto"
        />
        <p className="mt-2 text-xs text-muted-foreground">Marketing Management</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={{ pathname: item.href }}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <LogoutButton />
      </div>
      <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">
        v0.1.0 · Fase 1
      </div>
    </>
  );

  return (
    <>
      {/* Top bar móvil con hamburguesa — full width arriba del contenido */}
      <div className="sticky top-0 z-30 flex w-full items-center gap-3 border-b bg-card px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 hover:bg-secondary"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Image src="/drean-logo.png" alt="Drean" width={120} height={38} className="h-7 w-auto" />
      </div>

      {/* Sidebar desktop (md+) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        {navContent}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card shadow-xl md:hidden">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded-md p-1.5 hover:bg-secondary"
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </button>
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
