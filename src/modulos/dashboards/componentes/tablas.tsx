/**
 * Tablas del dashboard (tablaHtml y tablaPivote del panel): encabezado fijo al desplazar, columnas numéricas a la
 * derecha con cifras tabulares, pie de totales; sin orden por columna ni paginación.
 */
import type { ReactNode } from 'react';
import { CUERPO_TABLA, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { cn } from '@/lib/utilidades';
import type { Serie } from '../productos';

export interface Columna<T> {
  titulo: ReactNode;
  valor: (fila: T) => ReactNode;
  der?: boolean;
}

export function TablaDatos<T>({
  columnas,
  filas,
  pie,
  vacio = 'Sin datos',
  limitar = true,
  clave,
}: {
  columnas: Columna<T>[];
  filas: T[];
  pie?: T | null;
  vacio?: string;
  /** Alto máximo de 360 px con desplazamiento (tablas de las gráficas) */
  limitar?: boolean;
  clave?: (fila: T, i: number) => string | number;
}) {
  if (!filas.length) return <p className="px-[14px] py-[18px] text-center text-[12px] text-tenue">{vacio}</p>;
  // Tabla fina de la plantilla: cabecera de 22 px, filas de 23 px, franjas alternas y fila roja suave al pasar el ratón
  return (
    <div className={cn('overflow-auto border border-borde bg-superficie', limitar && 'max-h-[360px]')}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-[1]">
          <tr>
            {columnas.map((c, j) => (
              <th key={j} scope="col" className={c.der ? thR : th}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={CUERPO_TABLA}>
          {filas.map((f, i) => (
            <tr key={clave?.(f, i) ?? i}>
              {columnas.map((c, j) => (
                <td key={j} className={c.der ? tdR : td}>
                  {c.valor(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {pie && (
          <tfoot>
            <tr>
              {columnas.map((c, j) => (
                <td key={j} className={cn(c.der ? tdR : td, 'border-b-0 border-t border-borde bg-cabecera font-bold text-tinta dark:text-white')}>
                  {c.valor(pie)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

interface FilaPivote {
  x: string;
  valores: number[];
  total: number;
  esPie?: boolean;
}

/** Categorías × una columna por serie, «Total» por fila (si hay más de una serie) y pie con las sumas. */
export function TablaPivote({
  categorias,
  series,
  etiqueta,
  tituloCategoria,
  formato,
}: {
  categorias: string[];
  series: Serie[];
  etiqueta: (x: string) => string;
  tituloCategoria: string;
  formato: (n: number) => string;
}) {
  const filas: FilaPivote[] = categorias.map((x, i) => ({
    x,
    valores: series.map((s) => s.valores[i] ?? 0),
    total: series.reduce((a, s) => a + (s.valores[i] ?? 0), 0),
  }));
  const pie: FilaPivote = {
    x: 'Total',
    valores: series.map((s) => s.valores.reduce((a, v) => a + v, 0)),
    total: filas.reduce((a, f) => a + f.total, 0),
    esPie: true,
  };
  const columnas: Columna<FilaPivote>[] = [
    { titulo: tituloCategoria, valor: (f) => (f.esPie ? 'Total' : etiqueta(f.x)) },
    ...series.map((s, k) => ({ titulo: s.nombre, valor: (f: FilaPivote) => formato(f.valores[k] ?? 0), der: true })),
    ...(series.length > 1 ? [{ titulo: 'Total', valor: (f: FilaPivote) => formato(f.total), der: true }] : []),
  ];
  return <TablaDatos columnas={columnas} filas={filas} pie={pie} clave={(f) => f.x} />;
}

/** Punto de color de producto en las tablas (9×9, radio 3). */
export function Punto({ color }: { color: string }) {
  return <span aria-hidden className="mr-1.5 inline-block size-[9px] rounded-[3px] align-baseline" style={{ background: color }} />;
}
