/**
 * Formatos del dashboard: port fiel de panel/js/util.js del ETL (locale es-GT: coma de miles, punto decimal; el
 * menos es U+2212 y va delante de todo; un valor no numérico o infinito se muestra como "–").
 *
 * Diferencia a propósito: aceptan el texto decimal que manda la API y lo formatean EXACTO (Intl.NumberFormat
 * redondea un texto como decimal, sin pasar por float). Los números solo se usan para graficar y para porcentajes.
 */
import { Decimal } from 'decimal.js';

export type Valor = number | string | null | undefined;

const formatos = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const clave = `${min}-${max}`;
  let f = formatos.get(clave);
  if (!f) {
    f = new Intl.NumberFormat('es-GT', { minimumFractionDigits: min, maximumFractionDigits: max });
    formatos.set(clave, f);
  }
  return f;
}
const F0 = nf(0, 0);
const F1 = nf(1, 1);
const F2 = nf(2, 2);
const F01 = nf(0, 1);

const DECIMAL = /^[-+]?\d+(\.\d+)?$/;

/** Valor absoluto y signo; el texto decimal se queda como texto (exacto). */
function partes(v: Valor): { abs: number | Intl.StringNumericLiteral; neg: boolean } | null {
  if (typeof v === 'number') return Number.isFinite(v) ? { abs: Math.abs(v), neg: v < 0 } : null;
  if (typeof v === 'string' && DECIMAL.test(v.trim())) {
    const t = v.trim();
    return { abs: t.replace(/^[-+]/, '') as Intl.StringNumericLiteral, neg: t.startsWith('-') };
  }
  return null;
}

function conSigno(v: Valor, formato: Intl.NumberFormat, armar: (t: string) => string = (t) => t): string {
  const p = partes(v);
  if (!p) return '–';
  const texto = formato.format(p.abs);
  return `${p.neg && texto !== formato.format(0) ? '−' : ''}${armar(texto)}`;
}

function aNumero(v: Valor): number | null {
  const n = typeof v === 'string' ? (DECIMAL.test(v.trim()) ? Number(v) : NaN) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function corto(v: Valor): string | null {
  const n = aNumero(v);
  if (n === null) return null;
  const a = Math.abs(n);
  const [divisor, sufijo] = a >= 999950 ? [1e6, ' M'] : a >= 999.95 ? [1e3, ' k'] : [1, ''];
  const texto = F01.format(a / divisor);
  return `${n < 0 && texto !== '0' ? '−' : ''}${texto}${sufijo}`;
}

export const fmt = {
  entero: (v: Valor) => conSigno(v, F0),
  moneda: (v: Valor) => conSigno(v, F2, (t) => `Q${t}`),
  monedaEntera: (v: Valor) => conSigno(v, F0, (t) => `Q${t}`),
  monedaCorta: (v: Valor) => corto(v)?.replace(/^(−?)/, '$1Q') ?? '–',
  galones: (v: Valor) => conSigno(v, F2, (t) => `${t} gal`),
  galonesCorto: (v: Valor) => {
    const t = corto(v);
    return t === null ? '–' : `${t} gal`;
  },
  numero: (v: Valor, d = 2) => conSigno(v, nf(d, d)),
  pct: (v: Valor, d = 1) => conSigno(v, d === 1 ? F1 : nf(d, d), (t) => `${t}%`),
  porGalon: (v: Valor) => conSigno(v, F2, (t) => `Q${t}/gal`),
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** "2026-10-01" → "1 oct" (o "1 oct 2026" con año) */
export function fecha(texto: string | null | undefined, anio = false): string {
  if (!texto) return '–';
  const [a, m, d] = texto.slice(0, 10).split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]}${anio ? ` ${a}` : ''}`;
}

/** "2026-10-01 07:15" → "1 oct 2026, 07:15" (o "1 oct, 07:15" sin año) */
export function fechaHora(texto: string | null | undefined, anio = true): string {
  if (!texto) return '–';
  return `${fecha(texto, anio)}, ${texto.slice(11, 16)}`;
}

/** "2026-10-01" → "Jue" */
export function diaSemana(texto: string): string {
  const [a, m, d] = texto.split('-').map(Number);
  const dia = new Date(Date.UTC(a!, m! - 1, d!)).getUTCDay();
  return DIAS[(dia + 6) % 7]!;
}

export const plural = (n: number, uno: string, varios: string) => `${fmt.entero(n)} ${n === 1 ? uno : varios}`;

export const pct = (parte: number, total: number) => (total ? (100 * parte) / total : 0);

/** Texto decimal de la API → número, solo para graficar y para porcentajes. */
export const num = (v: Valor): number => aNumero(v) ?? 0;

/** Suma exacta de montos en texto decimal (pies de tabla). */
export function suma(valores: Valor[]): string {
  return valores.reduce<Decimal>((a, v) => (partes(v) ? a.plus(new Decimal(String(v).trim())) : a), new Decimal(0)).toString();
}

export type Medida = 'venta' | 'galones' | 'utilidad' | 'ventaSinFactura';

export const MEDIDAS_DIA: { valor: Medida; texto: string }[] = [
  { valor: 'venta', texto: 'Venta' },
  { valor: 'galones', texto: 'Galones' },
  { valor: 'utilidad', texto: 'Utilidad' },
  { valor: 'ventaSinFactura', texto: 'Sin factura' },
];

export const formatoDe = (m: string) => (m === 'galones' ? fmt.galones : fmt.moneda);
export const ejeDe = (m: string) => (m === 'galones' ? fmt.galonesCorto : fmt.monedaCorta);
export const nombreMedida = (m: string) => MEDIDAS_DIA.find((x) => x.valor === m)?.texto ?? m;
