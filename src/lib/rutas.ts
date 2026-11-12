/**
 * Rutas del frontend y qué acceso exige cada una. Lo usan el proxy (protección estricta en el servidor) y el
 * menú. La fuente de verdad del acceso es GET /api/v1/auth/me: acceso.modulos y acceso.pantallas.
 */
import type { Modulos, Perfil } from '@/api/tipos';

export type ModuloRuta = keyof Modulos;

export interface RequisitoRuta {
  /** Basta con uno de estos módulos */
  modulos: ModuloRuta[];
  /** Basta con tener una de estas pantallas */
  pantallas: string[];
}

/**
 * Pantallas del prototipo de gastos que trabajan con sus datos simulados (modulos/prototipo) mientras el backend no
 * expone sus tablas, y el módulo del ERP al que pertenece cada una (el de iam.pantalla.modulo).
 */
export const PANTALLAS_SIMULADAS: Readonly<Record<string, ModuloRuta>> = {
  tablero: 'gastos',
  alertas: 'gastos',
  hallazgos: 'auditoria',
  presupuestos: 'gastos',
  proveedores: 'gastos',
  catalogos: 'gastos',
  estaciones: 'administracion',
  usuarios: 'administracion',
  reportes: 'gastos',
  'caja-chica': 'gastos',
  compras: 'gastos',
  contratos: 'gastos',
  recurrentes: 'gastos',
  prorrateo: 'gastos',
  franquicia: 'gastos',
  indicadores: 'gastos',
  auditoria: 'auditoria',
  configuracion: 'gastos',
};

/** Integraciones: la carga de reportes al ETL. La abre quien tiene la pantalla de integraciones o la de cargar reportes. */
export const PANTALLAS_INTEGRACIONES = ['integraciones', 'cargas'];

/** Pantallas que tienen página en este frontend (las del menú que no estén aquí no se muestran). */
export const RUTA_DE_PANTALLA: Readonly<Record<string, string>> = {
  'mis-solicitudes': '/mis-solicitudes',
  gastos: '/gastos',
  autorizaciones: '/autorizaciones',
  'cuentas-por-pagar': '/cuentas-por-pagar',
  'dashboard-ventas': '/dashboard-ventas',
  inventario: '/inventario',
  'tomas-fisicas': '/tomas-fisicas',
  'historial-cargas': '/historial-cargas',
  ...Object.fromEntries(Object.keys(PANTALLAS_SIMULADAS).map((codigo) => [codigo, `/${codigo}`])),
  ...Object.fromEntries(PANTALLAS_INTEGRACIONES.map((codigo) => [codigo, '/integraciones'])),
};

const CONSULTA_GASTOS = ['gastos', 'mis-solicitudes', 'autorizaciones', 'cuentas-por-pagar'];

const REGLAS: { patron: RegExp; requisito: RequisitoRuta }[] = [
  { patron: /^\/dashboard-ventas\/?$/, requisito: { modulos: ['dashboards'], pantallas: ['dashboard-ventas'] } },
  { patron: /^\/inventario\/?$/, requisito: { modulos: ['dashboards'], pantallas: ['inventario'] } },
  { patron: /^\/tomas-fisicas\/?$/, requisito: { modulos: ['dashboards'], pantallas: ['tomas-fisicas'] } },
  { patron: /^\/historial-cargas\/?$/, requisito: { modulos: ['dashboards', 'gastos'], pantallas: ['historial-cargas', ...PANTALLAS_INTEGRACIONES] } },
  { patron: /^\/integraciones\/?$/, requisito: { modulos: ['gastos', 'dashboards'], pantallas: PANTALLAS_INTEGRACIONES } },
  // Detalle de un gasto de los datos simulados (enlaces del tablero, alertas, compras…)
  { patron: /^\/gastos\/simulados\/[^/]+\/?$/, requisito: { modulos: ['gastos'], pantallas: CONSULTA_GASTOS } },
  { patron: /^\/gastos\/nuevo\/?$/, requisito: { modulos: ['gastos'], pantallas: ['gastos', 'mis-solicitudes'] } },
  { patron: /^\/gastos\/[^/]+\/editar\/?$/, requisito: { modulos: ['gastos'], pantallas: ['gastos', 'mis-solicitudes'] } },
  { patron: /^\/gastos\/[^/]+\/?$/, requisito: { modulos: ['gastos'], pantallas: CONSULTA_GASTOS } },
  { patron: /^\/gastos\/?$/, requisito: { modulos: ['gastos'], pantallas: ['gastos'] } },
  { patron: /^\/mis-solicitudes\/?$/, requisito: { modulos: ['gastos'], pantallas: ['mis-solicitudes'] } },
  { patron: /^\/autorizaciones\/?$/, requisito: { modulos: ['gastos'], pantallas: ['autorizaciones'] } },
  { patron: /^\/cuentas-por-pagar\/?$/, requisito: { modulos: ['gastos'], pantallas: ['cuentas-por-pagar'] } },
  ...Object.entries(PANTALLAS_SIMULADAS).map(([codigo, modulo]) => ({
    patron: new RegExp(`^/${codigo}/?$`),
    requisito: { modulos: [modulo], pantallas: [codigo] },
  })),
];

/** Requisito de la ruta, o null si solo exige sesión (inicio, sin acceso). */
export function requisitoDe(ruta: string): RequisitoRuta | null {
  return REGLAS.find((r) => r.patron.test(ruta))?.requisito ?? null;
}

export function cumple(perfil: Perfil, requisito: RequisitoRuta): boolean {
  return (
    requisito.modulos.some((m) => perfil.acceso.modulos[m]) && perfil.acceso.pantallas.some((p) => requisito.pantallas.includes(p.codigo))
  );
}

export function tienePantalla(perfil: Perfil, ...codigos: string[]): boolean {
  return perfil.acceso.pantallas.some((p) => codigos.includes(p.codigo));
}

export function tienePermiso(perfil: Perfil, permiso: string): boolean {
  return perfil.acceso.permisos.includes(permiso);
}

/**
 * Pantalla de inicio de cada usuario, la misma del prototipo (inicioDe de Expenses_project/src/lib/acceso.ts):
 * Tesorería entra a cuentas por pagar, el encargado de caja chica a su caja, quien solo ve lo suyo a sus solicitudes
 * y los demás al Tablero. Sin Tablero, al Dashboard de ventas si tiene el módulo de dashboards.
 */
export function inicioDe(perfil: Perfil): string | null {
  const permisos = new Set(perfil.acceso.permisos);
  const ve = (codigo: string) => tienePantalla(perfil, codigo);
  const administra = permisos.has('aprobar') || permisos.has('configurar');
  if (permisos.has('pagar') && !administra && ve('cuentas-por-pagar')) return '/cuentas-por-pagar';
  if (permisos.has('caja_chica') && !administra && ve('caja-chica')) return '/caja-chica';
  if (perfil.acceso.alcance.soloPropios && ve('mis-solicitudes')) return '/mis-solicitudes';
  if (ve('tablero')) return '/tablero';
  if (ve('dashboard-ventas') && perfil.acceso.modulos.dashboards) return '/dashboard-ventas';
  const primera = perfil.acceso.pantallas.find((p) => RUTA_DE_PANTALLA[p.codigo]);
  return primera ? RUTA_DE_PANTALLA[primera.codigo]! : null;
}

/**
 * Solo rutas internas (evita redirecciones abiertas a otros sitios), y nunca el propio inicio de sesión: así un
 * destino no puede llevar de /login a /login.
 */
export function destinoSeguro(destino: string | null | undefined): string | null {
  if (!destino || !destino.startsWith('/') || destino.startsWith('//') || destino.startsWith('/api/')) return null;
  if (/^\/login(?:[/?#]|$)/.test(destino)) return null;
  return destino;
}
