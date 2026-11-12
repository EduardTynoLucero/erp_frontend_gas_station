/**
 * Formatos del ERP (port de lib/format.ts del prototipo).
 * El dinero llega de la API como TEXTO decimal exacto ("7132.73"): se formatea sobre el texto, sin pasar por
 * float, así lo que se muestra es exactamente lo que guarda la base.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function conComas(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Redondea un texto decimal a `dec` decimales (half up) sin usar float. */
export function redondearTexto(valor: string, dec = 2): string {
  const negativo = valor.startsWith('-');
  const [ent = '0', frac = ''] = (negativo ? valor.slice(1) : valor).split('.');
  if (frac.length <= dec) {
    const f = frac.padEnd(dec, '0');
    return `${negativo ? '-' : ''}${ent || '0'}${dec ? `.${f}` : ''}`;
  }
  // Suma 1 a la última cifra conservada si la siguiente es 5 o más
  let cifras = (ent + frac.slice(0, dec)).split('').map(Number);
  if (Number(frac[dec]) >= 5) {
    let i = cifras.length - 1;
    while (i >= 0) {
      if (cifras[i]! < 9) {
        cifras[i]! += 1;
        break;
      }
      cifras[i] = 0;
      i -= 1;
    }
    if (i < 0) cifras = [1, ...cifras];
  }
  const texto = cifras.join('');
  const corte = texto.length - dec;
  const e = texto.slice(0, corte) || '0';
  return `${negativo ? '-' : ''}${e}${dec ? `.${texto.slice(corte)}` : ''}`;
}

/** Q7,132.73 · −Q25.00 (signo menos tipográfico), como q() del prototipo. Acepta texto decimal o número. */
export function q(valor: string | number | null | undefined, simbolo = 'Q', dec = 2): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const texto = typeof valor === 'number' ? valor.toFixed(dec) : redondearTexto(valor, dec);
  const negativo = texto.startsWith('-') && !/^-0(\.0+)?$/.test(texto);
  const [ent = '0', frac] = texto.replace('-', '').split('.');
  return `${negativo ? '−' : ''}${simbolo}${conComas(ent)}${frac ? `.${frac}` : ''}`;
}

/** Formato compacto para etiquetas: Q1.23M · Q12.4k · Q1,234 (qk del prototipo). */
export function qk(valor: string | number): string {
  const n = typeof valor === 'number' ? valor : Number(valor);
  const a = Math.abs(n);
  const signo = n < 0 ? '−' : '';
  if (a >= 1_000_000) return `${signo}Q${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${signo}Q${(a / 1000).toFixed(1)}k`;
  return `${signo}Q${conComas(Math.round(a).toString())}`;
}

/** Número con separador de miles y decimales fijos (texto decimal o número). */
export function num(valor: string | number | null | undefined, dec = 0): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const texto = typeof valor === 'number' ? valor.toFixed(dec) : redondearTexto(valor, dec);
  const negativo = texto.startsWith('-') && !/^-0(\.0+)?$/.test(texto);
  const [ent = '0', frac] = texto.replace('-', '').split('.');
  return `${negativo ? '−' : ''}${conComas(ent)}${frac ? `.${frac}` : ''}`;
}

/** 5 oct 2026 (fecha AAAA-MM-DD o ISO). */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]} ${a}`;
}

/** 12 oct 2026, 15:00 · con la hora local de Guatemala si el ISO trae zona. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  if (iso.length <= 10) return fecha(iso);
  if (/[zZ]|[+-]\d\d:\d\d$/.test(iso)) {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(iso));
    const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
    return `${fecha(`${v('year')}-${v('month')}-${v('day')}`)}, ${v('hour')}:${v('minute')}`;
  }
  return `${fecha(iso)}, ${iso.slice(11, 16)}`;
}

/** "2026-10" → "Octubre 2026" */
export function periodoLabel(periodo: string): string {
  const [a, m] = periodo.split('-');
  const mes = MESES_LARGOS[Number(m) - 1] ?? '';
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${a}`;
}

/** 33.3 % */
export function pct(valor: number | string, dec = 1): string {
  return `${Number(valor).toFixed(dec)} %`;
}

function aUtc(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a!, m! - 1, d!);
}

/** Días de a hasta b (b − a), en UTC sobre AAAA-MM-DD. */
export function diasEntre(a: string, b: string): number {
  return Math.round((aUtc(b) - aUtc(a)) / 86_400_000);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aUtc(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}
