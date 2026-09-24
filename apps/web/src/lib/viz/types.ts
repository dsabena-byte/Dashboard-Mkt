// Motor de tableros de planilla (v2) — TIPOS. Puro y client-safe (sin server-only).
// La config de un tablero vive en tenant_dashboards.config (jsonb) con `v: 2`.
// Las configs viejas ({ widgets: WidgetConfig[] } del builder v1) se suben con upgradeDashboard().

export type FieldType = "date" | "number" | "text" | "boolean";
export type FieldRole = "dimension" | "measure";
/** Formato numérico. percent = el valor ya está en % (12,5 → 12,5%); pct_frac = fracción (0,125 → 12,5%). */
export type NumFormat = "auto" | "number" | "integer" | "decimal" | "currency" | "percent" | "pct_frac" | "ratio";
export type Agg = "sum" | "avg" | "min" | "max" | "count" | "countd" | "median" | "last";
export type DateGrain = "day" | "week" | "month" | "quarter" | "year";

export interface Dataset { id: string; name: string; columns: string[]; rows: unknown[][] }

// ── Ajustes por dataset (dentro del tablero) ──
export interface FieldOverride { label?: string; type?: FieldType; role?: FieldRole; format?: NumFormat; hidden?: boolean }
export interface CalcDef { id: string; name: string; expr: string; format?: NumFormat }
/** Lookup a un 2º dataset por clave común (tipo BUSCARV): trae columnas del remoto a este dataset. */
export interface BlendDef { id: string; datasetId: string; localKey: string; remoteKey: string; fields: string[] }
export interface DatasetSettings { fields?: Record<string, FieldOverride>; calcs?: CalcDef[]; blends?: BlendDef[] }

/** Campo resuelto (columna, calculado o traído por blend). */
export interface Field {
  id: string;
  label: string;
  type: FieldType;
  role: FieldRole;
  format: NumFormat;
  source: "col" | "calc" | "blend";
  col?: number;
  calc?: CalcDef;
  /** calculado que contiene agregaciones (SUM(...)/SUM(...)) → se evalúa después de agrupar */
  aggregate?: boolean;
  error?: string;
  hidden?: boolean;
  /** columna de fecha que solo trae el mes (sin año) */
  monthOnly?: boolean;
}

// ── Query ──
export type TableCalc = "none" | "pct_total" | "running" | "moving_avg" | "diff_prev" | "pct_prev" | "yoy" | "yoy_pct";
export interface Measure {
  id: string;
  field: string;         // id de campo ("__rows" = contar filas)
  agg: Agg;
  label?: string;
  format?: NumFormat;
  calc?: TableCalc;
  n?: number;            // ventana de media móvil
  axis?: "left" | "right";
  mark?: "bar" | "line";
  asMeta?: boolean;      // se dibuja como meta (gris pizarra, línea punteada)
}

export type RelDate = "last_n_days" | "last_n_months" | "this_month" | "prev_month" | "this_quarter" | "this_year" | "ytd" | "prev_year";
export interface Filter {
  field: string;
  op: "in" | "notin" | "between" | "gte" | "lte" | "contains" | "date_relative" | "bucket";
  values?: string[];     // in / notin / bucket (claves de bucket)
  min?: number | string | null;  // between/gte (número o fecha ISO)
  max?: number | string | null;  // between/lte
  text?: string;         // contains
  rel?: RelDate;
  n?: number;
  grain?: DateGrain;     // bucket
  anchor?: "hoy" | "datos"; // date_relative: relativo a hoy o a la última fecha con datos
}

export interface Target { field?: string; agg?: Agg; value?: number | null; label?: string }

export interface Query {
  x?: string;            // dimensión principal (eje / filas / categoría / etapas)
  series?: string;       // color / serie
  rows?: string[];       // pivot: filas
  cols?: string[];       // pivot / heatmap: columnas
  measures: Measure[];
  filters?: Filter[];
  grain?: DateGrain;
  sort?: { by: "x" | "value" | "none"; dir: "asc" | "desc"; measure?: string };
  topN?: { n: number; others?: boolean };
  target?: Target;
  /** campo de fecha para comparaciones/sparkline de KPI (default: 1er campo fecha) */
  dateField?: string;
}

// ── Widgets ──
export type ChartType =
  | "kpi" | "bar" | "line" | "area" | "combo" | "pie" | "donut" | "scatter" | "heatmap"
  | "table" | "pivot" | "funnel" | "waterfall" | "gauge" | "text";

export interface CondRule {
  measure: string;       // id de medida
  kind: "bars" | "scale" | "semaforo";
  /** semáforo: verde si >= green, amarillo si >= yellow (o invertido si dir=down) */
  green?: number;
  yellow?: number;
  dir?: "up" | "down";
}

export interface WidgetOpts {
  orientation?: "v" | "h";
  stack?: "none" | "stacked" | "percent";
  labels?: boolean;
  legend?: boolean;
  palette?: "azul" | "teal" | "pizarra" | "mixta";
  format?: NumFormat;    // override del formato de la 1ª medida
  // KPI / gauge
  kpiMode?: "total" | "last";
  compare?: "none" | "prev_period" | "prev_year";
  direction?: "up" | "down";
  green?: number;        // % de cumplimiento para verde (default 100)
  yellow?: number;       // % para amarillo (default 90)
  spark?: boolean;
  // tabla
  pageSize?: number;
  totals?: boolean;
  cond?: CondRule[];
  detail?: boolean;      // tabla de detalle (filas crudas)
  // texto
  text?: string;
  smooth?: boolean;
}

export interface Widget {
  id: string;
  type: ChartType;
  title: string;
  subtitle?: string;
  datasetId?: string;    // default: el dataset principal del tablero
  q: Query;
  w: 1 | 2 | 3 | 4;
  h: "s" | "m" | "l";
  opts: WidgetOpts;
}

/** Filtro de tablero (barra superior). Aplica a todos los widgets de ese dataset. */
export interface DashFilter { id: string; datasetId: string; field: string; kind: "date" | "list"; label?: string }

export interface DashboardV2 {
  v: 2;
  title: string;
  description?: string;
  datasetId: string | null;           // dataset principal
  datasets: Record<string, DatasetSettings>;
  widgets: Widget[];
  filters: DashFilter[];
}

/** Estado de filtros de tablero en runtime. */
export interface DashFilterState {
  date?: Record<string, { preset: string; from?: string; to?: string }>; // por DashFilter.id
  list?: Record<string, string[]>;
}
/** Filtro cruzado (clic en una barra/porción). */
export interface CrossFilter { sourceWidget: string; datasetId: string; field: string; grain?: DateGrain; key: string; label: string }
