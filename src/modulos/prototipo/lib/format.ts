const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const fmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Quetzales con dos decimales: Q7,132.73 */
export function q(n: number): string {
  const s = fmt2.format(Math.abs(n));
  return n < 0 ? `−Q${s}` : `Q${s}`;
}

/** Quetzales compactos para etiquetas de gráficas: Q12.4k */
export function qk(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}Q${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${sign}Q${(a / 1000).toFixed(1)}k`;
  return `${sign}Q${fmt0.format(a)}`;
}

export function num(n: number, dec = 0): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}

export function pct(n: number, dec = 1): string {
  return `${n.toFixed(dec)} %`;
}

/** 2026-10-05 → 5 oct 2026 */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y = 0, m = 1, d = 1] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

/** 2026-10-05T15:00:00 → 5 oct 2026, 15:00 */
export function fechaHora(iso: string): string {
  const hora = iso.length > 10 ? iso.slice(11, 16) : '';
  return hora ? `${fecha(iso)}, ${hora}` : fecha(iso);
}

/** 2026-10 → Octubre 2026 */
export function periodoLabel(p: string): string {
  const [y = 0, m = 1] = p.split('-').map(Number);
  return `${MESES_LARGOS[m - 1]} ${y}`;
}

function toUTC(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días de a hasta b (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(toUTC(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}

export function sumarMeses(iso: string, meses: number): string {
  const [y = 0, m = 1, d = 1] = iso.slice(0, 10).split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return base.toISOString().slice(0, 10);
}

export function periodoDe(iso: string): string {
  return iso.slice(0, 7);
}

export function sumar<T>(items: T[], f: (x: T) => number): number {
  return items.reduce((acc, x) => acc + f(x), 0);
}

export function agrupar<T>(items: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Descarga un CSV (separado por comas, UTF-8 con BOM para Excel). */
export function descargarCSV(nombre: string, filas: (string | number)[][]): void {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + filas.map((f) => f.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
