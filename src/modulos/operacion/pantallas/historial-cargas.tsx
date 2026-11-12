'use client';

/**
 * Historial de cargas: la pestaña «Historial» del panel del ETL sobre la API del ERP. Las últimas 200 cargas de las
 * estaciones del usuario (vengan del navegador, de la carpeta vigilada o del panel) y, al elegir una, su detalle:
 * revisión de calidad por regla con ejemplos, qué cambió en lo que ya estaba y el cuadre contra el reporte.
 */
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mensajeDeError } from '@/api/cliente';
import { useTienePantalla } from '@/componentes/marco/contexto';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { EncabezadoPagina } from '@/componentes/ui/tarjeta';
import { cn } from '@/lib/utilidades';
import { Estado, type TipoEstado } from '@/modulos/dashboards/componentes/iconos';
import { BOTON_CHICO, Cargando, Segmentado, TARJETA, TarjetaVacia, Veredicto } from '@/modulos/dashboards/componentes/piezas';
import { type Columna, TablaDatos } from '@/modulos/dashboards/componentes/tablas';
import { fmt, plural } from '@/modulos/dashboards/formato';
import { fechaReporte, NOMBRE_REPORTE } from '@/modulos/ingesta/etl';
import { type CargaEtl, type DetalleCarga, useCargas, useDetalleCarga } from '../datos';

const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  CARGADO: { texto: 'Cargado', tono: 'green' },
  RECHAZADO: { texto: 'Rechazado', tono: 'red' },
  DUPLICADO: { texto: 'Repetido', tono: 'amber' },
  RECIBIDO: { texto: 'Recibido', tono: 'blue' },
  VALIDADO: { texto: 'Validado', tono: 'blue' },
};

const SEVERIDAD: Record<string, { tipo: TipoEstado; texto: string }> = {
  ERROR: { tipo: 'critico', texto: 'Error' },
  ADVERTENCIA: { tipo: 'aviso', texto: 'Advertencia' },
  INFO: { tipo: 'info', texto: 'Informativa' },
};

/** Nombres de las reglas de calidad del ETL (los del panel) */
const REGLAS: Record<string, string> = {
  TICKET_FALTANTE: 'Tickets que faltan en la numeración',
  TICKET_NO_VINO: 'Tickets que ya estaban y no vienen en este archivo',
  FACTURA_QUITADA: 'Tickets que pierden su factura',
  SIN_PRODUCTO: 'Tickets sin producto',
  PRODUCTO_DISTINTO_A_SECCION: 'Producto distinto a la sección del reporte',
  PRECIO_FUERA_DE_PRICEBOOK: 'Precio fuera del pricebook',
  POSIBLE_DUPLICADO: 'Posibles tickets duplicados',
  NIT_INVALIDO: 'NIT que no pasa el dígito verificador',
  MARGEN_NEGATIVO: 'Vendidos abajo del costo',
  FORMULA: 'Cálculos del ticket que no cuadran',
  TICKET_REPETIDO: 'Ticket repetido en el archivo',
  SIN_TICKETS: 'El archivo no trae tickets',
  GRUPO_SIN_SUBTOTAL: 'Grupo sin subtotal',
  FILA_DESCONOCIDA: 'Filas que no se reconocen',
  ENCABEZADO_NO_ENCONTRADO: 'No se encontró el encabezado del reporte',
  COLUMNA_REPETIDA: 'Columna repetida',
  COLUMNA_OBLIGATORIA_FALTA: 'Falta una columna obligatoria',
  COLUMNA_NUEVA: 'Columnas que el ETL no usa',
  TOTAL_NO_ENCONTRADO: 'No se encontró el total general',
  SUBTOTAL_ILEGIBLE: 'Subtotal que no se puede leer',
  NO_CUADRA: 'No cuadra con los subtotales del reporte',
  ESTACION_FALTA: 'Falta la estación',
  NUMERO_INVALIDO: 'Números inválidos',
  VALOR_OBLIGATORIO_FALTA: 'Faltan datos obligatorios',
  FECHA_INVALIDA: 'Fechas inválidas',
};
const nombreRegla = (r: string) => REGLAS[r] ?? r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');

const instante = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' }) : '–');

type FiltroEstado = 'todas' | 'CARGADO' | 'RECHAZADO' | 'DUPLICADO';
const FILTROS: { valor: FiltroEstado; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'CARGADO', texto: 'Cargadas' },
  { valor: 'RECHAZADO', texto: 'Rechazadas' },
  { valor: 'DUPLICADO', texto: 'Repetidas' },
];

function Cuadre({ c }: { c: CargaEtl }) {
  if (c.cuadra === null) return <span className="text-slate-400">–</span>;
  return c.cuadra ? <Estado tipo="bueno">Cuadra</Estado> : <Estado tipo="critico">No cuadra</Estado>;
}

export function PantallaHistorialCargas() {
  const cliente = useQueryClient();
  const veIntegraciones = useTienePantalla('integraciones', 'cargas');
  const cargas = useCargas();
  const [filtro, setFiltro] = useState<FiltroEstado>('todas');
  const [elegida, setElegida] = useState<number | null>(null);

  const filas = useMemo(() => (cargas.data ?? []).filter((c) => filtro === 'todas' || c.estado === filtro), [cargas.data, filtro]);

  const encabezado = (
    <EncabezadoPagina
      titulo="Historial de cargas"
      descripcion="Cada reporte de BISS que procesó el ETL: resultado, revisión de calidad y cuadre contra los totales del reporte."
      acciones={
        veIntegraciones ? (
          <Link href="/integraciones" className={BOTON_CHICO}>
            Subir un reporte
          </Link>
        ) : undefined
      }
    />
  );
  if (cargas.isPending)
    return (
      <>
        {encabezado}
        <Cargando>Leyendo el historial…</Cargando>
      </>
    );
  if (cargas.isError)
    return (
      <>
        {encabezado}
        <Veredicto
          tipo="critico"
          titulo="No se pudo leer el historial"
          acciones={
            <button type="button" className={BOTON_CHICO} onClick={() => void cargas.refetch()}>
              Reintentar
            </button>
          }
        >
          <p>{mensajeDeError(cargas.error)}</p>
        </Veredicto>
      </>
    );
  if (!cargas.data.length)
    return (
      <>
        {encabezado}
        <TarjetaVacia titulo="Todavía no hay cargas de sus estaciones">
          Aparecen aquí cuando el servicio ETL procesa un reporte: el que se sube en Integraciones, el que deja la carpeta vigilada o el del panel del
          ETL.
        </TarjetaVacia>
      </>
    );

  const columnas: Columna<CargaEtl>[] = [
    {
      titulo: 'Carga',
      valor: (c) => (
        <button
          type="button"
          onClick={() => setElegida(c.cargaId)}
          aria-pressed={elegida === c.cargaId}
          aria-label={`Ver el detalle de la carga ${c.cargaId}`}
          className="inline-flex items-center gap-1 font-semibold text-brand-600 tabular-nums hover:underline dark:text-brand-300"
        >
          {c.cargaId}
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      ),
    },
    {
      titulo: 'Resultado',
      valor: (c) => {
        const e = ESTADO[c.estado] ?? { texto: c.estado, tono: 'gray' as const };
        return <Insignia tono={e.tono}>{e.texto}</Insignia>;
      },
    },
    { titulo: 'Cuadre', valor: (c) => <Cuadre c={c} /> },
    { titulo: 'Cuándo', valor: (c) => <span className="whitespace-nowrap">{instante(c.iniciadoEn)}</span> },
    { titulo: 'Reporte', valor: (c) => NOMBRE_REPORTE[c.tipoReporte] ?? c.tipoReporte },
    {
      titulo: 'Archivo',
      valor: (c) => (
        <span className="block max-w-[16rem] truncate" title={c.archivo}>
          {c.archivo}
        </span>
      ),
    },
    { titulo: 'Estación', valor: (c) => c.estaciones ?? '–' },
    { titulo: 'Usuario', valor: (c) => c.usuario ?? '–' },
    {
      titulo: 'Periodo',
      valor: (c) => (c.fechaMin ? <span className="whitespace-nowrap">{`${fechaReporte(c.fechaMin)} al ${fechaReporte(c.fechaMax)}`}</span> : '–'),
    },
    { titulo: 'Turnos', valor: (c) => (c.turnoMin ? `${c.turnoMin} a ${c.turnoMax}` : '–') },
    { titulo: 'Filas', valor: (c) => fmt.entero(c.filas), der: true },
    { titulo: 'Nuevos', valor: (c) => fmt.entero(c.insertadas), der: true },
    { titulo: 'Actualizados', valor: (c) => fmt.entero(c.actualizadas), der: true },
    { titulo: 'Sin cambio', valor: (c) => fmt.entero(c.sinCambio), der: true },
    { titulo: 'Errores', valor: (c) => fmt.entero(c.errores), der: true },
    { titulo: 'Advertencias', valor: (c) => fmt.entero(c.advertencias), der: true },
  ];
  const carga = cargas.data.find((c) => c.cargaId === elegida) ?? null;

  return (
    <>
      {encabezado}
      <div className="space-y-4">
        <section className={cn(TARJETA, 'p-[10px]')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[12px] font-bold leading-[1.25] text-tinta">Cargas del ETL</h2>
              <p className="mt-px text-[11px] leading-[1.35] text-tenue">
                {plural(filas.length, 'carga', 'cargas')} · las últimas 200 de sus estaciones. Elige una para ver su detalle.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmentado etiqueta="Resultado" opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />
              <button
                type="button"
                className={BOTON_CHICO}
                disabled={cargas.isFetching}
                onClick={() => void cliente.invalidateQueries({ queryKey: ['operacion', 'cargas'] })}
              >
                Actualizar
              </button>
            </div>
          </div>
          <TablaDatos columnas={columnas} filas={filas} vacio="Ninguna carga con ese resultado." clave={(c) => c.cargaId} />
        </section>
        {carga && <Detalle carga={carga} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function Detalle({ carga: c }: { carga: CargaEtl }) {
  const d = useDetalleCarga(c.cargaId);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    ref.current?.querySelector('h3')?.focus({ preventScroll: true });
  }, [c.cargaId]);
  const compras = c.tipoReporte === 'COMPRAS';
  const conteo = [
    NOMBRE_REPORTE[c.tipoReporte] ?? c.tipoReporte,
    c.turnoMin ? `Turnos ${c.turnoMin} a ${c.turnoMax}` : null,
    c.filas === null
      ? null
      : compras
        ? `${plural(c.filas, 'compra', 'compras')}: ${plural(c.insertadas ?? 0, 'nueva', 'nuevas')}, ${plural(c.actualizadas ?? 0, 'actualizada', 'actualizadas')}, ${fmt.entero(c.sinCambio)} sin cambio`
        : `${plural(c.filas, 'ticket', 'tickets')}: ${plural(c.insertadas ?? 0, 'nuevo', 'nuevos')}, ${plural(c.actualizadas ?? 0, 'actualizado', 'actualizados')}, ${fmt.entero(c.sinCambio)} sin cambio`,
    `${plural(c.errores, 'error', 'errores')}, ${plural(c.advertencias, 'advertencia', 'advertencias')}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const MEDIDAS: Record<string, string> = {
    cantidad: compras ? 'Cantidad' : 'Galones',
    iva: 'IVA',
    idp: 'IDP',
    descuento: 'Descuento',
    total: 'Total',
    total_neto: 'Total neto',
    costo_total: 'Costo',
    utilidad: 'Utilidad',
    fob_total: 'Costo FOB',
    cif_total: 'CIF',
  };
  const e = ESTADO[c.estado] ?? { texto: c.estado, tono: 'gray' as const };
  type FilaCuadre = DetalleCarga['cuadre'][number];
  const columnasCuadre: Columna<FilaCuadre>[] = [
    { titulo: 'Grupo', valor: (q) => q.grupo },
    { titulo: 'Medida', valor: (q) => MEDIDAS[q.medida] ?? q.medida },
    { titulo: compras ? 'Suma compras' : 'Suma tickets', valor: (q) => fmt.numero(q.suma, 2), der: true },
    { titulo: 'Reporte', valor: (q) => fmt.numero(q.reporte, 2), der: true },
    { titulo: '', valor: (q) => (q.cuadra ? <Estado tipo="bueno">Cuadra</Estado> : <Estado tipo="critico">No cuadra</Estado>) },
  ];
  type FilaCambio = DetalleCarga['cambios'][number];
  const columnasCambios: Columna<FilaCambio>[] = [
    { titulo: 'Entidad', valor: (x) => ({ TICKET: 'Ticket', CLIENTE: 'Cliente', COMPRA: 'Compra' })[x.entidad] ?? x.entidad },
    { titulo: 'Campo', valor: (x) => x.campo },
    { titulo: 'Cantidad', valor: (x) => fmt.entero(x.cantidad), der: true },
  ];

  return (
    <section ref={ref} className={cn(TARJETA, 'scroll-mt-20 p-[10px]')}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 tabIndex={-1} className="text-[13px] font-semibold tracking-tight text-slate-900 focus:outline-none dark:text-white">
            Carga {c.cargaId}: {c.archivo}
          </h3>
          <p className="mt-px text-[11px] leading-[1.35] text-tenue">
            {instante(c.iniciadoEn)} · {c.usuario ?? 'sin usuario'}
            {c.segundos !== null ? ` · ${fmt.numero(c.segundos, 1)} s` : ''}
          </p>
          <p className="mt-px text-[11px] leading-[1.35] text-tenue">{conteo}</p>
        </div>
        <Insignia tono={e.tono}>{e.texto}</Insignia>
      </div>
      {c.mensaje && <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">{c.mensaje}</p>}
      {d.isPending ? (
        <Cargando>Leyendo la carga {c.cargaId}…</Cargando>
      ) : d.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">{mensajeDeError(d.error)}</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Revisión de calidad</h4>
            {d.data.incidencias.length ? (
              <ul className="space-y-1.5">
                {d.data.incidencias.map((g) => {
                  const s = SEVERIDAD[g.severidad] ?? { tipo: 'info' as const, texto: g.severidad };
                  return (
                    <li key={`${g.severidad}-${g.regla}`} className="rounded-lg border border-slate-200 dark:border-slate-800">
                      <details>
                        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                          <Estado tipo={s.tipo}>{s.texto}</Estado>
                          <span>{nombreRegla(g.regla)}</span>
                          <span className="ml-auto font-semibold tabular-nums">{fmt.entero(g.cantidad)}</span>
                        </summary>
                        <ul className="list-disc space-y-1 border-t border-slate-100 py-2 pr-3 pl-8 text-[12px] text-slate-600 dark:border-slate-800 dark:text-slate-400">
                          {g.ejemplos.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                          {g.cantidad > g.ejemplos.length && <li className="text-slate-400">… y {fmt.entero(g.cantidad - g.ejemplos.length)} más</li>}
                        </ul>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm">
                <Estado tipo="bueno">Sin observaciones</Estado>
              </p>
            )}
            {d.data.cambios.length > 0 && (
              <>
                <h4 className="mt-4 mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Qué cambió en {compras ? 'compras' : 'tickets'} que ya estaban</h4>
                <TablaDatos columnas={columnasCambios} filas={d.data.cambios} clave={(x) => `${x.entidad}-${x.campo}`} />
              </>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Cuadre contra el reporte</h4>
            {d.data.cuadre.length ? (
              <>
                <p className="mb-2 text-sm">
                  {d.data.cuadre.every((q) => q.cuadra) ? (
                    <Estado tipo="bueno">{`Todo cuadra (${plural(d.data.cuadre.length, 'comparación', 'comparaciones')})`}</Estado>
                  ) : (
                    <Estado tipo="critico">{`${d.data.cuadre.filter((q) => !q.cuadra).length} comparaciones no cuadran`}</Estado>
                  )}
                </p>
                <TablaDatos columnas={columnasCuadre} filas={d.data.cuadre} clave={(q) => `${q.grupo}-${q.medida}`} />
              </>
            ) : (
              <p className="text-[11px] text-tenue">Esta carga no llegó a cuadrarse (el archivo se rechazó antes o era repetido).</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
