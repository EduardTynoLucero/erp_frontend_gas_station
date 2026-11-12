'use client';

/**
 * Gráficas del dashboard con Recharts, traducidas de las opciones de ECharts del panel del ETL:
 * barras apiladas por producto (Ventas por día y por turno), barras horizontales (Por producto, Facturación, Clientes)
 * y líneas con etiqueta al final (Utilidad por galón). Los colores son variables CSS: cambian solos con el tema.
 *
 * Sin la animación de Recharts (isAnimationActive=false): en modo desarrollo (React StrictMode) la animación de
 * Recharts 3 se quedaba a medio camino y dejaba barras y líneas a medio dibujar y sin etiquetas (las etiquetas solo
 * aparecen al terminar la animación). El aparecer de 250 ms lo da CSS en el lienzo (ver Lienzo en piezas.tsx).
 */
import {
  Bar,
  BarChart,
  type BarShapeProps,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Rectangle,
  Tooltip,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from 'recharts';
import { colorProducto, type Serie } from '../productos';
import { anchoMayor, marcasDe, marcasEje, recortarAncho } from './medidas';
import { CajaTooltip, type FilaTooltip, Leyenda, Lienzo, SinDatos, useOcultas } from './piezas';

const TICK = { fill: 'var(--graf-ejes)', fontSize: 12 };
const EJE_CATEGORIAS = { stroke: 'var(--graf-base)' };

/** Índice de la categoría bajo el puntero (cada fila de datos lleva su índice `i`). */
function indiceDe(payload: unknown): number | null {
  const fila = (payload as { payload?: { i?: unknown } }[] | undefined)?.[0]?.payload;
  return typeof fila?.i === 'number' ? fila.i : null;
}

/** Separación entre segmentos (borde del color de la superficie), más fina cuanto más delgada es la barra. */
const separacion = (ancho: number) => (ancho >= 12 ? 2 : ancho >= 5 ? 1 : 0);

// ---------------------------------------------------------------------------------------------------------------
// Barras verticales apiladas por producto
// ---------------------------------------------------------------------------------------------------------------

export function BarrasApiladas({
  etiqueta,
  categorias,
  series,
  formato,
  formatoEje,
  etiquetaX,
  tituloTooltip,
  notaTooltip,
}: {
  etiqueta: string;
  categorias: string[];
  series: Serie[];
  formato: (n: number) => string;
  formatoEje: (n: number) => string;
  etiquetaX: (x: string) => string;
  tituloTooltip: (x: string, i: number) => string;
  notaTooltip?: (x: string, i: number) => string | null;
}) {
  const [ocultas, alternar] = useOcultas();
  if (!categorias.length) return <SinDatos />;

  const visibles = series.map((s, k) => ({ s, k })).filter(({ s }) => !ocultas.has(s.nombre));
  const datos = categorias.map((x, i) => {
    const fila: Record<string, string | number> = { x, i };
    series.forEach((s, k) => (fila[`s${k}`] = s.valores[i] ?? 0));
    return fila;
  });
  // Solo el segmento visible más alto con valor > 0 lleva las esquinas de arriba redondeadas
  const arriba = categorias.map((_, i) => {
    for (let j = visibles.length - 1; j >= 0; j--) if ((visibles[j]!.s.valores[i] ?? 0) > 0) return visibles[j]!.k;
    return -1;
  });
  const conLeyenda = series.length >= 2;

  return (
    <>
      <Leyenda items={series.map((s) => ({ nombre: s.nombre, color: colorProducto(s.nombre) }))} ocultas={ocultas} alAlternar={alternar} />
      <Lienzo etiqueta={etiqueta}>
        {(ancho, alto) => (
          <BarChart width={ancho} height={alto} data={datos} stackOffset="sign" margin={{ top: conLeyenda ? 8 : 16, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--graf-rejilla)" />
            <XAxis
              dataKey="x"
              tickFormatter={etiquetaX}
              tickLine={false}
              axisLine={EJE_CATEGORIAS}
              tick={TICK}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis tickFormatter={formatoEje} axisLine={false} tickLine={false} tick={TICK} width="auto" />
            <Tooltip
              cursor={{ fill: 'var(--graf-rejilla)', opacity: 0.5 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const i = indiceDe(payload);
                if (!active || i === null) return null;
                const x = categorias[i]!;
                // De arriba hacia abajo de la pila, sin ceros; «Total» suma todas las series (también las ocultas)
                const filas: FilaTooltip[] = [...visibles]
                  .reverse()
                  .filter(({ s }) => (s.valores[i] ?? 0) !== 0)
                  .map(({ s }) => ({ color: colorProducto(s.nombre), nombre: s.nombre, valor: formato(s.valores[i] ?? 0) }));
                if (series.length > 1) filas.push({ nombre: 'Total', valor: formato(series.reduce((a, s) => a + (s.valores[i] ?? 0), 0)) });
                return <CajaTooltip titulo={tituloTooltip(x, i)} filas={filas} nota={notaTooltip?.(x, i)} />;
              }}
            />
            {series.map((s, k) => (
              <Bar
                key={s.nombre}
                dataKey={`s${k}`}
                name={s.nombre}
                stackId="total"
                fill={colorProducto(s.nombre)}
                stroke="var(--graf-superficie)"
                maxBarSize={24}
                hide={ocultas.has(s.nombre)}
                isAnimationActive={false}
                shape={(p: BarShapeProps) => (
                  <Rectangle {...p} strokeWidth={separacion(p.width ?? 0)} radius={arriba[p.index] === k ? [4, 4, 0, 0] : 0} />
                )}
              />
            ))}
          </BarChart>
        )}
      </Lienzo>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Barras horizontales (una sola medida)
// ---------------------------------------------------------------------------------------------------------------

function TickNombre({ x, y, texto, ancho }: { x: number; y: number; texto: string; ancho: number }) {
  const visible = recortarAncho(texto, ancho);
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--graf-tinta-2)">
      {visible !== texto && <title>{texto}</title>}
      {visible}
    </text>
  );
}

export interface ContenidoTooltip {
  titulo: string;
  filas: FilaTooltip[];
  nota?: string | null;
}

export function BarrasHorizontales({
  etiqueta,
  categorias,
  valores,
  colores,
  formatoEje,
  etiquetaDe,
  tooltipDe,
  anchoEtiqueta = 28,
}: {
  etiqueta: string;
  categorias: string[];
  valores: number[];
  /** Un color por barra (o uno solo para todas) */
  colores: string[];
  formatoEje: (n: number) => string;
  /** Texto a la derecha de cada barra */
  etiquetaDe: (i: number) => string;
  tooltipDe: (i: number) => ContenidoTooltip;
  /** Caracteres antes de recortar el nombre con "…" (32 en Clientes) */
  anchoEtiqueta?: number;
}) {
  if (!categorias.length) return <SinDatos />;
  const recortar = (v: string) => (v.length > anchoEtiqueta ? `${v.slice(0, anchoEtiqueta - 1)}…` : v);
  // La categoría es el índice: dos clientes con el mismo nombre no se juntan en una barra
  const datos = valores.map((v, i) => ({ k: String(i), i, v, t: etiquetaDe(i) }));

  return (
    <Lienzo etiqueta={etiqueta}>
      {(ancho, alto) => {
        const derecha = anchoMayor(datos.map((d) => d.t)) + 12;
        const anchoNombres = anchoMayor(categorias.map(recortar));
        const nombres = Math.min(anchoNombres, Math.floor(ancho * 0.4));
        const eje = marcasEje(valores, formatoEje, ancho - 4 - nombres - 8 - derecha);
        return (
          <BarChart layout="vertical" width={ancho} height={alto} data={datos} margin={{ top: 4, right: derecha, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--graf-rejilla)" />
            <XAxis
              type="number"
              {...(eje ? { domain: [eje.min, eje.max], ticks: marcasDe(eje), interval: 0 as const } : { tickCount: 4 })}
              tickFormatter={(v: number) => (eje?.apretado && v === eje.min ? '' : formatoEje(v))}
              axisLine={false}
              tickLine={false}
              tick={TICK}
            />
            <YAxis
              type="category"
              dataKey="k"
              width={nombres + 8}
              interval={0}
              axisLine={EJE_CATEGORIAS}
              tickLine={false}
              tick={(p: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => (
                <TickNombre x={Number(p.x)} y={Number(p.y)} ancho={nombres} texto={recortar(categorias[Number(p.payload?.value)] ?? '')} />
              )}
            />
            <Tooltip
              cursor={false}
              shared={false}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const i = indiceDe(payload);
                if (!active || i === null) return null;
                const t = tooltipDe(i);
                return <CajaTooltip titulo={t.titulo} filas={t.filas} nota={t.nota} />;
              }}
            />
            <Bar
              dataKey="v"
              maxBarSize={22}
              isAnimationActive={false}
              fill={colores[0]}
              shape={(p: BarShapeProps) => <Rectangle {...p} fill={colores[p.index] ?? colores[0]} radius={[0, 4, 4, 0]} />}
            >
              {/* Etiqueta a la derecha de la barra en un solo renglón (el margen derecho ya le deja lugar) */}
              <LabelList
                dataKey="t"
                content={(p) => {
                  const x = Number(p.x ?? 0);
                  const ancho = Number(p.width ?? 0);
                  const y = Number(p.y ?? 0) + Number(p.height ?? 0) / 2;
                  return (
                    <text x={Math.max(x, x + ancho) + 6} y={y} dy={4} fontSize={12} fill="var(--graf-tinta-2)">
                      {String(p.value ?? '')}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        );
      }}
    </Lienzo>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Líneas por producto con etiqueta al final
// ---------------------------------------------------------------------------------------------------------------

export interface SerieConHuecos {
  nombre: string;
  valores: (number | null)[];
}

/** Nombre de cada serie al final de su línea; si se enciman, se separan en vertical (moveOverlap del panel). */
function EtiquetasFinales({ series, categorias }: { series: SerieConHuecos[]; categorias: string[] }) {
  const escalaX = useXAxisScale();
  const escalaY = useYAxisScale();
  const area = usePlotArea();
  if (!escalaX || !escalaY || !area) return null;
  const puntos = series
    .flatMap((s) => {
      let i = s.valores.length - 1;
      while (i >= 0 && s.valores[i] === null) i--;
      if (i < 0) return [];
      const x = escalaX(categorias[i]);
      const y = escalaY(s.valores[i]);
      return typeof x === 'number' && typeof y === 'number' ? [{ nombre: s.nombre, x, y }] : [];
    })
    .sort((a, b) => a.y - b.y);
  const ALTO = 14;
  for (let j = 1; j < puntos.length; j++) puntos[j]!.y = Math.max(puntos[j]!.y, puntos[j - 1]!.y + ALTO);
  const exceso = (puntos.at(-1)?.y ?? 0) - (area.y + area.height);
  if (exceso > 0) for (const p of puntos) p.y -= exceso;
  return (
    <g>
      {puntos.map((p) => (
        <text key={p.nombre} x={p.x + 6} y={p.y} dy={4} fontSize={12} fill="var(--graf-tinta-2)">
          {p.nombre}
        </text>
      ))}
    </g>
  );
}

export function Lineas({
  etiqueta,
  categorias,
  series,
  formato,
  formatoEje,
  etiquetaX,
  tituloTooltip,
  notaTooltip,
}: {
  etiqueta: string;
  categorias: string[];
  series: SerieConHuecos[];
  formato: (n: number) => string;
  formatoEje: (n: number) => string;
  etiquetaX: (x: string) => string;
  tituloTooltip: (x: string) => string;
  notaTooltip?: (x: string, i: number) => string | null;
}) {
  const [ocultas, alternar] = useOcultas();
  if (!categorias.length) return <SinDatos />;
  const datos = categorias.map((x, i) => {
    const fila: Record<string, string | number | null> = { x, i };
    series.forEach((s, k) => (fila[`s${k}`] = s.valores[i] ?? null));
    return fila;
  });
  const visibles = series.filter((s) => !ocultas.has(s.nombre));
  const conLeyenda = series.length >= 2;

  return (
    <>
      <Leyenda items={series.map((s) => ({ nombre: s.nombre, color: colorProducto(s.nombre) }))} ocultas={ocultas} alAlternar={alternar} />
      <Lienzo etiqueta={etiqueta}>
        {(ancho, alto) => (
          <LineChart width={ancho} height={alto} data={datos} margin={{ top: conLeyenda ? 8 : 16, right: 76, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--graf-rejilla)" />
            <XAxis
              dataKey="x"
              scale="point"
              padding={{ left: 0, right: 0 }}
              tickFormatter={etiquetaX}
              tickLine={false}
              axisLine={EJE_CATEGORIAS}
              tick={TICK}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            {/* No se fuerza el cero (scale: true del panel); el redondeo a marcas "bonitas" puede incluirlo */}
            <YAxis domain={['auto', 'auto']} tickFormatter={formatoEje} axisLine={false} tickLine={false} tick={TICK} width="auto" />
            <Tooltip
              cursor={{ stroke: 'var(--graf-base)', strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const i = indiceDe(payload);
                if (!active || i === null) return null;
                const filas: FilaTooltip[] = visibles
                  .filter((s) => s.valores[i] !== null && s.valores[i] !== undefined)
                  .map((s) => ({ color: colorProducto(s.nombre), nombre: s.nombre, valor: formato(s.valores[i] ?? 0) }));
                return <CajaTooltip titulo={tituloTooltip(categorias[i]!)} filas={filas} nota={notaTooltip?.(categorias[i]!, i)} />;
              }}
            />
            {series.map((s, k) => (
              <Line
                key={s.nombre}
                type="linear"
                dataKey={`s${k}`}
                name={s.nombre}
                stroke={colorProducto(s.nombre)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--graf-superficie)', fill: colorProducto(s.nombre) }}
                connectNulls={false}
                hide={ocultas.has(s.nombre)}
                isAnimationActive={false}
              />
            ))}
            <EtiquetasFinales series={visibles} categorias={categorias} />
          </LineChart>
        )}
      </Lienzo>
    </>
  );
}
