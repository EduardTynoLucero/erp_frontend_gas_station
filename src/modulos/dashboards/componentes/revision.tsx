/**
 * «Tickets para revisar» y «Tickets que faltan»: listas sin gráfica. El filtro de producto no aplica aquí (el servidor
 * solo filtra por fecha y estación). Ticket, Turno y Falta van como números crudos, sin separador de miles.
 */
import type { ReactNode } from 'react';
import type { DashboardVentas } from '@/api/tipos';
import { cn } from '@/lib/utilidades';
import { fechaHora, fmt, plural } from '../formato';
import { Estado } from './iconos';
import { TARJETA } from './piezas';
import { TablaDatos } from './tablas';

type D = DashboardVentas;

function Seccion({ titulo, subtitulo, className, children }: { titulo: string; subtitulo: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn(TARJETA, 'p-[10px]', className)}>
      <div className="mb-2.5">
        <h3 className="text-[12px] font-bold leading-[1.25] text-tinta">{titulo}</h3>
        <p className="mt-px text-[11px] leading-[1.35] text-tenue">{subtitulo}</p>
      </div>
      {children}
    </section>
  );
}

const SEVERIDAD: Record<string, 'INFO' | 'ADVERTENCIA'> = {
  'MARGEN NEGATIVO': 'INFO',
  'PRECIO FUERA DE PRICEBOOK': 'ADVERTENCIA',
  'POSIBLE DUPLICADO': 'ADVERTENCIA',
  'SIN PRODUCTO': 'ADVERTENCIA',
};
const severidadDe = (alerta: string) => SEVERIDAD[alerta] ?? 'ADVERTENCIA';

const NOMBRE_REGLA: Record<string, string> = {
  SIN_PRODUCTO: 'Tickets sin producto',
  POSIBLE_DUPLICADO: 'Posibles tickets duplicados',
  MARGEN_NEGATIVO: 'Vendidos abajo del costo',
  PRECIO_FUERA_DE_PRICEBOOK: 'Precio fuera del pricebook',
};
const nombreRegla = (r: string) => NOMBRE_REGLA[r] ?? r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');
const nombreAlerta = (alerta: string) => nombreRegla(alerta.replace(/ /g, '_'));

type Reciente = D['alertas']['recientes'][number];

export function TicketsParaRevisar({ d, className }: { d: D; className?: string }) {
  const a = d.alertas;
  // Primero las advertencias y luego las informativas; dentro de cada grupo, por tickets de mayor a menor
  const resumen = [...a.resumen].sort(
    (x, y) => Number(severidadDe(x.alerta) === 'INFO') - Number(severidadDe(y.alerta) === 'INFO') || y.tickets - x.tickets,
  );
  return (
    <Seccion
      className={className}
      titulo="Tickets para revisar"
      subtitulo="Reglas sobre lo cargado, en el rango de fechas elegido (el filtro de producto no aplica aquí)."
    >
      {resumen.length === 0 ? (
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <Estado tipo="bueno">Ningún ticket con alertas en este rango</Estado>
        </p>
      ) : (
        <ul>
          {resumen.map((r, n) => {
            const info = severidadDe(r.alerta) === 'INFO';
            const filas = a.recientes.filter((x) => x.alerta === r.alerta).slice(0, 25);
            return (
              <li key={r.alerta} className={cn(n > 0 && 'border-t border-slate-200 dark:border-slate-800')}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1 rounded px-0.5 py-2.5 text-sm text-slate-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-slate-100 [&::-webkit-details-marker]:hidden">
                    <Estado tipo={info ? 'info' : 'aviso'}>{info ? 'Informativa' : 'Advertencia'}</Estado>
                    <span className="min-w-0 flex-1">{nombreAlerta(r.alerta)}</span>
                    <span className="text-slate-600 tabular-nums max-[600px]:order-last max-[600px]:w-full dark:text-slate-300">
                      {plural(r.tickets, 'ticket', 'tickets')} · {fmt.moneda(r.monto)}
                    </span>
                    <span
                      aria-hidden
                      className="mx-1 size-2 shrink-0 rotate-45 border-r-[1.5px] border-b-[1.5px] border-slate-400 transition-transform group-open:rotate-[225deg]"
                    />
                  </summary>
                  <div className="pb-3">
                    <TablaDatos<Reciente>
                      limitar={false}
                      vacio="Los más recientes de este tipo no entran en la lista de 100"
                      columnas={[
                        { titulo: 'Ticket', valor: (x) => String(x.ticket) },
                        { titulo: 'Fecha', valor: (x) => <span className="whitespace-nowrap">{fechaHora(x.fechaHora)}</span> },
                        { titulo: 'Detalle', valor: (x) => x.detalle ?? '–' },
                        { titulo: 'Monto', valor: (x) => fmt.moneda(x.monto), der: true },
                      ]}
                      filas={filas}
                      clave={(x, i) => `${x.estacion}-${x.ticket}-${i}`}
                    />
                    {r.tickets > 25 && (
                      <p className="mt-1.5 mb-3 text-[11px] text-tenue">
                        Se muestran los más recientes. El detalle completo está en la vista dashboards.v_alertas_ticket.
                      </p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}

type Faltante = D['faltantes'][number];

function entre(f: Faltante): string {
  if (!f.ultimoAntes || !f.primeroDespues) return '–';
  const mismoDia = f.primeroDespues.slice(0, 10) === f.ultimoAntes.slice(0, 10);
  return `${fechaHora(f.ultimoAntes, false)} y ${mismoDia ? f.primeroDespues.slice(11) : fechaHora(f.primeroDespues, false)}`;
}

export function TicketsQueFaltan({ d, className }: { d: D; className?: string }) {
  const total = d.faltantes.reduce((a, f) => a + f.ticketsFaltantes, 0);
  return (
    <Seccion className={className} titulo="Tickets que faltan" subtitulo="Huecos en la numeración: pueden ser tickets anulados o borrados en BISS.">
      <p className="mb-2.5 text-sm text-slate-700 dark:text-slate-200">
        {total > 0 ? (
          <Estado tipo="aviso">{plural(total, 'ticket falta', 'tickets faltan')} en la numeración</Estado>
        ) : (
          <Estado tipo="bueno">La numeración está completa</Estado>
        )}
      </p>
      {d.faltantes.length > 0 && (
        <TablaDatos<Faltante>
          limitar={false}
          columnas={[
            { titulo: 'Turno', valor: (f) => (f.turno === null ? '–' : String(f.turno)) },
            { titulo: 'Falta', valor: (f) => (f.faltaDesde === f.faltaHasta ? String(f.faltaDesde) : `${f.faltaDesde} a ${f.faltaHasta}`) },
            { titulo: 'Entre', valor: entre },
          ]}
          filas={d.faltantes}
          clave={(f, i) => `${f.estacion}-${f.faltaDesde}-${i}`}
        />
      )}
    </Seccion>
  );
}
