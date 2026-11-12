import type { ReactNode } from 'react';
import { cn } from '@/lib/utilidades';

/**
 * Barra de título de la página, como la barra de pestañas de los listados de la plantilla: el nombre de la pantalla
 * es la pestaña activa (rojo suave con la línea roja abajo) y las acciones van planas a la derecha («+ Nuevo»,
 * «Exportar»…). La descripción queda debajo, en letra tenue.
 */
export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-[6px]">
      <div className="flex min-h-[34px] flex-wrap items-stretch justify-between rounded-[2px] border border-borde bg-superficie">
        <h1 className="inline-flex min-h-[34px] min-w-0 items-center gap-[5px] border-b-2 border-r border-b-primario border-r-borde-suave bg-primario-suave px-[12px] text-[12px] font-semibold leading-[1.15] text-primario-tinta">
          {titulo}
        </h1>
        {acciones && <div className="barra-acciones ml-auto flex min-w-0 flex-wrap items-stretch">{acciones}</div>}
      </div>
      {descripcion && <p className="mt-[5px] max-w-[1100px] px-[2px] text-[11px] leading-[1.4] text-tenue">{descripcion}</p>}
    </div>
  );
}

export function Tarjeta({
  titulo,
  subtitulo,
  acciones,
  children,
  className,
  cuerpoClassName,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  cuerpoClassName?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-[2px] border border-borde bg-superficie', className)}>
      {(titulo || acciones) && (
        <div className="flex flex-wrap items-center justify-between gap-[6px] border-b border-borde-suave px-[10px] py-[6px]">
          <div className="min-w-0">
            {titulo && <h2 className="text-[12px] font-bold leading-[1.3] text-tinta">{titulo}</h2>}
            {subtitulo && <p className="mt-px text-[11px] leading-[1.35] text-tenue">{subtitulo}</p>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-[6px]">{acciones}</div>}
        </div>
      )}
      <div className={cn('p-[10px]', cuerpoClassName)}>{children}</div>
    </section>
  );
}

const TONOS_STAT = {
  red: 'text-[#a51d17] dark:text-red-400',
  amber: 'text-[#9a6200] dark:text-amber-400',
  green: 'text-[#007a3d] dark:text-emerald-400',
} as const;

/** Indicador de la plantilla: borde fino con la franja roja a la izquierda, etiqueta tenue y el valor en negrita. */
export function Indicador({ etiqueta, valor, pista, tono }: { etiqueta: ReactNode; valor: ReactNode; pista?: ReactNode; tono?: keyof typeof TONOS_STAT }) {
  return (
    <div className="grid content-start gap-[3px] rounded-[2px] border border-l-[3px] border-borde border-l-primario bg-superficie px-[10px] py-[7px]">
      <div className="text-[11px] font-semibold leading-[1.25] text-tenue">{etiqueta}</div>
      <div className={cn('text-[17px] font-bold leading-[1.2] tabular-nums', tono ? TONOS_STAT[tono] : 'text-tinta')}>{valor}</div>
      {pista && <div className="text-[11px] leading-[1.3] text-tenue">{pista}</div>}
    </div>
  );
}
