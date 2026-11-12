/**
 * Lógica de los filtros del dashboard, igual que panel/js/dashboard.js del ETL:
 * los rangos rápidos parten del ÚLTIMO DÍA CON DATOS (nunca de hoy) y se calculan en UTC.
 */
import type { FiltrosVentas, OpcionesVentas } from '@/api/tipos';

export type Rapido = '' | 'todo' | '7' | '30' | 'mes' | 'anterior';

export interface EstadoFiltros {
  desde: string;
  hasta: string;
  estacion?: string;
  producto?: string;
  /** Rango rápido marcado ('' si el usuario escribió las fechas) */
  rapido: Rapido;
}

export interface Rango {
  desde: string;
  hasta: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const deIso = (t: string) => new Date(`${t}T00:00:00Z`);
export const masDias = (t: string, n: number) => iso(new Date(deIso(t).getTime() + n * 86_400_000));

export const RAPIDOS: { valor: Exclude<Rapido, ''>; texto: string }[] = [
  { valor: 'todo', texto: 'Todo' },
  { valor: '7', texto: 'Últimos 7 días' },
  { valor: '30', texto: 'Últimos 30 días' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'anterior', texto: 'Mes anterior' },
];

/** Rango de un botón rápido, dentro de los datos; null si no hay datos para ese rango. */
export function rangoRapido({ desde: min, hasta: max }: Rango, tipo: Rapido): Rango | null {
  const limitar = (d: string) => (d < min ? min : d);
  if (tipo === '7') return { desde: limitar(masDias(max, -6)), hasta: max };
  if (tipo === '30') return { desde: limitar(masDias(max, -29)), hasta: max };
  if (tipo === 'mes') return { desde: limitar(`${max.slice(0, 7)}-01`), hasta: max };
  if (tipo === 'anterior') {
    // Nunca se recorta hacia el mes actual: sin datos del mes anterior, el botón queda desactivado
    const finAnterior = masDias(`${max.slice(0, 7)}-01`, -1);
    if (finAnterior < min) return null;
    return { desde: limitar(`${finAnterior.slice(0, 7)}-01`), hasta: finAnterior };
  }
  return { desde: min, hasta: max };
}

export function rangoDe(opciones: OpcionesVentas): Rango | null {
  const { desde, hasta } = opciones.rango;
  return desde && hasta ? { desde, hasta } : null;
}

/**
 * ponerOpciones del panel: reajusta los filtros cuando llegan opciones nuevas (por ejemplo, una carga nueva del ETL).
 * Un rango rápido se vuelve a calcular ("Últimos 7 días" llega hasta el último día nuevo); unas fechas escritas se
 * recortan al rango; una estación o un producto que ya no existe se quita. null si el modelo está vacío.
 */
export function ajustarFiltros(previos: EstadoFiltros | null, opciones: OpcionesVentas): EstadoFiltros | null {
  const rango = rangoDe(opciones);
  if (!rango) return null;
  const todo = { desde: rango.desde, hasta: rango.hasta, rapido: 'todo' as const };
  let f: EstadoFiltros;
  if (!previos?.desde) f = { ...todo };
  else if (previos.rapido) {
    const r = rangoRapido(rango, previos.rapido);
    f = { ...previos, ...(r ?? todo), rapido: r ? previos.rapido : 'todo' };
  } else if (previos.hasta < rango.desde || previos.desde > rango.hasta) f = { ...previos, ...todo };
  else
    f = {
      ...previos,
      desde: previos.desde < rango.desde ? rango.desde : previos.desde,
      hasta: previos.hasta > rango.hasta ? rango.hasta : previos.hasta,
    };
  if (f.estacion && !opciones.estaciones.some((e) => e.codigo === f.estacion)) delete f.estacion;
  if (f.producto && !opciones.productos.includes(f.producto)) delete f.producto;
  return f;
}

/** Parámetros de la consulta: solo los que no están vacíos (el rango rápido no viaja). */
export function consultaDe(f: EstadoFiltros): FiltrosVentas {
  return {
    desde: f.desde,
    hasta: f.hasta,
    ...(f.estacion ? { estacion: f.estacion } : {}),
    ...(f.producto ? { producto: f.producto } : {}),
  };
}
