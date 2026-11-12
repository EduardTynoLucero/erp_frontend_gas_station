/**
 * Las 6 tarjetas de indicadores del panel, con las mismas fórmulas y textos. Solo Venta total, Galones y Tickets se
 * comparan contra el periodo anterior (mismos días justo antes del rango); ▲ y ▼ no llevan color, solo la flecha.
 */
import type { ReactNode } from 'react';
import type { DashboardVentas } from '@/api/tipos';
import { cn } from '@/lib/utilidades';
import { fecha, fmt, num, pct, plural } from '../formato';
import { TARJETA } from './piezas';

const SIN_COMPARAR: Record<string, string> = {
  'sin-datos': 'sin periodo anterior cargado',
  parcial: 'faltan días por cargar, sin comparar',
};

function notaCorte(cortes: { hora: string }[] | undefined): string {
  const horas = [...new Set((cortes ?? []).map((c) => c.hora))];
  if (!horas.length) return '';
  if (horas.length > 1) return 'último día comparado hasta la misma hora en cada estación';
  return `comparado hasta ${horas[0]!.startsWith('01:') ? 'la' : 'las'} ${horas[0]} del último día`;
}

/**
 * El valor se ajusta al ancho de su tarjeta (container query, cqi = 1 % del ancho): con la barra lateral del ERP las
 * tarjetas son más angostas que en el panel y un monto como Q8,350,015.85 debe verse completo.
 */
function Tarjeta({ titulo, valor, nota, otraNota, principal }: { titulo: string; valor: string; nota: ReactNode; otraNota?: ReactNode; principal?: boolean }) {
  // Indicador de la plantilla: franja roja a la izquierda; el principal lleva el fondo rojo suave y el valor en rojo
  return (
    <div className={cn(TARJETA, '@container border-l-[3px] border-l-primario px-[10px] py-[7px]', principal && 'bg-primario-suave')}>
      <div className="truncate text-[11px] font-semibold leading-[1.3] text-tenue" title={titulo}>
        {titulo}
      </div>
      <div
        className={cn('mt-[2px] truncate text-[clamp(14px,11.5cqi,18px)] font-bold leading-[1.2] tabular-nums', principal ? 'text-primario-tinta' : 'text-tinta')}
        title={valor}
      >
        {valor}
      </div>
      <div className="mt-[2px] text-[10.5px] leading-[1.35] text-tenue">{nota}</div>
      {otraNota && <div className="mt-px text-[10.5px] leading-[1.35] text-tenue">{otraNota}</div>}
    </div>
  );
}

export function Indicadores({ datos }: { datos: DashboardVentas }) {
  const k = datos.kpis;
  const a = datos.anterior?.kpis?.tickets ? datos.anterior : null;

  const cambio = (actual: number, previo: number | undefined): ReactNode => {
    if (!a || !previo) return null;
    const p = ((actual - previo) / Math.abs(previo)) * 100;
    const flecha = p > 0.05 ? '▲' : p < -0.05 ? '▼' : '';
    return (
      <>
        <span className="font-semibold text-tinta-suave">
          {flecha} {fmt.pct(Math.abs(p))}
        </span>{' '}
        vs. {fecha(a.filtros.desde)} al {fecha(a.filtros.hasta)}
      </>
    );
  };

  const venta = num(k.venta);
  const galones = num(k.galones);
  const notaVenta = [`${plural(k.dias, 'día', 'días')} con ventas`, a ? null : SIN_COMPARAR[datos.sinComparar ?? '']].filter(Boolean).join(' · ');
  const vsVenta = cambio(venta, a ? num(a.kpis.venta) : undefined);
  const recargo = num(k.recargoPricebook);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[6px] min-[861px]:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
      <Tarjeta principal titulo="Venta total" valor={fmt.moneda(k.venta)} nota={vsVenta ?? notaVenta} otraNota={vsVenta ? notaCorte(a?.cortes) : null} />
      <Tarjeta
        titulo="Galones"
        valor={fmt.numero(k.galones, 2)}
        nota={cambio(galones, a ? num(a.kpis.galones) : undefined) ?? `Precio promedio ${fmt.porGalon(venta / galones)}`}
      />
      <Tarjeta
        titulo="Tickets"
        valor={fmt.entero(k.tickets)}
        nota={cambio(k.tickets, a?.kpis.tickets) ?? `Ticket promedio ${fmt.moneda(venta / k.tickets)}`}
      />
      <Tarjeta titulo="Utilidad" valor={fmt.moneda(k.utilidad)} nota={`Margen ${fmt.pct(pct(num(k.utilidad), num(k.neto)))} sobre la venta neta`} />
      <Tarjeta
        titulo="Venta sin factura"
        valor={fmt.moneda(k.ventaSinFactura)}
        nota={`${fmt.pct(pct(num(k.ventaSinFactura), venta))} de la venta · ${plural(k.ticketsSinFactura, 'ticket', 'tickets')}`}
      />
      <Tarjeta
        titulo="Descuentos de pricebook"
        valor={fmt.moneda(k.descuentoPricebook)}
        nota={recargo > 0 ? `Rebaja contra el precio de lista. Recargos cobrados aparte: ${fmt.moneda(k.recargoPricebook)}` : 'Rebaja contra el precio de lista'}
      />
    </div>
  );
}
