'use client';

/**
 * La comparación con la base, fila por fila (las tablas de la vista previa del panel del ETL):
 *   - Tickets del archivo: cada ticket con sus datos, qué pasará con él en la base (nuevo, se actualiza y qué cambia,
 *     o queda igual) y su revisión. Paginada en el servidor, con los filtros del panel: con revisión, sin factura,
 *     nuevos y se actualizan; por producto y con buscador.
 *   - Compras del archivo: las líneas del Reporte de compras (son pocas: todas a la vez), con lo mismo.
 */
import { ChevronRight, Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { mensajeDeError } from '@/api/cliente';
import { Aviso, EsqueletoTabla } from '@/componentes/ui/aviso';
import { claseFiltro } from '@/componentes/ui/campos';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { Paginacion, PieTabla } from '@/componentes/ui/tabla';
import { useRetardo } from '@/lib/ganchos';
import { cn } from '@/lib/utilidades';
import { Segmentado } from '@/modulos/dashboards/componentes/piezas';
import { type Columna, Punto, TablaDatos } from '@/modulos/dashboards/componentes/tablas';
import { fechaHora, fmt } from '@/modulos/dashboards/formato';
import { colorProducto } from '@/modulos/dashboards/productos';
import { type FiltroTickets, type TicketDePrevia, useTicketsDePrevia } from '../datos';
import type { EnLaBase, LineaCompra, Severidad, VistaPreviaEtl } from '../etl';

const SEVERIDAD: Record<Severidad, { texto: string; tono: Tono }> = {
  ERROR: { texto: 'Error', tono: 'red' },
  ADVERTENCIA: { texto: 'Advertencia', tono: 'amber' },
  INFO: { texto: 'Nota', tono: 'gray' },
};

/** Detalle que se abre dentro de la celda, con clic, toque o teclado (Enter o espacio) */
function Desplegable({ resumen, lineas }: { resumen: ReactNode; lineas: string[] }) {
  return (
    <details className="group max-w-xs">
      {/* La flecha propia va en la misma línea que la etiqueta (la del navegador la mandaba a la línea de arriba) */}
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
        {resumen}
      </summary>
      {/* Con ancho propio: al abrirse, la columna se ensancha en vez de partir el texto palabra por palabra */}
      <ul className="mt-1 w-64 max-w-[70vw] list-disc space-y-0.5 pl-8 text-xs whitespace-normal text-slate-600 dark:text-slate-300">
        {lineas.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </details>
  );
}

/** Qué pasará con la fila al cargar. El estado va siempre con palabra, no solo con color */
function CeldaEnBase({ e }: { e: EnLaBase | null | undefined }) {
  if (!e) return <span className="text-slate-400">–</span>;
  if (e.estado === 'NUEVO') return <Insignia tono="blue">Nuevo</Insignia>;
  if (e.estado === 'IGUAL') return <span className="whitespace-nowrap text-slate-400 dark:text-slate-500">Sin cambio</span>;
  const cambios = e.cambios ?? [];
  if (cambios.length <= 1) return <Insignia tono="amber">{cambios.length ? `Cambia: ${cambios[0]}` : 'Cambia'}</Insignia>;
  return <Desplegable resumen={<Insignia tono="amber">Cambian {cambios.length} datos</Insignia>} lineas={cambios} />;
}

function CeldaRevision({ i }: { i: { severidad: Severidad; cantidad: number; mensajes: string[] } | null }) {
  if (!i) return null;
  const s = SEVERIDAD[i.severidad];
  const marca = <Insignia tono={s.tono}>{i.cantidad > 1 ? `${s.texto} (${i.cantidad})` : s.texto}</Insignia>;
  return i.mensajes?.length ? <Desplegable resumen={marca} lineas={i.mensajes} /> : marca;
}

/** Un texto largo (el cliente, el pricebook) en una sola línea: recortado, y completo al pasar el puntero */
const Recortado = ({ texto, ancho }: { texto: string | null; ancho: string }) =>
  texto ? (
    <span className={cn('block truncate', ancho)} title={texto}>
      {texto}
    </span>
  ) : (
    <>–</>
  );

const Producto = ({ nombre }: { nombre: string }) => (
  <span className="whitespace-nowrap">
    <Punto color={colorProducto(nombre)} />
    {nombre}
  </span>
);

const Titulo = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <div>
    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</h4>
    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{children}</p>
  </div>
);

// ---------------------------------------------------------------------------------------------

const FILTROS: { valor: FiltroTickets; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'incidencias', texto: 'Con revisión' },
  { valor: 'sin-factura', texto: 'Sin factura' },
  { valor: 'nuevos', texto: 'Nuevos' },
  { valor: 'cambian', texto: 'Se actualizan' },
];
const POR_PAGINA = 25;
const DE_LA_COMPARACION = new Set<FiltroTickets>(['nuevos', 'cambian']);

export function TablaTicketsPrevia({
  id,
  version,
  productos,
  yaCargado,
}: {
  id: string;
  /** Cambia cuando el servicio ETL compara otra vez el archivo o lo carga: la tabla se vuelve a pedir */
  version: string;
  productos: string[];
  /** Este mismo archivo ya está en la base: no hay nuevos ni actualizados que filtrar */
  yaCargado: boolean;
}) {
  const [filtro, setFiltro] = useState<FiltroTickets>('todos');
  const [producto, setProducto] = useState('');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const buscar = useRetardo(texto.trim(), 250);
  const consulta = useTicketsDePrevia(
    id,
    { pagina, porPagina: POR_PAGINA, filtro, ...(producto ? { producto } : {}), ...(buscar ? { buscar } : {}) },
    version,
    true,
  );
  const d = consulta.data;
  // Sin comparación ticket por ticket no hay nuevos ni actualizados: esos filtros se apagan y cuentan como «Todos»
  const comparado = d?.comparado ?? true;
  const filtroVisible = !comparado && DE_LA_COMPARACION.has(filtro) ? 'todos' : filtro;

  // Las mismas columnas del panel. «En la base» y «Revisión» van junto al ticket (en el panel van al final): la
  // tabla es ancha, y así lo que se viene a ver aquí queda a la vista sin desplazarla.
  const columnas: Columna<TicketDePrevia>[] = [
    { titulo: 'Ticket', valor: (t) => <span className="font-medium text-slate-900 tabular-nums dark:text-white">{t.ticket}</span> },
    // «En la base» solo cuando hay comparación ticket por ticket (no con un archivo repetido ni si no se pudo comparar)
    ...(comparado ? [{ titulo: 'En la base', valor: (t: TicketDePrevia) => <CeldaEnBase e={t.enBase} /> }] : []),
    { titulo: 'Revisión', valor: (t) => <CeldaRevision i={t.incidencia} /> },
    { titulo: 'Fecha y hora', valor: (t) => <span className="whitespace-nowrap">{fechaHora(t.fechaHora)}</span> },
    { titulo: 'Turno', valor: (t) => t.turno ?? '–', der: true },
    { titulo: 'Bomba', valor: (t) => t.bomba ?? '–', der: true },
    { titulo: 'Producto', valor: (t) => <Producto nombre={t.producto} /> },
    { titulo: 'Galones', valor: (t) => fmt.numero(t.galones, 3), der: true },
    { titulo: 'Precio', valor: (t) => fmt.numero(t.precio, 2), der: true },
    { titulo: 'Total', valor: (t) => fmt.moneda(t.total), der: true },
    { titulo: 'Utilidad', valor: (t) => fmt.moneda(t.utilidad), der: true },
    { titulo: 'Cliente', valor: (t) => <Recortado texto={t.cliente} ancho="max-w-[15rem]" /> },
    { titulo: 'Factura', valor: (t) => (t.factura ? <span className="whitespace-nowrap">{t.factura}</span> : <span className="whitespace-nowrap text-slate-400 dark:text-slate-500">Sin factura</span>) },
    { titulo: 'Pricebook', valor: (t) => <Recortado texto={t.pricebook} ancho="max-w-[10rem]" /> },
  ];

  const desde = d?.total ? (d.pagina - 1) * d.porPagina + 1 : 0;
  const hasta = d ? Math.min(d.pagina * d.porPagina, d.total) : 0;

  return (
    <section aria-label="Tickets del archivo" className="space-y-2.5">
      <Titulo titulo="Tickets del archivo">
        Así entrarán al modelo, con lo que pasará con cada uno en la base. Para ver el detalle de una revisión o de un cambio, ábralo con un clic.
      </Titulo>
      {d && !d.disponible ? (
        <Aviso>{d.motivo}</Aviso>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Segmentado
              etiqueta="Qué tickets ver"
              opciones={FILTROS}
              valor={filtroVisible}
              alCambiar={(v) => {
                setFiltro(v);
                setPagina(1);
              }}
              noDisponible={(v) =>
                !comparado && DE_LA_COMPARACION.has(v) ? (yaCargado ? 'No aplica: este archivo ya está cargado' : 'Disponible cuando se compare con la base') : null
              }
            />
            <select
              aria-label="Producto"
              value={producto}
              onChange={(e) => {
                setProducto(e.target.value);
                setPagina(1);
              }}
              className={claseFiltro('w-auto')}
            >
              <option value="">Todos los productos</option>
              {productos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="relative min-w-52 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-[7px] size-[12px] -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar ticket, cliente, NIT, factura…"
                aria-label="Buscar en los tickets del archivo"
                maxLength={80}
                className={claseFiltro('pl-[24px]')}
              />
            </div>
          </div>

          {consulta.isError && !d ? (
            <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
          ) : !d ? (
            <EsqueletoTabla filas={5} />
          ) : (
            <>
              <div aria-busy={consulta.isFetching || undefined} className={cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
                <TablaDatos columnas={columnas} filas={d.filas} vacio="Ningún ticket con este filtro" limitar={false} clave={(t) => t.fila} />
              </div>
              {/* Pie del datatable de la plantilla: «Mostrando 1 a 25 de 40 tickets» y las páginas */}
              <PieTabla desde={desde} hasta={hasta} total={d.total} nombre="tickets" className="mt-0">
                <Paginacion pagina={d.pagina} paginas={d.paginas} alCambiar={setPagina} ocupado={consulta.isFetching && consulta.isPlaceholderData} />
              </PieTabla>
            </>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

export function TablaComprasPrevia({ v }: { v: VistaPreviaEtl }) {
  const compras = v.compras ?? [];
  const cmp = v.comparacion;
  // «En la base» solo cuando ya se comparó línea por línea (no con un archivo repetido)
  const enLaBase = cmp && !cmp.yaCargado && cmp.porFila ? new Map(cmp.porFila.map((x) => [x.fila, x])) : null;
  // Las columnas del panel, con «En la base» y «Revisión» junto a la factura y el producto, a la vista sin desplazar
  const columnas: Columna<LineaCompra>[] = [
    { titulo: 'Factura', valor: (c) => <span className="font-medium whitespace-nowrap text-slate-900 dark:text-white">{c.factura}</span> },
    {
      titulo: 'Producto',
      valor: (c) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {c.combustible ? <Producto nombre={c.producto} /> : c.producto}
          {c.anulada && <Insignia tono="amber">Anulada</Insignia>}
        </span>
      ),
    },
    ...(enLaBase ? [{ titulo: 'En la base', valor: (c: LineaCompra) => <CeldaEnBase e={enLaBase.get(c.fila)} /> }] : []),
    { titulo: 'Revisión', valor: (c) => <CeldaRevision i={c.incidencia} /> },
    { titulo: 'Fecha y hora', valor: (c) => <span className="whitespace-nowrap">{fechaHora(c.fechaHora)}</span> },
    { titulo: 'Turno', valor: (c) => c.turno ?? '–', der: true },
    { titulo: 'Cantidad', valor: (c) => fmt.numero(c.cantidad, 3), der: true },
    { titulo: 'Precio', valor: (c) => fmt.numero(c.precio, 4), der: true },
    { titulo: 'Total', valor: (c) => fmt.moneda(c.total), der: true },
    { titulo: 'Costo FOB', valor: (c) => fmt.moneda(c.costo), der: true },
    { titulo: 'Costo unitario', valor: (c) => fmt.numero(c.costoUnitario, 4), der: true },
    { titulo: 'Proveedor', valor: (c) => <Recortado texto={c.proveedor} ancho="max-w-[16rem]" /> },
  ];
  return (
    <section aria-label="Compras del archivo" className="space-y-2.5">
      <Titulo titulo="Compras del archivo">
        Así entrarán al modelo: una fila por factura y producto, con lo que pasará con cada una en la base. Para ver el detalle de una revisión o de
        un cambio, ábralo con un clic.
      </Titulo>
      {/* Son pocas líneas: todas a la vista, sin la altura máxima de las tablas de las gráficas */}
      <TablaDatos columnas={columnas} filas={compras} vacio="No se pudo leer ninguna compra de este archivo." limitar={false} clave={(c) => c.fila} />
    </section>
  );
}
