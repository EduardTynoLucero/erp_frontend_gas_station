export type EstadoGasto = 'borrador' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado';
export type OrigenGasto = 'manual' | 'recurrente' | 'reporte' | 'caja_chica' | 'compra';
export type Permiso =
  | 'ver_todo'
  | 'registrar'
  | 'aprobar'
  | 'pagar'
  | 'presupuestos'
  | 'catalogos'
  | 'revisar'
  | 'configurar'
  | 'usuarios'
  | 'auditar'
  | 'caja_chica';

export interface Empresa {
  id: string;
  nombre: string;
  nit: string;
  franquicia: string;
  moneda: string;
  periodoActual: string;
}

export interface Estacion {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string;
  gerenteId: string;
  unidades: string[];
  demo: boolean;
  activa: boolean;
}

export interface Unidad {
  id: string;
  nombre: string;
}

export interface CentroCosto {
  id: string;
  codigo: string;
  nombre: string;
  estacionId: string;
  unidad: string;
  activo: boolean;
}

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: Permiso[];
  /** Pantallas del menú que ve el rol (rutas). Lo que no está aquí no se muestra ni se envía desde el servidor. */
  pantallas: string[];
  limiteAutorizacion: number | null;
  /** El rol solo ve los gastos y compras que el mismo usuario registró. */
  soloPropios: boolean;
}

export interface Usuario {
  id: string;
  nombre: string;
  usuario: string;
  rolId: string;
  estaciones: string[];
  activo: boolean;
  /** Permisos que este usuario tiene además de los de su rol. */
  permisosExtra?: Permiso[];
  /** Permisos de su rol que a este usuario se le quitan. */
  permisosQuitados?: Permiso[];
  /** Pantallas que ve además de las de su rol. */
  pantallasExtra?: string[];
  /** Pantallas de su rol que no ve. */
  pantallasQuitadas?: string[];
  /** Límite de autorización propio (null = sin límite). Si no se indica, aplica el de su rol. */
  limiteAutorizacion?: number | null;
  /** Alcance propio: true = solo lo que registra, false = todo lo de sus estaciones. Si no se indica, el de su rol. */
  soloPropios?: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
  cuentaContable: string;
  subcategorias: string[];
  activa: boolean;
}

export interface Proveedor {
  id: string;
  nombre: string;
  nit: string;
  tipo: string;
  categoriaId: string;
  contacto: string;
  telefono: string;
  diasCredito: number;
  activo: boolean;
  fuente?: string;
}

export interface Venta {
  estacionId: string;
  fecha: string;
  turno: string;
  total: number;
  efectivo: number;
  tarjeta: number;
  credito: number;
  transferencia: number;
  abonosTarjeta: number;
  depositado: number;
  fuente: string;
}

export type TipoDocumento = 'FEL' | 'Recibo' | 'Sin documento';

export interface Documento {
  tipo: TipoDocumento;
  serie: string;
  numero: string;
  fechaEmision: string;
  verificado?: boolean;
  /** Archivo adjunto (foto o PDF del comprobante). */
  archivoId?: string;
  archivoNombre?: string;
}

export interface Aprobacion {
  usuarioId: string;
  fecha: string;
  accion: 'aprobado' | 'rechazado';
  comentario: string;
}

export interface Pago {
  fecha: string;
  metodo: string;
  referencia: string;
  usuarioId: string;
}

export interface Distribucion {
  estacionId: string;
  pct: number;
  monto: number;
}

export interface Gasto {
  id: string;
  folio: string;
  fecha: string;
  estacionId: string;
  centroCostoId: string;
  categoriaId: string;
  subcategoria: string;
  proveedorId: string | null;
  descripcion: string;
  monto: number;
  iva: number;
  metodoPago: string;
  documento: Documento;
  estado: EstadoGasto;
  solicitanteId: string;
  aprobaciones: Aprobacion[];
  origen: OrigenGasto;
  referencia: string | null;
  vencimiento: string | null;
  pago: Pago | null;
  distribucion?: Distribucion[];
}

export interface Presupuesto {
  id: string;
  periodo: string;
  estacionId: string;
  categoriaId: string;
  monto: number;
}

export interface MovimientoCaja {
  id: string;
  fecha: string;
  tipo: 'apertura' | 'desembolso';
  descripcion: string;
  monto: number;
  categoriaId: string | null;
  comprobante: string;
  liquidacionId?: string;
}

export interface CajaChica {
  id: string;
  estacionId: string;
  fondo: number;
  responsableId: string;
  movimientos: MovimientoCaja[];
}

export interface Recurrente {
  id: string;
  nombre: string;
  estacionId: string;
  centroCostoId: string;
  categoriaId: string;
  subcategoria: string;
  proveedorId: string;
  monto: number;
  frecuencia: string;
  diaPago: number;
  proximaFecha: string;
  activo: boolean;
}

export type Severidad = 'critica' | 'alta' | 'media' | 'baja';
export type EstadoHallazgo = 'abierta' | 'en_revision' | 'cerrada';

export interface Hallazgo {
  id: string;
  severidad: Severidad;
  titulo: string;
  monto: number;
  estacionId: string;
  fuente: string;
  detalle: string;
  accion: string;
  estado: EstadoHallazgo;
  fecha: string;
}

export interface EventoAuditoria {
  id: string;
  fecha: string;
  usuarioId: string;
  accion: string;
  entidad: string;
  detalle: string;
}

export interface NivelAutorizacion {
  hasta: number | null;
  rolId: string;
  etiqueta: string;
}

export interface Config {
  periodoActual: string;
  fechaCorte: string;
  hoy: string;
  niveles: NivelAutorizacion[];
  comprobanteObligatorioDesde: number;
  toleranciaMermaPct: number;
  tasaComisionTarjeta: number;
  alertaPresupuestoPct: number;
  diasAlertaVencimiento: number;
  diasAlertaPendiente: number;
  criterioProrrateo: 'ventas' | 'partes_iguales';
  limiteDesembolsoCaja: number;
}

export interface Cotizacion {
  proveedorId: string;
  monto: number;
  diasEntrega: number;
  nota: string;
}

export type EstadoOrden = 'requerimiento' | 'cotizando' | 'ordenada' | 'recibida' | 'cancelada';

export interface OrdenCompra {
  id: string;
  fecha: string;
  estacionId: string;
  centroCostoId: string;
  categoriaId: string;
  descripcion: string;
  solicitanteId: string;
  estado: EstadoOrden;
  cotizaciones: Cotizacion[];
  proveedorId: string | null;
  monto: number | null;
  fechaOrden: string | null;
  fechaRecepcion: string | null;
  gastoId: string | null;
  aprobadorId?: string | null;
}

export interface Contrato {
  id: string;
  proveedorId: string;
  estacionId: string;
  objeto: string;
  categoriaId: string;
  montoMensual: number;
  inicio: string;
  fin: string;
  renovacionAutomatica: boolean;
  avisoDias: number;
  documento: string;
}

export interface DB {
  empresa: Empresa;
  estaciones: Estacion[];
  unidades: Unidad[];
  centrosCosto: CentroCosto[];
  roles: Rol[];
  usuarios: Usuario[];
  categorias: Categoria[];
  proveedores: Proveedor[];
  ventas: Venta[];
  gastos: Gasto[];
  presupuestos: Presupuesto[];
  cajasChicas: CajaChica[];
  recurrentes: Recurrente[];
  hallazgos: Hallazgo[];
  auditoria: EventoAuditoria[];
  config: Config;
  ordenesCompra: OrdenCompra[];
  contratos: Contrato[];
}
