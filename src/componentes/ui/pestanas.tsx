'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utilidades';

/** Clases de la barra y de cada pestaña (también las usa el menú de pestañas de las pantallas del prototipo). */
export const BARRA_PESTANAS = 'mb-[6px] flex min-h-[34px] items-stretch overflow-x-auto rounded-[2px] border border-borde bg-superficie [scrollbar-width:none]';

export function clasePestana(activa: boolean): string {
  return cn(
    'inline-flex min-h-[34px] shrink-0 cursor-pointer items-center justify-center gap-[5px] whitespace-nowrap border-b-2 border-r border-r-borde-suave px-[12px] ' +
      'text-[12px] font-semibold leading-none transition-colors focus:outline-none focus-visible:bg-realce',
    activa ? 'border-b-primario bg-primario-suave text-primario-tinta' : 'border-b-transparent bg-superficie text-tinta hover:bg-realce hover:text-primario-tinta',
  );
}

/** Pestañas de la plantilla: una barra con borde; la activa lleva el fondo rojo suave y la línea roja abajo. */
export function Pestanas<T extends string>({
  pestanas,
  valor,
  alCambiar,
}: {
  pestanas: { valor: T; etiqueta: ReactNode }[];
  valor: T;
  alCambiar: (v: T) => void;
}) {
  return (
    <div role="tablist" className={BARRA_PESTANAS}>
      {pestanas.map((p) => (
        <button key={p.valor} type="button" role="tab" aria-selected={p.valor === valor} onClick={() => alCambiar(p.valor)} className={clasePestana(p.valor === valor)}>
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}
