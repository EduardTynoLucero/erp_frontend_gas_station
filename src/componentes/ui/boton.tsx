'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import type { Verificacion } from '@/api/tipos';
import { cn } from '@/lib/utilidades';

export type Variante = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type Tamano = 'md' | 'sm';

/** Botón de la plantilla: 30 px de alto, esquinas de 2 px, borde fino, sin sombra ni degradado. */
const BASE =
  // `boton` no tiene estilo propio: es la marca con que las tablas finas achican los botones de sus celdas
  'boton inline-flex shrink-0 cursor-pointer items-center justify-center gap-[5px] whitespace-nowrap rounded-[2px] border font-semibold ' +
  'leading-none transition-colors focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-primario disabled:cursor-not-allowed disabled:opacity-55';

const VARIANTES: Record<Variante, string> = {
  primary: 'border-primario bg-primario text-white hover:border-primario-fuerte hover:bg-primario-fuerte',
  secondary: 'border-borde-campo bg-superficie text-tinta hover:border-primario hover:text-primario disabled:hover:border-borde-campo disabled:hover:text-tinta',
  ghost: 'border-transparent bg-transparent text-tinta-suave hover:bg-realce hover:text-primario-tinta disabled:hover:bg-transparent',
  danger:
    'border-[#f5b5b8] bg-superficie text-[#c20510] hover:border-[#e30613] hover:bg-[#fef2f2] ' +
    'dark:border-red-500/40 dark:text-red-300 dark:hover:border-red-400 dark:hover:bg-red-500/10',
  // Verde Puma; con texto blanco va el #007A3D también en oscuro (el #008F47 no llega al contraste del texto chico)
  success: 'border-[#007a3d] bg-[#007a3d] text-white hover:border-[#005c2e] hover:bg-[#005c2e]',
};

const TAMANOS: Record<Tamano, string> = {
  md: 'h-[30px] px-[12px] text-[12px] [&_svg]:size-[14px]',
  sm: 'h-[24px] px-[8px] text-[11px] [&_svg]:size-[12px]',
};

export function clasesBoton(variante: Variante = 'primary', tamano: Tamano = 'md', extra?: string): string {
  return cn(BASE, VARIANTES[variante], TAMANOS[tamano], extra);
}

/** Botón de ícono de las barras y las tablas (26 px, borde gris pizarra; rojo al pasar el ratón). */
export const BOTON_ICONO =
  'inline-flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-[#cbd5e1] bg-superficie text-[#475569] ' +
  'transition-colors hover:border-primario hover:bg-primario-suave hover:text-primario-tinta focus:outline-none focus-visible:outline ' +
  'focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primario disabled:cursor-not-allowed disabled:opacity-40 ' +
  'dark:border-borde-campo dark:text-slate-300 [&_svg]:size-[13px]';

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  /** Muestra un indicador y deshabilita mientras la acción está en curso */
  cargando?: boolean;
  icono?: ReactNode;
}

export function Boton({ variante, tamano, cargando, icono, className, children, disabled, type = 'button', ...props }: PropsBoton) {
  return (
    <button type={type} className={clasesBoton(variante, tamano, className)} disabled={disabled || cargando} aria-busy={cargando || undefined} {...props}>
      {cargando ? <Loader2 className="animate-spin" aria-hidden /> : icono}
      {children}
    </button>
  );
}

export function EnlaceBoton({
  variante,
  tamano,
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamano?: Tamano }) {
  return <Link className={clasesBoton(variante, tamano, className)} {...props} />;
}

/** Tooltip accesible (también funciona sobre elementos deshabilitados, envueltos en un span enfocable). */
export function Ayuda({ texto, children, lado = 'top' }: { texto: ReactNode; children: ReactNode; lado?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={lado}
          sideOffset={6}
          className="z-[80] max-w-xs rounded-[2px] bg-slate-800 px-[8px] py-[6px] text-[11px] leading-snug text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          {texto}
          <Tooltip.Arrow className="fill-slate-800 dark:fill-slate-100" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/**
 * Botón gobernado por la regla del backend ({ ok, motivo } de `acciones`). Si la acción no está permitida queda
 * deshabilitado y el motivo se muestra en un tooltip (al pasar el ratón o al enfocar con el teclado).
 */
export function BotonAccion({ verificacion, ...props }: PropsBoton & { verificacion: Verificacion }) {
  if (verificacion.ok) return <Boton {...props} />;
  return (
    <Ayuda texto={verificacion.motivo}>
      <span
        tabIndex={0}
        className="inline-flex rounded-[2px] focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primario"
        aria-label={verificacion.motivo}
      >
        <Boton {...props} disabled aria-disabled className={cn(props.className, 'pointer-events-none')} />
      </span>
    </Ayuda>
  );
}
