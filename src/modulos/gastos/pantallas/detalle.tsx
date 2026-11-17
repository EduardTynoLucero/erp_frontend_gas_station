'use client';

/**
 * Detalle del gasto (/gastos/:id). Los botones salen del objeto `acciones` que calcula el backend con las mismas
 * reglas con que valida: se muestran según el estado y el rol, y se habilitan solo si `ok`; si no, el motivo
 * aparece en un tooltip. Tras cada acción la caché se actualiza con la respuesta y los botones cambian enseguida.
 * «Editar» abre el modal del borrador sobre esta misma pantalla. El comprobante de un gasto ya enviado (documento,
 * foto o PDF y verificación) y el reparto del prorrateo también están aquí.
 */
import { ArrowLeft, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import type { GastoDetalle } from '@/api/tipos';
import { useErp, useTienePantalla, useTienePermiso } from '@/componentes/marco/contexto';
import { Aviso, Esqueleto } from '@/componentes/ui/aviso';
import { Boton, BotonAccion } from '@/componentes/ui/boton';
import { Insignia, InsigniaEstado } from '@/componentes/ui/insignia';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, fechaHora, pct, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { DialogoComprobante } from '../componentes/dialogo-comprobante';
import { DialogoDecision, DialogoEliminar, DialogoPago } from '../componentes/dialogos';
import { ModalGasto } from '../componentes/modal-gasto';
import { urlAdjunto, useAccionGasto, useCatalogos, useGasto } from '../datos';
import { montoDe, nombreProveedor, ORIGEN_LARGO, TIPO_DOCUMENTO } from '../etiquetas';

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-[2px]">
      <dt className="text-[11px] font-semibold leading-[1.25] text-tenue">{termino}</dt>
      <dd className="font-semibold leading-[1.35] text-tinta">{children}</dd>
    </div>
  );
}

function Paso({ titulo, estado, children }: { titulo: string; estado: 'completo' | 'pendiente' | 'error'; children: React.ReactNode }) {
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[17.5px] top-[3px] size-[9px] rounded-full ring-2 ring-superficie',
          estado === 'error' ? 'bg-red-500' : estado === 'completo' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
        )}
      />
      <div className="font-bold text-tinta">{titulo}</div>
      <div className="text-tinta-suave">{children}</div>
    </li>
  );
}

function Acciones({ g, hoy, alEditar }: { g: GastoDetalle; hoy: string; alEditar: () => void }) {
  const router = useRouter();
  const accion = useAccionGasto();
  const autoriza = useTienePermiso('aprobar');
  const paga = useTienePermiso('pagar');
  const [decision, setDecision] = useState<'aprobar' | 'rechazar' | null>(null);
  const [pagando, setPagando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const veRegistro = useTienePantalla('gastos');

  async function ejecutar(tipo: 'enviar' | 'reabrir') {
    try {
      const r = await accion.mutateAsync({ tipo, id: g.id });
      toast.success(r.mensaje);
      if (tipo === 'reabrir') alEditar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <>
      {g.estado === 'borrador' && (
        <>
          <BotonAccion verificacion={g.acciones.eliminar} variante="ghost" onClick={() => setEliminando(true)}>
            Eliminar
          </BotonAccion>
          <BotonAccion verificacion={g.acciones.editar} variante="secondary" onClick={alEditar}>
            Editar
          </BotonAccion>
          <BotonAccion verificacion={g.acciones.enviar} onClick={() => void ejecutar('enviar')} cargando={accion.isPending}>
            Enviar a autorización
          </BotonAccion>
        </>
      )}
      {g.estado === 'rechazado' && (
        <BotonAccion verificacion={g.acciones.reabrir} onClick={() => void ejecutar('reabrir')} cargando={accion.isPending}>
          Corregir y volver a enviar
        </BotonAccion>
      )}
      {g.estado === 'pendiente' && autoriza && (
        <>
          <BotonAccion verificacion={g.acciones.rechazar} variante="danger" onClick={() => setDecision('rechazar')}>
            Rechazar
          </BotonAccion>
          <BotonAccion verificacion={g.acciones.aprobar} variante="success" onClick={() => setDecision('aprobar')}>
            Aprobar
          </BotonAccion>
        </>
      )}
      {g.estado === 'aprobado' && !g.esAjusteContable && paga && (
        <BotonAccion verificacion={g.acciones.pagar} onClick={() => setPagando(true)}>
          Registrar pago
        </BotonAccion>
      )}

      <DialogoDecision gasto={g} decision={decision} alCerrar={() => setDecision(null)} />
      {pagando && <DialogoPago gasto={g} abierto hoy={hoy} alCerrar={() => setPagando(false)} />}
      <DialogoEliminar
        gasto={g}
        abierto={eliminando}
        alCerrar={() => setEliminando(false)}
        alEliminar={() => router.replace(veRegistro ? '/gastos' : '/mis-solicitudes')}
      />
    </>
  );
}

const esImagen = (tipoMime: string) => tipoMime.startsWith('image/') && tipoMime !== 'image/heic';

/**
 * Comprobante del gasto: el documento, su foto o PDF y la verificación de Contabilidad. Después de enviado el gasto se
 * registra o se corrige desde aquí (en un borrador, al editarlo).
 */
function Comprobante({ g, hoy, comprobanteDesde }: { g: GastoDetalle; hoy: string; comprobanteDesde: string }) {
  const accion = useAccionGasto();
  const [editando, setEditando] = useState(false);
  const doc = g.documento;
  const sinDocumento = doc.tipo === 'Sin documento';

  async function verificar() {
    try {
      toast.success((await accion.mutateAsync({ tipo: 'verificar', id: g.id })).mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <Tarjeta
      titulo="Comprobante"
      acciones={
        g.acciones.comprobante.ok && (
          <Boton tamano="sm" variante="secondary" onClick={() => setEditando(true)}>
            {sinDocumento ? 'Adjuntar comprobante' : 'Cambiar'}
          </Boton>
        )
      }
    >
      {sinDocumento ? (
        g.faltaComprobante ? (
          <Aviso tono="red">Falta el comprobante. Es obligatorio desde {q(comprobanteDesde)}.</Aviso>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No requiere comprobante.</p>
        )
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-tinta">
              {TIPO_DOCUMENTO[doc.tipo]} {doc.serie ? `${doc.serie} – ` : ''}
              {doc.numero}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Emitida el {fecha(doc.fechaEmision)}</div>
          </div>
          {doc.tipo === 'FEL' &&
            (doc.verificado ? (
              <span className="text-right">
                <Insignia tono="green">Verificada</Insignia>
                {doc.verificadoPor && (
                  <span className="mt-[2px] block text-[11px] text-tenue">
                    {doc.verificadoPor.nombre} · {fechaHora(doc.verificadoEn)}
                  </span>
                )}
              </span>
            ) : g.acciones.verificar.ok ? (
              <Boton tamano="sm" variante="secondary" onClick={() => void verificar()} cargando={accion.isPending}>
                Marcar como verificada
              </Boton>
            ) : (
              <Insignia>Sin verificar</Insignia>
            ))}
        </div>
      )}

      {doc.adjunto && (
        <div className="mt-[8px] flex flex-wrap items-center gap-[10px] rounded-[2px] border border-borde-suave p-[6px]">
          {esImagen(doc.adjunto.tipoMime) && (
            // El archivo lo sirve el backend con la sesión del usuario: no es una imagen estática que Next.js pueda optimizar
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlAdjunto(doc.adjunto.id)} alt="Comprobante adjunto" className="size-[64px] rounded-[2px] border border-borde-suave object-cover" />
          )}
          <div className="min-w-0 text-[12px]">
            <p className="flex items-center gap-[5px] truncate text-tinta">
              <Paperclip className="size-[12px] shrink-0 text-tenue" aria-hidden />
              <span className="truncate">{doc.adjunto.nombre}</span>
            </p>
            <a href={urlAdjunto(doc.adjunto.id)} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-primario-tinta hover:underline">
              Abrir archivo
            </a>
            <span className="ml-[6px] text-[11px] text-tenue">{(doc.adjunto.bytes / 1024).toFixed(0)} KB</span>
          </div>
        </div>
      )}

      <DialogoComprobante gasto={g} abierto={editando} hoy={hoy} alCerrar={() => setEditando(false)} />
    </Tarjeta>
  );
}

function AvisoEstado({ g }: { g: GastoDetalle }) {
  const autoriza = useTienePermiso('aprobar');
  const paga = useTienePermiso('pagar');
  if (g.estado === 'pendiente') {
    if (autoriza && !g.acciones.aprobar.ok) return <Aviso tono="amber">{g.acciones.aprobar.motivo}</Aviso>;
    if (!autoriza) return <Aviso>Pendiente de autorización: {g.nivelRequerido}.</Aviso>;
  }
  if (g.estado === 'aprobado' && !g.esAjusteContable) {
    if (paga && !g.acciones.pagar.ok) return <Aviso tono="amber">{g.acciones.pagar.motivo}</Aviso>;
    if (!paga) {
      return <Aviso>Aprobado. El pago lo registra Tesorería{g.faltaComprobante ? ' cuando se adjunte el comprobante' : ''}.</Aviso>;
    }
  }
  if (g.estado === 'borrador') return <Aviso>Borrador: aún no entra a autorización.</Aviso>;
  return null;
}

export function PantallaDetalleGasto({ id, editar = false }: { id: string; editar?: boolean }) {
  const router = useRouter();
  const { perfil } = useErp();
  const [editando, setEditando] = useState(editar);
  const cerrarEdicion = () => {
    setEditando(false);
    // Si se llegó por /gastos/:id?editar=1, la dirección vuelve a ser la del detalle
    if (editar) router.replace(`/gastos/${id}`);
  };
  const consulta = useGasto(id);
  const catalogos = useCatalogos();
  const veRegistro = perfil.acceso.pantallas.some((p) => p.codigo === 'gastos');
  const regreso = veRegistro ? { href: '/gastos', texto: 'Registro de gastos' } : { href: '/mis-solicitudes', texto: 'Mis solicitudes' };

  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.estado === 404;
    return (
      <>
        <EncabezadoPagina titulo="Gasto no disponible" />
        <Aviso tono={noExiste ? 'amber' : 'red'}>
          {noExiste ? 'No existe o su usuario no tiene acceso a ese gasto. ' : `${mensajeDeError(consulta.error)} `}
          <Link href={regreso.href} className="font-medium underline">
            Volver
          </Link>
        </Aviso>
      </>
    );
  }
  const g = consulta.data;
  if (!g) {
    return (
      <div className="space-y-[6px]">
        <Esqueleto className="h-[34px] w-full" />
        <Esqueleto className="h-[220px] w-full" />
      </div>
    );
  }

  const hoy = catalogos.data?.parametros.hoy ?? g.fecha;
  const cuenta = catalogos.data?.categorias.find((c) => c.id === g.categoria.id)?.cuentaContable;
  const extranjera = g.moneda.codigo !== 'GTQ';
  const rechazado = g.estado === 'rechazado';

  return (
    <>
      <Link href={regreso.href} className="mb-[5px] inline-flex items-center gap-[4px] text-[11px] font-semibold text-primario-tinta hover:underline">
        <ArrowLeft className="size-[12px]" /> {regreso.texto}
      </Link>
      <EncabezadoPagina
        titulo={`${g.folio} · ${montoDe(g)}`}
        descripcion={g.descripcion}
        acciones={<Acciones g={g} hoy={hoy} alEditar={() => setEditando(true)} />}
      />
      <AvisoEstado g={g} />

      <div className="mt-[6px] grid gap-[6px] lg:grid-cols-3">
        <div className="space-y-[6px] lg:col-span-2">
          <Tarjeta titulo="Datos del gasto" acciones={<InsigniaEstado estado={g.estado} />}>
            <dl className="grid gap-x-[16px] gap-y-[8px] text-[12px] sm:grid-cols-2 xl:grid-cols-3">
              <Dato termino="Fecha">{fecha(g.fecha)}</Dato>
              <Dato termino="Estación">
                {g.estacion.codigo} · {g.estacion.nombre}
              </Dato>
              <Dato termino="Centro de costo">{g.centroCosto.nombre}</Dato>
              <Dato termino="Categoría">
                {g.categoria.nombre}
                {g.subcategoria ? ` · ${g.subcategoria}` : ''}
                {cuenta && <span className="block text-xs text-slate-500 dark:text-slate-400">Cuenta contable {cuenta}</span>}
              </Dato>
              <Dato termino="Proveedor">
                {nombreProveedor(g.proveedor)}
                {g.proveedor && <span className="block text-xs text-slate-500 dark:text-slate-400">NIT {g.proveedor.nit}</span>}
              </Dato>
              <Dato termino="Forma de pago">{g.metodoPago}</Dato>
              <Dato termino="Monto">
                <span className="tabular-nums">{montoDe(g)}</span>
                {Number(g.iva) > 0 && <span className="block text-xs text-slate-500 dark:text-slate-400">IVA incluido {q(g.iva, g.moneda.simbolo)}</span>}
                {extranjera && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Tipo de cambio {g.tipoCambio} · equivale a {q(g.montoFuncional)}
                  </span>
                )}
              </Dato>
              <Dato termino="Vencimiento">{g.esAjusteContable ? 'No aplica' : fecha(g.vencimiento)}</Dato>
              <Dato termino="Origen">{ORIGEN_LARGO[g.origen]}</Dato>
              <Dato termino="Referencia">{g.referencia ?? '—'}</Dato>
              <Dato termino="Solicitado por">{g.solicitante.nombre}</Dato>
              <Dato termino="Nivel que autoriza">{g.nivelRequerido ?? '—'}</Dato>
            </dl>
            {g.origen === 'reporte' && (
              <Aviso tono="amber" className="mt-4">
                Este registro sale del análisis de los reportes del sistema de la estación. Es un ajuste contable sin factura: su soporte es el reporte indicado en la
                referencia.
              </Aviso>
            )}
          </Tarjeta>

          <Comprobante g={g} hoy={hoy} comprobanteDesde={catalogos.data?.parametros.comprobanteObligatorioDesde ?? '100'} />

          {g.distribucion.length > 0 && (
            <Tarjeta titulo="Distribución entre estaciones (prorrateo)" subtitulo="Cómo se repartió este gasto de la oficina central">
              <ul className="space-y-[4px] text-[12px]">
                {g.distribucion.map((d) => (
                  <li key={d.estacion.id} className="flex justify-between gap-3">
                    <span className="text-tinta-suave">
                      <b className="font-semibold text-tinta">{d.estacion.codigo}</b> · {d.estacion.nombre} · {pct(d.pct)}
                    </span>
                    <span className="font-semibold tabular-nums text-tinta">{q(d.monto)}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>

        <div className="space-y-[6px]">
          <Tarjeta titulo="Flujo del gasto">
            <ol className="relative ml-[4px] space-y-[9px] border-l border-borde pl-[12px] text-[12px]">
              <Paso titulo="Solicitado" estado="completo">
                {g.solicitante.nombre} · {fecha(g.fecha)}
              </Paso>
              <Paso titulo={rechazado ? 'Rechazado' : 'Autorización'} estado={rechazado ? 'error' : g.aprobaciones.length > 0 ? 'completo' : 'pendiente'}>
                {g.aprobaciones.length > 0 ? (
                  g.aprobaciones.map((a) => (
                    <span key={a.id} className="block">
                      {a.usuario.nombre} · {fecha(a.fecha)} · {a.accion}
                      {a.comentario && <span className="block text-xs italic text-slate-500 dark:text-slate-400">“{a.comentario}”</span>}
                    </span>
                  ))
                ) : (
                  <>
                    Requiere: {g.nivelRequerido ?? '—'}
                    {g.estado === 'pendiente' && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Pueden autorizar: {g.autorizadores.join(', ') || 'nadie con los permisos actuales'}
                      </span>
                    )}
                  </>
                )}
              </Paso>
              <Paso titulo={g.esAjusteContable ? 'Registro contable' : 'Pago'} estado={g.pago ? 'completo' : 'pendiente'}>
                {g.pago
                  ? `${g.pago.metodo} ${g.pago.referencia} · ${fecha(g.pago.fecha)} · ${g.pago.usuario.nombre}`
                  : g.esAjusteContable
                    ? 'No genera pago; se registra como gasto al aprobarse'
                    : g.estado === 'aprobado'
                      ? `Pendiente, vence ${fecha(g.vencimiento)}`
                      : 'Pendiente'}
              </Paso>
            </ol>
          </Tarjeta>

          <Tarjeta titulo="Historial" subtitulo="Bitácora de auditoría de este folio">
            <ul className="space-y-[7px] text-[12px]">
              {g.historial.map((h) => (
                <li key={h.id} title={h.detalle}>
                  <div className="text-tinta-suave">
                    <b className="font-semibold text-tinta">{h.usuario}</b> · {h.accion.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{fechaHora(h.ocurridoEn)}</div>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </div>

      <ModalGasto
        abierto={editando}
        alCerrar={cerrarEdicion}
        gastoId={g.id}
        alGuardado={(_, mensaje) => {
          cerrarEdicion();
          toast.success(mensaje);
        }}
      />
    </>
  );
}
