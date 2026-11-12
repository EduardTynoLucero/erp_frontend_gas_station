'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utilidades';

const ANCHOS = {
  /** Confirmaciones y formularios cortos */
  normal: 'sm:max-w-[520px]',
  /** Formularios de dos columnas */
  ancho: 'sm:max-w-[780px]',
  /** Formularios largos (nuevo gasto) y detalles con tabla */
  grande: 'sm:max-w-[1040px]',
} as const;

const ContextoPie = createContext<HTMLElement | null>(null);

/**
 * Botones del pie del modal puestos desde su contenido: un formulario que vive dentro del cuerpo (con su estado)
 * declara aquí «Cancelar» y «Guardar» y quedan en el pie fijo del modal, fuera del área que se desplaza.
 */
export function PieDeModal({ children }: { children: ReactNode }) {
  const nodo = useContext(ContextoPie);
  return nodo ? createPortal(children, nodo) : null;
}

/**
 * Modal de la plantilla (Radix, accesible): centrado, borde fino, esquinas de 4 px, encabezado de 42 px con el título
 * y el botón de cerrar, cuerpo con desplazamiento propio y pie con los botones. Se cierra con Escape o clic fuera.
 */
export function Modal({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  children,
  pie,
  ancho,
  tamano,
  cuerpoClassName,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: ReactNode;
  descripcion?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  /** Atajo de tamano="ancho" */
  ancho?: boolean;
  tamano?: keyof typeof ANCHOS;
  cuerpoClassName?: string;
}) {
  const [nodoPie, setNodoPie] = useState<HTMLElement | null>(null);
  return (
    <Dialog.Root open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(15_23_42/0.35)] dark:bg-black/60" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[8px] sm:p-[16px]">
          <Dialog.Content
            className={cn(
              'flex max-h-[calc(100dvh-16px)] w-full flex-col overflow-hidden rounded-[4px] border border-borde-campo bg-superficie text-[12px] text-tinta shadow-xl ' +
                'focus:outline-none sm:max-h-[calc(100dvh-32px)]',
              ANCHOS[tamano ?? (ancho ? 'ancho' : 'normal')],
            )}
          >
            <div className="flex min-h-[42px] shrink-0 items-center justify-between gap-[10px] border-b border-borde-suave px-[10px] py-[9px]">
              <div className="min-w-0">
                <Dialog.Title className="text-[15px] font-bold leading-[1.2] text-tinta">{titulo}</Dialog.Title>
                {descripcion ? (
                  <Dialog.Description className="mt-[2px] text-[11px] text-tenue">{descripcion}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{typeof titulo === 'string' ? titulo : 'Diálogo'}</Dialog.Description>
                )}
              </div>
              <Dialog.Close
                aria-label="Cerrar"
                className="inline-flex size-[28px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-borde-campo bg-superficie text-tinta transition-colors hover:border-primario hover:text-primario focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-primario"
              >
                <X className="size-[14px]" />
              </Dialog.Close>
            </div>
            <div className={cn('min-h-0 flex-1 overflow-auto p-[10px]', cuerpoClassName)}>
              <ContextoPie.Provider value={nodoPie}>{children}</ContextoPie.Provider>
            </div>
            {/* El pie recibe los botones por la propiedad `pie` o desde el contenido, con <PieDeModal>; vacío no se ve */}
            <div
              ref={setNodoPie}
              className="flex min-h-[46px] shrink-0 flex-wrap items-center justify-end gap-[6px] border-t border-borde-suave px-[10px] py-[8px] empty:hidden"
            >
              {pie}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
