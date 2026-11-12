'use client';

import { cn } from '@/lib/utilidades';

/**
 * Botones segmentados de la plantilla: una fila con borde fino, el elegido en rojo sólido. Un botón no disponible
 * queda con aria-disabled y su motivo en title.
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  noDisponible,
  className,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T | '';
  alCambiar: (v: T) => void;
  etiqueta: string;
  /** Devuelve el motivo si el botón no está disponible */
  noDisponible?: (v: T) => string | null;
  className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={cn('inline-flex flex-wrap overflow-hidden rounded-[2px] border border-borde-campo bg-superficie', className)}>
      {opciones.map((o) => {
        const motivo = noDisponible?.(o.valor) ?? null;
        const marcado = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={marcado}
            aria-disabled={motivo ? true : undefined}
            title={motivo ?? undefined}
            onClick={() => !motivo && alCambiar(o.valor)}
            className={cn(
              'h-[26px] cursor-pointer border-r border-borde-suave px-[9px] text-[11px] font-medium whitespace-nowrap transition-colors last:border-r-0 focus:outline-none focus-visible:bg-realce',
              marcado ? 'bg-primario font-semibold text-white' : 'text-tinta-suave hover:bg-realce hover:text-primario-tinta',
              motivo && 'cursor-not-allowed text-slate-400 opacity-60 hover:bg-transparent hover:text-slate-400',
            )}
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}
