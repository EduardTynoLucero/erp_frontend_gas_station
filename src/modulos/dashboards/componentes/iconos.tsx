/** Íconos de trazo del panel del ETL (mismos trazos, 24×24). */
import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utilidades';

function Trazo({ children, className, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('size-4 shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoTabla = (p: SVGProps<SVGSVGElement>) => (
  <Trazo {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9 4v16" />
  </Trazo>
);

export const IconoGrafica = (p: SVGProps<SVGSVGElement>) => (
  <Trazo {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Trazo>
);

export type TipoEstado = 'bueno' | 'aviso' | 'critico' | 'info';

const TRAZOS: Record<TipoEstado, ReactNode> = {
  bueno: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12.5 2.6 2.6L16.2 9.5" />
    </>
  ),
  aviso: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  critico: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
};

/**
 * Colores de estado (reservados: nunca se usan como color de serie). Son las variables --estado-* de globals.css:
 * verde y rojo Puma, ámbar para el aviso y pizarra para lo informativo; cambian solas con el tema.
 */
const COLOR_ESTADO: Record<TipoEstado, string> = {
  bueno: 'text-[color:var(--estado-bueno)]',
  aviso: 'text-[color:var(--estado-aviso)]',
  critico: 'text-[color:var(--estado-critico)]',
  info: 'text-[color:var(--estado-info)]',
};

export function IconoEstado({ tipo, className }: { tipo: TipoEstado; className?: string }) {
  return <Trazo className={cn(COLOR_ESTADO[tipo], className)}>{TRAZOS[tipo]}</Trazo>;
}

/** Ícono + texto en peso 500 (el estado siempre lleva texto: nunca solo color). */
export function Estado({ tipo, children }: { tipo: TipoEstado; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
      <IconoEstado tipo={tipo} />
      {children}
    </span>
  );
}
