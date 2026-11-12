'use client';

/**
 * Cascada de inventario (la de la pestaña Inventario del panel): la existencia inicial y, cada día, las compras (suben),
 * las ventas (bajan), el ajuste por toma física y la existencia al cierre. Cada paso es una barra de rango
 * [antes, después]: así una existencia negativa (falta una compra o una toma) también se dibuja bien.
 */
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { CajaTooltip, Leyenda, Lienzo, SinDatos, useOcultas } from '@/modulos/dashboards/componentes/piezas';

export type TipoPaso = 'total' | 'sube' | 'baja' | 'ajuste';

export interface Paso {
  etiqueta: string;
  titulo: string;
  tipo: TipoPaso;
  antes: number;
  despues: number;
  nota?: string | null;
}

const NOMBRES: Record<TipoPaso, string> = { total: 'Existencia', sube: 'Compras', baja: 'Ventas', ajuste: 'Ajuste por toma física' };
const COLORES: Record<Exclude<TipoPaso, 'total'>, string> = { sube: 'var(--s6)', baja: 'var(--s8)', ajuste: 'var(--s4)' };
const TICK = { fill: 'var(--graf-ejes)', fontSize: 12 };

export function Cascada({
  etiqueta,
  pasos,
  colorTotal,
  formato,
  formatoEje,
}: {
  etiqueta: string;
  pasos: Paso[];
  colorTotal: string;
  formato: (n: number) => string;
  formatoEje: (n: number) => string;
}) {
  const [ocultas, alternar] = useOcultas();
  if (!pasos.length) return <SinDatos />;
  const color = (t: TipoPaso) => (t === 'total' ? colorTotal : COLORES[t]);
  const tipos = (['total', 'sube', 'baja', 'ajuste'] as const).filter((t) => pasos.some((p) => p.tipo === t));
  const datos = pasos
    .map((p, i) => ({ ...p, i, x: String(i), rango: [Math.min(p.antes, p.despues), Math.max(p.antes, p.despues)] as [number, number] }))
    .filter((p) => !ocultas.has(NOMBRES[p.tipo]));
  return (
    <>
      <Leyenda items={tipos.map((t) => ({ nombre: NOMBRES[t], color: color(t) }))} ocultas={ocultas} alAlternar={alternar} />
      <Lienzo etiqueta={etiqueta}>
        {(ancho, alto) => (
          <BarChart width={ancho} height={alto} data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} barCategoryGap="12%">
            <CartesianGrid vertical={false} stroke="var(--graf-rejilla)" />
            <XAxis
              dataKey="x"
              tickFormatter={(x: string) => pasos[Number(x)]?.etiqueta ?? ''}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: 'var(--graf-base)' }}
              tick={TICK}
              minTickGap={4}
            />
            <YAxis tickFormatter={formatoEje} axisLine={false} tickLine={false} tick={TICK} width="auto" />
            <Tooltip
              cursor={{ fill: 'var(--graf-rejilla)', opacity: 0.5 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const p = (payload?.[0]?.payload ?? null) as (Paso & { i: number }) | null;
                if (!active || !p) return null;
                const filas =
                  p.tipo === 'total'
                    ? [{ color: color(p.tipo), nombre: NOMBRES[p.tipo], valor: formato(p.despues) }]
                    : [
                        { color: color(p.tipo), nombre: NOMBRES[p.tipo], valor: `${p.despues >= p.antes ? '+' : '−'}${formato(Math.abs(p.despues - p.antes))}` },
                        { nombre: 'Queda', valor: formato(p.despues) },
                      ];
                return <CajaTooltip titulo={p.titulo} filas={filas} nota={p.nota} />;
              }}
            />
            <Bar dataKey="rango" isAnimationActive={false} maxBarSize={28} radius={[3, 3, 3, 3]} stroke="var(--graf-superficie)" strokeWidth={1}>
              {datos.map((p) => (
                <Cell key={p.i} fill={color(p.tipo)} />
              ))}
            </Bar>
          </BarChart>
        )}
      </Lienzo>
    </>
  );
}
