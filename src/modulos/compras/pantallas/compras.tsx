'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton, BotonAccion } from '@/componentes/ui/boton';
import { AreaTexto, Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import {
  type Compras,
  type EstadoOrden,
  type OrdenCompra,
  useAgregarCotizacion,
  useCancelarCompra,
  useCompras,
  useCrearRequerimiento,
  useEmitirOrden,
  useRecibirCompra,
} from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

const ESTADO: Record<EstadoOrden, [string, Tono]> = {
  requerimiento: ['Requerimiento', 'gray'],
  cotizando: ['Cotizando', 'amber'],
  ordenada: ['Orden emitida', 'blue'],
  recibida: ['Recibida', 'green'],
  cancelada: ['Cancelada', 'red'],
};

const PASOS: EstadoOrden[] = ['requerimiento', 'cotizando', 'ordenada', 'recibida'];

type Dialogo = '' | 'nuevo' | 'cot' | 'recibir';

export function PantallaCompras() {
  const { estacionId } = useErp();
  const consulta = useCompras(estacionId);
  const emitir = useEmitirOrden();
  const cancelar = useCancelarCompra();
  const [sel, setSel] = useState('');
  const [dialogo, setDialogo] = useState<Dialogo>('');
  const d = consulta.data;
  const oc: OrdenCompra | undefined = d ? (d.ordenes.find((o) => o.id === sel) ?? d.ordenes[0]) : undefined;

  async function ejecutar(accion: () => Promise<{ mensaje: string }>) {
    try {
      const r = await accion();
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Compras administrativas"
        descripcion="Requerimiento, cotizaciones, orden de compra y recepción. Al recibir, la factura del proveedor se convierte en un gasto aprobado que pasa a cuentas por pagar."
        acciones={d && d.puedeCrear && d.catalogos.estaciones.length > 0 && <Boton onClick={() => setDialogo('nuevo')}>+ Nuevo requerimiento</Boton>}
      />
      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : consulta.data.ordenes.length === 0 ? (
        <Vacio>
          Todavía no hay compras{estacionId ? ' en esta estación' : ' en las estaciones que puede ver'}. Una compra empieza como requerimiento, recibe
          cotizaciones de proveedores, se autoriza como orden y, al recibirla con su factura, genera el gasto.
          {consulta.data.puedeCrear && consulta.data.catalogos.estaciones.length > 0 ? ' Cree la primera con «+ Nuevo requerimiento».' : ''}
        </Vacio>
      ) : (
        <div className="grid gap-[6px] lg:grid-cols-5">
          <div className="space-y-[6px] lg:col-span-2">
            {consulta.data.total > consulta.data.ordenes.length && (
              <p className="text-[11px] text-tenue">
                Se muestran las {consulta.data.ordenes.length} más recientes de {consulta.data.total}.
              </p>
            )}
            {consulta.data.ordenes.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSel(o.id)}
                className={cn(
                  'w-full rounded-[2px] border bg-superficie px-[10px] py-[7px] text-left',
                  oc?.id === o.id ? 'border-primario ring-1 ring-primario' : 'border-borde hover:border-borde-campo',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-tenue">
                    {o.numero} · {o.estacion.codigo}
                  </span>
                  <Insignia tono={ESTADO[o.estado][1]}>{ESTADO[o.estado][0]}</Insignia>
                </div>
                <p className="mt-[3px] text-[12px] font-medium text-tinta">{o.descripcion}</p>
                <p className="mt-px text-[11px] text-tenue">
                  {fecha(o.fecha)} · {o.monto ? q(o.monto) : `${o.cotizaciones.length} cotizaciones`}
                </p>
              </button>
            ))}
          </div>

          {oc && (
            <Tarjeta
              className="lg:col-span-3"
              titulo={`${oc.numero} · ${oc.descripcion}`}
              subtitulo={`${oc.estacion.nombre} · ${oc.centroCosto.nombre} · ${oc.categoria.nombre} · solicitó ${oc.solicitante.nombre}`}
            >
              <ol className="mb-[10px] grid grid-cols-4 gap-1 text-center text-[11px]">
                {PASOS.map((p, i) => {
                  const hecho = oc.estado !== 'cancelada' && PASOS.indexOf(oc.estado) >= i;
                  return (
                    <li key={p} className={cn('rounded-[2px] px-1 py-[5px]', hecho ? 'bg-primario-suave font-medium text-primario-tinta' : 'bg-fondo text-tenue')}>
                      {ESTADO[p][0]}
                    </li>
                  );
                })}
              </ol>

              {oc.estado === 'cancelada' && (
                <Aviso tono="red" className="mb-[8px]">
                  Compra cancelada.
                </Aviso>
              )}

              <div className="mb-[6px] flex items-center justify-between">
                <p className="text-[12px] font-semibold text-tinta">Cotizaciones</p>
                {(oc.estado === 'requerimiento' || oc.estado === 'cotizando') && (
                  <BotonAccion tamano="sm" variante="secondary" verificacion={oc.acciones.cotizar} onClick={() => setDialogo('cot')}>
                    + Cotización
                  </BotonAccion>
                )}
              </div>
              {oc.cotizaciones.length === 0 ? (
                <Vacio>Aún no hay cotizaciones.</Vacio>
              ) : (
                <ContenedorTabla anchoMinimo={520}>
                  <Cabecera>
                    <th className={th}>Proveedor</th>
                    <th className={thR}>Entrega</th>
                    <th className={thR}>Monto</th>
                    <th className={thR}></th>
                  </Cabecera>
                  <Cuerpo>
                    {oc.cotizaciones.map((k) => (
                      <tr key={k.id} className={k.elegida ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}>
                        <td className={td}>
                          <p>{k.proveedor.nombre}</p>
                          {k.nota && <p className="text-[11px] text-tenue">{k.nota}</p>}
                        </td>
                        <td className={tdR}>{k.diasEntrega} días</td>
                        <td className={tdR}>
                          {q(k.monto)}{' '}
                          {k.esMenor && (
                            <Insignia tono="green" className="ml-1">
                              Menor
                            </Insignia>
                          )}
                        </td>
                        <td className={tdR}>
                          {oc.estado === 'cotizando' ? (
                            k.emitir.ok ? (
                              <Boton tamano="sm" cargando={emitir.isPending} onClick={() => ejecutar(() => emitir.mutateAsync({ id: oc.id, cotizacionId: k.id }))}>
                                Emitir orden
                              </Boton>
                            ) : (
                              <span className="text-[11px] text-tenue" title={k.emitir.motivo}>
                                Autoriza: {k.nivelRequerido}
                              </span>
                            )
                          ) : (
                            k.elegida && <Insignia tono="green">Elegida</Insignia>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Cuerpo>
                </ContenedorTabla>
              )}
              {oc.estado === 'cotizando' && oc.cotizaciones.length < 2 && (
                <Aviso tono="amber" className="mt-[8px]">
                  Política sugerida: pedir al menos dos cotizaciones antes de emitir la orden.
                </Aviso>
              )}

              <div className="mt-[10px] flex flex-wrap items-center justify-end gap-2">
                {oc.estado !== 'recibida' && oc.estado !== 'cancelada' && oc.acciones.cancelar.ok && (
                  <Boton variante="ghost" cargando={cancelar.isPending} onClick={() => ejecutar(() => cancelar.mutateAsync(oc.id))}>
                    Cancelar compra
                  </Boton>
                )}
                {oc.estado === 'ordenada' && (
                  <BotonAccion verificacion={oc.acciones.recibir} onClick={() => setDialogo('recibir')}>
                    Registrar recepción y factura
                  </BotonAccion>
                )}
                {oc.estado === 'recibida' && oc.gasto && (
                  <Link href={`/gastos/${oc.gasto.id}`} className="text-[12px] font-medium text-primario-tinta hover:underline">
                    Ver gasto generado ({oc.gasto.folio}) →
                  </Link>
                )}
              </div>
              {oc.fechaOrden && (
                <p className="mt-[8px] text-[11px] text-tenue">
                  Orden emitida el {fecha(oc.fechaOrden)}
                  {oc.aprobador && ` por ${oc.aprobador.nombre}`}
                  {oc.fechaRecepcion && ` · recibida el ${fecha(oc.fechaRecepcion)}`}
                </p>
              )}
            </Tarjeta>
          )}
        </div>
      )}

      {dialogo === 'nuevo' && d && <DialogoRequerimiento datos={d} estacionFiltro={estacionId} alCerrar={() => setDialogo('')} alCrear={(id) => setSel(id)} />}
      {dialogo === 'cot' && d && oc && <DialogoCotizacion datos={d} oc={oc} alCerrar={() => setDialogo('')} />}
      {dialogo === 'recibir' && oc && <DialogoRecepcion oc={oc} alCerrar={() => setDialogo('')} />}
    </div>
  );
}

function centroDe(datos: Compras, estacionId: string) {
  const cs = datos.catalogos.centrosCosto.filter((x) => x.estacionId === estacionId);
  return (cs.find((x) => x.unidadCodigo === 'ADMIN') ?? cs[0])?.id ?? '';
}

function DialogoRequerimiento({
  datos,
  estacionFiltro,
  alCerrar,
  alCrear,
}: {
  datos: Compras;
  estacionFiltro: string | undefined;
  alCerrar: () => void;
  alCrear: (id: string) => void;
}) {
  const crear = useCrearRequerimiento();
  const e = crear.error;
  const inicial = datos.catalogos.estaciones.find((x) => x.id === estacionFiltro)?.id ?? datos.catalogos.estaciones[0]?.id ?? '';
  const [req, setReq] = useState({
    estacionId: inicial,
    centroCostoId: centroDe(datos, inicial),
    categoriaId: datos.catalogos.categorias[0]?.id ?? '',
    descripcion: '',
  });
  async function confirmar() {
    try {
      const r = await crear.mutateAsync({ ...req, descripcion: req.descripcion.trim() });
      toast.success(r.mensaje);
      alCrear(r.data.id);
      alCerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Nuevo requerimiento de compra"
      pie={
        <>
          <Boton variante="ghost" onClick={alCerrar} disabled={crear.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={crear.isPending}>
            Crear
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Estación" htmlFor="oc-est" error={errorDe(e, 'estacionId')}>
          <Seleccion id="oc-est" value={req.estacionId} onChange={(ev) => setReq({ ...req, estacionId: ev.target.value, centroCostoId: centroDe(datos, ev.target.value) })}>
            {datos.catalogos.estaciones.map((x) => (
              <option key={x.id} value={x.id}>
                {x.codigo} · {x.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="oc-cat" error={errorDe(e, 'categoriaId')}>
          <Seleccion id="oc-cat" value={req.categoriaId} onChange={(ev) => setReq({ ...req, categoriaId: ev.target.value })}>
            {datos.catalogos.categorias.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Centro de costo" className="sm:col-span-2" htmlFor="oc-cc" error={errorDe(e, 'centroCostoId')}>
          <Seleccion id="oc-cc" value={req.centroCostoId} onChange={(ev) => setReq({ ...req, centroCostoId: ev.target.value })}>
            {datos.catalogos.centrosCosto
              .filter((x) => x.estacionId === req.estacionId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="¿Qué se necesita?" className="sm:col-span-2" htmlFor="oc-desc" error={errorDe(e, 'descripcion')}>
          <AreaTexto id="oc-desc" rows={3} value={req.descripcion} onChange={(ev) => setReq({ ...req, descripcion: ev.target.value })} />
        </Campo>
      </div>
    </Modal>
  );
}

function DialogoCotizacion({ datos, oc, alCerrar }: { datos: Compras; oc: OrdenCompra; alCerrar: () => void }) {
  const agregar = useAgregarCotizacion();
  const e = agregar.error;
  const [cot, setCot] = useState({ proveedorId: '', monto: '', diasEntrega: '5', nota: '' });
  async function confirmar() {
    try {
      const r = await agregar.mutateAsync({
        id: oc.id,
        cuerpo: { proveedorId: cot.proveedorId, monto: cot.monto.trim(), diasEntrega: Number.parseInt(cot.diasEntrega, 10) || 0, nota: cot.nota.trim() },
      });
      toast.success(r.mensaje);
      alCerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Agregar cotización"
      descripcion={`${oc.numero} · ${oc.descripcion}`}
      pie={
        <>
          <Boton variante="ghost" onClick={alCerrar} disabled={agregar.isPending}>
            Cancelar
          </Boton>
          <Boton disabled={!cot.proveedorId} onClick={confirmar} cargando={agregar.isPending}>
            Agregar
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Proveedor" className="sm:col-span-2" htmlFor="ct-prov" error={errorDe(e, 'proveedorId')}>
          <Seleccion id="ct-prov" value={cot.proveedorId} onChange={(ev) => setCot({ ...cot, proveedorId: ev.target.value })}>
            <option value="">Seleccione…</option>
            {datos.catalogos.proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Monto" htmlFor="ct-monto" error={errorDe(e, 'monto')}>
          <Entrada id="ct-monto" inputMode="decimal" className="tabular-nums" placeholder="0.00" value={cot.monto} onChange={(ev) => setCot({ ...cot, monto: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Días de entrega" htmlFor="ct-dias" error={errorDe(e, 'diasEntrega')}>
          <Entrada id="ct-dias" inputMode="numeric" value={cot.diasEntrega} onChange={(ev) => setCot({ ...cot, diasEntrega: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Nota" className="sm:col-span-2" htmlFor="ct-nota" error={errorDe(e, 'nota')}>
          <Entrada id="ct-nota" value={cot.nota} onChange={(ev) => setCot({ ...cot, nota: ev.target.value })} />
        </Campo>
      </div>
    </Modal>
  );
}

function DialogoRecepcion({ oc, alCerrar }: { oc: OrdenCompra; alCerrar: () => void }) {
  const recibir = useRecibirCompra();
  const e = recibir.error;
  const [doc, setDoc] = useState({ serie: '', numero: '' });
  async function confirmar() {
    try {
      const r = await recibir.mutateAsync({ id: oc.id, cuerpo: { serie: doc.serie.trim().toUpperCase(), numero: doc.numero.trim() } });
      toast.success(r.mensaje);
      alCerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`Recepción de ${oc.numero}`}
      pie={
        <>
          <Boton variante="ghost" onClick={alCerrar} disabled={recibir.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={recibir.isPending}>
            Registrar
          </Boton>
        </>
      }
    >
      <p className="mb-3 text-[12px] text-tenue">
        {oc.proveedor?.nombre ?? '—'} · {q(oc.monto)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Serie FEL" htmlFor="rc-serie" error={errorDe(e, 'serie')}>
          <Entrada id="rc-serie" value={doc.serie} onChange={(ev) => setDoc({ ...doc, serie: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Número FEL" htmlFor="rc-num" error={errorDe(e, 'numero')}>
          <Entrada id="rc-num" value={doc.numero} onChange={(ev) => setDoc({ ...doc, numero: ev.target.value })} />
        </Campo>
      </div>
    </Modal>
  );
}
