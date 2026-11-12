'use client';

/**
 * Barra de filtros de Inventario y Tomas físicas (la del panel del ETL): estación, Desde, Hasta, rangos rápidos y
 * «Actualizar». Una fecha se aplica cuando está completa; si Desde queda después de Hasta, la otra fecha se iguala a
 * la recién editada (nunca se intercambian).
 */
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { claseFiltro } from '@/componentes/ui/campos';
import { cn } from '@/lib/utilidades';
import { BOTON_CHICO, Segmentado, TARJETA } from '@/modulos/dashboards/componentes/piezas';
import { fecha } from '@/modulos/dashboards/formato';
import { RAPIDOS_INVENTARIO, type RapidoInventario } from '../datos';

/** Campo de la barra de filtros de la plantilla: etiqueta de 10 px en seminegrita sobre un control de 28 px */
export const CAMPO = 'flex flex-col gap-[3px] text-[10px] font-semibold leading-[1.1] text-tinta max-[860px]:flex-[1_1_140px]';

export interface FiltrosFecha {
  estacion: string;
  desde: string;
  hasta: string;
  rapido: RapidoInventario;
}

export function BarraOperacion({
  etiqueta,
  estaciones,
  filtros,
  rango,
  alCambiar,
  alRapido,
  alActualizar,
  actualizando,
  fechasOpcionales,
  children,
}: {
  etiqueta: string;
  estaciones: { codigo: string; nombre: string }[];
  filtros: FiltrosFecha;
  rango: { desde: string | null; hasta: string | null };
  alCambiar: (f: FiltrosFecha) => void;
  alRapido: (tipo: Exclude<RapidoInventario, ''>) => void;
  alActualizar: () => void;
  actualizando: boolean;
  /** Tomas físicas: sin fechas = todas */
  fechasOpcionales?: boolean;
  children?: ReactNode;
}) {
  const fechaEditada = (campo: 'desde' | 'hasta', valor: string) => {
    if (!valor && !fechasOpcionales) return; // fecha a medio escribir
    let desde = campo === 'desde' ? valor : filtros.desde;
    let hasta = campo === 'hasta' ? valor : filtros.hasta;
    if (desde && hasta && desde > hasta) {
      if (campo === 'hasta') desde = hasta;
      else hasta = desde;
    }
    alCambiar({ ...filtros, desde, hasta, rapido: '' });
  };
  return (
    <div role="search" aria-label={etiqueta} className={cn(TARJETA, 'flex flex-wrap items-end gap-[6px] bg-barra px-[6px] py-[5px]')}>
      <label className={CAMPO}>
        Estación
        <select
          value={filtros.estacion}
          onChange={(e) => alCambiar({ ...filtros, estacion: e.target.value })}
          className={claseFiltro('min-w-[170px]')}
        >
          {estaciones.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.codigo} · {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={CAMPO}>
        Desde
        <input type="date" value={filtros.desde} onChange={(e) => fechaEditada('desde', e.target.value)} className={claseFiltro('min-w-[128px]')} />
      </label>
      <label className={CAMPO}>
        Hasta
        <input type="date" value={filtros.hasta} onChange={(e) => fechaEditada('hasta', e.target.value)} className={claseFiltro('min-w-[128px]')} />
      </label>
      {children}
      <div className={CAMPO}>
        Rango rápido
        <Segmentado etiqueta="Rango rápido" opciones={RAPIDOS_INVENTARIO} valor={filtros.rapido} alCambiar={alRapido} />
      </div>
      <span className="flex-1" />
      {rango.desde && rango.hasta && (
        <span className="self-center text-[11px] text-tenue">
          Datos del {fecha(rango.desde, true)} al {fecha(rango.hasta, true)}
        </span>
      )}
      <button type="button" onClick={alActualizar} disabled={actualizando} className={cn(BOTON_CHICO, 'h-[28px]')}>
        {actualizando && <Loader2 className="animate-spin" aria-hidden />}
        Actualizar
      </button>
    </div>
  );
}
