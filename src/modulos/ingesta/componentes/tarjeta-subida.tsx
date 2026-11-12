'use client';

/**
 * Una subida: el archivo, en qué paso va (subido → revisado por el ETL → cargado), su vista previa (lo que trae, si
 * cuadra con el reporte y sus incidencias), la comparación con lo que ya está en la base («Qué pasará en la base» y,
 * en el detalle, fila por fila) y el resultado de la carga. Es la vista previa del panel del ETL.
 */
import { AlertTriangle, CheckCircle2, ChevronDown, CircleX, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import type { SubidaIngesta } from '@/api/tipos';
import { useTienePantalla } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla } from '@/componentes/ui/aviso';
import { BotonAccion } from '@/componentes/ui/boton';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { fechaHora, num, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { ordenarProductos } from '@/modulos/dashboards/productos';
import { enCurso, useAccionSubida, useSubida } from '../datos';
import { comoResultado, comoVistaPrevia, fechaReporte, NOMBRE_REPORTE, tamano, type VistaPreviaEtl } from '../etl';
import { ComparacionConLaBase } from './comparacion-base';
import { TablaComprasPrevia, TablaTicketsPrevia } from './tabla-previa';

type Paso = 'hecho' | 'activo' | 'error' | 'pendiente';

/** Lo que se le dice a la persona sobre la subida, con su color */
export function estadoDeSubida(s: SubidaIngesta, servicioActivo: boolean): { texto: string; tono: Tono; girando?: boolean } {
  const c = s.carga;
  if (c) {
    if (c.estado === 'PENDIENTE') return { texto: servicioActivo ? 'Carga en cola' : 'Carga en espera del servicio', tono: servicioActivo ? 'blue' : 'amber', girando: servicioActivo };
    if (c.estado === 'EN_PROCESO') return { texto: 'Cargando…', tono: 'blue', girando: true };
    if (c.estado === 'FALLIDA') return { texto: 'La carga falló', tono: 'red' };
    if (c.resultado === 'CARGADO') return { texto: 'Cargado', tono: 'green' };
    if (c.resultado === 'DUPLICADO') return { texto: 'Ya estaba cargado', tono: 'amber' };
    if (c.resultado === 'RECHAZADO') return { texto: 'Rechazado por el ETL', tono: 'red' };
  }
  switch (s.estado) {
    case 'PENDIENTE':
      return { texto: servicioActivo ? 'En cola' : 'En espera del servicio', tono: servicioActivo ? 'blue' : 'amber', girando: servicioActivo };
    case 'EN_PROCESO':
      return { texto: 'Revisando…', tono: 'blue', girando: true };
    case 'COMPLETADA': {
      if (s.resultado !== 'LISTA') return { texto: 'Con errores', tono: 'red' };
      // El archivo está bien, pero la comparación con la base dice que no hay nada que cargar, o no se pudo hacer
      const v = comoVistaPrevia(s.vistaPrevia);
      if (v?.comparacion?.yaCargado) return { texto: 'Archivo repetido', tono: 'amber' };
      if (v && !v.comparacion && v.avisoComparacion) return { texto: 'Sin comparar con la base', tono: 'amber' };
      return { texto: 'Lista para cargar', tono: 'green' };
    }
    case 'FALLIDA':
      return { texto: 'No se pudo revisar', tono: 'red' };
    case 'CANCELADA':
      return { texto: 'Descartada', tono: 'gray' };
    default:
      return { texto: 'Venció', tono: 'gray' };
  }
}

function pasos(s: SubidaIngesta): [Paso, Paso, Paso] {
  const revisado: Paso =
    s.estado === 'COMPLETADA' ? (s.resultado === 'LISTA' ? 'hecho' : 'error') : s.estado === 'FALLIDA' ? 'error' : s.estado === 'PENDIENTE' || s.estado === 'EN_PROCESO' ? 'activo' : 'pendiente';
  const c = s.carga;
  const cargado: Paso = !c
    ? 'pendiente'
    : c.estado === 'PENDIENTE' || c.estado === 'EN_PROCESO'
      ? 'activo'
      : c.estado === 'COMPLETADA' && (c.resultado === 'CARGADO' || c.resultado === 'DUPLICADO')
        ? 'hecho'
        : 'error';
  return ['hecho', revisado, cargado];
}

function Pasos({ s }: { s: SubidaIngesta }) {
  const estados = pasos(s);
  const nombres = ['Subido', 'Revisado por el ETL', 'Cargado'];
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Avance">
      {estados.map((e, i) => (
        <li key={nombres[i]} className="flex min-w-0 items-center gap-2">
          {i > 0 && <span aria-hidden className={cn('h-px w-5 sm:w-8', estados[i - 1] === 'hecho' ? 'bg-emerald-400 dark:bg-emerald-500/60' : 'bg-slate-200 dark:bg-slate-700')} />}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap',
              e === 'hecho' && 'text-emerald-700 dark:text-emerald-400',
              e === 'activo' && 'font-medium text-brand-700 dark:text-brand-300',
              e === 'error' && 'font-medium text-red-700 dark:text-red-400',
              e === 'pendiente' && 'text-slate-400 dark:text-slate-500',
            )}
          >
            {e === 'hecho' ? (
              <CheckCircle2 className="size-3.5" aria-hidden />
            ) : e === 'activo' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : e === 'error' ? (
              <CircleX className="size-3.5" aria-hidden />
            ) : (
              <span aria-hidden className="size-3.5 rounded-full border border-current" />
            )}
            {nombres[i]}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Dato({ etiqueta, valor, pista }: { etiqueta: string; valor: string; pista?: string | undefined }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{etiqueta}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{valor}</div>
      {pista && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{pista}</div>}
    </div>
  );
}

function Revision({ ok, aviso, children }: { ok: boolean; aviso?: boolean; children: ReactNode }) {
  const Icono = ok ? CheckCircle2 : aviso ? AlertTriangle : CircleX;
  return (
    <li className="flex items-start gap-2">
      <Icono
        aria-hidden
        className={cn('mt-0.5 size-4 shrink-0', ok ? 'text-emerald-600 dark:text-emerald-400' : aviso ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}
      />
      <span>{children}</span>
    </li>
  );
}

function ResumenVistaPrevia({ v }: { v: VistaPreviaEtl }) {
  const r = v.resumen;
  const esCompras = v.tipo === 'COMPRAS';
  const malos = v.cuadre.filter((f) => !f.cuadra).length;
  const { ERROR: errores, ADVERTENCIA: advertencias, INFO: informativas } = v.conteoIncidencias;
  const estaciones = r.estaciones.length ? r.estaciones.join(', ') : v.estacionUsada ? v.estacionUsada.split(' - ')[0]! : '—';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Dato etiqueta={esCompras ? 'Líneas de compra' : 'Tickets'} valor={num(esCompras ? (r.lineas ?? 0) : (r.tickets ?? 0))} pista={NOMBRE_REPORTE[v.tipo]} />
        <Dato etiqueta={esCompras ? 'Total comprado' : 'Venta'} valor={q(r.total)} pista={`${num(esCompras ? (r.galones ?? '0') : (r.cantidad ?? '0'), 3)} galones`} />
        <Dato etiqueta="Estación" valor={estaciones} pista={v.traeEstacion ? 'Según el archivo' : 'La elegida al subir'} />
        <Dato
          etiqueta="Periodo"
          valor={`${fechaReporte(r.fechaMin)}`}
          pista={`al ${fechaReporte(r.fechaMax)}${r.turnoMin !== null ? ` · turnos ${r.turnoMin}–${r.turnoMax}` : ''}`}
        />
      </div>
      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
        <Revision ok={malos === 0}>
          {v.cuadre.length === 0
            ? 'El reporte no trae subtotales para cuadrar.'
            : malos === 0
              ? `Cuadra con los totales del propio reporte (${v.cuadre.length} comparaciones).`
              : `${malos} de ${v.cuadre.length} comparaciones contra los totales del reporte no cuadran.`}
        </Revision>
        <Revision ok={errores === 0 && advertencias === 0} aviso={errores === 0}>
          {errores === 0 && advertencias === 0
            ? `Sin errores ni advertencias${informativas ? ` (${num(informativas)} ${informativas === 1 ? 'nota informativa' : 'notas informativas'})` : ''}.`
            : `${num(errores)} ${errores === 1 ? 'error' : 'errores'} y ${num(advertencias)} ${advertencias === 1 ? 'advertencia' : 'advertencias'}${errores ? ': con errores no se puede cargar' : ''}.`}
        </Revision>
      </ul>
    </div>
  );
}

const TONO_SEVERIDAD = { ERROR: 'red', ADVERTENCIA: 'amber', INFO: 'gray' } as const;
const NOMBRE_SEVERIDAD = { ERROR: 'Error', ADVERTENCIA: 'Advertencia', INFO: 'Nota' } as const;

/**
 * Lo que pesa de la vista previa: la comparación con la base fila por fila (tickets o compras), los productos, el
 * cuadre y las incidencias. Se pide al abrir el detalle.
 */
function DetalleVistaPrevia({ s }: { s: SubidaIngesta }) {
  const detalle = useSubida(s.id, true);
  // Cambia cuando el servicio ETL termina de comparar otra vez el archivo o de cargarlo: el detalle se vuelve a pedir
  const version = `${s.terminadaEn ?? ''}|${s.carga?.estado ?? ''}|${s.carga?.resultado ?? ''}`;
  const pedida = useRef(version);
  const { refetch } = detalle;
  useEffect(() => {
    if (pedida.current === version) return;
    pedida.current = version;
    void refetch();
  }, [version, refetch]);

  if (detalle.isPending) return <EsqueletoTabla filas={3} />;
  if (detalle.isError) return <Aviso tono="red">{mensajeDeError(detalle.error)}</Aviso>;
  const v = comoVistaPrevia(detalle.data.vistaPrevia);
  if (!v) return null;
  const productos = v.tipo === 'COMPRAS'
    ? (v.productos ?? []).map((p) => ({ nombre: p.producto, cuenta: `${num(p.lineas)} ${p.lineas === 1 ? 'línea' : 'líneas'}`, galones: p.cantidad ?? 0, total: p.total ?? 0 }))
    : (v.agregados?.productos ?? []).map((p) => ({ nombre: p.producto, cuenta: `${num(p.tickets)} ${p.tickets === 1 ? 'ticket' : 'tickets'}`, galones: p.galones, total: p.total }));
  return (
    <div className="space-y-5 border-t border-slate-100 pt-4 dark:border-slate-800">
      {v.tipo === 'COMPRAS' ? (
        <TablaComprasPrevia v={v} />
      ) : (v.resumen.tickets ?? 0) > 0 ? (
        <TablaTicketsPrevia
          id={s.id}
          version={version}
          productos={ordenarProductos((v.agregados?.productos ?? []).map((p) => p.producto))}
          yaCargado={Boolean(v.comparacion?.yaCargado)}
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Por producto</h4>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {productos.map((p) => (
                <tr key={p.nombre}>
                  <td className="py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-100">{p.nombre}</td>
                  <td className="py-1.5 pr-2 text-slate-500 dark:text-slate-400">{p.cuenta}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{num(p.galones, 3)} gal</td>
                  <td className="py-1.5 text-right font-medium tabular-nums text-slate-900 dark:text-white">{q(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.cuadre.length > 0 && (
            <>
              <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cuadre contra el reporte</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="pb-1 font-medium">Grupo</th>
                    <th className="pb-1 font-medium">Medida</th>
                    <th className="pb-1 text-right font-medium">Tickets</th>
                    <th className="pb-1 text-right font-medium">Reporte</th>
                    <th className="pb-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {v.cuadre.map((f) => (
                    <tr key={`${f.grupo}-${f.medida}`}>
                      <td className="py-1 pr-2 text-slate-700 dark:text-slate-200">{f.grupo}</td>
                      <td className="py-1 pr-2 text-slate-500 dark:text-slate-400">{f.medida}</td>
                      <td className="py-1 pr-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{f.suma}</td>
                      <td className="py-1 pr-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{f.reporte}</td>
                      <td className="py-1 text-right">
                        {f.cuadra ? (
                          <CheckCircle2 className="ml-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="Cuadra" />
                        ) : (
                          <CircleX className="ml-auto size-4 text-red-600 dark:text-red-400" aria-label="No cuadra" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Incidencias</h4>
          {(v.incidencias ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">El ETL no encontró nada que revisar.</p>
          ) : (
            <ul className="space-y-2.5">
              {(v.incidencias ?? []).slice(0, 12).map((g) => (
                <li key={`${g.severidad}-${g.regla}`} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Insignia tono={TONO_SEVERIDAD[g.severidad]}>{NOMBRE_SEVERIDAD[g.severidad]}</Insignia>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{g.regla}</span>
                    <span className="ml-auto text-xs tabular-nums text-slate-500 dark:text-slate-400">{num(g.cantidad)}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 pl-1 text-xs text-slate-600 dark:text-slate-300">
                    {g.ejemplos.slice(0, 3).map((e, i) => (
                      <li key={i} className="truncate" title={e.mensaje}>
                        {e.fila !== null ? <span className="text-slate-400 dark:text-slate-500">Fila {e.fila} · </span> : null}
                        {e.mensaje}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function TarjetaSubida({ s, servicioActivo, abiertaAlInicio }: { s: SubidaIngesta; servicioActivo: boolean; abiertaAlInicio?: boolean }) {
  const [abierta, setAbierta] = useState(abiertaAlInicio ?? false);
  const accion = useAccionSubida();
  const veDashboard = useTienePantalla('dashboard-ventas');
  const estado = estadoDeSubida(s, servicioActivo);
  const vista = comoVistaPrevia(s.vistaPrevia);
  const resultado = comoResultado(s.carga?.resumen);
  const trabajando = enCurso(s);
  // El archivo ya está en la base: la comparación era de antes de cargar, y lo que pasó de verdad lo dice el resultado
  const yaEnLaBase = s.carga?.estado === 'COMPLETADA' && (s.carga.resultado === 'CARGADO' || s.carga.resultado === 'DUPLICADO');
  // Con la vista previa a la vista y el ETL revisándola de nuevo: la base cambió y se está comparando otra vez
  const comparandoOtraVez = vista !== null && (s.estado === 'PENDIENTE' || s.estado === 'EN_PROCESO');

  const ejecutar = async (tipo: 'cargar' | 'descartar') => {
    try {
      await accion.mutateAsync({ id: s.id, accion: tipo });
      toast.success(tipo === 'cargar' ? `${s.archivo}: enviado al servicio ETL para cargarlo.` : `${s.archivo}: descartado.`);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  };

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm transition-colors dark:bg-slate-900',
        trabajando ? 'border-brand-200 dark:border-brand-500/30' : 'border-slate-200 dark:border-slate-800',
      )}
    >
      {trabajando && <div aria-hidden className="h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-950"><div className="h-full w-1/3 animate-barra bg-brand-500" /></div>}
      <div className="flex flex-wrap items-start gap-3 px-4 pt-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
          <FileSpreadsheet className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={s.archivo}>
            {s.archivo}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {tamano(s.bytes)}
            {s.tipoReporte ? ` · ${NOMBRE_REPORTE[s.tipoReporte]}` : ''} · {s.solicitadaPor} · {fechaHora(s.creadaEn)}
          </p>
        </div>
        <Insignia tono={estado.tono} className="gap-1">
          {estado.girando && <Loader2 className="size-3 animate-spin" aria-hidden />}
          {estado.texto}
        </Insignia>
      </div>

      <div className="space-y-3 px-4 py-3">
        <Pasos s={s} />

        {s.estado === 'PENDIENTE' && !servicioActivo && (
          <Aviso tono="amber">
            El servicio ETL no está encendido: el archivo espera en la cola y se revisa en cuanto se encienda (en una terminal, en la carpeta
            etl: <code className="font-mono text-xs">npm run dev</code>).
          </Aviso>
        )}
        {s.estado === 'FALLIDA' && s.error && <Aviso tono="red">{s.error}</Aviso>}
        {vista && <ResumenVistaPrevia v={vista} />}
        {vista && !yaEnLaBase && <ComparacionConLaBase v={vista} comparandoOtraVez={comparandoOtraVez} />}

        {s.carga?.estado === 'FALLIDA' && s.carga.error && <Aviso tono="red">La carga no se pudo hacer: {s.carga.error}</Aviso>}
        {resultado && (
          <div
            className={cn(
              'rounded-lg border px-3 py-2.5 text-sm',
              resultado.estado === 'CARGADO'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                : resultado.estado === 'DUPLICADO'
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
                  : 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
            )}
          >
            <p className="font-medium">
              {resultado.estado === 'CARGADO' ? 'Cargado' : resultado.estado === 'DUPLICADO' ? 'Ya estaba cargado' : 'Rechazado'}
              {resultado.carga_id ? ` · carga ${resultado.carga_id}` : ''} · {num(resultado.segundos, 1)} s
            </p>
            <p className="mt-0.5">{resultado.mensaje}</p>
            {resultado.estadisticas && (
              <p className="mt-1 text-xs opacity-90">
                Estadísticas al día: ANALYZE {resultado.estadisticas.tabla} en {num(resultado.estadisticas.segundos, 2)} s
              </p>
            )}
            {[resultado.aviso, resultado.aviso_estadisticas, resultado.avisoArchivo].filter(Boolean).map((a) => (
              <p key={a} className="mt-1 text-xs opacity-90">
                Aviso: {a}
              </p>
            ))}
            {resultado.estado === 'CARGADO' && s.tipoReporte === 'CONSULTA_TICKETS' && veDashboard && (
              <Link href="/dashboard-ventas" className="mt-1.5 inline-block text-xs font-medium underline underline-offset-2">
                Ver en el Dashboard de ventas →
              </Link>
            )}
          </div>
        )}

        {vista && abierta && <DetalleVistaPrevia s={s} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        {vista ? (
          <button
            type="button"
            onClick={() => setAbierta((a) => !a)}
            aria-expanded={abierta}
            className="inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <ChevronDown aria-hidden className={cn('size-4 transition-transform', abierta ? 'rotate-180' : '')} />
            {abierta ? 'Ocultar detalle' : `Ver ${vista.tipo === 'COMPRAS' ? 'compras' : 'tickets'} comparados con la base, productos, cuadre e incidencias`}
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          {s.acciones.descartar.ok && (
            <BotonAccion verificacion={s.acciones.descartar} variante="ghost" tamano="sm" cargando={accion.isPending && accion.variables?.accion === 'descartar'} onClick={() => ejecutar('descartar')}>
              Descartar
            </BotonAccion>
          )}
          {(s.acciones.cargar.ok || (s.estado === 'COMPLETADA' && !s.carga)) && (
            <BotonAccion
              verificacion={s.acciones.cargar}
              tamano="sm"
              icono={<Upload className="size-3.5" aria-hidden />}
              cargando={accion.isPending && accion.variables?.accion === 'cargar'}
              onClick={() => ejecutar('cargar')}
            >
              Cargar al ETL
            </BotonAccion>
          )}
        </div>
      </div>
    </article>
  );
}
