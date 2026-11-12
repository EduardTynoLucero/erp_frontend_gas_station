/**
 * Tablas de la plantilla (el «datatable fino» de Digital Labs): cabecera de 22 px, filas de 23 px, letra de 10 a
 * 10.5 px, borde fino, franjas alternas y fila roja suave al pasar el ratón. Las acompañan la barra superior («Mostrar N
 * registros» y buscador) y el pie («Mostrando 1 a 50 de 240 registros» y las páginas).
 * Sin 'use client': las clases th/td se importan también desde componentes del servidor; la barra y las páginas
 * (que llevan eventos) solo se usan dentro de pantallas del cliente.
 */
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utilidades';

export const th =
  'h-[22px] whitespace-nowrap border-b border-borde bg-cabecera px-[6px] text-left align-middle text-[10px] font-semibold leading-[1.1] ' +
  'text-[#334155] dark:text-slate-300';
export const thR = cn(th, 'text-right');
export const td = 'h-[23px] border-b border-borde-suave px-[6px] py-[2px] align-middle text-[10.5px] leading-[1.25] text-[#334155] dark:text-slate-300';
export const tdR = cn(td, 'whitespace-nowrap text-right tabular-nums');
export const filaClic = 'cursor-pointer';

/** Envuelve la tabla con su borde y el desplazamiento horizontal. */
export function ContenedorTabla({ children, anchoMinimo = 640, className }: { children: ReactNode; anchoMinimo?: number; className?: string }) {
  return (
    <div className={cn('max-w-full overflow-x-auto border border-borde bg-superficie', className)}>
      <table className="w-full border-collapse" style={{ minWidth: anchoMinimo }}>
        {children}
      </table>
    </div>
  );
}

export function Cabecera({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

/**
 * Clases del cuerpo de una tabla fina: franjas alternas, fila roja suave al pasar el ratón, la última sin borde y los
 * botones de las celdas en su tamaño de tabla (20 px de alto, letra de 10 px), como las acciones del datatable.
 */
export const CUERPO_TABLA =
  '[&>tr:hover]:bg-primario-suave [&>tr:last-child>td]:border-b-0 [&>tr:nth-child(even)]:bg-franja ' +
  '[&_td_.boton]:h-[20px] [&_td_.boton]:px-[6px] [&_td_.boton]:text-[10px] [&_td_.boton_svg]:size-[10px]';

export function Cuerpo({ children }: { children: ReactNode }) {
  return <tbody className={CUERPO_TABLA}>{children}</tbody>;
}

/** Barra superior de una tabla, con el fondo de las barras de la plantilla. */
export function BarraTabla({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[30px] flex-wrap items-center gap-[6px] border border-b-0 border-borde bg-barra px-[5px] py-[2px] text-[11px] text-tenue', className)}>
      {children}
    </div>
  );
}

const CONTROL = 'h-[26px] rounded-[2px] border border-[#cbd5e1] bg-superficie text-[11px] text-tinta focus:border-primario focus:outline-none dark:border-borde-campo';

/** «Mostrar [50] registros» */
export function MostrarRegistros({ valor, opciones = [10, 25, 50, 100], alCambiar }: { valor: number; opciones?: number[]; alCambiar: (n: number) => void }) {
  return (
    <label className="flex items-center gap-[4px] whitespace-nowrap text-[11px] font-medium text-tenue">
      Mostrar
      <select value={valor} onChange={(e) => alCambiar(Number(e.target.value))} className={cn(CONTROL, 'px-[4px]')}>
        {[...new Set([...opciones, valor])]
          .sort((a, b) => a - b)
          .map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
      </select>
      registros
    </label>
  );
}

/** Buscador de la barra de una tabla (a la derecha) */
export function BuscadorTabla({
  valor,
  alCambiar,
  etiqueta = 'Buscar',
  className,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative ml-auto w-full min-w-[170px] sm:w-[230px]', className)}>
      <Search className="pointer-events-none absolute left-[6px] top-1/2 size-[12px] -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        type="search"
        aria-label={etiqueta}
        placeholder={etiqueta}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className={cn(CONTROL, 'w-full pl-[22px] pr-[7px] placeholder:text-slate-400')}
      />
    </div>
  );
}

/** Números de página con ventana: 1 … 4 5 [6] 7 8 … 20 */
function ventana(pagina: number, paginas: number, maximo = 7): (number | 'izq' | 'der')[] {
  if (paginas <= 1) return [1];
  const mitad = Math.floor(maximo / 2);
  let fin = Math.min(paginas, Math.max(1, pagina - mitad) + maximo - 1);
  const inicio = Math.max(1, fin - maximo + 1);
  fin = Math.min(paginas, inicio + maximo - 1);
  const salida: (number | 'izq' | 'der')[] = [];
  if (inicio > 1) {
    salida.push(1);
    if (inicio > 2) salida.push('izq');
  }
  for (let p = inicio; p <= fin; p++) salida.push(p);
  if (fin < paginas) {
    if (fin < paginas - 1) salida.push('der');
    salida.push(paginas);
  }
  return salida;
}

const BOTON_PAGINA =
  'inline-flex h-[24px] min-w-[24px] cursor-pointer items-center justify-center rounded-[2px] border border-[#cbd5e1] bg-superficie px-[4px] text-[10px] font-medium ' +
  'text-tinta transition-colors hover:border-primario hover:bg-primario-suave hover:text-primario-tinta disabled:cursor-default disabled:opacity-40 ' +
  'disabled:hover:border-[#cbd5e1] disabled:hover:bg-superficie disabled:hover:text-tinta dark:border-borde-campo';

export function Paginacion({ pagina, paginas, alCambiar, ocupado }: { pagina: number; paginas: number; alCambiar: (p: number) => void; ocupado?: boolean }) {
  const total = Math.max(1, paginas);
  const actual = Math.min(Math.max(1, pagina), total);
  const ir = (p: number) => p >= 1 && p <= total && p !== actual && alCambiar(p);
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-end gap-[2px]">
      <button type="button" className={BOTON_PAGINA} onClick={() => ir(1)} disabled={ocupado || actual === 1} aria-label="Primera página">
        «
      </button>
      <button type="button" className={BOTON_PAGINA} onClick={() => ir(actual - 1)} disabled={ocupado || actual === 1} aria-label="Página anterior">
        ‹
      </button>
      {ventana(actual, total).map((p) =>
        typeof p === 'number' ? (
          <button
            key={p}
            type="button"
            aria-current={p === actual ? 'page' : undefined}
            aria-label={`Página ${p}`}
            disabled={ocupado && p !== actual}
            className={cn(BOTON_PAGINA, p === actual && 'border-primario bg-primario text-white hover:bg-primario hover:text-white')}
            onClick={() => ir(p)}
          >
            {p}
          </button>
        ) : (
          <span key={p} className={cn(BOTON_PAGINA, 'cursor-default opacity-70 hover:border-[#cbd5e1] hover:bg-superficie hover:text-tinta')} aria-hidden>
            …
          </span>
        ),
      )}
      <button type="button" className={BOTON_PAGINA} onClick={() => ir(actual + 1)} disabled={ocupado || actual === total} aria-label="Página siguiente">
        ›
      </button>
      <button type="button" className={BOTON_PAGINA} onClick={() => ir(total)} disabled={ocupado || actual === total} aria-label="Última página">
        »
      </button>
    </nav>
  );
}

/** Pie de una tabla: «Mostrando 1 a 50 de 240 registros» a la izquierda y lo que se le pase (las páginas) a la derecha. */
export function PieTabla({
  desde,
  hasta,
  total,
  nombre = 'registros',
  children,
  className,
}: {
  desde: number;
  hasta: number;
  total: number;
  nombre?: string;
  children?: ReactNode;
  className?: string;
}) {
  const n = (v: number) => v.toLocaleString('en-US');
  return (
    <div className={cn('mt-[3px] flex min-h-[26px] flex-wrap items-center justify-between gap-[4px] text-[10px] text-tenue', className)}>
      <span className="font-medium tabular-nums">
        {total === 0 ? `Sin ${nombre}` : `Mostrando ${n(desde)} a ${n(hasta)} de ${n(total)} ${nombre}`}
      </span>
      {children}
    </div>
  );
}
