/**
 * Rutas de los datos simulados del prototipo. Un gasto simulado (g1, g2…) no existe en el backend: su detalle se abre
 * en /gastos/simulados/<id>, no en /gastos/<id>, que es el detalle de los gastos reales.
 */
export const rutaGasto = (id: string): string => `/gastos/simulados/${encodeURIComponent(id)}`;
