import type { ReactNode } from 'react';
import { cn } from '@/lib/utilidades';

/**
 * Avisos de la plantilla: borde fino, fondo claro del mismo tono, esquinas de 2 px y letra de 11 px. El informativo
 * («blue», el de siempre) va en gris pizarra y el de éxito en verde Puma.
 */
const TONOS = {
  blue: 'border-[#cbd5e1] bg-[#f1f5f9] text-[#1e293b] dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200',
  amber: 'border-[#f5d48a] bg-[#fff4e0] text-[#8a5800] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  red: 'border-[#f5c2c0] bg-[#fff5f5] text-[#a51d17] dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
  green: 'border-[#a8e6c4] bg-[#ecfdf5] text-[#005c2e] dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
} as const;

export function Aviso({ tono = 'blue', children, className }: { tono?: keyof typeof TONOS; children: ReactNode; className?: string }) {
  return (
    <div role={tono === 'red' ? 'alert' : 'status'} className={cn('rounded-[2px] border px-[10px] py-[6px] text-[11px] leading-[1.4]', TONOS[tono], className)}>
      {children}
    </div>
  );
}

export function Vacio({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[2px] border border-dashed border-borde px-[14px] py-[16px] text-center text-[12px] text-tenue', className)}>{children}</div>;
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-[2px] bg-slate-200/60 dark:bg-slate-800', className)} />;
}

/** Filas grises mientras carga una tabla. */
export function EsqueletoTabla({ filas = 6 }: { filas?: number }) {
  return (
    <div className="space-y-[3px]" aria-label="Cargando…">
      {Array.from({ length: filas }, (_, i) => (
        <Esqueleto key={i} className="h-[22px] w-full" />
      ))}
    </div>
  );
}
