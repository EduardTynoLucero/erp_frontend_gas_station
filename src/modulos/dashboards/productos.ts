/**
 * Orden y color de los productos (port de graficas.js del panel): el color es fijo por NOMBRE, no por posición.
 * DIESEL, REGULAR y SUPER primero; los productos nuevos toman posición en el orden en que aparecen; SIN PRODUCTO
 * siempre al final y en gris. Se salta --s4 a propósito: es el del ajuste por toma física en la cascada.
 */
const ORDEN = ['DIESEL', 'REGULAR', 'SUPER'];
const extras: string[] = [];

function posicion(nombre: string): number {
  if (nombre === 'SIN PRODUCTO') return 99;
  const i = ORDEN.indexOf(nombre);
  if (i >= 0) return i;
  if (!extras.includes(nombre)) extras.push(nombre);
  return ORDEN.length + extras.indexOf(nombre);
}

const COLOR_POR_POSICION = [1, 2, 3, 5, 6];

/** Color del producto como variable CSS (cambia sola con el tema claro/oscuro). */
export function colorProducto(nombre: string): string {
  if (nombre === 'SIN PRODUCTO') return 'var(--s-otro)';
  const i = COLOR_POR_POSICION[posicion(nombre)];
  return i ? `var(--s${i})` : 'var(--s-otro)';
}

export const COLOR_UNICO = 'var(--acento)';

export function ordenarProductos(lista: string[]): string[] {
  return [...new Set(lista)].sort((a, b) => posicion(a) - posicion(b) || a.localeCompare(b));
}

export interface Serie {
  nombre: string;
  valores: number[];
}

/** Pivote: categorías (fechas, turnos…) × una serie por producto; los huecos valen 0. */
export function pivotar<T extends { producto: string }>(
  filas: T[],
  claveX: (f: T) => string,
  medida: (f: T) => number,
  ordenX: (a: string, b: string) => number = (a, b) => (a < b ? -1 : a > b ? 1 : 0),
): { categorias: string[]; series: Serie[] } {
  const categorias = [...new Set(filas.map(claveX))].sort(ordenX);
  const productos = ordenarProductos(filas.map((f) => f.producto));
  const indice = new Map(categorias.map((x, i) => [x, i]));
  const series = productos.map((p) => ({ nombre: p, valores: categorias.map(() => 0) }));
  const porNombre = new Map(series.map((s) => [s.nombre, s]));
  for (const f of filas) {
    const s = porNombre.get(f.producto);
    const i = indice.get(claveX(f));
    if (s && i !== undefined) s.valores[i] = (s.valores[i] ?? 0) + medida(f);
  }
  return { categorias, series };
}
