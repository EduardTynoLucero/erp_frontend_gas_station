'use client';

/** Piezas comunes del dashboard: tarjeta de gráfica, segmentado, leyenda, tooltip, lienzo medido y estados. */
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { clasesBoton } from '@/componentes/ui/boton';
import { cn } from '@/lib/utilidades';
import { IconoEstado, IconoGrafica, IconoTabla } from './iconos';

/** Tarjeta de la plantilla: borde fino, esquinas de 2 px, sin sombra */
export const TARJETA = 'min-w-0 rounded-[2px] border border-borde bg-superficie';
export const BOTON_CHICO = clasesBoton('secondary', 'sm', 'h-[26px]');

/** Botones segmentados (rango rápido y medida): los de la plantilla, compartidos con el resto del ERP. */
export { Segmentado } from '@/componentes/ui/segmentado';

/**
 * Tarjeta de gráfica: título, subtítulo, controles (segmentado) y el botón «Ver tabla» / «Ver gráfica», que cambia la
 * gráfica por su tabla equivalente.
 */
export function TarjetaGrafica({
  titulo,
  subtitulo,
  controles,
  className,
  alto,
  grafica,
  tabla,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  controles?: ReactNode;
  className?: string;
  alto: number;
  grafica: ReactNode;
  tabla: () => ReactNode;
}) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <article className={cn(TARJETA, 'p-[10px]', className)}>
      <div className="mb-[6px] flex flex-wrap items-start justify-between gap-x-[10px] gap-y-[5px]">
        <div className="min-w-0 flex-[1_1_220px]">
          <h3 className="text-[12px] font-bold leading-[1.25] text-tinta">{titulo}</h3>
          {subtitulo && <p className="mt-px text-[11px] leading-[1.35] text-tenue">{subtitulo}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-[5px]">
          {controles}
          <button type="button" aria-pressed={verTabla} onClick={() => setVerTabla((v) => !v)} className={BOTON_CHICO}>
            {verTabla ? <IconoGrafica /> : <IconoTabla />}
            <span>{verTabla ? 'Ver gráfica' : 'Ver tabla'}</span>
          </button>
        </div>
      </div>
      {verTabla ? (
        tabla()
      ) : (
        <div className="flex flex-col" style={{ height: alto }}>
          {grafica}
        </div>
      )}
    </article>
  );
}

/** Series ocultas desde la leyenda (por nombre: un filtro que cambia las series no repinta las que quedan). */
export function useOcultas() {
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(() => new Set());
  const alternar = useCallback(
    (nombre: string) =>
      setOcultas((previas) => {
        const nuevas = new Set(previas);
        if (nuevas.has(nombre)) nuevas.delete(nombre);
        else nuevas.add(nombre);
        return nuevas;
      }),
    [],
  );
  return [ocultas, alternar] as const;
}

/** Leyenda (solo con 2 o más series): clic para ocultar o mostrar la serie. */
export function Leyenda({
  items,
  ocultas,
  alAlternar,
}: {
  items: { nombre: string; color: string }[];
  ocultas: ReadonlySet<string>;
  alAlternar: (nombre: string) => void;
}) {
  if (items.length < 2) return null;
  return (
    <div role="group" aria-label="Series de la gráfica" className="flex h-[22px] shrink-0 items-center gap-[12px] overflow-x-auto">
      {items.map((it) => {
        const oculta = ocultas.has(it.nombre);
        return (
          <button
            key={it.nombre}
            type="button"
            aria-pressed={!oculta}
            title={oculta ? `Mostrar ${it.nombre}` : `Ocultar ${it.nombre}`}
            onClick={() => alAlternar(it.nombre)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-[5px] rounded-[2px] text-[11px] whitespace-nowrap text-tinta-suave focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-primario',
              oculta && 'text-slate-400 line-through decoration-slate-400/60 dark:text-slate-500',
            )}
          >
            <span className="size-[9px] shrink-0 rounded-[2px]" style={{ background: oculta ? 'var(--graf-base)' : it.color }} />
            {it.nombre}
          </button>
        );
      })}
    </div>
  );
}

export interface FilaTooltip {
  color?: string;
  nombre: string;
  valor: string;
}

/** Caja del tooltip: título, filas (punto de color, nombre y valor a la derecha) y una nota opcional. */
export function CajaTooltip({ titulo, filas, nota }: { titulo: string; filas: FilaTooltip[]; nota?: string | null }) {
  return (
    <div className="min-w-[130px] rounded-[2px] border border-borde bg-superficie px-[8px] py-[6px] text-[11px] leading-[1.45] text-tinta shadow-lg">
      <div className="mb-[2px] font-bold">{titulo}</div>
      {filas.map((f) => (
        <div key={f.nombre} className="flex items-center gap-[6px]">
          {f.color && <span className="size-[8px] shrink-0 rounded-[2px]" style={{ background: f.color }} />}
          <span>{f.nombre}</span>
          <b className="ml-auto pl-[12px] font-semibold tabular-nums">{f.valor}</b>
        </div>
      ))}
      {nota && <div className="mt-[3px] max-w-[260px] border-t border-borde-suave pt-[3px] text-tinta-suave">{nota}</div>}
    </div>
  );
}

/**
 * Área que mide su ancho y alto (ResizeObserver) y dibuja la gráfica con esas medidas exactas. Sin `alto`, ocupa el
 * espacio que queda en la tarjeta (debajo de la leyenda).
 */
export function Lienzo({ etiqueta, alto: altoFijo, children }: { etiqueta: string; alto?: number; children: (ancho: number, alto: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ ancho: 0, alto: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const ancho = Math.floor(r.width);
      const alto = Math.floor(r.height);
      setTam((t) => (t.ancho === ancho && t.alto === alto ? t : { ancho, alto }));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={etiqueta}
      className={cn('relative w-full', altoFijo ? 'flex-none' : 'min-h-0 flex-1')}
      style={altoFijo ? { height: altoFijo } : undefined}
    >
      {tam.ancho > 0 && tam.alto > 0 && <div className="absolute inset-0 motion-safe:animate-aparecer">{children(tam.ancho, tam.alto)}</div>}
    </div>
  );
}

export function SinDatos() {
  return <div className="flex h-full items-center justify-center text-[12px] text-tenue">Sin datos para este filtro</div>;
}

export function Girador() {
  return (
    <span
      aria-hidden
      className="inline-block size-[15px] shrink-0 animate-spin rounded-full border-2 border-borde border-t-primario motion-reduce:[animation-duration:2.4s]"
      style={{ animationDuration: '0.8s' }}
    />
  );
}

export function Cargando({ children }: { children: ReactNode }) {
  return (
    <div role="status" className={cn(TARJETA, 'flex items-center gap-[8px] p-[10px] text-[12px] text-tinta-suave')}>
      <Girador />
      {children}
    </div>
  );
}

export function TarjetaVacia({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className={cn(TARJETA, 'px-[14px] py-[22px] text-center text-[12px] leading-[1.45] text-tenue')}>
      <strong className="mb-[3px] block text-[12px] font-bold text-tinta">{titulo}</strong>
      {children}
    </div>
  );
}

/** Veredicto del panel: borde izquierdo de color, ícono de 24 px, título y acciones a la derecha. */
export function Veredicto({ tipo, titulo, children, acciones }: { tipo: 'critico' | 'aviso'; titulo: string; children?: ReactNode; acciones?: ReactNode }) {
  return (
    <div
      role={tipo === 'critico' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-start gap-[9px] rounded-[2px] border border-l-[3px] px-[10px] py-[8px]',
        tipo === 'critico'
          ? 'border-[#f5c2c0] border-l-[color:var(--estado-critico)] bg-[#fff5f5] dark:border-red-500/30 dark:border-l-[color:var(--estado-critico)] dark:bg-red-500/10'
          : 'border-[#f5d48a] border-l-[color:var(--estado-aviso)] bg-[#fff4e0] dark:border-amber-500/30 dark:border-l-[color:var(--estado-aviso)] dark:bg-amber-500/10',
      )}
    >
      <IconoEstado tipo={tipo} className="mt-px size-[18px]" />
      <div className="min-w-0 flex-[1_1_320px]">
        <h2 className="text-[12px] font-bold leading-[1.3] text-tinta">{titulo}</h2>
        <div className="text-[11px] leading-[1.4] text-tinta-suave [&>p]:mt-[2px]">{children}</div>
      </div>
      {acciones && <div className="flex items-center self-center">{acciones}</div>}
    </div>
  );
}
