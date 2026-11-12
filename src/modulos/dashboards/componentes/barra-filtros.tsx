'use client';

/**
 * Barra de filtros del dashboard, con la misma lógica que el panel del ETL:
 * - Fechas: al escribir se desmarca el rango rápido y se aplica a los 700 ms (solo si las dos fechas son válidas y
 *   están en orden); al salir del campo o con Enter se aplica ya, ajustando en silencio: vacía → primer/último día,
 *   fuera de rango → se recorta, Desde después de Hasta → la otra fecha se iguala a la recién editada (nunca se
 *   intercambian). Mientras el usuario escribe, no se le cambia el texto del campo que tiene el foco.
 * - Estación y Producto: se aplican a los 300 ms y no desmarcan el rango rápido.
 * - Rangos rápidos: al instante, relativos al último día con datos.
 */
import { Loader2 } from 'lucide-react';
import { type FocusEvent, useEffect, useRef, useState } from 'react';
import type { OpcionesVentas } from '@/api/tipos';
import { claseFiltro } from '@/componentes/ui/campos';
import { cn } from '@/lib/utilidades';
import { type EstadoFiltros, RAPIDOS, type Rango, type Rapido, rangoRapido } from '../filtros';
import { fecha } from '../formato';
import { BOTON_CHICO, Segmentado, TARJETA } from './piezas';

interface Valores {
  desde: string;
  hasta: string;
  estacion: string;
  producto: string;
}

export interface CambioFiltros {
  desde?: string;
  hasta?: string;
  estacion?: string;
  producto?: string;
  rapido?: Rapido;
}

/** Campo de la barra de filtros de la plantilla: etiqueta de 10 px en seminegrita sobre un control de 28 px */
const CAMPO = 'flex flex-col gap-[3px] text-[10px] font-semibold leading-[1.1] text-tinta max-[860px]:flex-[1_1_140px]';

export function BarraFiltros({
  opciones,
  rango,
  filtros,
  alCambiar,
  alActualizar,
  actualizando,
}: {
  opciones: OpcionesVentas;
  rango: Rango;
  filtros: EstadoFiltros;
  alCambiar: (cambio: CambioFiltros) => void;
  alActualizar: () => void;
  actualizando: boolean;
}) {
  const desdeRef = useRef<HTMLInputElement>(null);
  const hastaRef = useRef<HTMLInputElement>(null);
  const editada = useRef<'desde' | 'hasta'>('desde');
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [valores, setValores] = useState<Valores>(() => ({
    desde: filtros.desde,
    hasta: filtros.hasta,
    estacion: filtros.estacion ?? '',
    producto: filtros.producto ?? '',
  }));
  const actual = useRef(valores);
  const poner = (cambio: Partial<Valores>) => {
    actual.current = { ...actual.current, ...cambio };
    setValores(actual.current);
  };

  // Los filtros normalizados (o reajustados por una carga nueva) vuelven a los controles, salvo a la fecha con foco
  useEffect(() => {
    const enFoco = document.activeElement;
    const cambio: Partial<Valores> = { estacion: filtros.estacion ?? '', producto: filtros.producto ?? '' };
    if (enFoco !== desdeRef.current) cambio.desde = filtros.desde;
    if (enFoco !== hastaRef.current) cambio.hasta = filtros.hasta;
    poner(cambio);
  }, [filtros.desde, filtros.hasta, filtros.estacion, filtros.producto]);

  useEffect(() => () => clearTimeout(espera.current), []);

  function aplicar(final: boolean, destino: EventTarget | null = null) {
    clearTimeout(espera.current);
    const { desde: min, hasta: max } = rango;
    let { desde, hasta } = actual.current;
    const enRango = (v: string) => v >= min && v <= max;
    if (!final && (!enRango(desde) || !enRango(hasta) || desde > hasta)) return;
    const limitar = (v: string, vacio: string) => (!v ? vacio : v < min ? min : v > max ? max : v);
    desde = limitar(desde, min);
    hasta = limitar(hasta, max);
    if (desde > hasta) {
      // Si el foco va justo a la otra fecha, el usuario la va a cambiar: se espera a que salga de ella
      const otra = editada.current === 'hasta' ? desdeRef.current : hastaRef.current;
      if (destino && destino === otra) return;
      if (editada.current === 'hasta') desde = hasta;
      else hasta = desde;
    }
    if (final) {
      const cambio: Partial<Valores> = {};
      if (destino !== desdeRef.current) cambio.desde = desde;
      if (destino !== hastaRef.current) cambio.hasta = hasta;
      poner(cambio);
    }
    alCambiar({ desde, hasta, estacion: actual.current.estacion, producto: actual.current.producto });
  }

  function alEscribirFecha(campo: 'desde' | 'hasta', valor: string) {
    editada.current = campo;
    poner({ [campo]: valor });
    if (filtros.rapido) alCambiar({ rapido: '' });
    clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar(false), 700);
  }

  function alElegir(campo: 'estacion' | 'producto', valor: string) {
    poner({ [campo]: valor });
    clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar(true), 300);
  }

  function alRapido(tipo: Rapido) {
    const r = rangoRapido(rango, tipo);
    if (!r) return;
    clearTimeout(espera.current);
    poner({ desde: r.desde, hasta: r.hasta });
    alCambiar({ ...r, rapido: tipo, estacion: actual.current.estacion, producto: actual.current.producto });
  }

  const propsFecha = (campo: 'desde' | 'hasta') => ({
    type: 'date' as const,
    min: rango.desde,
    max: rango.hasta,
    value: valores[campo],
    onChange: (e: { target: { value: string } }) => alEscribirFecha(campo, e.target.value),
    onBlur: (e: FocusEvent<HTMLInputElement>) => aplicar(true, e.relatedTarget),
    onKeyDown: (e: { key: string }) => e.key === 'Enter' && aplicar(true),
    className: claseFiltro('min-w-[128px] max-[860px]:min-w-0'),
  });

  const sinMesAnterior = !rangoRapido(rango, 'anterior');

  return (
    <div role="search" aria-label="Filtros del dashboard" className={cn(TARJETA, 'flex flex-wrap items-end gap-[6px] bg-barra px-[6px] py-[5px]')}>
      <label className={CAMPO}>
        Desde
        <input ref={desdeRef} {...propsFecha('desde')} />
      </label>
      <label className={CAMPO}>
        Hasta
        <input ref={hastaRef} {...propsFecha('hasta')} />
      </label>
      <label className={CAMPO}>
        Estación
        <select value={valores.estacion} onChange={(e) => alElegir('estacion', e.target.value)} className={claseFiltro('min-w-[150px]')}>
          <option value="">Todas</option>
          {opciones.estaciones.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.codigo} · {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={CAMPO}>
        Producto
        <select value={valores.producto} onChange={(e) => alElegir('producto', e.target.value)} className={claseFiltro('min-w-[96px]')}>
          <option value="">Todos</option>
          {opciones.productos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <div className={CAMPO}>
        <span>Rango rápido</span>
        <Segmentado
          etiqueta="rango"
          opciones={RAPIDOS}
          valor={filtros.rapido}
          alCambiar={alRapido}
          noDisponible={(v) =>
            v === 'anterior' && sinMesAnterior ? `No hay datos del mes anterior: los datos empiezan el ${fecha(rango.desde, true)}` : null
          }
        />
      </div>
      <span className="flex-1" />
      <span className="self-center text-[11px] text-tenue">
        Datos del {fecha(rango.desde, true)} al {fecha(rango.hasta, true)}
      </span>
      <button
        type="button"
        onClick={alActualizar}
        className={cn(BOTON_CHICO, 'h-[28px]')}
        title="Vuelve a leer el modelo, por ejemplo después de una carga nueva del ETL"
      >
        {actualizando && <Loader2 className="animate-spin" aria-hidden />}
        Actualizar
      </button>
    </div>
  );
}
