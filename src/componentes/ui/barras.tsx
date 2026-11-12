import { cn } from '@/lib/utilidades';

/** Lista de barras horizontales (BarList del prototipo). */
export function ListaBarras({
  elementos,
  formato,
  color = 'var(--acento)',
}: {
  elementos: { clave: string; etiqueta: string; valor: number; sub?: string }[];
  formato: (v: number) => string;
  color?: string;
}) {
  if (elementos.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos para el filtro seleccionado.</p>;
  }
  const maximo = Math.max(...elementos.map((e) => e.valor), 0) || 1;
  return (
    <ul className="space-y-2.5">
      {elementos.map((e) => (
        <li key={e.clave} className="text-sm">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="truncate text-slate-700 dark:text-slate-300">{e.etiqueta}</span>
            <span className="font-medium tabular-nums text-slate-900 dark:text-white">{formato(e.valor)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(1.5, (e.valor / maximo) * 100)}%`, backgroundColor: color }}
                title={`${e.etiqueta}: ${formato(e.valor)}`}
              />
            </div>
            {e.sub && <span className="w-14 text-right text-xs text-slate-500 dark:text-slate-400">{e.sub}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BarraProgreso({ porcentaje, alertaDesde = 90 }: { porcentaje: number; alertaDesde?: number }) {
  const ancho = Number.isFinite(porcentaje) ? Math.min(100, Math.max(0, porcentaje)) : 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        // Dentro del límite va en verde (positivo); cerca del tope, ámbar; pasado, rojo
        className={cn('h-full rounded-full', porcentaje > 100 ? 'bg-red-500' : porcentaje >= alertaDesde ? 'bg-amber-500' : 'bg-emerald-600')}
        style={{ width: `${ancho}%` }}
      />
    </div>
  );
}
