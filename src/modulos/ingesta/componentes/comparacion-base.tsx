/**
 * «Qué pasará en la base»: la comparación del archivo con lo que ya está cargado, igual que la del panel del ETL.
 * Cada ticket se busca por estación y número (cada compra, por estación, factura y producto): entra nuevo, se
 * actualiza (y qué datos cambian) o queda igual. Avisa de lo que conviene revisar antes de cargar: tickets que
 * pierden su factura, tickets que cambian de día y archivos repetidos.
 */
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { fechaHora, num } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import type { VistaPreviaEtl } from '../etl';

const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;

function Indicador({ titulo, valor, nota, tono }: { titulo: string; valor: number; nota: ReactNode; tono?: 'amber' | 'red' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500 dark:text-slate-400">{titulo}</div>
      <div
        className={cn(
          'mt-0.5 text-xl font-semibold tabular-nums',
          tono === 'red' ? 'text-red-700 dark:text-red-400' : tono === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white',
        )}
      >
        {num(valor)}
      </div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{nota}</div>
    </div>
  );
}

function Nota({ icono, children, tono }: { icono: 'info' | 'aviso'; children: ReactNode; tono?: 'amber' }) {
  const Icono = icono === 'aviso' ? AlertTriangle : Info;
  return (
    <p className={cn('flex items-start gap-2 text-sm', tono === 'amber' ? 'text-amber-800 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300')}>
      <Icono aria-hidden className={cn('mt-0.5 size-4 shrink-0', tono === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')} />
      <span>{children}</span>
    </p>
  );
}

export function ComparacionConLaBase({ v, comparandoOtraVez }: { v: VistaPreviaEtl; comparandoOtraVez: boolean }) {
  const esCompras = v.tipo === 'COMPRAS';
  const cmp = v.comparacion;
  const cuerpo = (() => {
    if (!v.valido) return <p className="text-sm text-slate-500 dark:text-slate-400">No se compara porque el archivo tiene errores.</p>;
    if (!cmp) {
      return (
        <Nota icono="aviso" tono="amber">
          No se pudo comparar con la base{v.avisoComparacion ? `: ${v.avisoComparacion}` : '.'} Sin la comparación no se sabe qué cambiaría: suba el
          archivo otra vez para compararlo antes de cargarlo.
        </Nota>
      );
    }
    if (cmp.yaCargado) {
      return (
        <>
          <Nota icono="info">
            <strong className="font-semibold">No cambia nada: es un archivo repetido.</strong> Este mismo archivo ya se cargó en la carga{' '}
            {cmp.yaCargado.cargaId} ({cmp.yaCargado.archivo}, {fechaHora(cmp.yaCargado.cuando)}). Si se cargara otra vez quedaría registrado como
            repetido y {esCompras ? 'ninguna compra' : 'ningún ticket'} cambiaría; por eso «Cargar al ETL» está desactivado.
          </Nota>
        </>
      );
    }
    const campos = cmp.camposQueCambian.map((x) => `${x.campo} (${num(x.tickets)})`).join(', ');
    const pierden = cmp.pierdenFactura ?? 0;
    const seMueven = cmp.seMuevenDeDia ?? 0;
    return (
      <>
        <div className={cn('grid grid-cols-2 gap-2', esCompras ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
          <Indicador titulo={esCompras ? 'Compras nuevas' : 'Tickets nuevos'} valor={cmp.nuevos} nota="Entran por primera vez" />
          <Indicador
            titulo="Se actualizan"
            valor={cmp.cambian}
            nota={campos ? `Cambia: ${campos}` : 'Ya estaban, con datos distintos'}
            {...(cmp.cambian > 0 ? { tono: 'amber' as const } : {})}
          />
          <Indicador titulo="Quedan iguales" valor={cmp.iguales} nota="Ya estaban, sin cambios" />
          {!esCompras && (
            <Indicador
              titulo="Pierden su factura"
              valor={pierden}
              nota={pierden ? 'En la base tienen factura y aquí no' : 'Ninguno'}
              {...(pierden > 0 ? { tono: 'red' as const } : {})}
            />
          )}
        </div>
        {seMueven > 0 && (
          <Nota icono="info">
            {plural(seMueven, 'ticket ya estaba', 'tickets ya estaban')} en la base con otra fecha: la carga {seMueven === 1 ? 'lo pasa' : 'los pasa'} a
            la fecha de este archivo.
          </Nota>
        )}
        {pierden > 0 && (
          <Nota icono="aviso" tono="amber">
            Revise si este archivo es una exportación más vieja que la última cargada: el último archivo manda.
          </Nota>
        )}
        {esCompras && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Las compras de Diesel, Regular y Super suman al inventario desde su fecha y hora; los lubricantes se guardan, pero no entran al inventario
            de galones.
          </p>
        )}
      </>
    );
  })();

  return (
    <section aria-label="Qué pasará en la base" className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/30">
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Qué pasará en la base</h4>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {esCompras
              ? 'Cada compra se busca en el modelo por estación, serie y número de factura, y producto. Si ya existe, el último archivo cargado manda.'
              : 'Cada ticket se busca en el modelo por estación y número de ticket. Si un ticket ya existe, el último archivo cargado manda.'}
          </p>
        </div>
        {comparandoOtraVez ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            La base cambió: comparando otra vez…
          </span>
        ) : (
          cmp &&
          !cmp.yaCargado &&
          cmp.contraCarga !== undefined && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {cmp.contraCarga > 0 ? `Comparado con la base hasta la carga ${cmp.contraCarga}` : 'La base todavía no tiene cargas'}
            </span>
          )
        )}
      </div>
      <div className={cn('space-y-2.5 transition-opacity', comparandoOtraVez && 'opacity-50')}>{cuerpo}</div>
    </section>
  );
}
