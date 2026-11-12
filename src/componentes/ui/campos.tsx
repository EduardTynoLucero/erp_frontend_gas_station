import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utilidades';

/**
 * Estilo de input, select y textarea de la plantilla: 30 px de alto, borde fino gris, esquinas de 2 px y letra de
 * 12 px. Al enfocar, borde rojo Puma con un halo suave; con error, borde rojo oscuro y el mensaje debajo.
 */
export function claseEntrada(error?: boolean, extra?: string): string {
  return cn(
    'block min-h-[30px] w-full rounded-[2px] border border-borde-campo bg-superficie px-[8px] py-[5px] text-[12px] leading-[1.35] text-tinta ' +
      'placeholder:text-slate-400 hover:border-[#94a3b8] focus:border-primario focus:shadow-[0_0_0_2px_var(--ui-primary-soft)] focus:outline-none ' +
      'disabled:cursor-not-allowed disabled:border-borde-suave disabled:bg-apagado disabled:text-tenue [&[readonly]]:bg-apagado [&[readonly]]:text-tenue ' +
      'dark:placeholder:text-slate-500 dark:hover:border-slate-500',
    error && 'border-[#a51d17] shadow-[0_0_0_1px_#fdecec] hover:border-[#a51d17] focus:border-[#a51d17] dark:border-red-400 dark:shadow-none',
    extra,
  );
}

/** Campo de las barras de filtros: más bajo (28 px) y con letra de 11 px. */
export function claseFiltro(extra?: string): string {
  return cn(
    'block h-[28px] w-full min-w-0 rounded-[2px] border border-borde-campo bg-superficie px-[7px] text-[11px] font-medium text-tinta ' +
      'placeholder:text-slate-400 hover:border-[#94a3b8] focus:border-primario focus:shadow-[0_0_0_1px_var(--ui-primary)] focus:outline-none ' +
      'disabled:cursor-not-allowed disabled:border-borde disabled:bg-apagado disabled:text-tenue dark:placeholder:text-slate-500 dark:hover:border-slate-500',
    extra,
  );
}

/** Etiqueta de un campo (11 px, seminegrita, tenue) */
export const ETIQUETA = 'mb-[3px] block text-[11px] font-semibold leading-[1.2] text-tenue';

export function Campo({
  etiqueta,
  pista,
  error,
  className,
  children,
  htmlFor,
}: {
  etiqueta: ReactNode;
  pista?: ReactNode;
  error?: string | undefined;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={cn('block min-w-0', className)}>
      <label htmlFor={htmlFor} className={cn(ETIQUETA, error && 'text-[#a51d17] dark:text-red-400')}>
        {etiqueta}
      </label>
      {children}
      {error ? (
        <span role="alert" className="mt-[3px] block text-[11px] font-medium text-[#a51d17] dark:text-red-400">
          {error}
        </span>
      ) : (
        pista && <span className="mt-[3px] block text-[11px] text-tenue">{pista}</span>
      )}
    </div>
  );
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean }>(
  function Entrada({ invalido, className, ...props }, ref) {
    return <input ref={ref} aria-invalid={invalido || undefined} className={claseEntrada(invalido, className)} {...props} />;
  },
);

export const Seleccion = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalido?: boolean }>(
  function Seleccion({ invalido, className, ...props }, ref) {
    return <select ref={ref} aria-invalid={invalido || undefined} className={claseEntrada(invalido, className)} {...props} />;
  },
);

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalido?: boolean }>(
  function AreaTexto({ invalido, className, ...props }, ref) {
    return <textarea ref={ref} aria-invalid={invalido || undefined} className={claseEntrada(invalido, cn('min-h-[64px] resize-y', className))} {...props} />;
  },
);
