'use client';

/**
 * Piezas de los listados de la plantilla (ListLayout de Digital Labs): la barra de filtros que se muestra u oculta
 * («Ver filtros» / «Ocultar filtros», con el número de filtros activos y «Borrar filtros») y sus campos, con la
 * etiqueta de 10 px sobre un control de 28 px.
 */
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utilidades';

/** Si los filtros de una pantalla están a la vista: se recuerda en este navegador. */
export function useFiltrosAbiertos(clave: string, inicial = true): [boolean, () => void] {
  const [abierto, setAbierto] = useState(inicial);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(`erp:filtros:${clave}`);
      if (guardado === '1' || guardado === '0') setAbierto(guardado === '1');
    } catch {
      // sin almacenamiento: queda como empieza
    }
  }, [clave]);
  const alternar = () =>
    setAbierto((a) => {
      try {
        localStorage.setItem(`erp:filtros:${clave}`, a ? '0' : '1');
      } catch {
        // sin almacenamiento: vale hasta recargar
      }
      return !a;
    });
  return [abierto, alternar];
}

export function BarraFiltros({
  abierto,
  alAlternar,
  activos = 0,
  alLimpiar,
  controles,
  children,
  className,
}: {
  abierto: boolean;
  alAlternar: () => void;
  /** Cuántos filtros están puestos: sale en un cuadro rojo junto al botón */
  activos?: number;
  alLimpiar?: () => void;
  /** Lo que va a la derecha de la barra: «Mostrar N registros», el buscador, un total */
  controles?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-borde-suave bg-barra px-[6px] py-[4px]', className)}>
      <div className="flex min-h-[28px] flex-wrap items-center gap-x-[10px] gap-y-[4px]">
        <button
          type="button"
          onClick={alAlternar}
          aria-expanded={abierto}
          className={cn(
            'inline-flex h-[28px] cursor-pointer items-center gap-[5px] text-[11px] font-medium leading-none focus:outline-none focus-visible:underline',
            abierto ? 'text-primario-tinta' : 'text-tinta hover:text-primario-tinta',
          )}
        >
          <SlidersHorizontal className="size-[14px]" aria-hidden />
          <span>{abierto ? 'Ocultar filtros' : 'Ver filtros'}</span>
          {activos > 0 && (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center bg-primario px-[5px] text-[11px] font-extrabold text-white">{activos}</span>
          )}
          <ChevronDown className={cn('size-[14px] transition-transform duration-150', abierto && 'rotate-180')} aria-hidden />
        </button>
        {activos > 0 && alLimpiar && (
          <button
            type="button"
            onClick={alLimpiar}
            className="inline-flex h-[28px] cursor-pointer items-center gap-[4px] text-[11px] font-medium leading-none text-slate-400 hover:text-primario-tinta focus:outline-none focus-visible:underline"
          >
            <X className="size-[13px]" aria-hidden />
            Borrar filtros
          </button>
        )}
        {controles && <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-[10px] gap-y-[4px]">{controles}</div>}
      </div>
      {abierto && <div className="mt-[3px] grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] items-end gap-[6px] pb-[2px]">{children}</div>}
    </div>
  );
}

/** Campo de la barra de filtros: la etiqueta arriba (10 px, seminegrita) y el control debajo (use claseFiltro()). */
export function CampoFiltro({ etiqueta, children, className }: { etiqueta: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-[3px] text-[10px] font-semibold leading-[1.1] text-tinta', className)}>
      {etiqueta}
      {children}
    </label>
  );
}

/** Casilla dentro de los filtros («Solo sin comprobante») */
export function CasillaFiltro({ etiqueta, marcado, alCambiar }: { etiqueta: ReactNode; marcado: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <label className="inline-flex h-[28px] cursor-pointer items-center gap-[6px] text-[11px] font-medium text-tinta">
      <input type="checkbox" checked={marcado} onChange={(e) => alCambiar(e.target.checked)} className="size-[13px]" />
      {etiqueta}
    </label>
  );
}
