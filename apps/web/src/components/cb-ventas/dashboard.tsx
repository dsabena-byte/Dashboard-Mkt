// Port de cuadros-basicos/components/Dashboard.tsx (/ventas). Mismos cálculos; sin login/menú de usuario propio
// (Drean maneja usuarios) y con las pestañas en el renglón estándar de la página.
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LabelList, Legend, LineChart, Line, ReferenceLine,
} from "recharts";
import {
  AlertTriangle, Trophy, Building2, BarChart3, ChevronUp, ChevronDown, Minus,
  RotateCcw, FileText, CheckCircle2, Clock, XCircle, TrendingUp,
} from "lucide-react";
import type {
  CuadroBasicoItem, ClasificacionCliente, VentaRow, VentasFile, Tipologia,
} from "@/lib/cb-ventas/types";
import { matchesCB } from "@/lib/cb-ventas/match";
import {
  calcularPorcentajes as calcPorcentajes,
  evolucionMensualCB,
  filtrarCompras,
  mesEnCursoDe,
  type VentanaCtx,
} from "@/lib/cb-ventas/metrics";
import { KpiObjCard } from "@/components/trade/kpi-obj-card";
import { hoyAR, vigenteEnFecha, vigenteEnMes } from "@/lib/cb-ventas/vigencia";
import { AnalisisCB, type AnalisisData, type SegAnalisis } from "./analisis";

const OBJETIVO = 80;

const MESES = [
  { num: 1, label: "Enero" }, { num: 2, label: "Febrero" }, { num: 3, label: "Marzo" },
  { num: 4, label: "Abril" }, { num: 5, label: "Mayo" }, { num: 6, label: "Junio" },
  { num: 7, label: "Julio" }, { num: 8, label: "Agosto" }, { num: 9, label: "Septiembre" },
  { num: 10, label: "Octubre" }, { num: 11, label: "Noviembre" }, { num: 12, label: "Diciembre" },
];

const formatFecha = (f?: string | null) => {
  if (!f) return "—";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y!.slice(2)}`;
};

const getEstado = (fc: number, bo: number) =>
  fc > 0 ? "FACTURADO" : bo > 0 ? "BACKORDER" : "PENDIENTE";

type Props = {
  cuadroBasico: CuadroBasicoItem[];
  clasificacion: ClasificacionCliente[];
  ventas: VentasFile;
  user?: {
    email: string;
    nombre: string;
    rol: "all" | "vendedor";
    vendedor: string;
  };
  /** Pestaña del renglón único (Tablero | Análisis), la elige la página por ?tab=. */
  vista: "dashboard" | "analisis";
};

type Filters = {
  mes: string[];
  categoria: string;
  gerente: string;
  vendedor: string;
  tipologia: string[];
  cliente: string;
};

export default function CbVentasDashboard({ cuadroBasico: cuadroBasicoTodo, clasificacion, ventas, user, vista }: Props) {
  const isVendedor = user?.rol === "vendedor";
  const lockedVendedor = isVendedor ? user!.vendedor : null;
  const vendedorPorCliente = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clasificacion) m.set(c.cliente, c.vendedor);
    return m;
  }, [clasificacion]);

  const gerentePorVendedor = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clasificacion) m.set(c.vendedor, c.gerente);
    return m;
  }, [clasificacion]);

  const VENDEDORES = useMemo(
    () => [...new Set(clasificacion.map((c) => c.vendedor))],
    [clasificacion],
  );
  const GERENTES = useMemo(
    () => [...new Set(clasificacion.map((c) => c.gerente))],
    [clasificacion],
  );
  const [filters, setFilters] = useState<Filters>({
    mes: [],
    categoria: "TODAS",
    gerente: "TODOS",
    vendedor: lockedVendedor ?? "TODOS",
    tipologia: [],
    cliente: "TODOS",
  });

  // Vigencia (0140): el cuadro básico "de ahora" = el que vale hoy, o el del último mes elegido en el filtro de MES.
  // La evolución mensual recibe toda la historia y usa en cada mes lo que valía en ese mes.
  const cuadroBasico = useMemo(() => {
    if (!filters.mes.length) { const hoy = hoyAR(); return cuadroBasicoTodo.filter((i) => vigenteEnFecha(i, hoy)); }
    const anio = new Date(ventas.generatedAt).getFullYear();
    const mes = Math.max(...filters.mes.map(Number));
    return cuadroBasicoTodo.filter((i) => vigenteEnMes(i, anio, mes));
  }, [cuadroBasicoTodo, filters.mes, ventas.generatedAt]);
  const CLIENTES_UNICOS = useMemo(
    () => [...new Set(cuadroBasico.map((c) => c.cliente))],
    [cuadroBasico],
  );

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const next = { ...filters, [key]: value };
    // Cuando cambia un filtro upstream, los downstream se resetean para que
    // no queden valores que ya no existen en el subconjunto filtrado.
    if (key === "gerente") {
      next.vendedor = "TODOS";
      next.tipologia = [];
      next.cliente = "TODOS";
    }
    if (key === "vendedor") {
      next.tipologia = [];
      next.cliente = "TODOS";
    }
    if (key === "tipologia") next.cliente = "TODOS";
    setFilters(next);
  };
  const limpiarFiltros = () =>
    setFilters({
      mes: [],
      categoria: "TODAS",
      gerente: "TODOS",
      vendedor: lockedVendedor ?? "TODOS",
      tipologia: [],
      cliente: "TODOS",
    });

  const tipologiaPorCliente = useMemo(() => {
    const m = new Map<string, Tipologia>();
    for (const c of cuadroBasico) m.set(c.cliente, c.tipologia);
    return m;
  }, [cuadroBasico]);

  const vendedoresDisponibles = useMemo(
    () => filters.gerente === "TODOS"
      ? VENDEDORES
      : VENDEDORES.filter((v) => gerentePorVendedor.get(v) === filters.gerente),
    [filters.gerente, VENDEDORES, gerentePorVendedor],
  );

  // Clientes "en alcance" según Gerente y Vendedor (independiente de Tipología
  // y Cliente). Sirve de base para los dropdowns de Tipología y Cliente.
  const clientesEnAlcance = useMemo(
    () => CLIENTES_UNICOS.filter((cli) => {
      const v = vendedorPorCliente.get(cli);
      if (filters.gerente !== "TODOS" && (v ? gerentePorVendedor.get(v) : undefined) !== filters.gerente) return false;
      if (filters.vendedor !== "TODOS" && v !== filters.vendedor) return false;
      return true;
    }),
    [CLIENTES_UNICOS, vendedorPorCliente, gerentePorVendedor, filters.gerente, filters.vendedor],
  );

  const tipologiasDisponibles = useMemo(
    () => {
      const tipos = new Set<Tipologia>();
      for (const cli of clientesEnAlcance) {
        const t = tipologiaPorCliente.get(cli);
        if (t) tipos.add(t);
      }
      return [...tipos];
    },
    [clientesEnAlcance, tipologiaPorCliente],
  );

  const clientesDisponibles = useMemo(
    () => clientesEnAlcance.filter((cli) => {
      if (filters.tipologia.length > 0 && !filters.tipologia.includes(tipologiaPorCliente.get(cli) ?? "")) return false;
      return true;
    }),
    [clientesEnAlcance, tipologiaPorCliente, filters.tipologia],
  );

  // FC y BO se filtran por mes con semánticas distintas (ver filtrarCompras en
  // lib/sellin-metrics.ts): FC por mes exacto, BO acumulado hasta el último mes.
  const comprasFiltradas = useMemo(
    () =>
      filtrarCompras(ventas.rows, {
        meses: filters.mes.map(Number),
        vendedor: filters.vendedor !== "TODOS" ? filters.vendedor : null,
        vendedorPorCliente,
      }),
    [ventas.rows, filters.mes, filters.vendedor, vendedorPorCliente],
  );

  const pasaFiltros = (item: CuadroBasicoItem) => {
    if (filters.categoria !== "TODAS" && item.categoria !== filters.categoria) return false;
    if (filters.tipologia.length > 0 && !filters.tipologia.includes(item.tipologia)) return false;
    if (filters.cliente !== "TODOS" && item.cliente !== filters.cliente) return false;
    const v = vendedorPorCliente.get(item.cliente);
    if (filters.vendedor !== "TODOS" && v !== filters.vendedor) return false;
    if (filters.gerente !== "TODOS" && (v ? gerentePorVendedor.get(v) : undefined) !== filters.gerente) return false;
    return true;
  };
  const cbFiltrado = useMemo(
    () => cuadroBasico.filter(pasaFiltros),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuadroBasico, filters, vendedorPorCliente, gerentePorVendedor],
  );
  // Mismos filtros sobre TODA la historia: solo para la evolución mensual (cada mes toma lo que valía en ese mes).
  const cbFiltradoTodo = useMemo(
    () => cuadroBasicoTodo.filter(pasaFiltros),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuadroBasicoTodo, filters, vendedorPorCliente, gerentePorVendedor],
  );

  // Ventana de FACTURACIÓN a MES CERRADO por tipología y criterio de "cumplido":
  // ambos viven en lib/sellin-metrics.ts para que el copiloto de datos
  // (/api/chat) calcule con las mismas fórmulas que esta pantalla.
  // Si hay filtro de MES activo, manda el filtro (comprasFiltradas ya lo acotó).
  const ventanaCtx: VentanaCtx = {
    hayFiltroMes: filters.mes.length > 0,
    mesEnCurso: mesEnCursoDe(ventas.generatedAt),
  };

  const calcularPorcentajes = (items: CuadroBasicoItem[]) =>
    calcPorcentajes(items, comprasFiltradas, ventanaCtx);

  const cumplPorVendedor = useMemo(() => {
    const vs = [...new Set(cbFiltrado.map((c) => vendedorPorCliente.get(c.cliente)).filter(Boolean) as string[])];
    return vs
      .map((v) => {
        const itemsVend = cbFiltrado.filter((c) => vendedorPorCliente.get(c.cliente) === v);
        return { nombre: v, gerente: gerentePorVendedor.get(v) ?? "", ...calcularPorcentajes(itemsVend) };
      })
      .sort((a, b) => b.pctCB - a.pctCB);
  }, [cbFiltrado, comprasFiltradas]);

  const cumplPorCliente = useMemo(() => {
    const cs = [...new Set(cbFiltrado.map((c) => c.cliente))];
    return cs
      .map((cli) => {
        const itemsCli = cbFiltrado.filter((c) => c.cliente === cli);
        return {
          nombre: cli,
          tipologia: itemsCli[0]?.tipologia,
          vendedor: vendedorPorCliente.get(cli) ?? "",
          ...calcularPorcentajes(itemsCli),
        };
      })
      .sort((a, b) => b.pctCB - a.pctCB);
  }, [cbFiltrado, comprasFiltradas]);

  const cumplPorCategoria = useMemo(() => {
    const cats: Array<"LAVADO" | "REFRIGERACION" | "COCCION"> = [
      "LAVADO", "REFRIGERACION", "COCCION",
    ];
    return cats.map((cat) => {
      const items = cbFiltrado.filter((c) => c.categoria === cat);
      const p = calcularPorcentajes(items);
      return { categoria: cat, "% CB": p.pctCB, "% Infaltables": p.pctInf, "% Estratégico": p.pctEst };
    });
  }, [cbFiltrado, comprasFiltradas]);

  const cumplPorGerencia = useMemo(() => {
    const byGerencia = new Map<string, CuadroBasicoItem[]>();
    for (const item of cbFiltrado) {
      const v = vendedorPorCliente.get(item.cliente);
      const g = v ? gerentePorVendedor.get(v) : undefined;
      if (!g) continue;
      const arr = byGerencia.get(g) ?? [];
      arr.push(item);
      byGerencia.set(g, arr);
    }
    return Array.from(byGerencia.entries())
      .map(([gerencia, items]) => {
        const p = calcularPorcentajes(items);
        return { gerencia, "% CB": p.pctCB, "% Infaltables": p.pctInf, "% Estratégico": p.pctEst };
      })
      .sort((a, b) => b["% CB"] - a["% CB"]);
  }, [cbFiltrado, comprasFiltradas, vendedorPorCliente, gerentePorVendedor]);

  const cumplPorTipologia = useMemo(() => {
    const byTipologia = new Map<string, CuadroBasicoItem[]>();
    for (const item of cbFiltrado) {
      const arr = byTipologia.get(item.tipologia) ?? [];
      arr.push(item);
      byTipologia.set(item.tipologia, arr);
    }
    // Orden fijo (más amigable visualmente que sort por %).
    const order: Array<string> = ["TOP 10", "HIPERMERCADOS", "GRANDES CUENTAS RESTO", "SMALL RETAILERS"];
    const labelMap: Record<string, string> = {
      "TOP 10": "Top 10",
      "HIPERMERCADOS": "Hipermercados",
      "GRANDES CUENTAS RESTO": "Grandes Cuentas Resto",
      "SMALL RETAILERS": "Small Retailers",
    };
    return Array.from(byTipologia.entries())
      .map(([tipologia, items]) => {
        const p = calcularPorcentajes(items);
        return { tipologia: labelMap[tipologia] ?? tipologia, _key: tipologia, "% CB": p.pctCB, "% Infaltables": p.pctInf, "% Estratégico": p.pctEst };
      })
      .sort((a, b) => order.indexOf(a._key) - order.indexOf(b._key));
  }, [cbFiltrado, comprasFiltradas]);

  // Serie del gráfico "Evolución mensual". La fórmula vive en
  // lib/sellin-metrics.ts para que el copiloto grafique exactamente lo mismo.
  const evolucionMensual = useMemo(
    () =>
      evolucionMensualCB(cbFiltradoTodo, ventas.rows, {
        generatedAt: ventas.generatedAt,
        vendedor: filters.vendedor !== "TODOS" ? filters.vendedor : null,
        vendedorPorCliente,
      }).map((p) => ({
        mes: p.mesLabel.slice(0, 3),
        "% CB": p.pctCB,
        "% Infaltables": p.pctInf,
        "% Estratégico": p.pctEst,
      })),
    [cbFiltradoTodo, filters.vendedor, ventas, vendedorPorCliente],
  );

  const kpisGlobales = useMemo(() => {
    const p = calcularPorcentajes(cbFiltrado);
    return {
      ...p,
      cantClientes: [...new Set(cbFiltrado.map((c) => c.cliente))].length,
      cantVendedores: [...new Set(cbFiltrado.map((c) => vendedorPorCliente.get(c.cliente)).filter(Boolean))].length,
    };
  }, [cbFiltrado, comprasFiltradas, vendedorPorCliente]);

  // Datos para el tab "Análisis": brecha al 80% + SKUs a recuperar por segmento
  // (la palanca accionable = cuántos cumplimientos faltan en cada segmento para
  // que llegue al objetivo). Respeta los filtros activos.
  const analisisData = useMemo<AnalisisData>(() => {
    const faltan80 = (total: number, cumpl: number) => Math.max(0, Math.ceil(0.8 * total) - cumpl);
    const skuList = (its: CuadroBasicoItem[]) => its.map((i) => ({ sku: i.sku, cliente: i.cliente, categoria: i.categoria, tipo: i.tipo }));
    const seg = (nombre: string, items: CuadroBasicoItem[], extra?: string): SegAnalisis => {
      const p = calcularPorcentajes(items);
      return { nombre, pctCB: p.pctCB, pctInf: p.pctInf, pctEst: p.pctEst, totalCB: p.totalCB, cumplidosCB: p.cumplidosCB, faltan80: faltan80(p.totalCB, p.cumplidosCB), extra, skusFaltantes: skuList(p.itemsFaltantes) };
    };

    // % de cumplimiento por categoría de producto (CB · Inf · Est) de un set de items.
    const catBreak: [string, string][] = [["LAVADO", "Lavado"], ["REFRIGERACION", "Refri"], ["COCCION", "Cocción"]];
    const porCatDe = (items: CuadroBasicoItem[]) =>
      catBreak
        .map(([c, lbl]) => {
          const its = items.filter((i) => i.categoria === c);
          if (its.length === 0) return null;
          const p = calcularPorcentajes(its);
          return { categoria: lbl, pctCB: p.pctCB, pctInf: p.pctInf, pctEst: p.pctEst };
        })
        .filter((x): x is { categoria: string; pctCB: number; pctInf: number; pctEst: number } => x != null);
    const itemsPorCliente = new Map<string, CuadroBasicoItem[]>();
    const itemsPorVendedor = new Map<string, CuadroBasicoItem[]>();
    for (const it of cbFiltrado) {
      (itemsPorCliente.get(it.cliente) ?? itemsPorCliente.set(it.cliente, []).get(it.cliente)!).push(it);
      const v = vendedorPorCliente.get(it.cliente);
      if (v) (itemsPorVendedor.get(v) ?? itemsPorVendedor.set(v, []).get(v)!).push(it);
    }

    const catLabel: Record<string, string> = { LAVADO: "Lavado", REFRIGERACION: "Refrigeración", COCCION: "Cocción" };
    const categoria = ["LAVADO", "REFRIGERACION", "COCCION"]
      .map((c) => seg(catLabel[c]!, cbFiltrado.filter((i) => i.categoria === c)))
      .filter((s) => s.totalCB > 0);

    const tipMap = new Map<string, CuadroBasicoItem[]>();
    for (const it of cbFiltrado) {
      const t = tipologiaPorCliente.get(it.cliente);
      if (!t) continue;
      (tipMap.get(t) ?? tipMap.set(t, []).get(t)!).push(it);
    }
    const tipLabel: Record<string, string> = { "TOP 10": "Top 10", "GRANDES CUENTAS RESTO": "Grandes Cuentas Resto", HIPERMERCADOS: "Hipermercados", "SMALL RETAILERS": "Small Retailers" };

    // Hijos por tipología = clientes de esa tipología que arrastran el indicador.
    const clientesPorTip = new Map<string, { nombre: string; pctCB: number; pctInf: number; pctEst: number; faltan: number }[]>();
    for (const c of cumplPorCliente) {
      const t = tipologiaPorCliente.get(c.nombre);
      const faltan = c.totalCB - c.cumplidosCB;
      if (!t || c.pctCB >= OBJETIVO || faltan <= 0) continue;
      (clientesPorTip.get(t) ?? clientesPorTip.set(t, []).get(t)!).push({ nombre: c.nombre, pctCB: c.pctCB, pctInf: c.pctInf, pctEst: c.pctEst, faltan });
    }
    for (const arr of clientesPorTip.values()) arr.sort((a, b) => b.faltan - a.faltan);
    const tipologia = [...tipMap.entries()].map(([t, items]) => ({ ...seg(tipLabel[t] ?? t, items), hijos: (clientesPorTip.get(t) ?? []).slice(0, 12).map((h) => ({ ...h, porCat: porCatDe(itemsPorCliente.get(h.nombre) ?? []) })) }));

    const gerMap = new Map<string, CuadroBasicoItem[]>();
    for (const it of cbFiltrado) {
      const v = vendedorPorCliente.get(it.cliente);
      const g = v ? gerentePorVendedor.get(v) : undefined;
      if (!g) continue;
      (gerMap.get(g) ?? gerMap.set(g, []).get(g)!).push(it);
    }
    // Hijos por gerencia = vendedores de esa gerencia que arrastran el indicador.
    const vendedoresPorGer = new Map<string, { nombre: string; pctCB: number; pctInf: number; pctEst: number; faltan: number }[]>();
    for (const v of cumplPorVendedor) {
      const faltan = v.totalCB - v.cumplidosCB;
      if (v.pctCB >= OBJETIVO || faltan <= 0) continue;
      (vendedoresPorGer.get(v.gerente) ?? vendedoresPorGer.set(v.gerente, []).get(v.gerente)!).push({ nombre: v.nombre, pctCB: v.pctCB, pctInf: v.pctInf, pctEst: v.pctEst, faltan });
    }
    for (const arr of vendedoresPorGer.values()) arr.sort((a, b) => b.faltan - a.faltan);
    const gerencia = [...gerMap.entries()].map(([g, items]) => ({ ...seg(g, items), hijos: (vendedoresPorGer.get(g) ?? []).slice(0, 12).map((h) => ({ ...h, porCat: porCatDe(itemsPorVendedor.get(h.nombre) ?? []) })) }));

    const vendedor: SegAnalisis[] = cumplPorVendedor.map((v) => ({ nombre: v.nombre, pctCB: v.pctCB, pctInf: v.pctInf, pctEst: v.pctEst, totalCB: v.totalCB, cumplidosCB: v.cumplidosCB, faltan80: faltan80(v.totalCB, v.cumplidosCB), extra: v.gerente, skusFaltantes: skuList(v.itemsFaltantes) }));
    const cliente: SegAnalisis[] = cumplPorCliente.map((c) => ({ nombre: c.nombre, pctCB: c.pctCB, pctInf: c.pctInf, pctEst: c.pctEst, totalCB: c.totalCB, cumplidosCB: c.cumplidosCB, faltan80: faltan80(c.totalCB, c.cumplidosCB), extra: c.vendedor, skusFaltantes: skuList(c.itemsFaltantes) }));

    const puntos = evolucionMensual.map((e) => ({ mes: String(e.mes), pctCB: Number((e as Record<string, unknown>)["% CB"]) }));
    const ultimo = puntos.length ? puntos[puntos.length - 1]!.pctCB : null;
    const primero = puntos.length ? puntos[0]!.pctCB : null;
    const prev = puntos.length > 1 ? puntos[puntos.length - 2]!.pctCB : null;

    return {
      global: { pctCB: kpisGlobales.pctCB, totalCB: kpisGlobales.totalCB, cumplidosCB: kpisGlobales.cumplidosCB, brechaPp: kpisGlobales.pctCB - OBJETIVO, faltan80: faltan80(kpisGlobales.totalCB, kpisGlobales.cumplidosCB) },
      evolucion: {
        puntos, ultimo, primero,
        primerMes: puntos.length ? puntos[0]!.mes : null,
        deltaMes: ultimo != null && prev != null ? ultimo - prev : null,
        deltaDesdeInicio: ultimo != null && primero != null ? ultimo - primero : null,
      },
      dims: { categoria, tipologia, gerencia, vendedor, cliente },
    };
  }, [cbFiltrado, comprasFiltradas, cumplPorVendedor, cumplPorCliente, evolucionMensual, kpisGlobales, tipologiaPorCliente, vendedorPorCliente, gerentePorVendedor]);

  // Una fila por (sku, tipo). Para cada SKU agregamos a través de todos
  // los clientes filtrados: unidades FC, BO, y % cumplimiento (clientes
  // con al menos 1 unidad / clientes que tienen el SKU en su CB).
  type FilaSKU = {
    sku: string;        // primary (Modelo)
    skus: string[];     // primary + homólogos deduplicados (todos los SKUs involucrados)
    fobSkus: string[];  // SKUs de `skus` que tuvieron al menos una compra FOB
    categoria: string;
    tipo: "INFALTABLE" | "ESTRATEGICO";
    clientesEnCB: number;
    clientesCumplidos: number;
    fcUnits: number;
    boUnits: number;
    pct: number;
  };
  const skusDetalle = useMemo<FilaSKU[]>(() => {
    type Acc = FilaSKU & {
      _declared: Set<string>;       // primary + homólogos declarados en el CB
      _unitsBySku: Map<string, number>; // unidades reales (FC+BO) por SKU
      _fobBySku: Set<string>;       // SKUs con al menos una compra canal=FOB
    };
    const byKey = new Map<string, Acc>();
    for (const item of cbFiltrado) {
      const key = `${item.sku}|${item.tipo}`;
      let row = byKey.get(key);
      if (!row) {
        row = {
          sku: item.sku,
          skus: [],
          fobSkus: [],
          _declared: new Set<string>([item.sku]),
          _unitsBySku: new Map<string, number>(),
          _fobBySku: new Set<string>(),
          categoria: item.categoria,
          tipo: item.tipo,
          clientesEnCB: 0,
          clientesCumplidos: 0,
          fcUnits: 0,
          boUnits: 0,
          pct: 0,
        };
        byKey.set(key, row);
      }
      for (const a of item.skuAliases ?? []) row._declared.add(a);
      row.clientesEnCB += 1;
      const compras = comprasFiltradas.filter((c) => matchesCB(c, item));
      const fc = compras.filter((c) => c.tipo === "FC").reduce((a, c) => a + c.unidades, 0);
      const bo = compras.filter((c) => c.tipo === "BO").reduce((a, c) => a + c.unidades, 0);
      row.fcUnits += fc;
      row.boUnits += bo;
      if (fc + bo > 0) row.clientesCumplidos += 1;
      for (const c of compras) {
        row._unitsBySku.set(c.sku, (row._unitsBySku.get(c.sku) ?? 0) + c.unidades);
        if (c.canal === "FOB") row._fobBySku.add(c.sku);
      }
    }
    return [...byKey.values()]
      .map(({ _declared, _unitsBySku, _fobBySku, ...r }) => {
        // Mostramos el primary siempre + solo los homólogos que tuvieron
        // facturación o back order. Si el primary no tuvo ventas pero los
        // homólogos sí, queda el primary como referencia del target del CB.
        const aliasesConVentas = [..._declared]
          .filter((s) => s !== r.sku && (_unitsBySku.get(s) ?? 0) > 0)
          .sort();
        const skus = [r.sku, ...aliasesConVentas];
        return {
          ...r,
          skus,
          fobSkus: skus.filter((s) => _fobBySku.has(s)),
          pct: r.clientesEnCB > 0 ? Math.round((r.clientesCumplidos / r.clientesEnCB) * 100) : 0,
        };
      })
      .sort((a, b) => {
        // Infaltables primero, después por categoría, después alfabético por SKU
        if (a.tipo !== b.tipo) return a.tipo === "INFALTABLE" ? -1 : 1;
        if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
        return a.sku.localeCompare(b.sku);
      });
  }, [cbFiltrado, comprasFiltradas]);

  // Map<sku, Set<cliente>>: por cada SKU, los clientes (filtrados) que lo
  // tienen en su CB. La usa TablaSKUs para construir el breakdown FC por
  // fecha cuando el usuario expande una fila.
  const cbClientesPorSku = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const item of cbFiltrado) {
      const s = m.get(item.sku) ?? new Set<string>();
      s.add(item.cliente);
      m.set(item.sku, s);
    }
    return m;
  }, [cbFiltrado]);

  const detalleSKUs = useMemo(() => {
    if (!clienteSeleccionado) return [];
    return cbFiltrado
      .filter((c) => c.cliente === clienteSeleccionado)
      .map((item) => {
        const compras = comprasFiltradas.filter((c) => matchesCB(c, item));
        const fc = compras.filter((c) => c.tipo === "FC").reduce((a, c) => a + c.unidades, 0);
        const bo = compras.filter((c) => c.tipo === "BO").reduce((a, c) => a + c.unidades, 0);
        const ult = compras.map((c) => c.fecha).sort().pop();
        return { ...item, fcUnits: fc, boUnits: bo, estado: getEstado(fc, bo), ultimaActualizacion: ult };
      });
  }, [clienteSeleccionado, cbFiltrado, comprasFiltradas]);

  const filtrosActivos =
    (filters.mes.length > 0 ? 1 : 0) +
    (filters.categoria !== "TODAS" ? 1 : 0) +
    (filters.gerente !== "TODOS" ? 1 : 0) +
    (filters.vendedor !== "TODOS" ? 1 : 0) +
    (filters.tipologia.length > 0 ? 1 : 0) +
    (filters.cliente !== "TODOS" ? 1 : 0);

  return (
    <div className="bg-slate-50 rounded-lg">
      <p className="px-1 pb-2 text-xs text-slate-500">
        Última carga de ventas: {ventas.source === "dummy" ? "todavía no llegó ninguna" : new Date(ventas.generatedAt).toLocaleString("es-AR")} · Objetivo: {OBJETIVO}%
      </p>
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-wrap gap-2 items-end">
            <MultiSelectDropdown
              label="MES"
              values={filters.mes}
              onChange={(v) => updateFilter("mes", v)}
              options={MESES.map((m) => ({ v: String(m.num), l: m.label }))}
              placeholder="Todos"
            />
            <FilterDropdown label="CATEGORÍA" value={filters.categoria} onChange={(v) => updateFilter("categoria", v)} options={[
              { v: "TODAS", l: "Todas" }, { v: "LAVADO", l: "Lavado" },
              { v: "REFRIGERACION", l: "Refrigeración" }, { v: "COCCION", l: "Cocción" },
            ]} />
            {!isVendedor && (
              <FilterDropdown label="GERENTE" value={filters.gerente} onChange={(v) => updateFilter("gerente", v)} options={[{ v: "TODOS", l: "Todos" }, ...GERENTES.map((g) => ({ v: g, l: g }))]} />
            )}
            <FilterDropdown
              label="VENDEDOR"
              value={filters.vendedor}
              onChange={(v) => updateFilter("vendedor", v)}
              options={[{ v: "TODOS", l: "Todos" }, ...vendedoresDisponibles.map((v) => ({ v, l: v }))]}
              disabled={isVendedor}
            />
            <MultiSelectDropdown
              label="TIPOLOGÍA"
              values={filters.tipologia}
              onChange={(v) => updateFilter("tipologia", v)}
              options={[
                { v: "TOP 10", l: "Grandes Cuentas Top 10" },
                { v: "GRANDES CUENTAS RESTO", l: "Grandes Cuentas Resto" },
                { v: "HIPERMERCADOS", l: "Hipermercados" },
                { v: "SMALL RETAILERS", l: "Small Retailers" },
              ].filter((o) => tipologiasDisponibles.includes(o.v as Tipologia))}
              placeholder="Todas"
            />
            <FilterDropdown label="CLIENTE" value={filters.cliente} onChange={(v) => updateFilter("cliente", v)} options={[{ v: "TODOS", l: "Todos" }, ...clientesDisponibles.slice().sort().map((c) => ({ v: c, l: c }))]} wide />
            <button onClick={limpiarFiltros} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Limpiar
            </button>
          </div>
          {filtrosActivos > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              {filtrosActivos} {filtrosActivos === 1 ? "filtro activo" : "filtros activos"} ·{" "}
              {kpisGlobales.cantClientes} {kpisGlobales.cantClientes === 1 ? "cliente" : "clientes"}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {kpisGlobales.totalCB === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="text-slate-900 font-semibold mb-1">Sin resultados</h3>
            <p className="text-slate-500 text-sm">Probá ajustar los filtros o limpiar para ver todos los datos.</p>
          </div>
        ) : (
          <>
            {vista === "analisis" ? (
              <AnalisisCB analisis={analisisData} />
            ) : (
            <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Mismo card que /cuadros-basicos y /floor-share (KpiObjCard: semáforo solo para el estado). */}
              <KpiObjCard title="Cuadro Básico" medida="% de modelos del CB comprados" value={kpisGlobales.pctCB} obj={OBJETIVO} decimals={0} contexto={`${kpisGlobales.cumplidosCB} / ${kpisGlobales.totalCB} SKUs`} />
              <KpiObjCard title="Infaltables" medida="% de infaltables comprados" value={kpisGlobales.pctInf} obj={OBJETIVO} decimals={0} contexto={`${kpisGlobales.cumplidosInf} / ${kpisGlobales.totalInf} SKUs`} />
              <KpiObjCard title="Estratégico" medida="% de estratégicos comprados" value={kpisGlobales.pctEst} obj={OBJETIVO} decimals={0} contexto={`${kpisGlobales.cumplidosEst} / ${kpisGlobales.totalEst} SKUs`} />
              <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clientes</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/70">Según filtros aplicados</div>
                <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{kpisGlobales.cantClientes}</div>
                <div className="mt-3 flex items-center justify-between border-t pt-2 text-[11px]">
                  <span className="text-muted-foreground">Vendedores</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold tabular-nums text-foreground">{kpisGlobales.cantVendedores}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Panel title="Evolución mensual" icon={<TrendingUp className="w-4 h-4 text-pink-600" />}>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={evolucionMensual} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} />
                    <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <ReferenceLine y={OBJETIVO} stroke="#e63946" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Obj ${OBJETIVO}%`, position: "insideTopRight", fill: "#e63946", fontSize: 11, fontWeight: 600 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="% CB" stroke="#2542C2" strokeWidth={2.5} dot={{ r: 4, fill: "#2542C2" }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="% Infaltables" stroke="#A855F7" strokeWidth={2.5} dot={{ r: 4, fill: "#A855F7" }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="% Estratégico" stroke="#EC4899" strokeWidth={2.5} dot={{ r: 4, fill: "#EC4899" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Cumplimiento por Categoría" icon={<BarChart3 className="w-4 h-4 text-blue-600" />}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={cumplPorCategoria} margin={{ top: 30, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="categoria" tick={{ fontSize: 12, fill: "#64748b" }} />
                    <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <ReferenceLine y={OBJETIVO} stroke="#e63946" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Obj ${OBJETIVO}%`, position: "insideTopRight", fill: "#e63946", fontSize: 11, fontWeight: 600 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="% CB" fill="#2542C2">
                      <LabelList dataKey="% CB" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                    <Bar dataKey="% Infaltables" fill="#A855F7">
                      <LabelList dataKey="% Infaltables" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                    <Bar dataKey="% Estratégico" fill="#EC4899">
                      <LabelList dataKey="% Estratégico" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Panel title="Cumplimiento por Tipología" icon={<BarChart3 className="w-4 h-4 text-violet-600" />}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={cumplPorTipologia} margin={{ top: 30, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="tipologia" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                    <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <ReferenceLine y={OBJETIVO} stroke="#e63946" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Obj ${OBJETIVO}%`, position: "insideTopRight", fill: "#e63946", fontSize: 11, fontWeight: 600 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="% CB" fill="#2542C2">
                      <LabelList dataKey="% CB" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                    <Bar dataKey="% Infaltables" fill="#A855F7">
                      <LabelList dataKey="% Infaltables" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                    <Bar dataKey="% Estratégico" fill="#EC4899">
                      <LabelList dataKey="% Estratégico" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Cumplimiento por Gerencia" icon={<Building2 className="w-4 h-4 text-blue-600" />}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={cumplPorGerencia} margin={{ top: 30, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="gerencia" tick={{ fontSize: 12, fill: "#64748b" }} interval={0} />
                    <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <ReferenceLine y={OBJETIVO} stroke="#e63946" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Obj ${OBJETIVO}%`, position: "insideTopRight", fill: "#e63946", fontSize: 11, fontWeight: 600 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="% CB" fill="#2542C2">
                      <LabelList dataKey="% CB" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                    <Bar dataKey="% Infaltables" fill="#A855F7">
                      <LabelList dataKey="% Infaltables" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                    <Bar dataKey="% Estratégico" fill="#EC4899">
                      <LabelList dataKey="% Estratégico" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#1e293b" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <TablaCumplimiento title="Cumplimiento por Vendedor" icon={<Trophy className="w-4 h-4 text-amber-500" />} columnHeader="Vendedor" rows={cumplPorVendedor} />
              {/* Mismo alto que la de vendedores; scroll interno (pedido del user). */}
              <div className="relative lg:min-h-[320px]">
                <TablaCumplimiento ajustar title="Cumplimiento por Cliente / Cadena" icon={<Building2 className="w-4 h-4 text-blue-600" />} columnHeader="Cliente / Cadena" rows={cumplPorCliente} onRowClick={(cli) => setClienteSeleccionado(cli)} />
              </div>
            </div>

            {clienteSeleccionado && (
              <Panel title={`Detalle de SKUs · ${clienteSeleccionado}`} icon={<FileText className="w-4 h-4 text-slate-600" />} actionLabel="Cerrar" onAction={() => setClienteSeleccionado(null)}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left p-3 font-semibold text-slate-700">Modelo</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Categoría</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Tipo CB</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Estado</th>
                        <th className="text-right p-3 font-semibold text-slate-700">FC</th>
                        <th className="text-right p-3 font-semibold text-slate-700">BO</th>
                        <th className="text-right p-3 font-semibold text-slate-700">Última act.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleSKUs.map((item, i) => (
                        <tr key={`${item.sku}-${item.tipo}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-mono text-slate-900">{item.sku}</td>
                          <td className="p-3 text-slate-600">{item.categoria}</td>
                          <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${item.tipo === "INFALTABLE" ? "bg-violet-50 text-violet-700" : "bg-pink-50 text-pink-700"}`}>{item.tipo}</span></td>
                          <td className="p-3"><EstadoBadge estado={item.estado} /></td>
                          <td className="p-3 text-right text-green-700 font-medium">{item.fcUnits > 0 ? `${item.fcUnits}u` : "—"}</td>
                          <td className="p-3 text-right text-amber-700 font-medium">{item.boUnits > 0 ? `${item.boUnits}u` : "—"}</td>
                          <td className="p-3 text-right text-slate-600 font-mono text-xs">{formatFecha(item.ultimaActualizacion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            <Panel title="Detalle por SKU del Cuadro Básico" icon={<FileText className="w-4 h-4 text-slate-600" />}>
              <TablaSKUs rows={skusDetalle} mostrarClientes={filters.cliente === "TODOS"} comprasFiltradas={comprasFiltradas} cbClientesPorSku={cbClientesPorSku} />
            </Panel>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type FilaCumpl = {
  nombre: string;
  pctCB: number;
  pctInf: number;
  pctEst: number;
};

function TablaCumplimiento({
  title, icon, columnHeader, rows, onRowClick, ajustar,
}: {
  ajustar?: boolean;
  title: string;
  icon: React.ReactNode;
  columnHeader: string;
  rows: FilaCumpl[];
  onRowClick?: (nombre: string) => void;
}) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${ajustar ? "flex max-h-[70vh] flex-col lg:absolute lg:inset-0 lg:max-h-none" : ""}`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        <span className="text-xs text-slate-500">Δ vs objetivo {OBJETIVO}%</span>
      </div>
      <div className={ajustar ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto"}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-[1]">
            <tr>
              <th style={{ backgroundColor: "#ffffff" }} className="text-center p-3 font-semibold text-slate-700 border-b-2 border-slate-200 whitespace-nowrap">{columnHeader}</th>
              <th style={{ backgroundColor: "#1e3a8a" }} className="text-center p-3 font-bold text-white border-l border-blue-900" colSpan={2}>% CB</th>
              <th style={{ backgroundColor: "#1e3a8a" }} className="text-center p-3 font-bold text-white border-l border-blue-900" colSpan={2}>% INFALTABLES</th>
              <th style={{ backgroundColor: "#1e3a8a" }} className="text-center p-3 font-bold text-white border-l border-blue-900" colSpan={2}>% ESTRATÉGICO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nombre} className={`border-b border-slate-100 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}`} onClick={() => onRowClick && onRowClick(r.nombre)}>
                <td className="p-2.5 text-slate-900 font-medium whitespace-nowrap max-w-[200px] truncate" title={r.nombre}>{r.nombre}</td>
                <CeldaPct pct={r.pctCB} />
                <CeldaDelta pct={r.pctCB} />
                <CeldaPct pct={r.pctInf} />
                <CeldaDelta pct={r.pctInf} />
                <CeldaPct pct={r.pctEst} />
                <CeldaDelta pct={r.pctEst} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CeldaPct({ pct }: { pct: number }) {
  const bg = pct >= 80 ? "bg-green-200 text-green-900" : pct >= 70 ? "bg-yellow-100 text-yellow-900" : "bg-red-200 text-red-900";
  return <td className={`text-center p-2.5 font-bold ${bg}`}>{pct}%</td>;
}

function CeldaDelta({ pct }: { pct: number }) {
  const delta = pct - OBJETIVO;
  const isPositive = delta > 0;
  const isZero = delta === 0;
  const color = isZero ? "text-slate-500" : isPositive ? "text-green-700" : "text-red-600";
  const Icon = isZero ? Minus : isPositive ? ChevronUp : ChevronDown;
  const sign = isPositive ? "+" : "";
  return (
    <td className={`text-center p-2.5 font-medium ${color} bg-slate-50`}>
      <span className="inline-flex items-center gap-0.5">
        {sign}{delta} pp <Icon className="w-3 h-3" />
      </span>
    </td>
  );
}

function Panel({
  title, icon, children, actionLabel, onAction,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        {actionLabel && (
          <button onClick={onAction} className="text-xs text-slate-600 hover:text-slate-900 font-medium">{actionLabel}</button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FilterDropdown({
  label, value, onChange, options, wide, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
  wide?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col flex-1 ${wide ? "min-w-[160px] sm:min-w-[200px]" : "min-w-[120px] sm:min-w-[140px]"}`}>
      <label className="text-[10px] font-bold text-slate-600 mb-1 tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="px-3 py-2 border border-slate-300 rounded-md bg-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    FACTURADO: { color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" />, label: "Facturado" },
    BACKORDER: { color: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" />, label: "Back Order" },
    PENDIENTE: { color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" />, label: "Pendiente" },
  };
  const c = config[estado]!;
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${c.color}`}>{c.icon} {c.label}</span>;
}

function MultiSelectDropdown({
  label, values, onChange, options, placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: { v: string; l: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const display =
    values.length === 0
      ? placeholder ?? "Todos"
      : values.length === 1
      ? options.find((o) => o.v === values[0])?.l ?? values[0]
      : `${values.length} seleccionados`;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div ref={ref} className="flex flex-col flex-1 min-w-[120px] sm:min-w-[140px] relative">
      <label className="text-[10px] font-bold text-slate-600 mb-1 tracking-wider">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-2 border border-slate-300 rounded-md bg-white text-sm text-left flex justify-between items-center gap-2 hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className="truncate">{display}</span>
        <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-full bg-white border border-slate-300 rounded-md shadow-lg z-20 max-h-72 overflow-y-auto">
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 border-b border-slate-200"
            >
              Limpiar selección
            </button>
          )}
          {options.map((o) => (
            <label key={o.v} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={values.includes(o.v)}
                onChange={() => toggle(o.v)}
                className="w-3.5 h-3.5"
              />
              <span>{o.l}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function TablaSKUs({ rows, mostrarClientes, comprasFiltradas, cbClientesPorSku }: {
  rows: Array<{
    sku: string;
    skus: string[];
    fobSkus: string[];
    categoria: string;
    tipo: "INFALTABLE" | "ESTRATEGICO";
    clientesEnCB: number;
    clientesCumplidos: number;
    fcUnits: number;
    boUnits: number;
    pct: number;
  }>;
  mostrarClientes: boolean;
  comprasFiltradas: VentaRow[];
  cbClientesPorSku: Map<string, Set<string>>;
}) {
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  // Primero tipo → categoría (cerradas); al tocar una categoría se ven sus SKUs (pedido del user: la lista era muy larga).
  const [catsAbiertas, setCatsAbiertas] = useState<Set<string>>(new Set());
  const toggleCat = (k: string) => setCatsAbiertas((cur) => {
    const n = new Set(cur);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const porCategoria = (pref: string, lista: typeof rows) => {
    const orden = ["LAVADO", "REFRIGERACION", "COCCION"];
    const norm = (c: string) => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const cats = Array.from(new Set(lista.map((r) => r.categoria))).sort((a, b) => {
      const ia = orden.indexOf(norm(a)), ib = orden.indexOf(norm(b));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "es");
    });
    return cats.map((cat) => {
      const k = `${pref}-${cat}`;
      const items = lista.filter((r) => r.categoria === cat);
      const abierta = catsAbiertas.has(k);
      const en = items.reduce((a, x) => a + x.clientesEnCB, 0);
      const cu = items.reduce((a, x) => a + x.clientesCumplidos, 0);
      const fc = items.reduce((a, x) => a + x.fcUnits, 0);
      const bo = items.reduce((a, x) => a + x.boUnits, 0);
      const pct = en > 0 ? Math.round((cu / en) * 100) : 0;
      const pctBg = pct >= 80 ? "bg-green-100 text-green-800" : pct >= 70 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
      const u = (n: number) => (n > 0 ? `${n.toLocaleString("es-AR")}u` : "—");
      return [
        <tr key={k} className="cursor-pointer border-b border-slate-200 bg-slate-50/60 hover:bg-blue-50" onClick={() => toggleCat(k)}>
          <td className="p-3 font-semibold text-slate-800">
            <ChevronDown className={`mr-1 inline h-3.5 w-3.5 text-slate-500 transition-transform ${abierta ? "rotate-180" : "-rotate-90"}`} />
            {cat}
          </td>
          <td className="p-3 text-xs text-slate-500">{items.length} SKU{items.length !== 1 ? "s" : ""} · {abierta ? "ocultar" : "ver"}</td>
          {mostrarClientes && <td className="p-3 text-right font-mono text-xs text-slate-600">{cu}/{en}</td>}
          <td className="p-3 text-right font-semibold text-green-700">{u(fc)}</td>
          <td className="p-3 text-right font-semibold text-amber-700">{u(bo)}</td>
          <td className="p-3 text-right font-bold text-slate-900">{u(fc + bo)}</td>
          <td className={`p-3 text-right font-bold ${pctBg}`}>{pct}%</td>
        </tr>,
        ...(abierta ? items.map((r) => (
          <FilaSKU
            key={`${pref}-${r.sku}`}
            r={r}
            mostrarClientes={mostrarClientes}
            totalCols={totalCols}
            expanded={expandedSku === `${pref}-${r.sku}`}
            onToggle={r.fcUnits > 0 ? () => setExpandedSku((c) => c === `${pref}-${r.sku}` ? null : `${pref}-${r.sku}`) : undefined}
            comprasFiltradas={comprasFiltradas}
            clientesScope={cbClientesPorSku.get(r.sku)}
          />
        )) : []),
      ];
    });
  };
  const totalPorTipo = (tipo: "INFALTABLE" | "ESTRATEGICO") => {
    const r = rows.filter((x) => x.tipo === tipo);
    const en = r.reduce((a, x) => a + x.clientesEnCB, 0);
    const cu = r.reduce((a, x) => a + x.clientesCumplidos, 0);
    const fc = r.reduce((a, x) => a + x.fcUnits, 0);
    const bo = r.reduce((a, x) => a + x.boUnits, 0);
    return {
      label: `TOTAL ${tipo === "INFALTABLE" ? "INFALTABLES" : "ESTRATÉGICO"}`,
      fcUnits: fc,
      boUnits: bo,
      total: fc + bo,
      clientesEnCB: en,
      clientesCumplidos: cu,
      pct: en > 0 ? Math.round((cu / en) * 100) : 0,
    };
  };
  const totInf = totalPorTipo("INFALTABLE");
  const totEst = totalPorTipo("ESTRATEGICO");
  const enTot = totInf.clientesEnCB + totEst.clientesEnCB;
  const cuTot = totInf.clientesCumplidos + totEst.clientesCumplidos;
  const totGen = {
    label: "TOTAL GENERAL",
    fcUnits: totInf.fcUnits + totEst.fcUnits,
    boUnits: totInf.boUnits + totEst.boUnits,
    total: totInf.fcUnits + totInf.boUnits + totEst.fcUnits + totEst.boUnits,
    clientesEnCB: enTot,
    clientesCumplidos: cuTot,
    pct: enTot > 0 ? Math.round((cuTot / enTot) * 100) : 0,
  };

  const infRows = rows.filter((r) => r.tipo === "INFALTABLE");
  const estRows = rows.filter((r) => r.tipo === "ESTRATEGICO");
  const totalCols = mostrarClientes ? 6 : 5;
  // Spans para la celda "TOTAL XXX" en filas resumen: cubre las cols de
  // texto antes de los números (Categoría + SKU + Clientes? = 3 o 2).
  const labelSpan = mostrarClientes ? 3 : 2;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-[1]">
          <tr>
            <th className="text-left p-3 font-semibold text-slate-700">Categoría</th>
            <th className="text-left p-3 font-semibold text-slate-700">SKU</th>
            {mostrarClientes && <th className="text-right p-3 font-semibold text-slate-700">Clientes</th>}
            <th className="text-right p-3 font-semibold text-slate-700">Facturado</th>
            <th className="text-right p-3 font-semibold text-slate-700">Back Order</th>
            <th className="text-right p-3 font-semibold text-slate-700">Total</th>
            <th className="text-right p-3 font-semibold text-slate-700">% Cumpl.</th>
          </tr>
        </thead>
        <tbody>
          {infRows.length > 0 && (
            <tr className="bg-violet-50">
              <td colSpan={totalCols} className="px-3 py-1.5 text-xs font-bold text-violet-800 uppercase tracking-wider">Infaltables</td>
            </tr>
          )}
          {porCategoria("inf", infRows)}
          {infRows.length > 0 && <FilaTotal r={totInf} accent="violet" labelSpan={labelSpan} />}

          {estRows.length > 0 && (
            <tr className="bg-pink-50">
              <td colSpan={totalCols} className="px-3 py-1.5 text-xs font-bold text-pink-800 uppercase tracking-wider">Estratégico</td>
            </tr>
          )}
          {porCategoria("est", estRows)}
          {estRows.length > 0 && <FilaTotal r={totEst} accent="pink" labelSpan={labelSpan} />}

          {(infRows.length > 0 || estRows.length > 0) && <FilaTotal r={totGen} accent="slate" labelSpan={labelSpan} grand />}
        </tbody>
      </table>
    </div>
  );
}

function FilaSKU({ r, mostrarClientes, totalCols, expanded, onToggle, comprasFiltradas, clientesScope }: {
  r: {
    sku: string;
    skus: string[];
    fobSkus: string[];
    categoria: string;
    tipo: "INFALTABLE" | "ESTRATEGICO";
    clientesEnCB: number;
    clientesCumplidos: number;
    fcUnits: number;
    boUnits: number;
    pct: number;
  };
  mostrarClientes: boolean;
  totalCols: number;
  expanded: boolean;
  onToggle?: () => void;
  comprasFiltradas: VentaRow[];
  clientesScope?: Set<string>;
}) {
  const pctBg = r.pct >= 80 ? "bg-green-100 text-green-800" : r.pct >= 70 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
  const total = r.fcUnits + r.boUnits;
  const clickable = !!onToggle;
  return (
    <>
      <tr
        className={`border-b border-slate-100 ${clickable ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"}`}
        onClick={onToggle}
      >
        <td className="p-3 text-slate-600">
          {clickable && (
            <ChevronDown
              className={`inline w-3.5 h-3.5 text-slate-400 mr-1 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          )}
          {r.categoria}
        </td>
        <td className="p-3 font-mono text-slate-900">
          {(() => {
            const fobSet = new Set(r.fobSkus);
            const skuWithFobBadge = (s: string, cls: string) => (
              <span key={s} className={cls}>
                {s}
                {fobSet.has(s) && (
                  <span
                    className="ml-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 align-middle"
                    title="Compra vía exportación FOB"
                  >
                    FOB
                  </span>
                )}
              </span>
            );
            if (r.skus.length > 1) {
              return (
                <div className="flex flex-col gap-0.5">
                  {r.skus.map((s, i) => skuWithFobBadge(s, i === 0 ? "" : "text-xs text-slate-500"))}
                </div>
              );
            }
            return skuWithFobBadge(r.sku, "");
          })()}
        </td>
        {mostrarClientes && (
          <td className="p-3 text-right text-slate-600 font-mono text-xs">{r.clientesCumplidos}/{r.clientesEnCB}</td>
        )}
        <td className="p-3 text-right text-green-700 font-medium">{r.fcUnits > 0 ? `${r.fcUnits.toLocaleString("es-AR")}u` : "—"}</td>
        <td className="p-3 text-right text-amber-700 font-medium">{r.boUnits > 0 ? `${r.boUnits.toLocaleString("es-AR")}u` : "—"}</td>
        <td className="p-3 text-right text-slate-900 font-semibold">{total > 0 ? `${total.toLocaleString("es-AR")}u` : "—"}</td>
        <td className={`p-3 text-right font-bold ${pctBg}`}>{r.pct}%</td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100">
          <td colSpan={totalCols} className="p-0">
            <DetalleFCPorFecha skus={r.skus} clientesScope={clientesScope} comprasFiltradas={comprasFiltradas} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetalleFCPorFecha({ skus, clientesScope, comprasFiltradas }: {
  skus: string[];
  clientesScope?: Set<string>;
  comprasFiltradas: VentaRow[];
}) {
  const filas = useMemo(() => {
    // Agrupamos por (fecha, sku) para que el detalle muestre a qué SKU
    // corresponde cada facturación — útil cuando el CB tiene homólogos.
    // Para la fecha usamos fechaFactura (real, día concreto) si vino del
    // Office Script. Si no está, fallback a fecha (que para FC es el
    // período fiscal con día 01 — agrupa todo el mes en una fila).
    const skuSet = new Set(skus);
    const byKey = new Map<string, { fecha: string; sku: string; unidades: number }>();
    for (const c of comprasFiltradas) {
      if (c.tipo !== "FC") continue;
      if (!skuSet.has(c.sku)) continue;
      if (clientesScope && !clientesScope.has(c.cliente)) continue;
      const fecha = c.fechaFactura ?? c.fecha;
      const key = `${fecha}|${c.sku}`;
      const cur = byKey.get(key);
      if (cur) cur.unidades += c.unidades;
      else byKey.set(key, { fecha, sku: c.sku, unidades: c.unidades });
    }
    return Array.from(byKey.values()).sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.sku.localeCompare(b.sku);
    });
  }, [skus, clientesScope, comprasFiltradas]);

  const totalFC = filas.reduce((a, r) => a + r.unidades, 0);
  const fechasUnicas = new Set(filas.map((f) => f.fecha)).size;

  if (filas.length === 0) {
    return (
      <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500">
        Sin facturación en el período filtrado.
      </div>
    );
  }
  return (
    <div className="px-4 py-3 bg-slate-50">
      <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
        Detalle facturación por fecha · {fechasUnicas} {fechasUnicas === 1 ? "fecha" : "fechas"} · {totalFC.toLocaleString("es-AR")}u
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {filas.map((f) => (
          <div key={`${f.fecha}|${f.sku}`} className="flex justify-between items-center bg-white px-3 py-1.5 rounded border border-slate-200">
            <div className="flex flex-col">
              <span className="text-xs text-slate-600">{formatFecha(f.fecha)}</span>
              <span className="text-[10px] font-mono text-slate-500">{f.sku}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">{f.unidades.toLocaleString("es-AR")}u</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilaTotal({ r, accent, labelSpan, grand }: {
  r: { label: string; fcUnits: number; boUnits: number; total: number; pct: number };
  accent: "violet" | "pink" | "slate";
  labelSpan: number;
  grand?: boolean;
}) {
  const bg = accent === "violet" ? "bg-violet-100" : accent === "pink" ? "bg-pink-100" : "bg-slate-200";
  const txt = accent === "violet" ? "text-violet-900" : accent === "pink" ? "text-pink-900" : "text-slate-900";
  const pctBg = r.pct >= 80 ? "bg-green-200 text-green-900" : r.pct >= 70 ? "bg-yellow-200 text-yellow-900" : "bg-red-200 text-red-900";
  return (
    <tr className={`${bg} ${grand ? "border-t-2 border-slate-400" : "border-b border-slate-200"}`}>
      <td className={`p-3 font-bold text-xs uppercase tracking-wider ${txt}`} colSpan={labelSpan}>{r.label}</td>
      <td className={`p-3 text-right font-bold ${txt}`}>{r.fcUnits > 0 ? `${r.fcUnits.toLocaleString("es-AR")}u` : "—"}</td>
      <td className={`p-3 text-right font-bold ${txt}`}>{r.boUnits > 0 ? `${r.boUnits.toLocaleString("es-AR")}u` : "—"}</td>
      <td className={`p-3 text-right font-bold ${txt}`}>{r.total > 0 ? `${r.total.toLocaleString("es-AR")}u` : "—"}</td>
      <td className={`p-3 text-right font-bold ${pctBg}`}>{r.pct}%</td>
    </tr>
  );
}

