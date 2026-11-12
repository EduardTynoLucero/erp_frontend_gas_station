import type { ReactNode } from 'react';
import type { EstadoGasto } from '@/api/tipos';
import { cn } from '@/lib/utilidades';

export type Tono = 'gray' | 'blue' | 'green' | 'green-solid' | 'amber' | 'red' | 'violet' | 'pink';

/**
 * Tonos de las etiquetas de la plantilla (ListPill): texto oscuro sobre fondo claro, con borde del mismo color. Van en
 * la paleta de Puma Energy (rojo, verde, gris pizarra y blanco); el ámbar se queda para lo pendiente y las advertencias.
 * Los nombres de los tonos son los de siempre, pero «blue» (en proceso, informativo) ya se ve en pizarra, «violet» en
 * blanco con borde pizarra y «pink» en rojo suave. «green-solid» es el verde lleno de lo completado (pagado).
 */
const TONOS: Record<Tono, string> = {
  gray: 'border-[#e2e8f0] bg-[#f8fafc] text-[#475569] dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  blue: 'border-[#cbd5e1] bg-[#e2e8f0] text-[#1e293b] dark:border-slate-500 dark:bg-slate-600/40 dark:text-slate-100',
  green: 'border-[#a8e6c4] bg-[#ecfdf5] text-[#007a3d] dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300',
  'green-solid': 'border-[#007a3d] bg-[#007a3d] text-white dark:border-[#007a3d] dark:bg-[#007a3d] dark:text-white',
  amber: 'border-[#fde68a] bg-[#fef3c7] text-[#b45309] dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'border-[#fecaca] bg-[#fee2e2] text-[#b91c1c] dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300',
  violet: 'border-[#94a3b8] bg-white text-[#334155] dark:border-slate-500 dark:bg-transparent dark:text-slate-200',
  pink: 'border-[#fecaca] bg-[#fef2f2] text-[#a1040e] dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300',
};

export function Insignia({ tono = 'gray', children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center whitespace-nowrap rounded-full border px-[7px] align-middle text-[10px] font-bold leading-none',
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const ESTADOS: Record<EstadoGasto, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'gray' },
  pendiente: { texto: 'Por autorizar', tono: 'amber' },
  aprobado: { texto: 'Aprobado', tono: 'green' },
  rechazado: { texto: 'Rechazado', tono: 'red' },
  pagado: { texto: 'Pagado', tono: 'green-solid' },
};

export function InsigniaEstado({ estado }: { estado: EstadoGasto }) {
  const e = ESTADOS[estado];
  return <Insignia tono={e.tono}>{e.texto}</Insignia>;
}
