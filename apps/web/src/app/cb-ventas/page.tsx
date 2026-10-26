import type { ReactNode } from "react";
import { DashTabBar } from "@/components/diagnostico/dash-tabs";
import { HowToRead } from "@/components/knowledge/how-to-read";
import CbVentasDashboard from "@/components/cb-ventas/dashboard";
import { EditarCatalogo, EditarClientes } from "@/components/cb-ventas/editar";
import { getCbVentasDatos, leerCatalogo, leerClientes, svc } from "@/lib/cb-ventas/server";
import { puedeEditarActual } from "@/lib/usuarios-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TABS = ["tablero", "analisis", "clientes", "catalogo"] as const;
type Tab = (typeof TABS)[number];

export default async function CbVentasPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const editor = await puedeEditarActual("trade");
  const pedido = typeof searchParams.tab === "string" ? searchParams.tab : "tablero";
  const tab: Tab = (TABS as readonly string[]).includes(pedido) && (editor || pedido === "tablero" || pedido === "analisis") ? (pedido as Tab) : "tablero";
  const items = [
    { key: "tablero", label: "Tablero", href: "/cb-ventas" },
    { key: "analisis", label: "Análisis", href: "/cb-ventas?tab=analisis" },
    ...(editor ? [
      { key: "clientes", label: "Clientes", href: "/cb-ventas?tab=clientes" },
      { key: "catalogo", label: "Cuadro básico y homólogos", href: "/cb-ventas?tab=catalogo" },
    ] : []),
  ];

  let contenido: ReactNode;
  const datos = await getCbVentasDatos();
  if (datos.estado !== "ok") {
    contenido = <div className="rounded-lg border bg-white p-6 text-sm text-slate-600">{datos.mensaje}</div>;
  } else if (tab === "clientes" || tab === "catalogo") {
    const s = svc();
    contenido = tab === "clientes"
      ? <EditarClientes clientes={await leerClientes(s)} />
      : <EditarCatalogo catalogo={await leerCatalogo(s)} clientes={(await leerClientes(s)).map((c) => ({ cliente: c.cliente, tipologia: c.tipologia }))} />;
  } else {
    const user = datos.alcance.vendedor
      ? { email: "", nombre: "", rol: "vendedor" as const, vendedor: datos.alcance.vendedor }
      : undefined;
    contenido = (
      <CbVentasDashboard
        cuadroBasico={datos.cuadroBasico}
        clasificacion={datos.clasificacion}
        ventas={datos.ventas}
        user={user}
        vista={tab === "analisis" ? "analisis" : "dashboard"}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CB Ventas · Cumplimiento del Cuadro Básico</h1>
        <p className="text-sm text-muted-foreground">
          Qué modelos de su cuadro básico compró cada cliente (facturas y pedidos pendientes). Objetivo 80%.
          {datos.estado === "ok" && datos.alcance.vendedor ? ` Ves solo los clientes de ${datos.alcance.vendedor}.` : ""}
          {datos.estado === "ok" && !datos.alcance.vendedor && datos.alcance.gerencia ? ` Ves solo la gerencia ${datos.alcance.gerencia}.` : ""}
        </p>
      </div>
      <HowToRead slug="cb-ventas" />
      <DashTabBar items={items} active={tab} />
      {contenido}
    </div>
  );
}
