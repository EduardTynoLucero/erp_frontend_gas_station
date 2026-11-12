// Motor de acciones: cada operación del sistema es una función pura (datos actuales + usuario + acción → datos nuevos).
// La ejecuta el servidor (npm run dev / preview) y, en la versión de un solo archivo, el propio navegador.
// Toda validación de permisos vive aquí, así que la pantalla no puede saltarse una regla.
import type {
  Categoria,
  CentroCosto,
  Config,
  Contrato,
  Cotizacion,
  DB,
  Documento,
  Estacion,
  EstadoHallazgo,
  Gasto,
  MovimientoCaja,
  OrdenCompra,
  OrigenGasto,
  Pago,
  Permiso,
  Proveedor,
  Recurrente,
  Rol,
  Usuario,
} from '../types';
import { agrupar, q, sumar, sumarDias, sumarMeses } from './format';
import { administra, administraRol, listaPantallas, nombrePantalla, pantallasDe } from './acceso';
import {
  limiteCubre,
  limiteDe,
  nivelRequerido,
  PERMISOS,
  permisosDe,
  puedeAprobar,
  puedeComprobante,
  puedeEditarBorrador,
  puedeOperarCaja,
  puedePagar,
  puedeReabrir,
  puedeRegistrar,
  soloPropios,
  tiene,
  veEstacion,
  veGasto,
  veOrden,
} from './reglas';
import { ESTACION_CENTRAL, estadoCaja, pesosProrrateo } from './selectors';

export interface NuevoGasto {
  fecha: string;
  estacionId: string;
  centroCostoId: string;
  categoriaId: string;
  subcategoria: string;
  proveedorId: string | null;
  descripcion: string;
  monto: number;
  metodoPago: string;
  documento: Documento;
  vencimiento: string | null;
  origen?: OrigenGasto;
  referencia?: string | null;
}

export type DatosUsuario = Pick<
  Usuario,
  | 'id'
  | 'nombre'
  | 'usuario'
  | 'rolId'
  | 'estaciones'
  | 'activo'
  | 'permisosExtra'
  | 'permisosQuitados'
  | 'pantallasExtra'
  | 'pantallasQuitadas'
  | 'limiteAutorizacion'
  | 'soloPropios'
>;
export type DatosRequerimiento = Pick<OrdenCompra, 'estacionId' | 'centroCostoId' | 'categoriaId' | 'descripcion'>;
export type DatosEstacion = Pick<Estacion, 'id' | 'codigo' | 'nombre' | 'direccion' | 'gerenteId' | 'unidades' | 'activa'> & {
  fondoCaja?: number;
};

export type Accion =
  | { tipo: 'crearGasto'; datos: NuevoGasto; enviar: boolean }
  | { tipo: 'editarGasto'; id: string; datos: NuevoGasto; enviar: boolean }
  | { tipo: 'eliminarBorrador'; id: string }
  | { tipo: 'reabrirGasto'; id: string }
  | { tipo: 'enviarGasto'; id: string }
  | { tipo: 'aprobarGasto'; id: string; comentario: string }
  | { tipo: 'rechazarGasto'; id: string; comentario: string }
  | { tipo: 'pagarGasto'; id: string; pago: Omit<Pago, 'usuarioId'> }
  | { tipo: 'registrarComprobante'; id: string; doc: Documento }
  | { tipo: 'verificarComprobante'; id: string }
  | { tipo: 'desembolsoCaja'; cajaId: string; mov: Omit<MovimientoCaja, 'id' | 'tipo'> }
  | { tipo: 'liquidarCaja'; cajaId: string }
  | { tipo: 'generarRecurrentes'; ids: string[] }
  | { tipo: 'guardarRecurrente'; r: Recurrente }
  | { tipo: 'toggleRecurrente'; id: string }
  | { tipo: 'cambiarEstadoHallazgo'; id: string; estado: EstadoHallazgo }
  | { tipo: 'guardarPresupuesto'; periodo: string; estacionId: string; categoriaId: string; monto: number }
  | { tipo: 'copiarPresupuestos'; desde: string; hacia: string }
  | { tipo: 'guardarProveedor'; p: Proveedor }
  | { tipo: 'toggleProveedor'; id: string }
  | { tipo: 'guardarUsuario'; u: DatosUsuario; clave?: string }
  | { tipo: 'toggleUsuario'; id: string }
  | { tipo: 'guardarRol'; rol: Rol }
  | { tipo: 'guardarConfig'; cfg: Config }
  | { tipo: 'guardarCategoria'; c: Categoria; nueva: boolean }
  | { tipo: 'guardarCentro'; c: CentroCosto; nuevo: boolean }
  | { tipo: 'guardarEstacion'; e: DatosEstacion }
  | { tipo: 'crearRequerimiento'; datos: DatosRequerimiento }
  | { tipo: 'agregarCotizacion'; ocId: string; cot: Cotizacion }
  | { tipo: 'emitirOrden'; ocId: string; idx: number }
  | { tipo: 'recibirOrden'; ocId: string; doc: Documento }
  | { tipo: 'cancelarOrden'; ocId: string }
  | { tipo: 'guardarContrato'; c: Contrato }
  | { tipo: 'renovarContrato'; id: string; meses: number }
  | { tipo: 'aplicarProrrateo'; periodo: string; criterio: Config['criterioProrrateo'] }
  | { tipo: 'quitarProrrateo'; periodo: string };

export type Resultado = { ok: true; db: DB; mensaje: string; id?: string } | { ok: false; error: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const fallo = (error: string): Resultado => ({ ok: false, error });
const listo = (db: DB, mensaje: string, id?: string): Resultado => ({ ok: true, db, mensaje, id });
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const MESES_FRECUENCIA: Record<string, number> = { Mensual: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12 };

function siguiente(valores: string[], re: RegExp): number {
  let max = 0;
  for (const v of valores) {
    const m = re.exec(v);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** Hora del evento: nunca anterior al último registro, para que la bitácora quede en orden. */
function horaEvento(db: DB, fecha: string): string {
  const ultimo = db.auditoria.reduce((m, a) => (a.fecha > m ? a.fecha : m), '');
  if (fecha > ultimo) return fecha;
  const t = new Date(`${ultimo}Z`);
  t.setUTCMinutes(t.getUTCMinutes() + 1);
  return t.toISOString().slice(0, 19);
}

/** Agrega un evento a la bitácora. También lo usa el servidor para inicios de sesión y cambios de contraseña. */
export function auditar(db: DB, usuarioId: string, fechaPropuesta: string, accion: string, entidad: string, detalle: string): DB {
  const fecha = horaEvento(db, fechaPropuesta);
  const id = `a${siguiente(
    db.auditoria.map((a) => a.id),
    /^a(\d+)$/,
  )}`;
  return { ...db, auditoria: [{ id, fecha, usuarioId, accion, entidad, detalle }, ...db.auditoria] };
}

export function marcaDeTiempo(db: DB, hora: string): string {
  return `${db.config.hoy}T${hora}`;
}

function cambiarGasto(db: DB, id: string, f: (g: Gasto) => Gasto): DB {
  return { ...db, gastos: db.gastos.map((g) => (g.id === id ? f(g) : g)) };
}

function ivaDe(monto: number, doc: Documento): number {
  return doc.tipo === 'FEL' ? r2((monto / 1.12) * 0.12) : 0;
}

function agregarGasto(db: DB, datos: NuevoGasto, solicitanteId: string, estado: Gasto['estado'], extra: Partial<Gasto> = {}): [DB, Gasto] {
  const n = siguiente(
    db.gastos.map((g) => g.folio),
    /^G-\d{4}-(\d+)$/,
  );
  const id = `g${siguiente(
    db.gastos.map((g) => g.id),
    /^g(\d+)$/,
  )}`;
  const g: Gasto = {
    id,
    folio: `G-${datos.fecha.slice(0, 4)}-${String(n).padStart(4, '0')}`,
    fecha: datos.fecha,
    estacionId: datos.estacionId,
    centroCostoId: datos.centroCostoId,
    categoriaId: datos.categoriaId,
    subcategoria: datos.subcategoria,
    proveedorId: datos.proveedorId,
    descripcion: datos.descripcion.trim(),
    monto: r2(datos.monto),
    iva: ivaDe(datos.monto, datos.documento),
    metodoPago: datos.metodoPago,
    documento: datos.documento,
    estado,
    solicitanteId,
    aprobaciones: [],
    origen: datos.origen ?? 'manual',
    referencia: datos.referencia ?? null,
    vencimiento: datos.vencimiento,
    pago: null,
    ...extra,
  };
  return [{ ...db, gastos: [...db.gastos, g] }, g];
}

function validarGasto(db: DB, d: NuevoGasto): string | null {
  if (!FECHA.test(d.fecha)) return 'Indique la fecha del gasto.';
  if (d.fecha > db.config.hoy) return 'La fecha no puede ser posterior a hoy.';
  if (!db.estaciones.some((e) => e.id === d.estacionId)) return 'Seleccione la estación.';
  const cc = db.centrosCosto.find((c) => c.id === d.centroCostoId);
  if (!cc || cc.estacionId !== d.estacionId) return 'El centro de costo no corresponde a la estación.';
  if (!db.categorias.some((c) => c.id === d.categoriaId)) return 'Seleccione la categoría.';
  if (!d.descripcion.trim()) return 'Describa el gasto.';
  if (!(d.monto > 0)) return 'El monto debe ser mayor que cero.';
  if (d.documento.tipo !== 'Sin documento' && !d.documento.numero.trim()) return 'Indique el número del documento.';
  if (d.documento.tipo === 'FEL' && d.proveedorId) {
    const dup = db.gastos.find(
      (g) =>
        g.estado !== 'rechazado' &&
        g.proveedorId === d.proveedorId &&
        g.documento.tipo === 'FEL' &&
        g.documento.numero === d.documento.numero.trim() &&
        g.documento.serie === d.documento.serie.trim(),
    );
    if (dup) return `Esa factura ya está registrada en ${dup.folio}.`;
  }
  return null;
}

function vencimientoDe(db: DB, proveedorId: string | null, desde: string): string {
  const dias = db.proveedores.find((p) => p.id === proveedorId)?.diasCredito ?? 0;
  return sumarDias(desde, dias);
}

/** Debe quedar al menos un usuario activo que pueda administrar usuarios. */
function quedaAdministrador(db: DB): boolean {
  return db.usuarios.some((u) => u.activo && tiene(db, u, 'usuarios'));
}

const exige = (db: DB, u: Usuario, p: Permiso, texto: string): string | null =>
  tiene(db, u, p) ? null : `Su usuario no tiene permiso: no ${texto}.`;

/**
 * Pantalla donde vive cada acción. Además del permiso, el usuario debe tener alguna de estas pantallas:
 * si a alguien se le quita una pantalla, tampoco puede hacer sus operaciones por otra vía.
 */
const PANTALLA_DE: Record<Accion['tipo'], string[]> = {
  crearGasto: ['gastos', 'mis-solicitudes'],
  editarGasto: ['gastos', 'mis-solicitudes'],
  eliminarBorrador: ['gastos', 'mis-solicitudes'],
  reabrirGasto: ['gastos', 'mis-solicitudes'],
  enviarGasto: ['gastos', 'mis-solicitudes'],
  aprobarGasto: ['autorizaciones'],
  rechazarGasto: ['autorizaciones'],
  pagarGasto: ['cuentas-por-pagar'],
  registrarComprobante: ['gastos', 'mis-solicitudes', 'cuentas-por-pagar'],
  verificarComprobante: ['gastos'],
  desembolsoCaja: ['caja-chica'],
  liquidarCaja: ['caja-chica'],
  generarRecurrentes: ['recurrentes'],
  guardarRecurrente: ['recurrentes'],
  toggleRecurrente: ['recurrentes'],
  cambiarEstadoHallazgo: ['hallazgos'],
  guardarPresupuesto: ['presupuestos'],
  copiarPresupuestos: ['presupuestos'],
  guardarProveedor: ['proveedores'],
  toggleProveedor: ['proveedores'],
  guardarUsuario: ['usuarios'],
  toggleUsuario: ['usuarios'],
  guardarRol: ['usuarios'],
  guardarConfig: ['configuracion'],
  guardarCategoria: ['catalogos'],
  guardarCentro: ['catalogos'],
  guardarEstacion: ['estaciones'],
  crearRequerimiento: ['compras'],
  agregarCotizacion: ['compras'],
  emitirOrden: ['compras'],
  recibirOrden: ['compras'],
  cancelarOrden: ['compras'],
  guardarContrato: ['contratos'],
  renovarContrato: ['contratos'],
  aplicarProrrateo: ['prorrateo'],
  quitarProrrateo: ['prorrateo'],
};

const PERMISOS_VALIDOS = new Set<string>(PERMISOS.map(([p]) => p));
const listaPermisos = (ps: unknown): Permiso[] =>
  Array.isArray(ps) ? [...new Set(ps.filter((p): p is Permiso => typeof p === 'string' && PERMISOS_VALIDOS.has(p)))] : [];

/** Lo que define el alcance de un usuario; si cambia, cambia lo que puede ver o hacer. */
function alcance(db: DB, u: Usuario): string {
  return JSON.stringify([u.rolId, permisosDe(db, u), pantallasDe(db, u), limiteDe(db, u), soloPropios(db, u), [...u.estaciones].sort(), u.activo]);
}

/**
 * Ejecuta una acción en nombre de un usuario.
 * `hora` es la hora local (HH:MM:SS); la fecha la pone la configuración ("fecha del sistema").
 */
export function ejecutar(db: DB, usuarioId: string, accion: Accion, hora: string): Resultado {
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  if (!usuario || !usuario.activo) return fallo('Su usuario no está activo. Inicie sesión de nuevo.');
  const requeridas = PANTALLA_DE[accion.tipo];
  if (!requeridas) return fallo('Acción no reconocida.');
  const mias = pantallasDe(db, usuario);
  if (!requeridas.some((r) => mias.includes(r))) return fallo(`Su usuario no tiene acceso a la pantalla ${nombrePantalla(requeridas[0]!)}.`);
  const uid = usuario.id;
  const hoy = db.config.hoy;
  const ahora = marcaDeTiempo(db, hora);
  const log = (d: DB, acc: string, entidad: string, detalle: string) => auditar(d, uid, ahora, acc, entidad, detalle);
  // Lo que el usuario no puede ver, para él no existe: así no se opera ni se confirma la existencia de datos ajenos.
  const gasto = (id: string) => db.gastos.find((g) => g.id === id && veGasto(db, usuario, g));
  const orden = (id: string) => db.ordenesCompra.find((o) => o.id === id && veOrden(db, usuario, o));

  switch (accion.tipo) {
    case 'crearGasto': {
      const { datos, enviar } = accion;
      const v = puedeRegistrar(db, usuario, datos.estacionId);
      if (!v.ok) return fallo(v.motivo);
      const err = validarGasto(db, datos);
      if (err) return fallo(err);
      const [d2, g] = agregarGasto(db, datos, uid, enviar ? 'pendiente' : 'borrador');
      return listo(
        log(d2, 'crear', 'Gasto', `${g.folio} · ${g.descripcion} · ${q(g.monto)}`),
        `${g.folio} ${enviar ? `enviado a autorización (${nivelRequerido(db, g.monto).etiqueta})` : 'guardado como borrador'}.`,
        g.id,
      );
    }

    case 'editarGasto': {
      const g = gasto(accion.id);
      if (!g) return fallo('El gasto no existe.');
      const v = puedeEditarBorrador(db, usuario, g);
      if (!v.ok) return fallo(v.motivo);
      const datos = accion.datos;
      if (!veEstacion(db, usuario, datos.estacionId)) return fallo('No tiene acceso a esa estación.');
      const err = validarGasto({ ...db, gastos: db.gastos.filter((x) => x.id !== g.id) }, datos);
      if (err) return fallo(err);
      const d2 = cambiarGasto(db, g.id, (x) => ({
        ...x,
        fecha: datos.fecha,
        folio: x.folio,
        estacionId: datos.estacionId,
        centroCostoId: datos.centroCostoId,
        categoriaId: datos.categoriaId,
        subcategoria: datos.subcategoria,
        proveedorId: datos.proveedorId,
        descripcion: datos.descripcion.trim(),
        monto: r2(datos.monto),
        iva: ivaDe(datos.monto, datos.documento),
        metodoPago: datos.metodoPago,
        documento: datos.documento,
        vencimiento: datos.vencimiento,
        estado: accion.enviar ? 'pendiente' : 'borrador',
      }));
      return listo(
        log(d2, accion.enviar ? 'enviar' : 'editar', 'Gasto', `${g.folio} · ${datos.descripcion.trim()} · ${q(datos.monto)}`),
        accion.enviar ? `${g.folio} enviado a autorización.` : `${g.folio} actualizado.`,
        g.id,
      );
    }

    case 'eliminarBorrador': {
      const g = gasto(accion.id);
      if (!g) return fallo('El gasto no existe.');
      const v = puedeEditarBorrador(db, usuario, g);
      if (!v.ok) return fallo(v.motivo);
      return listo(log({ ...db, gastos: db.gastos.filter((x) => x.id !== g.id) }, 'eliminar', 'Gasto', `${g.folio} · borrador eliminado`), `Borrador ${g.folio} eliminado.`);
    }

    case 'reabrirGasto': {
      const g = gasto(accion.id);
      if (!g) return fallo('El gasto no existe.');
      const v = puedeReabrir(db, usuario, g);
      if (!v.ok) return fallo(v.motivo);
      return listo(
        log(cambiarGasto(db, g.id, (x) => ({ ...x, estado: 'borrador' })), 'reabrir', 'Gasto', `${g.folio} vuelve a borrador para corregirlo`),
        `${g.folio} volvió a borrador. Corríjalo y envíelo de nuevo.`,
        g.id,
      );
    }

    case 'enviarGasto': {
      const g = gasto(accion.id);
      if (!g) return fallo('El gasto no existe.');
      const v = puedeEditarBorrador(db, usuario, g);
      if (!v.ok) return fallo(v.motivo);
      return listo(
        log(cambiarGasto(db, g.id, (x) => ({ ...x, estado: 'pendiente' })), 'enviar', 'Gasto', `${g.folio} enviado a autorización`),
        `${g.folio} enviado. Lo autoriza: ${nivelRequerido(db, g.monto).etiqueta}.`,
      );
    }

    case 'aprobarGasto':
    case 'rechazarGasto': {
      const g = gasto(accion.id);
      if (!g) return fallo('El gasto no existe.');
      const v = puedeAprobar(db, usuario, g);
      if (!v.ok) return fallo(v.motivo);
      const aprobar = accion.tipo === 'aprobarGasto';
      const comentario = accion.comentario.trim();
      if (!aprobar && !comentario) return fallo('Escriba el motivo del rechazo.');
      const estado = aprobar ? 'aprobado' : 'rechazado';
      const d2 = cambiarGasto(db, g.id, (x) => ({
        ...x,
        estado,
        aprobaciones: [...x.aprobaciones, { usuarioId: uid, fecha: hoy, accion: estado, comentario }],
      }));
      return listo(
        log(d2, estado, 'Gasto', `${g.folio} · ${q(g.monto)}${comentario ? ` · ${comentario}` : ''}`),
        `${g.folio} ${aprobar ? 'aprobado' : 'rechazado'}.`,
      );
    }

    case 'pagarGasto': {
      const g = gasto(accion.id);
      if (!g) return fallo('El gasto no existe.');
      const v = puedePagar(db, usuario, g);
      if (!v.ok) return fallo(v.motivo);
      const pago = accion.pago;
      if (!FECHA.test(pago.fecha) || pago.fecha > hoy) return fallo('La fecha de pago no es válida.');
      if (!pago.referencia.trim()) return fallo('Indique la referencia del pago (cheque, transferencia o recibo).');
      const d2 = cambiarGasto(db, g.id, (x) => ({ ...x, estado: 'pagado', pago: { ...pago, referencia: pago.referencia.trim(), usuarioId: uid } }));
      return listo(log(d2, 'pagar', 'Gasto', `${g.folio} · ${pago.metodo} ${pago.referencia.trim()} · ${q(g.monto)}`), `Pago de ${g.folio} registrado.`);
    }

    case 'registrarComprobante': {
      const g = gasto(accion.id);
      if (!g) return fallo('El gasto no existe.');
      const v = puedeComprobante(db, usuario, g);
      if (!v.ok) return fallo(v.motivo);
      const doc = accion.doc;
      if (doc.tipo !== 'Sin documento' && !doc.numero.trim()) return fallo('Indique el número del documento.');
      const d2 = cambiarGasto(db, g.id, (x) => ({
        ...x,
        documento: { ...doc, serie: doc.serie.trim(), numero: doc.numero.trim(), verificado: false },
        iva: ivaDe(x.monto, doc),
      }));
      const adj = doc.archivoNombre ? ` · adjunto ${doc.archivoNombre}` : '';
      return listo(log(d2, 'comprobante', 'Gasto', `${g.folio} · ${doc.tipo} ${doc.serie} ${doc.numero}${adj}`.replace(/\s+/g, ' ')), `Comprobante registrado en ${g.folio}.`);
    }

    case 'verificarComprobante': {
      const g = gasto(accion.id);
      const err = exige(db, usuario, 'revisar', 'verifica facturas');
      if (err) return fallo(err);
      if (!g) return fallo('El gasto no existe.');
      if (g.documento.tipo !== 'FEL') return fallo('Solo se verifican facturas FEL.');
      const d2 = cambiarGasto(db, g.id, (x) => ({ ...x, documento: { ...x.documento, verificado: true } }));
      return listo(
        log(d2, 'verificar_fel', 'Integración', `${g.folio} · FEL ${g.documento.serie}-${g.documento.numero} válida (simulado)`),
        'Factura verificada (simulación de consulta a SAT).',
      );
    }

    case 'desembolsoCaja': {
      const caja = db.cajasChicas.find((c) => c.id === accion.cajaId);
      if (!caja) return fallo('La caja no existe.');
      const v = puedeOperarCaja(db, usuario, caja.estacionId);
      if (!v.ok) return fallo(v.motivo);
      const mov = accion.mov;
      if (!FECHA.test(mov.fecha) || mov.fecha > hoy) return fallo('La fecha del desembolso no es válida.');
      if (!mov.descripcion.trim()) return fallo('Describa el desembolso.');
      if (!(mov.monto > 0)) return fallo('El monto debe ser mayor que cero.');
      if (mov.monto > db.config.limiteDesembolsoCaja)
        return fallo(`Supera el tope por desembolso de ${q(db.config.limiteDesembolsoCaja)}; registre un gasto normal.`);
      if (mov.monto > estadoCaja(db, caja).saldo) return fallo('No hay saldo suficiente en la caja.');
      if (mov.monto >= db.config.comprobanteObligatorioDesde && !mov.comprobante.trim())
        return fallo(`El comprobante es obligatorio desde ${q(db.config.comprobanteObligatorioDesde)}.`);
      const id = `m${siguiente(
        caja.movimientos.map((m) => m.id),
        /^m(\d+)$/,
      )}`;
      const nuevo: MovimientoCaja = { ...mov, descripcion: mov.descripcion.trim(), id, tipo: 'desembolso' };
      const d2 = { ...db, cajasChicas: db.cajasChicas.map((x) => (x.id === caja.id ? { ...x, movimientos: [...x.movimientos, nuevo] } : x)) };
      return listo(log(d2, 'desembolso', 'Caja chica', `${caja.id} · ${nuevo.descripcion} · ${q(mov.monto)}`), 'Desembolso registrado.');
    }

    case 'liquidarCaja': {
      const caja = db.cajasChicas.find((c) => c.id === accion.cajaId);
      if (!caja) return fallo('La caja no existe.');
      const v = puedeOperarCaja(db, usuario, caja.estacionId);
      if (!v.ok) return fallo(v.motivo);
      const pendientes = estadoCaja(db, caja).porLiquidar;
      if (!pendientes.length) return fallo('No hay desembolsos por liquidar.');
      const est = db.estaciones.find((e) => e.id === caja.estacionId)!;
      const n = siguiente(
        db.gastos.map((g) => g.referencia ?? ''),
        new RegExp(`^LIQ-${caja.id}-(\\d+)$`),
      );
      const liqId = `LIQ-${caja.id}-${n}`;
      const centro = db.centrosCosto.find((c) => c.id === `${est.codigo}-ADMIN`) ?? db.centrosCosto.find((c) => c.estacionId === est.id);
      let d2 = db;
      for (const [cat, movs] of agrupar(pendientes, (m) => m.categoriaId ?? 'ADM')) {
        const categoria = db.categorias.find((c) => c.id === cat);
        [d2] = agregarGasto(
          d2,
          {
            fecha: hoy,
            estacionId: caja.estacionId,
            centroCostoId: centro?.id ?? '',
            categoriaId: cat,
            subcategoria: categoria?.subcategorias[0] ?? '',
            proveedorId: null,
            descripcion: `Reposición de caja chica ${caja.id}: ${movs.length} desembolsos de ${(categoria?.nombre ?? cat).toLowerCase()}`,
            monto: sumar(movs, (m) => m.monto),
            metodoPago: 'Efectivo',
            documento: { tipo: 'Recibo', serie: 'LIQ', numero: liqId, fechaEmision: hoy },
            vencimiento: hoy,
            origen: 'caja_chica',
            referencia: liqId,
          },
          uid,
          'pendiente',
        );
      }
      const ids = new Set(pendientes.map((m) => m.id));
      d2 = {
        ...d2,
        cajasChicas: d2.cajasChicas.map((x) =>
          x.id === caja.id ? { ...x, movimientos: x.movimientos.map((m) => (ids.has(m.id) ? { ...m, liquidacionId: liqId } : m)) } : x,
        ),
      };
      return listo(
        log(d2, 'liquidar', 'Caja chica', `${liqId} · ${pendientes.length} desembolsos · ${q(sumar(pendientes, (m) => m.monto))}`),
        'Liquidación enviada a autorización. El fondo se repone cuando Tesorería la pague.',
      );
    }

    case 'generarRecurrentes': {
      let d2 = db;
      const folios: string[] = [];
      for (const id of accion.ids) {
        const r = d2.recurrentes.find((x) => x.id === id);
        if (!r || !veEstacion(d2, usuario, r.estacionId)) continue;
        if (!r.activo) return fallo(`La plantilla "${r.nombre}" está pausada.`);
        const v = puedeRegistrar(d2, usuario, r.estacionId);
        if (!v.ok) return fallo(v.motivo);
        if (!d2.centrosCosto.some((c) => c.id === r.centroCostoId)) return fallo(`La plantilla "${r.nombre}" tiene un centro de costo inválido.`);
        const mes = r.proximaFecha.slice(0, 7);
        const [d3, g] = agregarGasto(
          d2,
          {
            fecha: r.proximaFecha > hoy ? hoy : r.proximaFecha,
            estacionId: r.estacionId,
            centroCostoId: r.centroCostoId,
            categoriaId: r.categoriaId,
            subcategoria: r.subcategoria,
            proveedorId: r.proveedorId || null,
            descripcion: `${r.nombre} (${mes})`,
            monto: r.monto,
            metodoPago: 'Transferencia',
            documento: { tipo: 'Sin documento', serie: '', numero: '', fechaEmision: '' },
            vencimiento: vencimientoDe(d2, r.proveedorId, r.proximaFecha),
            origen: 'recurrente',
          },
          uid,
          'pendiente',
        );
        const meses = MESES_FRECUENCIA[r.frecuencia] ?? 1;
        d2 = {
          ...d3,
          recurrentes: d3.recurrentes.map((x) => (x.id === id ? { ...x, proximaFecha: sumarMeses(x.proximaFecha, meses) } : x)),
        };
        d2 = auditar(d2, uid, ahora, 'generar', 'Recurrente', `${r.nombre} → ${g.folio} · ${q(r.monto)}`);
        folios.push(g.folio);
      }
      if (!folios.length) return fallo('No hay plantillas para generar.');
      return listo(
        d2,
        folios.length === 1 ? `${folios[0]} generado y enviado a autorización.` : `${folios.length} gastos recurrentes generados y enviados a autorización.`,
      );
    }

    case 'guardarRecurrente': {
      const err = exige(db, usuario, 'catalogos', 'administra plantillas de gastos recurrentes');
      if (err) return fallo(err);
      const r = accion.r;
      if (!veEstacion(db, usuario, r.estacionId)) return fallo('No tiene acceso a esa estación.');
      if (r.id) {
        const actual = db.recurrentes.find((x) => x.id === r.id);
        if (!actual || !veEstacion(db, usuario, actual.estacionId)) return fallo('La plantilla no existe.');
      }
      if (!r.nombre.trim()) return fallo('Indique el nombre del gasto.');
      if (!(r.monto > 0)) return fallo('El monto debe ser mayor que cero.');
      if (!FECHA.test(r.proximaFecha)) return fallo('Indique la próxima fecha.');
      const cc = db.centrosCosto.find((c) => c.id === r.centroCostoId);
      if (!cc || cc.estacionId !== r.estacionId) return fallo('El centro de costo no corresponde a la estación.');
      if (!db.categorias.some((c) => c.id === r.categoriaId)) return fallo('Seleccione la categoría.');
      const nuevo = !r.id;
      const id = nuevo
        ? `RT${siguiente(
            db.recurrentes.map((x) => x.id),
            /^RT(\d+)$/,
          )}`
        : r.id;
      const rec: Recurrente = { ...r, id, nombre: r.nombre.trim(), monto: r2(r.monto), diaPago: Number(r.proximaFecha.slice(8, 10)) };
      const recurrentes = nuevo ? [...db.recurrentes, rec] : db.recurrentes.map((x) => (x.id === id ? rec : x));
      return listo(log({ ...db, recurrentes }, nuevo ? 'crear' : 'editar', 'Recurrente', `${rec.nombre} · ${q(rec.monto)} · ${rec.frecuencia}`), 'Plantilla guardada.', id);
    }

    case 'toggleRecurrente': {
      const r = db.recurrentes.find((x) => x.id === accion.id && veEstacion(db, usuario, x.estacionId));
      if (!r) return fallo('La plantilla no existe.');
      const err = exige(db, usuario, 'catalogos', 'administra plantillas de gastos recurrentes');
      if (err) return fallo(err);
      return listo(
        log({ ...db, recurrentes: db.recurrentes.map((x) => (x.id === r.id ? { ...x, activo: !x.activo } : x)) }, r.activo ? 'desactivar' : 'activar', 'Recurrente', r.nombre),
        r.activo ? 'Plantilla pausada.' : 'Plantilla activada.',
      );
    }

    case 'cambiarEstadoHallazgo': {
      const h = db.hallazgos.find((x) => x.id === accion.id && veEstacion(db, usuario, x.estacionId));
      if (!h) return fallo('El hallazgo no existe.');
      const err = exige(db, usuario, 'auditar', 'da seguimiento a hallazgos');
      if (err) return fallo(err);
      return listo(
        log({ ...db, hallazgos: db.hallazgos.map((x) => (x.id === h.id ? { ...x, estado: accion.estado } : x)) }, 'hallazgo', 'Control', `${h.titulo} → ${accion.estado.replace('_', ' ')}`),
        'Hallazgo actualizado.',
      );
    }

    case 'guardarPresupuesto': {
      const err = exige(db, usuario, 'presupuestos', 'modifica presupuestos');
      if (err) return fallo(err);
      const { periodo, estacionId, categoriaId, monto } = accion;
      if (!db.estaciones.some((e) => e.id === estacionId) || !veEstacion(db, usuario, estacionId)) return fallo('No tiene acceso a esa estación.');
      if (!db.categorias.some((c) => c.id === categoriaId)) return fallo('Seleccione la categoría.');
      if (!(monto >= 0)) return fallo('Monto inválido.');
      if (!/^\d{4}-\d{2}$/.test(periodo)) return fallo('Periodo inválido.');
      const id = `PR-${periodo}-${estacionId}-${categoriaId}`;
      const existe = db.presupuestos.some((p) => p.id === id);
      const presupuestos = existe
        ? db.presupuestos.map((p) => (p.id === id ? { ...p, monto: r2(monto) } : p))
        : [...db.presupuestos, { id, periodo, estacionId, categoriaId, monto: r2(monto) }];
      return listo(log({ ...db, presupuestos }, 'presupuesto', 'Presupuesto', `${id} = ${q(monto)}`), 'Presupuesto actualizado.');
    }

    case 'copiarPresupuestos': {
      const err = exige(db, usuario, 'presupuestos', 'modifica presupuestos');
      if (err) return fallo(err);
      const { desde, hacia } = accion;
      if (desde === hacia) return fallo('Elija un periodo distinto.');
      const origen = db.presupuestos.filter((p) => p.periodo === desde && veEstacion(db, usuario, p.estacionId));
      if (!origen.length) return fallo('El periodo de origen no tiene presupuesto.');
      if (!/^\d{4}-\d{2}$/.test(hacia)) return fallo('Periodo inválido.');
      const existentes = new Set(db.presupuestos.filter((p) => p.periodo === hacia).map((p) => p.id));
      const nuevos = origen
        .map((p) => ({ ...p, id: `PR-${hacia}-${p.estacionId}-${p.categoriaId}`, periodo: hacia }))
        .filter((p) => !existentes.has(p.id));
      if (!nuevos.length) return fallo('El periodo ya tiene todas esas líneas de presupuesto.');
      return listo(
        log({ ...db, presupuestos: [...db.presupuestos, ...nuevos] }, 'presupuesto', 'Presupuesto', `Copia ${desde} → ${hacia} · ${nuevos.length} líneas`),
        `${nuevos.length} líneas copiadas de ${desde}.`,
      );
    }

    case 'guardarProveedor': {
      const err = exige(db, usuario, 'catalogos', 'administra proveedores');
      if (err) return fallo(err);
      const p = accion.p;
      if (!p.nombre.trim()) return fallo('El nombre es obligatorio.');
      const nit = p.nit.trim().toUpperCase();
      if (nit && nit !== 'POR DEFINIR' && db.proveedores.some((x) => x.id !== p.id && x.nit.toUpperCase() === nit))
        return fallo(`Ya existe un proveedor con NIT ${p.nit.trim()}.`);
      const nuevo = !p.id;
      const id = nuevo
        ? `P${String(
            siguiente(
              db.proveedores.map((x) => x.id),
              /^P(\d+)$/,
            ),
          ).padStart(2, '0')}`
        : p.id;
      const prov = { ...p, id, nombre: p.nombre.trim(), nit: p.nit.trim() || 'Por definir' };
      const proveedores = nuevo ? [...db.proveedores, prov] : db.proveedores.map((x) => (x.id === id ? prov : x));
      return listo(log({ ...db, proveedores }, nuevo ? 'crear' : 'editar', 'Proveedor', `${id} · ${prov.nombre}`), 'Proveedor guardado.', id);
    }

    case 'toggleProveedor': {
      const p = db.proveedores.find((x) => x.id === accion.id);
      if (!p) return fallo('El proveedor no existe.');
      const err = exige(db, usuario, 'catalogos', 'administra proveedores');
      if (err) return fallo(err);
      return listo(
        log({ ...db, proveedores: db.proveedores.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)) }, p.activo ? 'desactivar' : 'activar', 'Proveedor', p.nombre),
        p.activo ? 'Proveedor desactivado.' : 'Proveedor activado.',
      );
    }

    case 'guardarUsuario': {
      const err = exige(db, usuario, 'usuarios', 'administra usuarios');
      if (err) return fallo(err);
      const u = accion.u;
      const login = u.usuario.trim().toLowerCase();
      if (!u.nombre.trim()) return fallo('Indique el nombre.');
      if (!/^[a-z0-9._-]{3,30}$/.test(login)) return fallo('El usuario debe tener de 3 a 30 letras, números, punto o guion, sin espacios.');
      if (db.usuarios.some((x) => x.id !== u.id && x.usuario.toLowerCase() === login)) return fallo(`El usuario "${login}" ya existe.`);
      const rol = db.roles.find((r) => r.id === u.rolId);
      if (!rol) return fallo('Seleccione un rol.');
      const estaciones = [...new Set(u.estaciones)].filter((e) => db.estaciones.some((x) => x.id === e));
      if (!estaciones.length) return fallo('Asigne al menos una estación.');
      const lim = u.limiteAutorizacion;
      if (lim !== undefined && lim !== null && !(typeof lim === 'number' && lim >= 0)) return fallo('Límite de autorización inválido.');
      const nuevo = !u.id;
      const anterior = nuevo ? undefined : db.usuarios.find((x) => x.id === u.id);
      if (!nuevo && !anterior) return fallo('El usuario no existe.');
      if (nuevo && (accion.clave ?? '').length < 6) return fallo('La contraseña inicial debe tener al menos 6 caracteres.');
      const id = anterior
        ? anterior.id
        : `U${siguiente(
            db.usuarios.map((x) => x.id),
            /^U(\d+)$/,
          )}`;
      // Solo se guarda lo que difiere del rol: si el rol cambia, el usuario lo hereda.
      const extra = listaPermisos(u.permisosExtra).filter((p) => !rol.permisos.includes(p));
      const quitados = listaPermisos(u.permisosQuitados).filter((p) => rol.permisos.includes(p));
      const pantallasExtra = listaPantallas(u.pantallasExtra).filter((p) => !rol.pantallas.includes(p));
      const pantallasQuitadas = listaPantallas(u.pantallasQuitadas).filter((p) => rol.pantallas.includes(p));
      const datos: Usuario = {
        id,
        nombre: u.nombre.trim(),
        usuario: login,
        rolId: rol.id,
        estaciones,
        activo: u.activo !== false,
        ...(extra.length ? { permisosExtra: extra } : {}),
        ...(quitados.length ? { permisosQuitados: quitados } : {}),
        ...(pantallasExtra.length ? { pantallasExtra } : {}),
        ...(pantallasQuitadas.length ? { pantallasQuitadas } : {}),
        ...(lim !== undefined && lim !== rol.limiteAutorizacion ? { limiteAutorizacion: lim === null ? null : r2(lim) } : {}),
        ...(typeof u.soloPropios === 'boolean' && u.soloPropios !== rol.soloPropios ? { soloPropios: u.soloPropios } : {}),
      };
      if (anterior && anterior.id === uid) {
        if (alcance(db, anterior) !== alcance(db, datos))
          return fallo('No puede cambiar su propio rol, permisos, pantallas, límite ni estaciones. Pídaselo a otro administrador.');
      } else {
        if (anterior) {
          const v = administra(db, usuario, anterior);
          if (!v.ok) return fallo(`No puede modificar a ${anterior.nombre}: ${v.motivo}`);
        }
        const v = administra(db, usuario, datos);
        if (!v.ok) return fallo(v.motivo);
      }
      const usuarios = anterior ? db.usuarios.map((x) => (x.id === id ? datos : x)) : [...db.usuarios, datos];
      const d2 = { ...db, usuarios };
      if (!quedaAdministrador(d2)) return fallo('Debe quedar al menos un usuario activo que administre usuarios.');
      const ajustes = [
        extra.length ? `+${extra.join(', +')}` : '',
        quitados.length ? `-${quitados.join(', -')}` : '',
        pantallasExtra.length ? `+pantallas ${pantallasExtra.join(', ')}` : '',
        pantallasQuitadas.length ? `-pantallas ${pantallasQuitadas.join(', ')}` : '',
        datos.limiteAutorizacion !== undefined ? `límite ${datos.limiteAutorizacion === null ? 'sin límite' : q(datos.limiteAutorizacion)}` : '',
        datos.soloPropios !== undefined ? (datos.soloPropios ? 'solo lo propio' : 'todo lo de sus estaciones') : '',
      ].filter(Boolean);
      return listo(
        log(d2, nuevo ? 'crear' : 'editar', 'Usuario', `${datos.nombre} (${login}) · ${rol.nombre}${ajustes.length ? ` · ${ajustes.join(' · ')}` : ''}`),
        nuevo ? `Usuario ${login} creado.` : 'Usuario actualizado.',
        id,
      );
    }

    case 'toggleUsuario': {
      const err = exige(db, usuario, 'usuarios', 'administra usuarios');
      if (err) return fallo(err);
      if (accion.id === uid) return fallo('No puede desactivarse a sí mismo.');
      const u = db.usuarios.find((x) => x.id === accion.id);
      if (!u) return fallo('El usuario no existe.');
      const v = administra(db, usuario, u);
      if (!v.ok) return fallo(`No puede modificar a ${u.nombre}: ${v.motivo}`);
      const d2 = { ...db, usuarios: db.usuarios.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x)) };
      if (!quedaAdministrador(d2)) return fallo('Debe quedar al menos un usuario activo que administre usuarios.');
      return listo(log(d2, u.activo ? 'desactivar' : 'activar', 'Usuario', u.nombre), u.activo ? `${u.nombre} ya no puede iniciar sesión.` : `${u.nombre} activado.`);
    }

    case 'guardarRol': {
      const err = exige(db, usuario, 'usuarios', 'administra roles');
      if (err) return fallo(err);
      const r = accion.rol;
      if (!r.nombre.trim()) return fallo('Indique el nombre del rol.');
      if (r.limiteAutorizacion !== null && !(r.limiteAutorizacion >= 0)) return fallo('Límite de autorización inválido.');
      const nuevo = !r.id;
      const anterior = nuevo ? undefined : db.roles.find((x) => x.id === r.id);
      if (!nuevo && !anterior) return fallo('El rol no existe.');
      const id = anterior
        ? anterior.id
        : `RL${siguiente(
            db.roles.map((x) => x.id),
            /^RL(\d+)$/,
          )}`;
      if (db.roles.some((x) => x.id !== id && x.nombre.trim().toLowerCase() === r.nombre.trim().toLowerCase())) return fallo('Ya existe un rol con ese nombre.');
      const rol: Rol = {
        id,
        nombre: r.nombre.trim(),
        descripcion: r.descripcion.trim(),
        permisos: listaPermisos(r.permisos),
        pantallas: listaPantallas(r.pantallas),
        limiteAutorizacion: r.limiteAutorizacion === null ? null : r2(r.limiteAutorizacion),
        soloPropios: r.soloPropios === true,
      };
      if (anterior) {
        const v = administraRol(db, usuario, anterior);
        if (!v.ok) return fallo(`No puede modificar el rol ${anterior.nombre}: ${v.motivo}`);
      }
      const v = administraRol(db, usuario, rol);
      if (!v.ok) return fallo(v.motivo);
      const roles = anterior ? db.roles.map((x) => (x.id === id ? rol : x)) : [...db.roles, rol];
      const niveles = db.config.niveles.map((n) => (n.rolId === id ? { ...n, hasta: rol.limiteAutorizacion } : n));
      const d2 = { ...db, roles, config: { ...db.config, niveles } };
      if (!quedaAdministrador(d2)) return fallo('Debe quedar al menos un usuario activo que administre usuarios.');
      if (db.usuarios.some((x) => x.id === uid && x.rolId === id) && alcance(db, usuario) !== alcance(d2, usuario))
        return fallo('No puede cambiar el rol que usted mismo tiene. Pídaselo a otro administrador.');
      return listo(
        log(d2, nuevo ? 'crear' : 'editar', 'Rol', `${rol.nombre} · ${rol.permisos.join(', ') || 'sin permisos'} · ${rol.pantallas.length} pantallas`),
        `Rol "${rol.nombre}" guardado.`,
        id,
      );
    }

    case 'guardarConfig': {
      const err = exige(db, usuario, 'configurar', 'modifica la configuración');
      if (err) return fallo(err);
      const cfg = accion.cfg;
      if (!FECHA.test(cfg.hoy)) return fallo('La fecha del sistema no es válida.');
      if (!/^\d{4}-\d{2}$/.test(cfg.periodoActual)) return fallo('El periodo abierto no es válido.');
      if (JSON.stringify(cfg.niveles) !== JSON.stringify(db.config.niveles) && !tiene(db, usuario, 'usuarios'))
        return fallo('Los límites de autorización los cambia quien administra usuarios y roles.');
      const topes = cfg.niveles.map((n) => n.hasta).filter((h): h is number => h !== null);
      if (topes.some((t, i) => i > 0 && t <= topes[i - 1]!)) return fallo('Los topes de autorización deben ir en aumento.');
      const roles: Rol[] = db.roles.map((r) => {
        const nivel = cfg.niveles.find((n) => n.rolId === r.id);
        return nivel ? { ...r, limiteAutorizacion: nivel.hasta } : r;
      });
      const empresa = { ...db.empresa, periodoActual: cfg.periodoActual };
      return listo(auditar({ ...db, config: cfg, roles, empresa }, uid, `${cfg.hoy}T${hora}`, 'configurar', 'Configuración', 'Parámetros actualizados'), 'Configuración guardada.');
    }

    case 'guardarCategoria': {
      const err = exige(db, usuario, 'catalogos', 'administra catálogos');
      if (err) return fallo(err);
      const c = accion.c;
      const id = c.id.trim().toUpperCase();
      if (!/^[A-Z0-9]{2,6}$/.test(id)) return fallo('El código debe tener de 2 a 6 letras o números.');
      if (!c.nombre.trim()) return fallo('Indique el nombre.');
      if (accion.nueva && db.categorias.some((x) => x.id === id)) return fallo(`Ya existe la categoría ${id}.`);
      const subcategorias = [...new Set(c.subcategorias.map((s) => s.trim()).filter(Boolean))];
      if (!subcategorias.length) return fallo('Agregue al menos una subcategoría.');
      const cat: Categoria = { ...c, id, nombre: c.nombre.trim(), descripcion: c.descripcion.trim(), cuentaContable: c.cuentaContable.trim(), subcategorias };
      const categorias = accion.nueva ? [...db.categorias, cat] : db.categorias.map((x) => (x.id === id ? cat : x));
      return listo(log({ ...db, categorias }, accion.nueva ? 'crear' : 'editar', 'Categoría', `${id} · ${cat.nombre} · cuenta ${cat.cuentaContable}`), 'Categoría guardada.', id);
    }

    case 'guardarCentro': {
      const err = exige(db, usuario, 'catalogos', 'administra catálogos');
      if (err) return fallo(err);
      const c = accion.c;
      const est = db.estaciones.find((e) => e.id === c.estacionId);
      if (!est) return fallo('Seleccione la estación.');
      if (!veEstacion(db, usuario, est.id)) return fallo('No tiene acceso a esa estación.');
      if (!accion.nuevo) {
        const actual = db.centrosCosto.find((x) => x.id === c.id);
        if (!actual || !veEstacion(db, usuario, actual.estacionId)) return fallo('El centro de costo no existe.');
      }
      if (!db.unidades.some((u) => u.id === c.unidad)) return fallo('Seleccione la unidad de negocio.');
      const id = accion.nuevo ? `${est.codigo}-${c.unidad}` : c.id;
      if (accion.nuevo && db.centrosCosto.some((x) => x.id === id)) return fallo(`El centro ${id} ya existe.`);
      const nombre = c.nombre.trim() || `${db.unidades.find((u) => u.id === c.unidad)?.nombre} · ${est.codigo}`;
      const cc: CentroCosto = { ...c, id, codigo: id, nombre };
      const centrosCosto = accion.nuevo ? [...db.centrosCosto, cc] : db.centrosCosto.map((x) => (x.id === id ? cc : x));
      const estaciones = db.estaciones.map((e) => (e.id === est.id && !e.unidades.includes(c.unidad) ? { ...e, unidades: [...e.unidades, c.unidad] } : e));
      return listo(log({ ...db, centrosCosto, estaciones }, accion.nuevo ? 'crear' : 'editar', 'Centro de costo', `${id} · ${nombre}`), 'Centro de costo guardado.', id);
    }

    case 'guardarEstacion': {
      const err = exige(db, usuario, 'configurar', 'administra estaciones');
      if (err) return fallo(err);
      const e = accion.e;
      const codigo = e.codigo.trim().toUpperCase();
      if (!/^[A-Z0-9]{2,8}$/.test(codigo)) return fallo('El código debe tener de 2 a 8 letras o números.');
      if (!e.nombre.trim()) return fallo('Indique el nombre de la estación.');
      if (!e.unidades.length) return fallo('Elija al menos una unidad de negocio.');
      if (db.estaciones.some((x) => x.id !== e.id && x.codigo === codigo)) return fallo(`Ya existe una estación con código ${codigo}.`);
      const nuevo = !e.id;
      const anterior = db.estaciones.find((x) => x.id === e.id);
      if (!nuevo && (!anterior || !veEstacion(db, usuario, anterior.id))) return fallo('La estación no existe.');
      if (anterior && anterior.codigo !== codigo) return fallo('El código de una estación existente no se cambia (lo usan sus centros de costo).');
      const id = nuevo
        ? `E${siguiente(
            db.estaciones.map((x) => x.id),
            /^E(\d+)$/,
          )}`
        : e.id;
      const est: Estacion = {
        id,
        codigo,
        nombre: e.nombre.trim(),
        direccion: e.direccion.trim(),
        gerenteId: e.gerenteId,
        unidades: e.unidades,
        demo: anterior?.demo ?? false,
        activa: e.activa,
      };
      const estaciones = nuevo ? [...db.estaciones, est] : db.estaciones.map((x) => (x.id === id ? est : x));
      const centrosNuevos: CentroCosto[] = est.unidades
        .filter((u) => !db.centrosCosto.some((c) => c.id === `${codigo}-${u}`))
        .map((u) => ({
          id: `${codigo}-${u}`,
          codigo: `${codigo}-${u}`,
          nombre: `${db.unidades.find((x) => x.id === u)?.nombre ?? u} · ${codigo}`,
          estacionId: id,
          unidad: u,
          activo: true,
        }));
      let cajasChicas = db.cajasChicas;
      const fondo = r2(e.fondoCaja ?? 0);
      if (nuevo && fondo > 0) {
        const cajaId = `CC${siguiente(
          db.cajasChicas.map((c) => c.id),
          /^CC(\d+)$/,
        )}`;
        cajasChicas = [
          ...cajasChicas,
          {
            id: cajaId,
            estacionId: id,
            fondo,
            responsableId: e.gerenteId,
            movimientos: [{ id: 'm1', fecha: hoy, tipo: 'apertura', descripcion: 'Saldo inicial del fondo', monto: fondo, categoriaId: null, comprobante: '' }],
          },
        ];
      }
      const d2 = { ...db, estaciones, centrosCosto: [...db.centrosCosto, ...centrosNuevos], cajasChicas };
      return listo(
        log(d2, nuevo ? 'crear' : 'editar', 'Estación', `${codigo} · ${est.nombre}${centrosNuevos.length ? ` · ${centrosNuevos.length} centros de costo` : ''}`),
        nuevo ? `Estación ${codigo} creada con ${centrosNuevos.length} centros de costo.` : 'Estación actualizada.',
        id,
      );
    }

    case 'crearRequerimiento': {
      const datos = accion.datos;
      const v = puedeRegistrar(db, usuario, datos.estacionId);
      if (!v.ok) return fallo(v.motivo);
      if (!datos.descripcion.trim()) return fallo('Describa qué se necesita.');
      const cc = db.centrosCosto.find((c) => c.id === datos.centroCostoId);
      if (!cc || cc.estacionId !== datos.estacionId) return fallo('El centro de costo no corresponde a la estación.');
      const n = siguiente(
        db.ordenesCompra.map((o) => o.id),
        /^OC-\d{4}-(\d+)$/,
      );
      const oc: OrdenCompra = {
        ...datos,
        descripcion: datos.descripcion.trim(),
        id: `OC-${hoy.slice(0, 4)}-${String(n).padStart(3, '0')}`,
        fecha: hoy,
        solicitanteId: uid,
        estado: 'requerimiento',
        cotizaciones: [],
        proveedorId: null,
        monto: null,
        fechaOrden: null,
        fechaRecepcion: null,
        gastoId: null,
      };
      return listo(log({ ...db, ordenesCompra: [oc, ...db.ordenesCompra] }, 'crear', 'Compra', `${oc.id} · ${oc.descripcion}`), `Requerimiento ${oc.id} creado.`, oc.id);
    }

    case 'agregarCotizacion': {
      const oc = orden(accion.ocId);
      if (!oc) return fallo('La compra no existe.');
      if (oc.estado !== 'requerimiento' && oc.estado !== 'cotizando') return fallo('La compra ya no recibe cotizaciones.');
      const v = puedeRegistrar(db, usuario, oc.estacionId);
      if (!v.ok) return fallo(v.motivo);
      const cot = accion.cot;
      if (!db.proveedores.some((p) => p.id === cot.proveedorId)) return fallo('Seleccione el proveedor.');
      if (!(cot.monto > 0)) return fallo('El monto de la cotización debe ser mayor que cero.');
      const d2 = {
        ...db,
        ordenesCompra: db.ordenesCompra.map((o) => (o.id === oc.id ? { ...o, estado: 'cotizando' as const, cotizaciones: [...o.cotizaciones, { ...cot, monto: r2(cot.monto) }] } : o)),
      };
      return listo(log(d2, 'cotizacion', 'Compra', `${oc.id} · ${q(cot.monto)}`), 'Cotización agregada.');
    }

    case 'emitirOrden': {
      const oc = orden(accion.ocId);
      const cot = oc?.cotizaciones[accion.idx];
      if (!oc || !cot) return fallo('La cotización no existe.');
      if (oc.estado !== 'cotizando') return fallo('La compra no está en cotización.');
      if (!veEstacion(db, usuario, oc.estacionId)) return fallo('No tiene acceso a esa estación.');
      if (!limiteCubre(db, usuario, cot.monto)) return fallo(`Necesita autorización de ${nivelRequerido(db, cot.monto).etiqueta} para ${q(cot.monto)}.`);
      if (oc.solicitanteId === uid) return fallo('Quien solicita la compra no puede autorizarla.');
      const d2 = {
        ...db,
        ordenesCompra: db.ordenesCompra.map((o) =>
          o.id === oc.id ? { ...o, estado: 'ordenada' as const, proveedorId: cot.proveedorId, monto: cot.monto, fechaOrden: hoy, aprobadorId: uid } : o,
        ),
      };
      return listo(log(d2, 'ordenar', 'Compra', `${oc.id} · ${q(cot.monto)}`), `Orden ${oc.id} emitida.`);
    }

    case 'recibirOrden': {
      const oc = orden(accion.ocId);
      if (!oc || oc.estado !== 'ordenada' || oc.monto === null) return fallo('La orden no está pendiente de recibir.');
      const v = puedeRegistrar(db, usuario, oc.estacionId);
      if (!v.ok) return fallo(v.motivo);
      const doc = accion.doc;
      if (!doc.numero.trim()) return fallo('Registre la factura del proveedor.');
      const sub = db.categorias.find((c) => c.id === oc.categoriaId)?.subcategorias[0] ?? '';
      const [d2, g] = agregarGasto(
        db,
        {
          fecha: hoy,
          estacionId: oc.estacionId,
          centroCostoId: oc.centroCostoId,
          categoriaId: oc.categoriaId,
          subcategoria: sub,
          proveedorId: oc.proveedorId,
          descripcion: oc.descripcion,
          monto: oc.monto,
          metodoPago: 'Transferencia',
          documento: doc,
          vencimiento: vencimientoDe(db, oc.proveedorId, hoy),
          origen: 'compra',
          referencia: oc.id,
        },
        oc.solicitanteId,
        'aprobado',
        {
          aprobaciones: [
            { usuarioId: oc.aprobadorId ?? uid, fecha: oc.fechaOrden ?? hoy, accion: 'aprobado', comentario: `Autorizado en la orden ${oc.id}` },
          ],
        },
      );
      const d3 = {
        ...d2,
        ordenesCompra: d2.ordenesCompra.map((o) => (o.id === oc.id ? { ...o, estado: 'recibida' as const, fechaRecepcion: hoy, gastoId: g.id } : o)),
      };
      return listo(log(d3, 'recibir', 'Compra', `${oc.id} → ${g.folio} · ${q(g.monto)}`), `Recepción registrada; ${g.folio} pasa a cuentas por pagar.`, g.id);
    }

    case 'cancelarOrden': {
      const oc = orden(accion.ocId);
      if (!oc) return fallo('La compra no existe.');
      if (oc.estado === 'recibida' || oc.estado === 'cancelada') return fallo('La compra ya está cerrada.');
      if (oc.solicitanteId !== uid && !(tiene(db, usuario, 'aprobar') && veEstacion(db, usuario, oc.estacionId)))
        return fallo('Solo quien la solicitó o quien autoriza en la estación puede cancelarla.');
      return listo(
        log({ ...db, ordenesCompra: db.ordenesCompra.map((o) => (o.id === oc.id ? { ...o, estado: 'cancelada' } : o)) }, 'cancelar', 'Compra', oc.id),
        `${oc.id} cancelada.`,
      );
    }

    case 'guardarContrato': {
      const err = exige(db, usuario, 'catalogos', 'administra contratos');
      if (err) return fallo(err);
      const c = accion.c;
      if (!c.objeto.trim()) return fallo('Indique el servicio contratado.');
      if (!db.proveedores.some((p) => p.id === c.proveedorId)) return fallo('Seleccione el proveedor.');
      if (!db.estaciones.some((e) => e.id === c.estacionId)) return fallo('Seleccione la estación.');
      if (!veEstacion(db, usuario, c.estacionId)) return fallo('No tiene acceso a esa estación.');
      if (c.id) {
        const actual = db.contratos.find((x) => x.id === c.id);
        if (!actual || !veEstacion(db, usuario, actual.estacionId)) return fallo('El contrato no existe.');
      }
      if (!FECHA.test(c.inicio) || !FECHA.test(c.fin) || c.fin <= c.inicio) return fallo('Revise las fechas: el fin debe ser posterior al inicio.');
      if (!(c.montoMensual >= 0)) return fallo('Monto mensual inválido.');
      const nuevo = !c.id;
      const id = nuevo
        ? `CT-${String(
            siguiente(
              db.contratos.map((x) => x.id),
              /^CT-(\d+)$/,
            ),
          ).padStart(3, '0')}`
        : c.id;
      const ct: Contrato = { ...c, id, objeto: c.objeto.trim(), montoMensual: r2(c.montoMensual), documento: c.documento.trim() || 'Pendiente de digitalizar' };
      const contratos = nuevo ? [...db.contratos, ct] : db.contratos.map((x) => (x.id === id ? ct : x));
      return listo(log({ ...db, contratos }, nuevo ? 'crear' : 'editar', 'Contrato', `${id} · ${ct.objeto} · ${q(ct.montoMensual)}/mes`), 'Contrato guardado.', id);
    }

    case 'renovarContrato': {
      const c = db.contratos.find((x) => x.id === accion.id && veEstacion(db, usuario, x.estacionId));
      if (!c) return fallo('El contrato no existe.');
      if (!tiene(db, usuario, 'aprobar') || !tiene(db, usuario, 'ver_todo')) return fallo('Las renovaciones las autoriza la administración central.');
      return listo(
        log({ ...db, contratos: db.contratos.map((x) => (x.id === c.id ? { ...x, fin: sumarMeses(x.fin, accion.meses) } : x)) }, 'renovar', 'Contrato', `${c.objeto} · +${accion.meses} meses`),
        'Contrato renovado.',
      );
    }

    case 'aplicarProrrateo': {
      const err = exige(db, usuario, 'presupuestos', 'aplica prorrateos') ?? exige(db, usuario, 'ver_todo', 've todas las estaciones');
      if (err) return fallo(err);
      const { periodo, criterio } = accion;
      const pesos = pesosProrrateo(db, periodo, criterio);
      if (!pesos.length) return fallo('No hay estaciones con ventas para repartir.');
      let total = 0;
      const gastos = db.gastos.map((g) => {
        if (g.estacionId !== ESTACION_CENTRAL || g.fecha.slice(0, 7) !== periodo || g.estado === 'rechazado') return g;
        total += g.monto;
        let resto = g.monto;
        const distribucion = pesos.map((p, i) => {
          const monto = i === pesos.length - 1 ? r2(resto) : r2((g.monto * p.pct) / 100);
          resto -= monto;
          return { estacionId: p.estacionId, pct: p.pct, monto };
        });
        return { ...g, distribucion };
      });
      if (!total) return fallo('No hay gastos de oficina central en ese periodo.');
      return listo(
        log({ ...db, gastos }, 'prorrateo', 'Prorrateo', `${periodo} · ${criterio === 'ventas' ? 'según ventas' : 'partes iguales'} · ${q(total)}`),
        'Prorrateo aplicado a los gastos de oficina central.',
      );
    }

    case 'quitarProrrateo': {
      const err = exige(db, usuario, 'presupuestos', 'aplica prorrateos') ?? exige(db, usuario, 'ver_todo', 've todas las estaciones');
      if (err) return fallo(err);
      const gastos = db.gastos.map((g) =>
        g.estacionId === ESTACION_CENTRAL && g.fecha.slice(0, 7) === accion.periodo ? { ...g, distribucion: undefined } : g,
      );
      return listo(log({ ...db, gastos }, 'prorrateo', 'Prorrateo', `${accion.periodo} · prorrateo revertido`), 'Prorrateo revertido.');
    }
  }
}

/**
 * Lo que cada usuario recibe del servidor. Cada dato sale solo si el usuario tiene alguna pantalla que lo usa:
 * - Gastos y compras: solo de sus estaciones (todas si tiene "ver todas las estaciones"); con alcance "solo lo propio",
 *   solo lo que registró.
 * - Ventas, presupuestos, caja chica, recurrentes, contratos y hallazgos: solo con la pantalla correspondiente.
 * - Bitácora completa y lista completa de usuarios: solo con las pantallas de auditoría y de usuarios. Sin ellas,
 *   sus propios eventos y los de gastos que puede ver, y solo las personas con quienes trabaja.
 */
export function vistaPara(db: DB, u: Usuario): DB {
  const ve = (estacionId: string) => veEstacion(db, u, estacionId);
  const mias = new Set(pantallasDe(db, u));
  const con = (...rutas: string[]) => rutas.some((r) => mias.has(r));
  const propios = soloPropios(db, u);
  const gastos = con('gastos', 'mis-solicitudes') ? db.gastos.filter((g) => veGasto(db, u, g)) : [];
  const ordenesCompra = con('compras', 'mis-solicitudes') ? db.ordenesCompra.filter((o) => veOrden(db, u, o)) : [];
  const estaciones = db.estaciones.filter((e) => ve(e.id));
  const cajasChicas = con('caja-chica') ? db.cajasChicas.filter((c) => ve(c.estacionId)) : [];

  let auditoria = db.auditoria;
  if (!con('auditoria')) {
    const claves = new Set<string>([...gastos.map((g) => g.folio), ...ordenesCompra.map((o) => o.id)]);
    const re = /G-\d{4}-\d{4}|OC-\d{4}-\d{3}/g;
    auditoria = db.auditoria.filter((a) => a.usuarioId === u.id || (a.detalle.match(re) ?? []).some((k) => claves.has(k)));
  }

  let usuarios = db.usuarios;
  let roles = db.roles;
  if (!con('usuarios')) {
    const ids = new Set<string>([u.id]);
    for (const g of gastos) {
      ids.add(g.solicitanteId);
      for (const a of g.aprobaciones) ids.add(a.usuarioId);
      if (g.pago) ids.add(g.pago.usuarioId);
    }
    for (const o of ordenesCompra) {
      ids.add(o.solicitanteId);
      if (o.aprobadorId) ids.add(o.aprobadorId);
    }
    for (const a of auditoria) ids.add(a.usuarioId);
    for (const c of cajasChicas) ids.add(c.responsableId);
    for (const e of estaciones) ids.add(e.gerenteId);
    if (!propios) for (const x of db.usuarios) if (x.estaciones.some((e) => u.estaciones.includes(e))) ids.add(x.id);
    // De los demás solo va lo necesario para mostrar nombres y saber quién autoriza; sus pantallas no.
    usuarios = db.usuarios
      .filter((x) => ids.has(x.id))
      .map((x) => (x.id === u.id ? x : { ...x, pantallasExtra: undefined, pantallasQuitadas: undefined }));
    roles = db.roles.filter((r) => usuarios.some((x) => x.rolId === r.id)).map((r) => (r.id === u.rolId ? r : { ...r, pantallas: [] }));
  }

  return {
    ...db,
    estaciones,
    centrosCosto: db.centrosCosto.filter((c) => ve(c.estacionId)),
    usuarios,
    roles,
    gastos,
    ordenesCompra,
    auditoria,
    cajasChicas,
    ventas: con('tablero', 'indicadores', 'prorrateo', 'franquicia', 'integraciones', 'estaciones') ? db.ventas.filter((v) => ve(v.estacionId)) : [],
    presupuestos: con('presupuestos') ? db.presupuestos.filter((p) => ve(p.estacionId)) : [],
    recurrentes: con('recurrentes') ? db.recurrentes.filter((r) => ve(r.estacionId)) : [],
    contratos: con('contratos') ? db.contratos.filter((c) => ve(c.estacionId)) : [],
    hallazgos: con('hallazgos') ? db.hallazgos.filter((h) => ve(h.estacionId)) : [],
  };
}
