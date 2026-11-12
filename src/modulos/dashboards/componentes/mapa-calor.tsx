'use client';

/**
 * «¿Cuándo se vende?»: mapa de calor día de la semana × hora (SVG propio, como el heatmap de ECharts del panel).
 * Cada celda es el PROMEDIO POR DÍA que calcula el servidor. Escala secuencial continua de 0 al máximo, interpolada
 * en RGB entre 5 colores; los colores son variables CSS (--sec-1…5) mezcladas con color-mix, así que el mapa cambia
 * solo con el tema (en oscuro la escala se invierte).
 */
import { useState } from 'react';
import type { DashboardVentas } from '@/api/tipos';
import { DIAS, fmt, num } from '../formato';
import { anchoMayor, anchoTexto } from './medidas';
import { CajaTooltip, Lienzo, SinDatos } from './piezas';
import { type Columna, TablaDatos } from './tablas';

export type Celda = DashboardVentas['mapaDeCalor'][number];
export type MedidaMapa = 'tickets' | 'venta' | 'galones';

export const MEDIDAS_MAPA: { valor: MedidaMapa; texto: string }[] = [
  { valor: 'tickets', texto: 'Tickets' },
  { valor: 'venta', texto: 'Venta' },
  { valor: 'galones', texto: 'Galones' },
];

const NOMBRE_DIA: [string, string][] = [
  ['lunes', 'lunes'],
  ['martes', 'martes'],
  ['miércoles', 'miércoles'],
  ['jueves', 'jueves'],
  ['viernes', 'viernes'],
  ['sábado', 'sábados'],
  ['domingo', 'domingos'],
];

/** Formato del tooltip y de la leyenda */
export const formatoMapa = (m: MedidaMapa) => (m === 'tickets' ? (v: number) => `${fmt.numero(v, 1)} tickets` : m === 'galones' ? fmt.galones : fmt.moneda);
/** Formato de la tabla */
const formatoCelda = (m: MedidaMapa) => (m === 'venta' ? fmt.monedaEntera : (v: number) => fmt.numero(v, 1));

function colorEscala(v: number, maximo: number): string {
  const t = Math.min(1, Math.max(0, v / maximo)) * 4;
  const i = Math.min(3, Math.floor(t));
  const parte = Math.round((t - i) * 1000) / 10;
  return `color-mix(in srgb, var(--sec-${i + 2}) ${parte}%, var(--sec-${i + 1}))`;
}

const hh = (h: number) => String(h).padStart(2, '0');
const IZQUIERDA = 36;
const ABAJO = 22;

export function MapaCalor({ celdas, medida }: { celdas: Celda[]; medida: MedidaMapa }) {
  const [punto, setPunto] = useState<{ celda: Celda; x: number; y: number } | null>(null);
  if (!celdas.length) return <SinDatos />;

  const horas = [...new Set(celdas.map((c) => c.hora))].sort((a, b) => a - b);
  const desde = horas[0] ?? 0;
  const hasta = horas.at(-1) ?? 23;
  const columnas = hasta - desde + 1;
  const valor = (c: Celda) => num(c[medida]);
  const maximo = Math.max(...celdas.map(valor), 1);
  const formato = formatoMapa(medida);
  const textoMin = formato(0);
  const textoMax = formato(maximo);

  return (
    <>
      <Lienzo etiqueta="¿Cuándo se vende?">
        {(ancho, alto) => {
          const anchoCelda = (ancho - IZQUIERDA - 8) / columnas;
          const altoCelda = (alto - ABAJO - 8) / 7;
          // Etiquetas de hora que no se enciman (hideOverlap)
          const salto = Math.max(1, Math.ceil((anchoTexto('00') + 8) / anchoCelda));
          const nombreMedida = MEDIDAS_MAPA.find((m) => m.valor === medida)!.texto;
          return (
            <div className="relative h-full w-full" onMouseLeave={() => setPunto(null)}>
              <svg width={ancho} height={alto} className="block">
                {DIAS.map((d, f) => (
                  <text key={d} x={IZQUIERDA - 8} y={8 + f * altoCelda + altoCelda / 2} dy={4} textAnchor="end" fontSize={12} fill="var(--graf-ejes)">
                    {d}
                  </text>
                ))}
                {Array.from({ length: columnas }, (_, c) =>
                  c % salto === 0 ? (
                    <text key={c} x={IZQUIERDA + c * anchoCelda + anchoCelda / 2} y={alto - 6} textAnchor="middle" fontSize={12} fill="var(--graf-ejes)">
                      {hh(desde + c)}
                    </text>
                  ) : null,
                )}
                {celdas.map((c) => (
                  <rect
                    key={`${c.dia}-${c.hora}`}
                    x={IZQUIERDA + (c.hora - desde) * anchoCelda + 1}
                    y={8 + (c.dia - 1) * altoCelda + 1}
                    width={Math.max(0, anchoCelda - 2)}
                    height={Math.max(0, altoCelda - 2)}
                    rx={3}
                    style={{ fill: colorEscala(valor(c), maximo) }}
                    className="stroke-transparent hover:stroke-[var(--graf-tinta)]"
                    strokeWidth={1}
                    onMouseMove={(e) => {
                      const caja = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                      setPunto({ celda: c, x: e.clientX - caja.left, y: e.clientY - caja.top });
                    }}
                  />
                ))}
              </svg>
              {punto && (
                <div
                  className="pointer-events-none absolute z-10"
                  style={{
                    left: punto.x,
                    top: punto.y,
                    transform: `translate(${punto.x > ancho / 2 ? 'calc(-100% - 12px)' : '12px'}, ${punto.y > alto / 2 ? 'calc(-100% - 12px)' : '12px'})`,
                  }}
                >
                  <CajaTooltip
                    titulo={`${DIAS[punto.celda.dia - 1]} ${hh(punto.celda.hora)}:00`}
                    filas={[{ nombre: `${nombreMedida} (promedio por día)`, valor: formato(valor(punto.celda)) }]}
                    nota={(() => {
                      const n = punto.celda.dias ?? 0;
                      const [uno, varios] = NOMBRE_DIA[punto.celda.dia - 1]!;
                      return `Promedio de ${n} ${n === 1 ? uno : varios} con datos a esa hora`;
                    })()}
                  />
                </div>
              )}
            </div>
          );
        }}
      </Lienzo>
      <LeyendaEscala textoMin={textoMin} textoMax={textoMax} />
    </>
  );
}

/** Barra de la escala: mínimo ▬ máximo, centrada abajo. */
function LeyendaEscala({ textoMin, textoMax }: { textoMin: string; textoMax: string }) {
  return (
    <Lienzo etiqueta={`Escala de ${textoMin} a ${textoMax}`} alto={40}>
      {(ancho) => {
        const espacioTextos = anchoMayor([textoMax]) + anchoMayor([textoMin]) + 2 * 8 + 24;
        const largo = Math.max(60, Math.min(160, ancho - espacioTextos));
        return (
          <div className="flex h-full items-center justify-center gap-2 text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
            <span>{textoMin}</span>
            <span
              aria-hidden
              className="h-3 rounded-sm"
              style={{ width: largo, background: 'linear-gradient(to right, var(--sec-1), var(--sec-2), var(--sec-3), var(--sec-4), var(--sec-5))' }}
            />
            <span>{textoMax}</span>
          </div>
        );
      }}
    </Lienzo>
  );
}

interface FilaMapa {
  dia: number;
  veces: number;
  valores: number[];
  total: number;
}

/** Tabla equivalente: siempre 7 filas; un día de la semana sin datos muestra «–» en toda la fila. */
export function TablaMapa({ celdas, medida }: { celdas: Celda[]; medida: MedidaMapa }) {
  if (!celdas.length) return <TablaDatos columnas={[]} filas={[]} />;
  const horas = [...new Set(celdas.map((c) => c.hora))].sort((a, b) => a - b);
  const desde = horas[0] ?? 0;
  const hasta = horas.at(-1) ?? 23;
  const lista = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const veces = DIAS.map((_, i) => Math.max(0, ...celdas.filter((c) => c.dia === i + 1).map((c) => c.dias)));
  const aMedias = celdas.some((c) => c.dias < (veces[c.dia - 1] ?? 0));
  const formato = formatoCelda(medida);
  const filas: FilaMapa[] = DIAS.map((_, i) => {
    const valores = lista.map((h) => num(celdas.find((c) => c.dia === i + 1 && c.hora === h)?.[medida]));
    return { dia: i, veces: veces[i] ?? 0, valores, total: valores.reduce((a, v) => a + v, 0) };
  });
  const columnas: Columna<FilaMapa>[] = [
    { titulo: 'Día', valor: (f) => DIAS[f.dia] },
    { titulo: 'Días con ventas', valor: (f) => fmt.entero(f.veces), der: true },
    ...lista.map((h, k) => ({ titulo: hh(h), valor: (f: FilaMapa) => (f.veces === 0 ? '–' : formato(f.valores[k] ?? 0)), der: true })),
    { titulo: 'Todo el día', valor: (f) => (f.veces === 0 ? '–' : formato(f.total)), der: true },
  ];
  return (
    <>
      <TablaDatos columnas={columnas} filas={filas} clave={(f) => f.dia} />
      {aMedias && (
        <p className="mt-1.5 text-[11px] text-tenue">
          En las horas que no trae un día cargado a medias (el primero o el último cargado), el promedio no cuenta ese día.
        </p>
      )}
    </>
  );
}
