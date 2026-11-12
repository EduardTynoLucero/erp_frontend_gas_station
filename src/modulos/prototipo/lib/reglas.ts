// Reglas de negocio: permisos, niveles de autorización y control documental.
// Las usa la pantalla (para mostrar u ocultar botones) y el servidor (para validar cada acción).
import type { DB, Estacion, Gasto, NivelAutorizacion, OrdenCompra, Permiso, Rol, Usuario } from '../types';
import { q } from './format';

export interface Verificacion {
  ok: boolean;
  motivo: string;
}

const OK: Verificacion = { ok: true, motivo: '' };
const no = (motivo: string): Verificacion => ({ ok: false, motivo });

/** Nombre de cada permiso, en el orden en que se muestra la matriz. */
export const PERMISOS: [Permiso, string][] = [
  ['ver_todo', 'Ver todas las estaciones'],
  ['registrar', 'Registrar gastos y solicitudes'],
  ['aprobar', 'Autorizar gastos y órdenes de compra'],
  ['pagar', 'Registrar pagos (tesorería)'],
  ['caja_chica', 'Operar caja chica'],
  ['presupuestos', 'Presupuestos y prorrateo'],
  ['catalogos', 'Catálogos, proveedores, contratos y recurrentes'],
  ['revisar', 'Verificar facturas FEL'],
  ['auditar', 'Dar seguimiento a hallazgos'],
  ['configurar', 'Cambiar parámetros y estaciones'],
  ['usuarios', 'Administrar usuarios y roles'],
];

const SIN_ROL: Rol = {
  id: '',
  nombre: 'Sin rol',
  descripcion: '',
  permisos: [],
  pantallas: [],
  limiteAutorizacion: 0,
  soloPropios: true,
};

export function rolDe(db: DB, u: Usuario): Rol {
  return db.roles.find((r) => r.id === u.rolId) ?? SIN_ROL;
}

/**
 * Permisos efectivos del usuario: los de su rol, más los que se le agregaron y menos los que se le quitaron.
 * Todo el sistema (menú, pantallas, servidor) decide con esta lista, nunca con el rol directamente.
 */
export function permisosDe(db: DB, u: Usuario): Permiso[] {
  const base = rolDe(db, u).permisos;
  const extra = u.permisosExtra ?? [];
  const quitados = u.permisosQuitados ?? [];
  return PERMISOS.map(([p]) => p).filter((p) => (base.includes(p) || extra.includes(p)) && !quitados.includes(p));
}

export function tiene(db: DB, u: Usuario, p: Permiso): boolean {
  return permisosDe(db, u).includes(p);
}

/** Tope de autorización efectivo (null = sin límite). 0 si el usuario no autoriza. */
export function limiteDe(db: DB, u: Usuario): number | null {
  if (!tiene(db, u, 'aprobar')) return 0;
  return u.limiteAutorizacion !== undefined ? u.limiteAutorizacion : rolDe(db, u).limiteAutorizacion;
}

export function soloPropios(db: DB, u: Usuario): boolean {
  return u.soloPropios ?? rolDe(db, u).soloPropios === true;
}

/** El usuario tiene pantallas, permisos, límite o alcance distintos a los de su rol. */
export function tieneAjustes(u: Usuario): boolean {
  return !!(
    u.permisosExtra?.length ||
    u.permisosQuitados?.length ||
    u.pantallasExtra?.length ||
    u.pantallasQuitadas?.length ||
    u.limiteAutorizacion !== undefined ||
    u.soloPropios !== undefined
  );
}

export function veEstacion(db: DB, u: Usuario, estacionId: string): boolean {
  return tiene(db, u, 'ver_todo') || u.estaciones.includes(estacionId);
}

export function estacionesVisibles(db: DB, u: Usuario): Estacion[] {
  return db.estaciones.filter((e) => veEstacion(db, u, e.id));
}

export function veGasto(db: DB, u: Usuario, g: Gasto): boolean {
  if (!veEstacion(db, u, g.estacionId)) return false;
  return !soloPropios(db, u) || g.solicitanteId === u.id;
}

export function veOrden(db: DB, u: Usuario, o: OrdenCompra): boolean {
  if (!veEstacion(db, u, o.estacionId)) return false;
  return !soloPropios(db, u) || o.solicitanteId === u.id;
}

/** a ≤ b, donde null es "sin límite". */
const dentroDe = (a: number | null, b: number | null) => b === null || (a !== null && a <= b);

/**
 * Un administrador solo maneja usuarios que no tengan más alcance que él: mismos o menos permisos,
 * estaciones que él ve y un límite de autorización que no supere el suyo. Así nadie se da (ni da a otro)
 * más de lo que tiene, y nadie toma la cuenta de alguien con más permisos cambiándole la contraseña.
 */
export function cubreUsuario(db: DB, admin: Usuario, u: Usuario): Verificacion {
  const mios = permisosDe(db, admin);
  const faltan = permisosDe(db, u).filter((p) => !mios.includes(p));
  if (faltan.length) return no(`${u.nombre || 'El usuario'} tendría permisos que usted no tiene (${faltan.map(nombrePermiso).join(', ')}).`);
  if (!tiene(db, admin, 'ver_todo') && u.estaciones.some((e) => !admin.estaciones.includes(e)))
    return no('Solo puede asignar estaciones a las que usted tiene acceso.');
  if (tiene(db, u, 'aprobar') && !dentroDe(limiteDe(db, u), limiteDe(db, admin))) return no('El límite de autorización no puede superar el suyo.');
  return OK;
}

/** Igual que cubreUsuario, para un rol completo. */
export function cubreRol(db: DB, admin: Usuario, r: Rol): Verificacion {
  const mios = permisosDe(db, admin);
  const faltan = r.permisos.filter((p) => !mios.includes(p));
  if (faltan.length) return no(`El rol tendría permisos que usted no tiene (${faltan.map(nombrePermiso).join(', ')}).`);
  if (r.permisos.includes('aprobar') && !dentroDe(r.limiteAutorizacion, limiteDe(db, admin))) return no('El límite del rol no puede superar el suyo.');
  return OK;
}

export function nombrePermiso(p: Permiso): string {
  return PERMISOS.find(([x]) => x === p)?.[1] ?? p;
}

/** Primer nivel cuyo tope cubre el monto. */
export function nivelRequerido(db: DB, monto: number): NivelAutorizacion {
  return db.config.niveles.find((n) => n.hasta === null || monto <= n.hasta) ?? db.config.niveles[db.config.niveles.length - 1]!;
}

/** Ajustes que salen de los reportes (merma, descuentos) no llevan factura: su soporte es el reporte. */
export function esAjusteContable(g: Gasto): boolean {
  return g.metodoPago === 'No aplica';
}

export function faltaComprobante(db: DB, g: Gasto): boolean {
  return (
    !esAjusteContable(g) &&
    g.estado !== 'rechazado' &&
    g.documento.tipo === 'Sin documento' &&
    g.monto >= db.config.comprobanteObligatorioDesde
  );
}

export function puedeRegistrar(db: DB, u: Usuario, estacionId?: string): Verificacion {
  if (!tiene(db, u, 'registrar')) return no('Su usuario no tiene permiso para registrar gastos.');
  if (estacionId && !veEstacion(db, u, estacionId)) return no('No tiene acceso a esa estación.');
  return OK;
}

/** Borradores: los edita, envía o elimina quien los registró (o el super administrador). */
export function puedeEditarBorrador(db: DB, u: Usuario, g: Gasto): Verificacion {
  if (g.estado !== 'borrador') return no('Solo se modifican gastos en borrador.');
  if (g.solicitanteId !== u.id && !tiene(db, u, 'configurar')) return no('Solo quien registró el borrador puede modificarlo.');
  return puedeRegistrar(db, u, g.estacionId);
}

export function puedeReabrir(db: DB, u: Usuario, g: Gasto): Verificacion {
  if (g.estado !== 'rechazado') return no('Solo se corrigen gastos rechazados.');
  if (g.solicitanteId !== u.id) return no('Solo quien solicitó el gasto puede corregirlo.');
  return puedeRegistrar(db, u, g.estacionId);
}

export function puedeAprobar(db: DB, u: Usuario, g: Gasto): Verificacion {
  if (g.estado !== 'pendiente') return no('El gasto no está pendiente de autorización.');
  if (!tiene(db, u, 'aprobar')) return no('Su usuario no tiene permiso para autorizar gastos.');
  if (!veGasto(db, u, g)) return no('No tiene acceso a este gasto.');
  if (g.solicitanteId === u.id) return no('No puede autorizar un gasto que usted mismo solicitó.');
  const lim = limiteDe(db, u);
  if (lim !== null && g.monto > lim) {
    return no(`Supera su límite de ${q(lim)}. Lo autoriza: ${nivelRequerido(db, g.monto).etiqueta}.`);
  }
  return OK;
}

/** Tope de autorización del usuario para órdenes de compra. */
export function limiteCubre(db: DB, u: Usuario, monto: number): boolean {
  const lim = limiteDe(db, u);
  return tiene(db, u, 'aprobar') && (lim === null || monto <= lim);
}

export function puedePagar(db: DB, u: Usuario, g: Gasto): Verificacion {
  if (g.estado !== 'aprobado') return no('Solo se pagan gastos aprobados.');
  if (esAjusteContable(g)) return no('Es un ajuste contable; no genera pago.');
  if (!tiene(db, u, 'pagar')) return no('Su usuario no registra pagos; lo hace Tesorería.');
  if (!veGasto(db, u, g)) return no('No tiene acceso a este gasto.');
  if (faltaComprobante(db, g)) {
    return no(`Falta el comprobante; es obligatorio desde ${q(db.config.comprobanteObligatorioDesde)}.`);
  }
  return OK;
}

/** Adjuntar o corregir el comprobante: quien registra en la estación, Tesorería o Contabilidad. */
export function puedeComprobante(db: DB, u: Usuario, g: Gasto): Verificacion {
  if (g.estado === 'rechazado') return no('El gasto está rechazado.');
  if (esAjusteContable(g)) return no('Los ajustes contables no llevan comprobante.');
  if (!veGasto(db, u, g)) return no('No tiene acceso a este gasto.');
  if (tiene(db, u, 'pagar') || tiene(db, u, 'revisar')) return OK;
  return puedeRegistrar(db, u, g.estacionId);
}

export function puedeOperarCaja(db: DB, u: Usuario, estacionId: string): Verificacion {
  if (!tiene(db, u, 'caja_chica')) return no('Solo consulta: los desembolsos los registra el encargado de caja chica.');
  if (!veEstacion(db, u, estacionId)) return no('No tiene acceso a esa estación.');
  return OK;
}
