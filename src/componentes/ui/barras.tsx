/**
 * Gráficas sencillas de las pantallas de gastos (las del diseño original): lista de barras, barras agrupadas, columnas por
 * día y barra de progreso. Son solo dibujo: reciben el valor ya calculado por el backend. El dinero llega como texto
 * decimal exacto; aquí se convierte a número únicamente para medir el ancho de una barra, nunca para sumar ni mostrar.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utilidades';

/** Colores de las series, en orden fijo, de la paleta de Puma Energy (cambian solos con el tema) */
export const SERIES = ['var(--acento)', 'var(--s7)', 'var(--s6)', 'var(--s-otro)'];

/** Texto decimal o número → número, solo para proporciones de dibujo */
export const aNumero = (v: string | number | null | undefined): number => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Lista de barras horizontales (BarList del diseño original). Con `alClic`, cada fila lleva a su detalle */
export function ListaBarras({
  elementos,
  formato,
  color = SERIES[0],
  alClic,
  vacio = 'Sin datos para el filtro seleccionado.',
}: {
  elementos: { clave: string; etiqueta: ReactNode; valor: string | number; sub?: ReactNode }[];
  formato: (v: string | number) => string;
  color?: string | undefined;
  alClic?: (clave: string) => void;
  vacio?: string;
}) {
  if (elementos.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">{vacio}</p>;
  const maximo = Math.max(...elementos.map((e) => aNumero(e.valor)), 0) || 1;
  return (
    <ul className="space-y-2.5">
      {elementos.map((e) => {
        const contenido = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{e.etiqueta}</span>
              <span className="shrink-0 font-medium tabular-nums text-slate-900 dark:text-white">{formato(e.valor)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (aNumero(e.valor) / maximo) * 100)}%`, backgroundColor: color }} />
              </div>
              {e.sub && <span className="w-14 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{e.sub}</span>}
            </div>
          </>
        );
        return (
          <li key={e.clave} className="text-sm">
            {alClic ? (
              <button type="button" onClick={() => alClic(e.clave)} className="block w-full cursor-pointer rounded-[2px] text-left hover:bg-primario-suave focus:outline-none focus-visible:bg-primario-suave">
                {contenido}
              </button>
            ) : (
              contenido
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function LeyendaSeries({ series }: { series: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      {series.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: SERIES[i] }} />
          {s}
        </span>
      ))}
    </div>
  );
}

/** Barras horizontales agrupadas, de 2 a 4 series, con su leyenda (GroupedBars del diseño original) */
export function BarrasAgrupadas({
  series,
  filas,
  formato,
  vacio = 'Sin datos para el filtro seleccionado.',
}: {
  series: string[];
  filas: { clave: string; etiqueta: ReactNode; valores: (string | number)[] }[];
  formato: (v: string | number) => string;
  vacio?: string;
}) {
  if (filas.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">{vacio}</p>;
  const maximo = Math.max(1, ...filas.flatMap((f) => f.valores.map(aNumero)));
  return (
    <div>
      <LeyendaSeries series={series} />
      <ul className="mt-3 space-y-3">
        {filas.map((f) => (
          <li key={f.clave}>
            <p className="mb-1 truncate text-sm text-slate-700 dark:text-slate-300">{f.etiqueta}</p>
            <div className="space-y-1">
              {f.valores.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${Math.max(aNumero(v) > 0 ? 1.5 : 0, (aNumero(v) / maximo) * 100)}%`, background: SERIES[i] }}
                      title={`${series[i]}: ${formato(v)}`}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{formato(v)}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Columnas verticales por día o mes, una serie (Columns del diseño original) */
export function Columnas({
  datos,
  formato,
  alto = 140,
  color = SERIES[0],
}: {
  datos: { clave: string; etiqueta: string; valor: string | number }[];
  formato: (v: string | number) => string;
  alto?: number;
  color?: string | undefined;
}) {
  const maximo = Math.max(1, ...datos.map((d) => aNumero(d.valor)));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: alto }}>
        {datos.map((d) => (
          <div key={d.clave} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-[24px] rounded-t"
              style={{ height: `${Math.max(aNumero(d.valor) > 0 ? 2 : 0, (aNumero(d.valor) / maximo) * 100)}%`, background: color }}
            />
            <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-slate-100 dark:text-slate-900">
              {d.etiqueta}: {formato(d.valor)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-slate-200 pt-1 dark:border-slate-800">
        {datos.map((d) => (
          <span key={d.clave} className="flex-1 truncate text-center text-[10px] text-slate-500 dark:text-slate-400">
            {d.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barra de avance: verde dentro del límite, ámbar cerca del tope y roja al pasarlo. `porcentaje` null = sin tope */
export function BarraProgreso({ porcentaje, alertaDesde = 90 }: { porcentaje: number | null; alertaDesde?: number }) {
  const valor = porcentaje === null || !Number.isFinite(porcentaje) ? 100 : porcentaje;
  const pasado = porcentaje === null || valor > 100;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, valor)))}
    >
      <div
        className={cn('h-full rounded-full', pasado ? 'bg-red-500' : valor >= alertaDesde ? 'bg-amber-500' : 'bg-emerald-600')}
        style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
      />
    </div>
  );
}
