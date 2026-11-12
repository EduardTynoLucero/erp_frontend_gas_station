'use client';

/**
 * Zona para soltar los reportes de BISS (o elegirlos), como la del panel del ETL. Acepta varios .xlsx a la vez;
 * cada uno se sube y se revisa por separado.
 */
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import { type DragEvent, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utilidades';

export const MAX_MB = 50;

export function ZonaCarga({ alElegir, deshabilitada }: { alElegir: (archivos: File[]) => void; deshabilitada?: boolean }) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  // dragenter/dragleave también saltan al pasar sobre los hijos: se cuenta para saber cuándo se salió de verdad
  const profundidad = useRef(0);

  const soltar = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    profundidad.current = 0;
    setEncima(false);
    if (deshabilitada) return;
    const archivos = [...e.dataTransfer.files];
    if (archivos.length) alElegir(archivos);
  };

  return (
    <label
      htmlFor={id}
      onDragEnter={(e) => {
        e.preventDefault();
        profundidad.current++;
        setEncima(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = deshabilitada ? 'none' : 'copy';
      }}
      onDragLeave={() => {
        profundidad.current = Math.max(0, profundidad.current - 1);
        if (profundidad.current === 0) setEncima(false);
      }}
      onDrop={soltar}
      className={cn(
        'group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-900',
        encima
          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
          : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/5',
        deshabilitada && 'pointer-events-none opacity-60',
      )}
    >
      <span
        className={cn(
          'grid size-14 place-items-center rounded-2xl shadow-sm ring-1 ring-inset transition-transform duration-200',
          encima
            ? 'scale-110 bg-brand-500 text-white ring-brand-500'
            : 'bg-white text-brand-600 ring-slate-200 group-hover:scale-105 dark:bg-slate-800 dark:text-brand-300 dark:ring-slate-700',
        )}
      >
        {encima ? <FileSpreadsheet className="size-7" aria-hidden /> : <UploadCloud className="size-7" aria-hidden />}
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
          {encima ? (
            'Suelte los archivos para subirlos'
          ) : (
            <>
              Arrastre aquí los reportes de BISS o <span className="text-brand-600 underline-offset-2 group-hover:underline dark:text-brand-300">elíjalos</span>
            </>
          )}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          Consulta de Tickets (comprobantes por turno y bomba) o Reporte de compras · Excel .xlsx de hasta {MAX_MB} MB · varios a la vez
        </span>
      </span>
      <input
        ref={entrada}
        id={id}
        type="file"
        multiple
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        disabled={deshabilitada}
        onChange={(e) => {
          const archivos = [...(e.target.files ?? [])];
          e.target.value = '';
          if (archivos.length) alElegir(archivos);
        }}
      />
    </label>
  );
}
