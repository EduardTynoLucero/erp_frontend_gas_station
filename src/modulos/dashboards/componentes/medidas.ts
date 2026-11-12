/**
 * Medición de textos y marcas del eje de valores de las barras horizontales (port de graficas.js del panel):
 * el margen derecho deja lugar a la etiqueta más larga y las marcas se eligen para que sus textos no se encimen.
 * Solo se usa en el navegador (necesita un canvas).
 */
let contexto: CanvasRenderingContext2D | null = null;
let fuente = '';

export function anchoTexto(texto: string, px = 12): number {
  if (typeof document === 'undefined') return texto.length * px * 0.6;
  if (!contexto) contexto = document.createElement('canvas').getContext('2d');
  if (!contexto) return texto.length * px * 0.6;
  const familia = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const deseada = `${px}px ${familia}`;
  if (fuente !== deseada) {
    contexto.font = deseada;
    fuente = deseada;
  }
  return contexto.measureText(texto).width;
}

export const anchoMayor = (textos: string[], px = 12) => Math.ceil(Math.max(0, ...textos.map((t) => anchoTexto(t, px))));

/** Recorta un texto con "…" para que quepa en un ancho en px. */
export function recortarAncho(texto: string, ancho: number, px = 12): string {
  if (anchoTexto(texto, px) <= ancho) return texto;
  let fin = texto.length;
  while (fin > 1 && anchoTexto(`${texto.slice(0, fin)}…`, px) > ancho) fin--;
  return `${texto.slice(0, fin)}…`;
}

export interface Eje {
  paso: number;
  min: number;
  max: number;
  /** Las etiquetas no caben: se oculta la del mínimo */
  apretado?: boolean;
}

const SEPARACION = 12;

/** Marcas "bonitas" del eje de valores (1, 2, 2.5, 5 × 10^n) cuyas etiquetas no se enciman en el área. */
export function marcasEje(valores: number[], formato: (v: number) => string, area: number): Eje | null {
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(0, ...valores);
  const rango = maximo - minimo;
  if (!(rango > 0) || !(area > 0)) return null;
  const limpio = (v: number) => Number(v.toPrecision(12));
  const pasos: number[] = [];
  for (let e = Math.floor(Math.log10(rango / 5)); pasos.length < 12; e++) {
    for (const m of e < 0 ? [1, 2, 5] : [1, 2, 2.5, 5]) if (m * 10 ** e >= rango / 5) pasos.push(limpio(m * 10 ** e));
  }
  let eje: Eje | null = null;
  for (const paso of pasos) {
    const min = limpio(Math.floor(minimo / paso + 1e-9) * paso);
    const max = limpio(Math.ceil(maximo / paso - 1e-9) * paso);
    const n = Math.round((max - min) / paso);
    const etiquetas = Array.from({ length: n + 1 }, (_, i) => formato(limpio(min + i * paso)));
    if (etiquetas.some((t, i) => i > 0 && t === etiquetas[i - 1])) continue;
    eje = { paso, min, max };
    const anchos = etiquetas.map((t) => anchoTexto(t));
    const espacio = (area * paso) / (max - min);
    if (anchos.every((w, i) => i === 0 || espacio - (w + anchos[i - 1]!) / 2 >= SEPARACION)) return eje;
    if (paso >= rango) return { ...eje, apretado: true };
  }
  return eje;
}

export function marcasDe(eje: Eje): number[] {
  const n = Math.round((eje.max - eje.min) / eje.paso);
  return Array.from({ length: n + 1 }, (_, i) => Number((eje.min + i * eje.paso).toPrecision(12)));
}
