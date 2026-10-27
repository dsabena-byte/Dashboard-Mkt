// Copia literal de cuadros-basicos/lib/types.ts (CB Ventas).
export type Tipologia =
  | "TOP 10"
  | "GRANDES CUENTAS RESTO"
  | "HIPERMERCADOS"
  | "SMALL RETAILERS";

export type Categoria = "LAVADO" | "REFRIGERACION" | "COCCION";

export type TipoCB = "INFALTABLE" | "ESTRATEGICO";

export type CuadroBasicoItem = {
  tipologia: Tipologia;
  cliente: string;
  tipo: TipoCB;
  categoria: Categoria;
  sku: string;
  // SKUs alternativos del mismo producto (cambios de nomenclatura, variantes
  // de color, etc.). Si el cliente compró cualquiera de estos, cumple el CB.
  // Opcional para compat con el JSON estático en data/cuadro-basico.json.
  skuAliases?: string[];
  // Vigencia del renglón (migración 0140; ISO, hasta null = vigente). Sin fechas = vale siempre.
  desde?: string | null;
  hasta?: string | null;
};

export type ClasificacionCliente = {
  id: string;            // ID interno del cliente (col ID del CSV)
  cliente: string;
  pesoFacturacion: number; // 0..1
  tipologia: Tipologia;
  vendedor: string;
  gerente: string;       // "Cuentas Clave" | "Interior" | "Buenos Aires"
};

export type VentaTipo = "FC" | "BO";

// Canal de venta. "FOB" = exportación (viene de las solapas FC_FOB / BO_FOB
// del Excel). Opcional por compat con blobs antiguos sin este campo.
export type VentaCanal = "SELL_IN" | "FOB";

// Una línea de la solapa BO o FC de "FC + BO 2026 - Hanna.xlsx".
// Un pedido (documentoVentas) puede tener para un mismo SKU una porción
// facturada (fila en FC) y otra pendiente (fila en BO); ambas se unen por
// `documentoVentas + sku` cuando hace falta reconstruir el pedido completo.
export type VentaRow = {
  documentoVentas: string;
  cliente: string;
  sku: string;
  tipo: VentaTipo;
  unidades: number;
  fecha: string; // YYYY-MM-DD. Para FC: período fiscal (EjercicioPeriodo,
                  // día 01). Para BO: Fecha Creación Cabecera real.
  mes: number;   // 1..12 (derivado de fecha)
  vendedor: string;
  fechaFactura?: string; // YYYY-MM-DD. Solo FC. Fecha REAL de emisión de
                         // la factura, separada de "fecha" para mostrar
                         // en el detalle expandido (sino se ven todas
                         // como día 01 del mes por el calendario fiscal).
  canal?: VentaCanal;    // "FOB" si vino de las solapas FC_FOB/BO_FOB.
                         // Ausente o "SELL_IN" para ventas tradicionales.
};

export type VentasFile = {
  generatedAt: string;
  source: "dummy" | "sharepoint";
  rows: VentaRow[];
};

// Payload que manda el flow de Power Automate al endpoint /api/ventas.
// Una entrada por fila de la solapa correspondiente; el server las
// concatena en `VentasFile.rows` con su `tipo` ("FC" o "BO").
export type VentasPayloadRow = {
  documentoVentas: string | number;
  cliente: string;
  sku: string;
  unidades: number | string;
  fecha: string | number; // YYYY-MM-DD, DD/MM/YYYY, ISO, YYYYMMDD (int) o
                          // YYYYNNN (período fiscal SAP).
  vendedor: string;
  fechaFactura?: string | number; // Opcional. Fecha real de emisión de
                                   // factura, distinta del período fiscal.
  canal?: VentaCanal; // "FOB" para ventas de las solapas FC_FOB/BO_FOB.
};

export type VentasPayload = {
  fc: VentasPayloadRow[];
  bo: VentasPayloadRow[];
  generatedAt?: string;
};
