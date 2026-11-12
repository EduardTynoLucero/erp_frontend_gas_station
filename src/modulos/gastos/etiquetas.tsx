/** Etiquetas y celdas compartidas por las pantallas de gastos (mismos textos del prototipo). */
import type { GastoResumen, OrigenGasto, TipoDocumento } from '@/api/tipos';
import { Insignia } from '@/componentes/ui/insignia';
import { q } from '@/lib/formato';

export const ORIGEN_CORTO: Record<OrigenGasto, string> = {
  manual: 'Manual',
  recurrente: 'Recurrente',
  reporte: 'Desde reportes',
  caja_chica: 'Caja chica',
  compra: 'Compra',
};

export const ORIGEN_LARGO: Record<OrigenGasto, string> = {
  manual: 'Registro manual',
  recurrente: 'Gasto recurrente',
  reporte: 'Tomado de los reportes del sistema de la estación',
  caja_chica: 'Liquidación de caja chica',
  compra: 'Compra administrativa',
};

export const TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  FEL: 'Factura FEL',
  Recibo: 'Recibo',
  'Sin documento': 'Sin documento',
};

/** Métodos para registrar un pago, en el orden del prototipo */
export const METODOS_DE_PAGO = ['Transferencia', 'Cheque', 'Efectivo', 'Débito bancario', 'Tarjeta corporativa'];

export function nombreProveedor(p: { nombre: string } | null): string {
  return p?.nombre ?? 'Ajuste interno';
}

/** Monto en su moneda (Q, US$…). */
export function montoDe(g: Pick<GastoResumen, 'monto' | 'moneda'>): string {
  return q(g.monto, g.moneda.simbolo);
}

/** Monto con su equivalente en quetzales cuando el gasto está en otra moneda. */
export function CeldaMonto({ g }: { g: Pick<GastoResumen, 'monto' | 'moneda' | 'montoFuncional'> }) {
  return (
    <>
      {montoDe(g)}
      {g.moneda.codigo !== 'GTQ' && <span className="block text-xs text-slate-500 dark:text-slate-400">≈ {q(g.montoFuncional)}</span>}
    </>
  );
}

/** Columna "Comprobante" del registro: Falta / No requiere / FEL ✓ */
export function CeldaComprobante({ g }: { g: Pick<GastoResumen, 'faltaComprobante' | 'documento'> }) {
  if (g.faltaComprobante) return <Insignia tono="red">Falta</Insignia>;
  if (g.documento.tipo === 'Sin documento') return <span className="text-xs text-slate-400 dark:text-slate-500">No requiere</span>;
  return (
    <span className="text-xs text-slate-600 dark:text-slate-300">
      {g.documento.tipo}
      {g.documento.verificado ? ' ✓' : ''}
    </span>
  );
}

/** Periodo AAAA-MM → rango de fechas para filtrar en la API. */
export function rangoDePeriodo(periodo: string): { desde: string; hasta: string } {
  const [a, m] = periodo.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a!, m!, 0)).getUTCDate();
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(ultimo).padStart(2, '0')}` };
}

/** Los últimos `n` periodos AAAA-MM hasta el de `hoy`, del más reciente al más antiguo. */
export function ultimosPeriodos(hoy: string, n = 18): string[] {
  const [a, m] = hoy.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a!, m! - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}
