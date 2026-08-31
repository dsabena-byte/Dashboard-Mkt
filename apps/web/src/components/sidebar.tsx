"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Compass,
  Target,
  Layers,
  HeartPulse,
  TrendingUp,
  CircleDollarSign,
  Sparkles,
  Activity,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { isPathAllowed } from "@/lib/dashboard-access";
import { LogoutButton } from "@/components/auth/logout-button";
import { getTenant } from "@/lib/tenant/current";

const tenant = getTenant();

type Icon = ComponentType<{ className?: string }>;

type NavNode =
  | { type: "link"; href: string; label: string; icon?: Icon; dot?: string }
  | { type: "group"; id: string; label: string; icon?: Icon; dot?: string; children: NavNode[] }
  | { type: "divider" };

const TREE: NavNode[] = [
  { type: "link", href: "/mapa-estrategico", label: "Mapa Estratégico", icon: Compass },
  { type: "link", href: "/overview", label: "Objetivos Estratégicos", icon: Target },
  {
    type: "group",
    id: "planes",
    label: "Planes de Acción",
    icon: Layers,
    children: [
      {
        type: "group",
        id: "plan-medios",
        label: "Plan de Medios",
        dot: "#3b82f6",
        children: [
          { type: "link", href: "/performance", label: "Pauta Mkt" },
          { type: "link", href: "/performance-conversion", label: "Pauta Ecommerce" },
        ],
      },
      { type: "link", href: "/redes", label: "Redes Sociales", dot: "#14b8a6" },
      { type: "link", href: "/influencia", label: "Mkt de Influencia", dot: "#ec4899" },
      { type: "link", href: "/mkt-canal", label: "Mkt Canal Comercial", dot: "#f59e0b" },
      { type: "link", href: "/web", label: "Web / Ecommerce", dot: "#22c55e" },
      { type: "link", href: "/seo-search", label: "Optimización SEO", dot: "#eab308" },
      {
        type: "group",
        id: "trade",
        label: "Trade Mkt",
        dot: "#8b5cf6",
        children: [
          { type: "link", href: "/cuadros-basicos", label: "Cuadros Básicos" },
          { type: "link", href: "/floor-share", label: "Floor Share" },
        ],
      },
    ],
  },
  { type: "link", href: "/salud-marca", label: "Salud de Marca", icon: HeartPulse },
  { type: "link", href: "/mercado", label: "Análisis de Mercado", icon: TrendingUp },
  { type: "link", href: "/funnel", label: "Inversión de Marketing", icon: CircleDollarSign },
  { type: "divider" },
  { type: "link", href: "/contenido", label: "Generador de Contenido", icon: Sparkles },
  { type: "link", href: "/monitoreo", label: "Monitoreo conexiones", icon: Activity },
];

// Poda el árbol según los dashboards permitidos (link no permitido → fuera;
// grupo sin hijos permitidos → fuera).
function filterTree(nodes: NavNode[], allowed: string[] | null): NavNode[] {
  const out: NavNode[] = [];
  for (const n of nodes) {
    if (n.type === "divider") { out.push(n); continue; }
    if (n.type === "link") { if (isPathAllowed(n.href, allowed)) out.push(n); continue; }
    const children = filterTree(n.children, allowed);
    if (children.some((c) => c.type !== "divider")) out.push({ ...n, children });
  }
  return out;
}

// Ids de los grupos que son ancestros del path activo (para autoabrirlos).
function ancestorsOf(nodes: NavNode[], path: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.type === "link") { if (path === n.href || path.startsWith(`${n.href}/`)) return trail; }
    else if (n.type === "group") { const r = ancestorsOf(n.children, path, [...trail, n.id]); if (r) return r; }
  }
  return null;
}

export function Sidebar({ allowed = null }: { allowed?: string[] | null }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Grupos abiertos: Plan de Medios y Trade Mkt vienen abiertos (para que sus
  // dashboards internos se vean apenas se abre Planes de Acción). Planes de
  // Acción arranca cerrado; se abre si estás dentro de una de sus páginas.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set<string>(["plan-medios", "trade", ...(ancestorsOf(TREE, pathname) ?? [])]),
  );

  const tree = filterTree(TREE, allowed);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const toggle = (id: string) => setOpenIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Cerrar drawer al navegar; mantener abiertos los ancestros del activo.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    const anc = ancestorsOf(TREE, pathname);
    if (anc && anc.length) setOpenIds((prev) => { const n = new Set(prev); anc.forEach((id) => n.add(id)); return n; });
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }
  }, [drawerOpen]);

  // ---- renderers por nivel ----
  const renderLeaf3 = (n: Extract<NavNode, { type: "link" }>) => (
    <Link key={n.href} href={{ pathname: n.href }} className={`sn-l3 ${isActive(n.href) ? "active" : ""}`}>
      <span className="truncate">{n.label}</span>
    </Link>
  );

  const renderChild = (n: NavNode) => {
    if (n.type === "divider") return null;
    if (n.type === "link") {
      return (
        <Link key={n.href} href={{ pathname: n.href }} className={`sn-l2 ${isActive(n.href) ? "active" : ""}`}>
          {n.dot && <span className="sn-dot" style={{ background: n.dot }} />}
          <span className="truncate">{n.label}</span>
        </Link>
      );
    }
    const open = openIds.has(n.id);
    return (
      <div key={n.id}>
        <button type="button" onClick={() => toggle(n.id)} className="sn-l2 w-full">
          {n.dot && <span className="sn-dot" style={{ background: n.dot }} />}
          <span className="truncate">{n.label}</span>
          <ChevronRight className={`sn-cx2 ${open ? "open" : ""}`} />
        </button>
        {open && <div className="sn-l3wrap">{n.children.map((c) => (c.type === "link" ? renderLeaf3(c) : null))}</div>}
      </div>
    );
  };

  const renderTop = (n: NavNode, i: number) => {
    if (n.type === "divider") return <div key={`div-${i}`} className="sn-divider" />;
    if (n.type === "link") {
      const Ico = n.icon;
      return (
        <Link key={n.href} href={{ pathname: n.href }} className={`sn-item ${isActive(n.href) ? "active" : ""}`}>
          {Ico && <Ico className="sn-ic" />}
          <span className="truncate">{n.label}</span>
        </Link>
      );
    }
    const Ico = n.icon;
    const open = openIds.has(n.id);
    return (
      <div key={n.id}>
        <button type="button" onClick={() => toggle(n.id)} className="sn-item w-full">
          {Ico && <Ico className="sn-ic" />}
          <span className="truncate">{n.label}</span>
          <ChevronRight className={`sn-cx ${open ? "open" : ""}`} />
        </button>
        {open && <div className="sn-sub">{n.children.map(renderChild)}</div>}
      </div>
    );
  };

  const navContent = (
    <>
      <style>{`
        .sn{background:linear-gradient(180deg,#0c1a33,#0a1730);color:#aeb9cc}
        .sn-brand{padding:20px 20px 16px;border-bottom:1px solid #1c2c4a}
        .sn-tag{margin-top:8px;font-size:11.5px;font-weight:500;color:#8ea0bd;letter-spacing:.02em}
        .sn-nav{flex:1;overflow-y:auto;padding:12px 12px 8px;display:flex;flex-direction:column;gap:2px}
        .sn-nav::-webkit-scrollbar{width:0}
        .sn-item{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;color:#aeb9cc;font-size:13.5px;font-weight:500;cursor:pointer;position:relative;width:100%;background:none;border:0;text-align:left}
        .sn-item:hover{background:#ffffff0f;color:#e8edf6}
        .sn-item.active{background:#1d3a6e;color:#fff;font-weight:600}
        .sn-item.active::before{content:"";position:absolute;left:-12px;top:7px;bottom:7px;width:3px;border-radius:2px;background:#4f8cff}
        .sn-ic{width:17px;height:17px;flex:0 0 auto;opacity:.9}
        .sn-cx{margin-left:auto;width:15px;height:15px;transition:transform .15s;opacity:.7}
        .sn-cx.open{transform:rotate(90deg)}
        .sn-sub{display:flex;flex-direction:column;gap:1px;margin:2px 0 4px}
        .sn-l2{display:flex;align-items:center;gap:10px;padding:7px 11px 7px 14px;margin-left:20px;border-left:1px solid #1c2c4a;border-radius:0 8px 8px 0;color:#aeb9cc;font-size:12.5px;cursor:pointer;background:none;border-top:0;border-right:0;border-bottom:0;text-align:left}
        .sn-l2:hover{background:#ffffff0f;color:#e8edf6}
        .sn-l2.active{color:#fff;font-weight:600}
        .sn-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
        .sn-cx2{margin-left:auto;width:12px;height:12px;opacity:.6;transition:transform .15s}
        .sn-cx2.open{transform:rotate(90deg)}
        .sn-l3wrap{margin-left:40px;border-left:1px solid #1c2c4a;display:flex;flex-direction:column}
        .sn-l3{padding:6px 11px 6px 16px;color:#8ea0bd;font-size:12px;cursor:pointer}
        .sn-l3:hover{background:#ffffff0f;color:#e8edf6}
        .sn-l3.active{color:#fff;font-weight:600}
        .sn-divider{height:1px;background:#1c2c4a;margin:12px 11px}
        .sn-foot{border-top:1px solid #1c2c4a;padding:10px 12px}
        .sn-ver{padding:2px 12px 10px;font-size:10px;color:#5f6f8e}
      `}</style>
      <div className="sn-brand">
        <Image src="/drean-logo-white.png" alt={tenant.displayName} width={tenant.branding.logoWidth} height={tenant.branding.logoHeight} priority className="h-auto w-24" />
        <p className="sn-tag">{tenant.branding.tagline}</p>
      </div>
      <nav className="sn-nav">{tree.map(renderTop)}</nav>
      <div className="sn-foot"><LogoutButton /></div>
      <div className="sn-ver">v0.1.0 · Fase 1</div>
    </>
  );

  return (
    <>
      {/* Top bar móvil */}
      <div className="sticky top-0 z-30 flex w-full items-center gap-3 border-b bg-[#0c1a33] px-4 py-2 md:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-md p-2 text-slate-200 hover:bg-white/10" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
        <Image src="/drean-logo-white.png" alt={tenant.displayName} width={tenant.branding.logoWidth} height={tenant.branding.logoHeight} className="h-6 w-auto" />
      </div>

      {/* Sidebar desktop */}
      <aside className="sn sticky top-0 hidden h-screen w-64 shrink-0 flex-col md:flex">
        {navContent}
      </aside>

      {/* Drawer mobile */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setDrawerOpen(false)} />
          <aside className="sn fixed inset-y-0 left-0 z-50 flex w-64 flex-col shadow-xl md:hidden">
            <button type="button" onClick={() => setDrawerOpen(false)} className="absolute right-2 top-2 rounded-md p-1.5 text-slate-300 hover:bg-white/10" aria-label="Cerrar menú">
              <X className="h-4 w-4" />
            </button>
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
