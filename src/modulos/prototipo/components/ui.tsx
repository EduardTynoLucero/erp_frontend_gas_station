'use client';

/**
 * Componentes de interfaz de las pantallas del prototipo (Expenses_project/src/components/ui.tsx): mismos nombres y
 * props, para que las pantallas restauradas no cambien, pero con el aspecto del ERP y modo oscuro. Donde el frontend
 * ya tiene el componente equivalente (tarjeta, insignia, botón, modal, aviso, tabla), se usa ese.
 */
import { FlaskConical } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Aviso as AvisoErp, Vacio } from '@/componentes/ui/aviso';
import { Ayuda, clasesBoton } from '@/componentes/ui/boton';
import { claseEntrada, ETIQUETA } from '@/componentes/ui/campos';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { Modal as ModalErp } from '@/componentes/ui/modal';
import { BARRA_PESTANAS, clasePestana } from '@/componentes/ui/pestanas';
import { ContenedorTabla, td as tdErp, tdR as tdRErp, th as thErp, thR as thRErp } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador, Tarjeta } from '@/componentes/ui/tarjeta';
import { cn } from '@/lib/utilidades';
import type { EstadoGasto, Severidad } from '../types';

/** Une clases; si dos chocan (text-slate-700 de la celda y text-brand-700 del folio), gana la última. */
export function cx(...xs: (string | false | null | undefined)[]): string {
  return cn(...xs);
}

// Paleta para gráficas (series en orden fijo) de Puma Energy: rojo, pizarra, verde y gris. Las variables cambian con el tema.
export const SERIES = ['var(--acento)', 'var(--s7)', 'var(--s6)', 'var(--s-otro)'];

/**
 * Marca discreta de las pantallas que todavía trabajan con los datos simulados del prototipo: un ícono junto al
 * título, con la explicación al pasar el ratón o al enfocarlo con el teclado.
 */
export function MarcaSimulada() {
  return (
    <Ayuda texto="Datos simulados, guardados en este navegador: esta pantalla todavía no tiene tablas conectadas en el backend.">
      <span
        tabIndex={0}
        aria-label="Datos simulados"
        className="inline-flex size-[18px] items-center justify-center rounded-full text-primario-tinta/60 transition-colors hover:bg-primario-suave-2 hover:text-primario-tinta focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-primario"
      >
        <FlaskConical className="size-[12px]" aria-hidden />
      </span>
    </Ayuda>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <EncabezadoPagina
      titulo={
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {title}
          <MarcaSimulada />
        </span>
      }
      descripcion={description}
      acciones={actions}
    />
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Tarjeta titulo={title} subtitulo={subtitle} acciones={actions} className={className} cuerpoClassName={bodyClassName}>
      {children}
    </Tarjeta>
  );
}

export function Badge({ tone = 'gray', children, className }: { tone?: Tono; children: ReactNode; className?: string }) {
  return (
    <Insignia tono={tone} className={className}>
      {children}
    </Insignia>
  );
}

const ESTADOS: Record<EstadoGasto, [string, Tono]> = {
  borrador: ['Borrador', 'gray'],
  pendiente: ['Por autorizar', 'amber'],
  aprobado: ['Aprobado', 'green'],
  rechazado: ['Rechazado', 'red'],
  pagado: ['Pagado', 'green-solid'],
};

export function EstadoBadge({ estado }: { estado: EstadoGasto }) {
  const [txt, tone] = ESTADOS[estado];
  return <Badge tone={tone}>{txt}</Badge>;
}

export const estadoTexto = (e: EstadoGasto) => ESTADOS[e][0];

const SEV: Record<Severidad, [string, Tono]> = {
  critica: ['Crítica', 'red'],
  alta: ['Alta', 'amber'],
  media: ['Media', 'blue'],
  baja: ['Baja', 'gray'],
};

export function SeveridadBadge({ s }: { s: Severidad }) {
  const [txt, tone] = SEV[s];
  return <Badge tone={tone}>{txt}</Badge>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <button type="button" {...props} className={clasesBoton(variant, size, className)} />;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'red' | 'amber' | 'green' }) {
  return <Indicador etiqueta={label} valor={value} pista={hint} tono={tone} />;
}

// Tablas: clases compartidas (las del frontend, con modo oscuro).
export const th = thErp;
export const thR = thRErp;
export const td = tdErp;
export const tdR = tdRErp;

export function TableWrap({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return <ContenedorTabla anchoMinimo={minWidth}>{children}</ContenedorTabla>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <Vacio>{children}</Vacio>;
}

export function ProgressBar({ pct, warnAt = 90 }: { pct: number; warnAt?: number }) {
  const w = Math.min(100, Math.max(0, isFinite(pct) ? pct : 100));
  // Dentro del presupuesto va en verde (positivo); cerca del tope, ámbar; pasado, rojo
  const color = pct > 100 ? 'bg-red-500' : pct >= warnAt ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(isFinite(pct) ? pct : 100)}
    >
      <div className={cx('h-full rounded-full', color)} style={{ width: `${w}%` }} />
    </div>
  );
}

/** Barras horizontales delgadas con valor al final. */
export function BarList({
  items,
  format,
  color = SERIES[0],
  onClick,
}: {
  items: { key: string; label: ReactNode; value: number; sub?: ReactNode }[];
  format: (n: number) => string;
  color?: string;
  onClick?: (key: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <Empty>Sin datos para el filtro seleccionado.</Empty>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className={cx(onClick && 'cursor-pointer rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60')} onClick={() => onClick?.(i.key)}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{i.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900 dark:text-white">{format(i.value)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2.5 rounded-full"
                style={{ width: `${Math.max(1.5, (i.value / max) * 100)}%`, background: color }}
                title={`${typeof i.label === 'string' ? i.label : i.key}: ${format(i.value)}`}
              />
            </div>
            {i.sub && <span className="w-14 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{i.sub}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Barras horizontales agrupadas (2 a 4 series) con leyenda. */
export function GroupedBars({
  series,
  rows,
  format,
}: {
  series: string[];
  rows: { key: string; label: ReactNode; values: number[] }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div>
      <Legend series={series} />
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.key}>
            <p className="mb-1 truncate text-sm text-slate-700 dark:text-slate-300">{r.label}</p>
            <div className="space-y-1">
              {r.values.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${Math.max(v > 0 ? 1.5 : 0, (v / max) * 100)}%`, background: SERIES[i] }}
                      title={`${series[i]}: ${format(v)}`}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{format(v)}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ series }: { series: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      {series.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} />
          {s}
        </span>
      ))}
    </div>
  );
}

/** Columnas verticales por día/mes para tendencias (una serie). */
export function Columns({
  data,
  format,
  height = 140,
  color = SERIES[0],
}: {
  data: { key: string; label: string; value: number }[];
  format: (n: number) => string;
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-[24px] rounded-t"
              style={{ height: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%`, background: color }}
            />
            <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-slate-100 dark:text-slate-900">
              {d.label}: {format(d.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-slate-200 pt-1 dark:border-slate-800">
        {data.map((d) => (
          <span key={d.key} className="flex-1 truncate text-center text-[10px] text-slate-500 dark:text-slate-400">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <ModalErp abierto={open} alCerrar={onClose} titulo={title} pie={footer} ancho={wide}>
      {children}
    </ModalErp>
  );
}

export const inputCls = claseEntrada();

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block min-w-0', className)}>
      <span className={ETIQUETA}>{label}</span>
      {children}
      {hint && <span className="mt-[3px] block text-[11px] text-tenue">{hint}</span>}
    </label>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className={BARRA_PESTANAS}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={clasePestana(value === t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Aviso({ tone = 'blue', children }: { tone?: 'blue' | 'amber' | 'red' | 'green'; children: ReactNode }) {
  return <AvisoErp tono={tone}>{children}</AvisoErp>;
}

/** Selector de foto o PDF del comprobante; sube el archivo y devuelve su id. */
export function Adjuntar({
  nombre,
  onSubir,
  onQuitar,
  ocupado,
}: {
  nombre?: string;
  onSubir: (f: File) => void;
  onQuitar: () => void;
  ocupado?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {nombre ? (
        <>
          <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-[2px] border border-borde-suave bg-barra px-[7px] py-[3px] text-[11px] text-tinta">
            📎 {nombre}
          </span>
          <button type="button" className="cursor-pointer text-xs font-semibold text-[#c20510] hover:underline dark:text-red-400" onClick={onQuitar}>
            Quitar
          </button>
        </>
      ) : (
        <label className={clasesBoton('secondary', 'md')}>
          {ocupado ? 'Subiendo…' : 'Adjuntar foto o PDF'}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onSubir(f);
            }}
          />
        </label>
      )}
    </div>
  );
}
