/**
 * Validación del formulario de gasto en el navegador. Repite las reglas de formato del backend (Zod) para avisar
 * antes de enviar; el backend vuelve a validar todo y sus errores por campo se muestran igual.
 * El monto se valida y se envía como TEXTO: nunca pasa por un número de coma flotante.
 */
import { Decimal } from 'decimal.js';
import type { CatalogosGasto, TipoDocumento } from '@/api/tipos';

/** NUMERIC(19,4) como texto: hasta 15 enteros y 4 decimales (mismo patrón que el backend). */
export const PATRON_IMPORTE = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;
/** Tipo de cambio NUMERIC(19,8) */
export const PATRON_TASA = /^(?:0|[1-9]\d{0,10})(?:\.\d{1,8})?$/;

export interface ValoresGasto {
  modo: 'gasto' | 'solicitud';
  fecha: string;
  estacionId: string;
  centroCostoId: string;
  categoriaId: string;
  subcategoria: string;
  proveedorId: string;
  descripcion: string;
  moneda: string;
  monto: string;
  tipoCambio: string;
  metodoPago: string;
  /** '' = seguir la sugerencia (fecha + días de crédito del proveedor) */
  vencimiento: string;
  docTipo: TipoDocumento;
  docSerie: string;
  docNumero: string;
}

export type CampoGasto = keyof ValoresGasto;
export type ErroresGasto = Partial<Record<CampoGasto, string>>;

function decimales(texto: string): number {
  const i = texto.indexOf('.');
  return i < 0 ? 0 : texto.length - i - 1;
}

/** Valida en el orden en que se muestran los errores (el mismo del prototipo). */
export function validarGasto(v: ValoresGasto, c: Pick<CatalogosGasto, 'monedas' | 'parametros'>): ErroresGasto {
  const e: ErroresGasto = {};
  if (!v.fecha) e.fecha = 'Indique la fecha del gasto.';
  else if (v.fecha > c.parametros.hoy) e.fecha = 'La fecha no puede ser posterior a hoy.';
  if (!v.estacionId) e.estacionId = 'Seleccione la estación.';
  if (!v.centroCostoId) e.centroCostoId = 'El centro de costo no corresponde a la estación.';
  if (!v.descripcion.trim()) e.descripcion = 'Escriba una descripción.';

  const moneda = c.monedas.find((m) => m.codigo === v.moneda);
  const monto = v.monto.trim();
  if (!monto) e.monto = 'El monto debe ser mayor que cero.';
  else if (!PATRON_IMPORTE.test(monto)) e.monto = 'Monto inválido: use dígitos y punto decimal, sin separadores de miles (ej. 1500.00).';
  else if (new Decimal(monto).lte(0)) e.monto = 'El monto debe ser mayor que cero.';
  else if (moneda && decimales(monto) > moneda.decimales) e.monto = `Un monto en ${moneda.codigo} admite como máximo ${moneda.decimales} decimales.`;

  if (moneda && !moneda.esFuncional) {
    const tasa = v.tipoCambio.trim();
    if (!tasa) e.tipoCambio = `Indique el tipo de cambio de ${moneda.codigo}.`;
    else if (!PATRON_TASA.test(tasa)) e.tipoCambio = 'Tipo de cambio inválido: use dígitos y punto decimal, con hasta 8 decimales.';
    else if (new Decimal(tasa).lte(0) || new Decimal(tasa).eq(1)) e.tipoCambio = `Indique el tipo de cambio de ${moneda.codigo} (quetzales por cada ${moneda.codigo}).`;
  }

  if (v.modo === 'gasto') {
    if (v.docTipo === 'FEL' && (!v.docSerie.trim() || !v.docNumero.trim())) e.docNumero = 'La factura FEL necesita serie y número.';
    if (v.docTipo === 'Recibo' && !v.docNumero.trim()) e.docNumero = 'Indique el número de recibo.';
  }
  return e;
}

/** Ruta de campo del backend ("documento.numero") → campo del formulario. */
export const CAMPO_DE_API: Readonly<Record<string, CampoGasto>> = {
  fecha: 'fecha',
  estacionId: 'estacionId',
  centroCostoId: 'centroCostoId',
  categoriaId: 'categoriaId',
  subcategoria: 'subcategoria',
  proveedorId: 'proveedorId',
  descripcion: 'descripcion',
  moneda: 'moneda',
  monto: 'monto',
  tipoCambio: 'tipoCambio',
  metodoPago: 'metodoPago',
  vencimiento: 'vencimiento',
  'documento.numero': 'docNumero',
  'documento.serie': 'docSerie',
  'documento.tipo': 'docTipo',
};

/** Equivalente en quetzales (exacto, half up a 2 decimales) para la vista previa del nivel de autorización. */
export function montoFuncionalEstimado(monto: string, tasa: string): Decimal {
  if (!PATRON_IMPORTE.test(monto.trim())) return new Decimal(0);
  const t = PATRON_TASA.test(tasa.trim()) ? new Decimal(tasa.trim()) : new Decimal(1);
  return new Decimal(monto.trim()).mul(t).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
