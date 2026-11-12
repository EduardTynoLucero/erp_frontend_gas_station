'use client';

/** Historial de cargas del ETL (etl.carga por la fachada dashboards.carga): las de las estaciones del usuario. */
import { CheckCircle2, CircleX, Minus } from 'lucide-react';
import Link from 'next/link';
import type { CargaEtl } from '@/api/tipos';
import { Vacio } from '@/componentes/ui/aviso';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { Tarjeta } from '@/componentes/ui/tarjeta';
import { fechaHora, num } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { fechaReporte, NOMBRE_REPORTE } from '../etl';

const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  CARGADO: { texto: 'Cargado', tono: 'green' },
  RECHAZADO: { texto: 'Rechazado', tono: 'red' },
  DUPLICADO: { texto: 'Repetido', tono: 'amber' },
  RECIBIDO: { texto: 'Recibido', tono: 'blue' },
  VALIDADO: { texto: 'Validado', tono: 'blue' },
};

export function HistorialCargas({ cargas }: { cargas: CargaEtl[] }) {
  return (
    <Tarjeta
      titulo="Historial de cargas del ETL"
      subtitulo="Las últimas 30 de sus estaciones, vengan del navegador, de la carpeta vigilada o del panel del ETL"
      acciones={
        // El detalle de cada carga (incidencias, cuadre y cambios) está en Dashboards → Historial de cargas
        <Link href="/historial-cargas" className="text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300">
          Ver el historial con el detalle de cada carga
        </Link>
      }
    >
      {cargas.length === 0 ? (
        <Vacio>Todavía no hay cargas de sus estaciones.</Vacio>
      ) : (
        <ContenedorTabla anchoMinimo={900}>
          <Cabecera>
            <th className={th}>Carga</th>
            <th className={th}>Fecha</th>
            <th className={th}>Archivo</th>
            <th className={th}>Estación</th>
            <th className={th}>Datos del</th>
            <th className={th}>Resultado</th>
            <th className={thR}>Tickets</th>
            <th className={th}>Revisión</th>
          </Cabecera>
          <Cuerpo>
            {cargas.map((c) => {
              const e = ESTADO[c.estado] ?? { texto: c.estado, tono: 'gray' as const };
              return (
                <tr key={c.cargaId} className="align-top">
                  <td className={cn(td, 'whitespace-nowrap font-medium tabular-nums text-slate-900 dark:text-white')}>{c.cargaId}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{fechaHora(c.iniciadoEn)}</td>
                  <td className={cn(td, 'max-w-[18rem]')}>
                    <span className="block truncate font-medium text-slate-800 dark:text-slate-100" title={c.archivo}>
                      {c.archivo}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {NOMBRE_REPORTE[c.tipoReporte] ?? c.tipoReporte}
                      {c.usuario ? ` · ${c.usuario}` : ''}
                    </span>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>{c.estaciones ?? '—'}</td>
                  <td className={cn(td, 'whitespace-nowrap text-xs')}>
                    {c.fechaMin ? (
                      <>
                        {fechaReporte(c.fechaMin)}
                        <span className="block text-slate-500 dark:text-slate-400">al {fechaReporte(c.fechaMax)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={td}>
                    <Insignia tono={e.tono}>{e.texto}</Insignia>
                    {c.segundos !== null && <span className="ml-1.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">{num(c.segundos, 1)} s</span>}
                    {c.estado !== 'CARGADO' && c.mensaje && (
                      <span className="mt-1 block max-w-[16rem] text-xs text-slate-500 dark:text-slate-400" title={c.mensaje}>
                        <span className="line-clamp-2">{c.mensaje}</span>
                      </span>
                    )}
                  </td>
                  <td className={tdR}>
                    {c.insertadas === null ? (
                      '—'
                    ) : (
                      <>
                        {num(c.insertadas)} nuevos
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{num(c.actualizadas ?? 0)} actualizados</span>
                      </>
                    )}
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-xs')}>
                    <span className="inline-flex items-center gap-1">
                      {c.cuadra === null ? (
                        <Minus className="size-3.5 text-slate-400" aria-hidden />
                      ) : c.cuadra ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <CircleX className="size-3.5 text-red-600 dark:text-red-400" aria-hidden />
                      )}
                      {c.cuadra === null ? 'sin cuadre' : c.cuadra ? 'cuadra' : 'no cuadra'}
                    </span>
                    {(c.errores > 0 || c.advertencias > 0) && (
                      <span className="block text-slate-500 dark:text-slate-400">
                        {c.errores > 0 ? `${num(c.errores)} errores · ` : ''}
                        {num(c.advertencias)} advertencias
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Cuerpo>
        </ContenedorTabla>
      )}
    </Tarjeta>
  );
}
