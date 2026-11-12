// Qué pantallas ve cada usuario: las de su rol, más las que se le agregaron y menos las que se le quitaron.
// El menú, las rutas y el servidor (qué datos envía) usan esta misma lista.
import type { DB, Permiso, Rol, Usuario } from '../types';
import { cubreRol, cubreUsuario, rolDe, soloPropios, tiene, type Verificacion } from './reglas';

export interface Modulo {
  ruta: string;
  label: string;
  grupo: string;
}

// Los dos módulos del ERP (los mismos grupos de iam.pantalla en el backend): sin las fases del prototipo
const DASHBOARDS = 'Dashboards';
const GASTOS = 'Gastos';

export const MODULOS: Modulo[] = [
  { ruta: 'tablero', label: 'Tablero de gastos', grupo: DASHBOARDS },
  { ruta: 'indicadores', label: 'Indicadores gerenciales', grupo: DASHBOARDS },
  { ruta: 'reportes', label: 'Reportes', grupo: DASHBOARDS },
  { ruta: 'integraciones', label: 'Integraciones', grupo: DASHBOARDS },
  { ruta: 'mis-solicitudes', label: 'Mis solicitudes', grupo: GASTOS },
  { ruta: 'gastos', label: 'Registro de gastos', grupo: GASTOS },
  { ruta: 'autorizaciones', label: 'Solicitudes y autorizaciones', grupo: GASTOS },
  { ruta: 'cuentas-por-pagar', label: 'Cuentas por pagar y pagos', grupo: GASTOS },
  { ruta: 'caja-chica', label: 'Caja chica', grupo: GASTOS },
  { ruta: 'compras', label: 'Compras administrativas', grupo: GASTOS },
  { ruta: 'proveedores', label: 'Proveedores', grupo: GASTOS },
  { ruta: 'contratos', label: 'Contratos y servicios', grupo: GASTOS },
  { ruta: 'recurrentes', label: 'Gastos recurrentes', grupo: GASTOS },
  { ruta: 'presupuestos', label: 'Presupuestos', grupo: GASTOS },
  { ruta: 'prorrateo', label: 'Prorrateo de gastos compartidos', grupo: GASTOS },
  { ruta: 'franquicia', label: 'Gastos de franquicia', grupo: GASTOS },
  { ruta: 'alertas', label: 'Alertas', grupo: GASTOS },
  { ruta: 'hallazgos', label: 'Hallazgos de reportes', grupo: GASTOS },
  { ruta: 'auditoria', label: 'Auditoría y trazabilidad', grupo: GASTOS },
  { ruta: 'catalogos', label: 'Catálogos y centros de costo', grupo: GASTOS },
  { ruta: 'estaciones', label: 'Empresas y estaciones', grupo: GASTOS },
  { ruta: 'usuarios', label: 'Usuarios y roles', grupo: GASTOS },
  { ruta: 'configuracion', label: 'Configuración', grupo: GASTOS },
];

export const GRUPOS = [DASHBOARDS, GASTOS];

const RUTAS = new Set(MODULOS.map((m) => m.ruta));

export function nombrePantalla(ruta: string): string {
  return MODULOS.find((m) => m.ruta === ruta)?.label ?? ruta;
}

/** Deja solo rutas de pantallas que existen, sin repetir. */
export function listaPantallas(ps: unknown): string[] {
  return Array.isArray(ps) ? [...new Set(ps.filter((p): p is string => typeof p === 'string' && RUTAS.has(p)))] : [];
}

/** Pantallas efectivas del usuario, en el orden del menú. */
export function pantallasDe(db: DB, u: Usuario): string[] {
  const base = rolDe(db, u).pantallas ?? [];
  const extra = u.pantallasExtra ?? [];
  const quitadas = u.pantallasQuitadas ?? [];
  return MODULOS.map((m) => m.ruta).filter((r) => (base.includes(r) || extra.includes(r)) && !quitadas.includes(r));
}

export function puedeVerModulo(db: DB, u: Usuario, ruta: string): boolean {
  const partes = ruta.split('/');
  const base = partes[0] ?? '';
  // Registrar o corregir un gasto también exige el permiso de registrar.
  if (base === 'gastos' && (partes[1] === 'nuevo' || partes[2] === 'editar') && !tiene(db, u, 'registrar')) return false;
  if (!RUTAS.has(base)) return true;
  return pantallasDe(db, u).includes(base);
}

export function modulosVisibles(db: DB, u: Usuario): Modulo[] {
  const mias = pantallasDe(db, u);
  return MODULOS.filter((m) => mias.includes(m.ruta));
}

/** Pantalla de inicio según el trabajo del usuario. */
export function inicioDe(db: DB, u: Usuario): string {
  const p = (x: Permiso) => tiene(db, u, x);
  const ve = (r: string) => puedeVerModulo(db, u, r);
  if (p('pagar') && !p('aprobar') && !p('configurar') && ve('cuentas-por-pagar')) return '/cuentas-por-pagar';
  if (p('caja_chica') && !p('aprobar') && !p('configurar') && ve('caja-chica')) return '/caja-chica';
  if (soloPropios(db, u) && ve('mis-solicitudes')) return '/mis-solicitudes';
  if (ve('tablero')) return '/tablero';
  const primera = modulosVisibles(db, u)[0];
  return primera ? `/${primera.ruta}` : '/sin-pantallas';
}

/** Un administrador solo maneja usuarios con permisos, estaciones, límite y pantallas que él mismo tiene. */
export function administra(db: DB, admin: Usuario, u: Usuario): Verificacion {
  const v = cubreUsuario(db, admin, u);
  if (!v.ok) return v;
  const mias = pantallasDe(db, admin);
  const faltan = pantallasDe(db, u).filter((p) => !mias.includes(p));
  if (faltan.length) return { ok: false, motivo: `${u.nombre || 'El usuario'} vería pantallas que usted no ve (${faltan.map(nombrePantalla).join(', ')}).` };
  return v;
}

/** Igual que administra, para un rol completo. */
export function administraRol(db: DB, admin: Usuario, r: Rol): Verificacion {
  const v = cubreRol(db, admin, r);
  if (!v.ok) return v;
  const mias = pantallasDe(db, admin);
  const faltan = (r.pantallas ?? []).filter((p) => !mias.includes(p));
  if (faltan.length) return { ok: false, motivo: `El rol vería pantallas que usted no ve (${faltan.map(nombrePantalla).join(', ')}).` };
  return v;
}
