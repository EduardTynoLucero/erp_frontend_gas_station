/**
 * Lo que escribe el servicio ETL en cada subida: la vista previa (igual que la del panel del ETL) y el resultado de
 * la carga (el mismo .json que deja en procesados/ o rechazados/). La API los entrega como JSON libre; aquí se
 * describen solo los campos que muestra la pantalla.
 */
export type Severidad = 'ERROR' | 'ADVERTENCIA' | 'INFO';

export interface FilaCuadre {
  grupo: string;
  medida: string;
  suma: string;
  reporte: string;
  diferencia?: string;
  cuadra: boolean;
}

export interface GrupoIncidencias {
  severidad: Severidad;
  regla: string;
  cantidad: number;
  ejemplos: { mensaje: string; fila: number | null; ticket: number | null }[];
}

/** Qué pasará con un ticket (o una línea de compra) al cargar: entra nuevo, queda igual o se actualiza */
export interface EnLaBase {
  estado: 'NUEVO' | 'IGUAL' | 'CAMBIA';
  /** Con CAMBIA: los datos que cambian (factura, total, cliente…) */
  cambios: string[];
}

/**
 * La comparación del archivo con lo que ya está en la base, igual que la del panel del ETL: cada ticket se busca por
 * estación y número (cada compra, por estación, factura y producto), y si ya existe, el último archivo cargado manda.
 */
export interface ComparacionConBase {
  /** Este mismo archivo ya se cargó: no se compara fila por fila, porque cargarlo otra vez no cambia nada */
  yaCargado: { cargaId: number; archivo: string; cuando: string } | null;
  nuevos: number;
  iguales: number;
  cambian: number;
  /** Tickets que en la base tienen factura y en este archivo no */
  pierdenFactura?: number;
  /** Tickets que ya estaban con otra fecha: la carga los cambia de día */
  seMuevenDeDia?: number;
  camposQueCambian: { campo: string; tickets: number }[];
  /** Hasta qué carga había en la base cuando se comparó (0: ninguna). Si entra otra, el servicio ETL compara otra vez */
  contraCarga?: number;
  /** Reporte de compras, solo en el detalle de la subida: la comparación de cada línea */
  porFila?: ({ fila: number } & EnLaBase)[];
}

/** Una línea del Reporte de compras (una por factura y producto). Cantidades e importes: texto decimal exacto */
export interface LineaCompra {
  fila: number;
  turno: number | null;
  factura: string;
  fechaHora: string;
  proveedor: string | null;
  producto: string;
  combustible: boolean;
  cantidad: string | null;
  precio: string | null;
  total: string | null;
  costo: string | null;
  costoUnitario: string | null;
  anulada: boolean;
  incidencia: { severidad: Severidad; cantidad: number; mensajes: string[] } | null;
}

export interface VistaPreviaEtl {
  tipo: 'CONSULTA_TICKETS' | 'COMPRAS';
  valido: boolean;
  estacionUsada: string | null;
  traeEstacion: boolean;
  hoja: string;
  filaEncabezado: number;
  resumen: {
    estaciones: string[];
    proveedores?: string[];
    turnoMin: number | null;
    turnoMax: number | null;
    fechaMin: string | null;
    fechaMax: string | null;
    total: string;
    cantidad?: string;
    galones?: string;
    tickets?: number;
    lineas?: number;
  };
  cuadre: FilaCuadre[];
  conteoIncidencias: Record<Severidad, number>;
  /** Solo en el detalle de la subida */
  incidencias?: GrupoIncidencias[];
  agregados?: { productos: { producto: string; tickets: number; galones: number; total: number; utilidad: number }[] };
  productos?: { producto: string; lineas: number; cantidad: number | null; total: number | null; combustible: boolean }[];
  /** Reporte de compras, solo en el detalle de la subida: sus líneas */
  compras?: LineaCompra[];
  /** null: no se comparó (el archivo tiene errores, o falló y `avisoComparacion` dice por qué) */
  comparacion: ComparacionConBase | null;
  avisoComparacion: string | null;
  /** Por qué el servicio ETL no pudo guardar la tabla de tickets, si pasó */
  avisoTickets?: string | null;
}

export interface ResultadoCargaEtl {
  estado: 'CARGADO' | 'RECHAZADO' | 'DUPLICADO';
  carga_id: number | null;
  mensaje: string;
  segundos: number;
  conteos: { insertadas: number; actualizadas: number; sin_cambio: number; no_vinieron?: number } | null;
  aviso: string | null;
  estadisticas: { tabla: string; segundos: number } | null;
  aviso_estadisticas: string | null;
  avisoArchivo: string | null;
}

export const comoVistaPrevia = (r: Record<string, unknown> | null | undefined): VistaPreviaEtl | null =>
  r && typeof r.tipo === 'string' && typeof r.resumen === 'object' ? (r as unknown as VistaPreviaEtl) : null;

export const comoResultado = (r: Record<string, unknown> | null | undefined): ResultadoCargaEtl | null =>
  r && typeof r.estado === 'string' ? (r as unknown as ResultadoCargaEtl) : null;

export const NOMBRE_REPORTE: Record<string, string> = {
  CONSULTA_TICKETS: 'Consulta de Tickets',
  COMPRAS: 'Reporte de compras',
  DESCONOCIDO: 'Archivo no reconocido',
};

/** "2026-11-09 09:11:00" (o con T) → "9 nov 2026 09:11": hora local de la estación, como la escribe el reporte */
export function fechaReporte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [f, h] = iso.split(/[T ]/);
  const [a, m, d] = (f ?? '').split('-').map(Number);
  if (!a || !m || !d) return iso;
  return `${d} ${meses[m - 1]} ${a}${h ? ` ${h.slice(0, 5)}` : ''}`;
}

export function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
