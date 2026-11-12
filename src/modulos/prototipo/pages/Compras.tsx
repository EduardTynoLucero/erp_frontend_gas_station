'use client';

import { useState } from 'react';
import { Link, rutaGasto } from '../lib/router';
import { Aviso, Badge, Button, Card, Empty, Field, inputCls, Modal, PageHeader, TableWrap, td, tdR, th, thR } from '../components/ui';
import { fecha, q } from '../lib/format';
import { estacionesVisibles, limiteCubre, nivelRequerido, puedeRegistrar, tiene, veEstacion } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import type { EstadoOrden } from '../types';

const ESTADO: Record<EstadoOrden, [string, 'gray' | 'amber' | 'blue' | 'green' | 'red']> = {
  requerimiento: ['Requerimiento', 'gray'],
  cotizando: ['Cotizando', 'amber'],
  ordenada: ['Orden emitida', 'blue'],
  recibida: ['Recibida', 'green'],
  cancelada: ['Cancelada', 'red'],
};

const PASOS: EstadoOrden[] = ['requerimiento', 'cotizando', 'ordenada', 'recibida'];

export default function Compras() {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const ordenes = db.ordenesCompra.filter((o) => veEstacion(db, usuario, o.estacionId) && (estacionFiltro === 'ALL' || o.estacionId === estacionFiltro));
  const [sel, setSel] = useState(ordenes[0]?.id ?? '');
  const [modal, setModal] = useState<'' | 'nuevo' | 'cot' | 'recibir'>('');
  const estaciones = estacionesVisibles(db, usuario).filter((e) => puedeRegistrar(db, usuario, e.id).ok);
  const centroDe = (estacionId: string) => {
    const cs = db.centrosCosto.filter((x) => x.estacionId === estacionId && x.activo);
    return (cs.find((x) => x.unidad === 'ADMIN') ?? cs[0])?.id ?? '';
  };
  const [req, setReq] = useState({ estacionId: estaciones[0]?.id ?? '', centroCostoId: centroDe(estaciones[0]?.id ?? ''), categoriaId: 'MNT', descripcion: '' });
  const [cot, setCot] = useState({ proveedorId: '', monto: '', diasEntrega: '5', nota: '' });
  const [doc, setDoc] = useState({ serie: '', numero: '' });
  const oc = ordenes.find((o) => o.id === sel) ?? ordenes[0];
  const registraAqui = !!oc && puedeRegistrar(db, usuario, oc.estacionId).ok;
  const puedeCancelar = !!oc && (oc.solicitanteId === usuario.id || (tiene(db, usuario, 'aprobar') && veEstacion(db, usuario, oc.estacionId)));

  const crear = async () => {
    const id = await acciones.crearRequerimiento({
      estacionId: req.estacionId,
      categoriaId: req.categoriaId,
      descripcion: req.descripcion,
      centroCostoId: req.centroCostoId,
    });
    if (id) {
      setModal('');
      setReq({ ...req, descripcion: '' });
      setSel(id);
    }
  };
  const agregar = async () => {
    if (!oc) return;
    const ok = await acciones.agregarCotizacion(oc.id, {
      proveedorId: cot.proveedorId,
      monto: Number(cot.monto),
      diasEntrega: Number(cot.diasEntrega) || 0,
      nota: cot.nota.trim(),
    });
    if (ok) {
      setModal('');
      setCot({ proveedorId: '', monto: '', diasEntrega: '5', nota: '' });
    }
  };
  const recibir = async () => {
    if (!oc) return;
    const ok = await acciones.recibirOrden(oc.id, { tipo: 'FEL', serie: doc.serie.trim().toUpperCase(), numero: doc.numero.trim(), fechaEmision: db.config.hoy });
    if (ok) setModal('');
  };

  return (
    <div>
      <PageHeader
        title="Compras administrativas"
        description="Requerimiento, cotizaciones, orden de compra y recepción. Al recibir, la factura del proveedor se convierte en un gasto aprobado que pasa a cuentas por pagar."
        actions={
          estaciones.length > 0 && (
            <Button onClick={() => setModal('nuevo')}>+ Nuevo requerimiento</Button>
          )
        }
      />
      {ordenes.length === 0 ? (
        <Empty>No hay compras en las estaciones que puede ver.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            {ordenes.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSel(o.id)}
                className={`w-full rounded-xl border bg-white dark:bg-slate-900 p-3 text-left shadow-sm ${oc?.id === o.id ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {o.id} · {c.estCodigo(o.estacionId)}
                  </span>
                  <Badge tone={ESTADO[o.estado][1]}>{ESTADO[o.estado][0]}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{o.descripcion}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {fecha(o.fecha)} · {o.monto ? q(o.monto) : `${o.cotizaciones.length} cotizaciones`}
                </p>
              </button>
            ))}
          </div>

          {oc && (
            <Card className="lg:col-span-3" title={`${oc.id} · ${oc.descripcion}`} subtitle={`${c.estacion(oc.estacionId)?.nombre} · ${c.catNombre(oc.categoriaId)} · solicitó ${c.usrNombre(oc.solicitanteId)}`}>
              <ol className="mb-4 grid grid-cols-4 gap-1 text-center text-xs">
                {PASOS.map((p, i) => {
                  const hecho = oc.estado !== 'cancelada' && PASOS.indexOf(oc.estado) >= i;
                  return (
                    <li key={p} className={`rounded-md px-1 py-1.5 ${hecho ? 'bg-brand-50 dark:bg-brand-500/15 font-medium text-brand-700 dark:text-brand-300' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500'}`}>
                      {ESTADO[p][0]}
                    </li>
                  );
                })}
              </ol>

              {oc.estado === 'cancelada' && <Aviso tone="red">Compra cancelada.</Aviso>}

              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cotizaciones</p>
                {(oc.estado === 'requerimiento' || oc.estado === 'cotizando') && registraAqui && (
                  <Button size="sm" variant="secondary" onClick={() => setModal('cot')}>
                    + Cotización
                  </Button>
                )}
              </div>
              {oc.cotizaciones.length === 0 ? (
                <Empty>Aún no hay cotizaciones.</Empty>
              ) : (
                <TableWrap minWidth={520}>
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className={th}>Proveedor</th>
                      <th className={thR}>Entrega</th>
                      <th className={thR}>Monto</th>
                      <th className={thR}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {oc.cotizaciones.map((k, i) => {
                      const min = Math.min(...oc.cotizaciones.map((x) => x.monto));
                      const elegida = oc.proveedorId === k.proveedorId && oc.monto === k.monto;
                      return (
                        <tr key={i} className={elegida ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}>
                          <td className={td}>
                            <p>{c.provNombre(k.proveedorId)}</p>
                            {k.nota && <p className="text-xs text-slate-500 dark:text-slate-400">{k.nota}</p>}
                          </td>
                          <td className={tdR}>{k.diasEntrega} días</td>
                          <td className={tdR}>
                            {q(k.monto)} {k.monto === min && oc.cotizaciones.length > 1 && <Badge tone="green">Menor</Badge>}
                          </td>
                          <td className={tdR}>
                            {oc.estado === 'cotizando' ? (
                              limiteCubre(db, usuario, k.monto) && oc.solicitanteId !== usuario.id ? (
                                <Button size="sm" onClick={() => acciones.emitirOrden(oc.id, i)}>
                                  Emitir orden
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400">Autoriza: {nivelRequerido(db, k.monto).etiqueta}</span>
                              )
                            ) : (
                              elegida && <Badge tone="green">Elegida</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrap>
              )}
              {oc.estado === 'cotizando' && oc.cotizaciones.length < 2 && (
                <div className="mt-3">
                  <Aviso tone="amber">Política sugerida: pedir al menos dos cotizaciones antes de emitir la orden.</Aviso>
                </div>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {oc.estado !== 'recibida' && oc.estado !== 'cancelada' && puedeCancelar && (
                  <Button variant="ghost" onClick={() => acciones.cancelarOrden(oc.id)}>
                    Cancelar compra
                  </Button>
                )}
                {oc.estado === 'ordenada' && registraAqui && (
                  <Button
                    onClick={() => {
                      setDoc({ serie: '', numero: '' });
                      setModal('recibir');
                    }}
                  >
                    Registrar recepción y factura
                  </Button>
                )}
                {oc.estado === 'recibida' && oc.gastoId && (
                  <Link to={rutaGasto(oc.gastoId)} className="text-sm font-medium text-brand-600 dark:text-brand-300 hover:underline">
                    Ver gasto generado →
                  </Link>
                )}
              </div>
              {oc.fechaOrden && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Orden emitida el {fecha(oc.fechaOrden)}
                  {oc.aprobadorId && ` por ${c.usrNombre(oc.aprobadorId)}`}
                  {oc.fechaRecepcion && ` · recibida el ${fecha(oc.fechaRecepcion)}`}
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      <Modal
        open={modal === 'nuevo'}
        onClose={() => setModal('')}
        title="Nuevo requerimiento de compra"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal('')}>
              Cancelar
            </Button>
            <Button onClick={crear}>
              Crear
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estación">
            <select className={inputCls} value={req.estacionId} onChange={(e) => setReq({ ...req, estacionId: e.target.value, centroCostoId: centroDe(e.target.value) })}>
              {estaciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo} · {e.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoría">
            <select className={inputCls} value={req.categoriaId} onChange={(e) => setReq({ ...req, categoriaId: e.target.value })}>
              {db.categorias.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Centro de costo" className="sm:col-span-2">
            <select className={inputCls} value={req.centroCostoId} onChange={(e) => setReq({ ...req, centroCostoId: e.target.value })}>
              {db.centrosCosto
                .filter((x) => x.estacionId === req.estacionId && x.activo)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="¿Qué se necesita?" className="sm:col-span-2">
            <textarea className={inputCls} rows={3} value={req.descripcion} onChange={(e) => setReq({ ...req, descripcion: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={modal === 'cot'}
        onClose={() => setModal('')}
        title="Agregar cotización"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal('')}>
              Cancelar
            </Button>
            <Button disabled={!cot.proveedorId} onClick={agregar}>
              Agregar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Proveedor" className="sm:col-span-2">
            <select className={inputCls} value={cot.proveedorId} onChange={(e) => setCot({ ...cot, proveedorId: e.target.value })}>
              <option value="">Seleccione…</option>
              {db.proveedores
                .filter((p) => p.activo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Monto">
            <input type="number" className={`${inputCls} tabular-nums`} value={cot.monto} onChange={(e) => setCot({ ...cot, monto: e.target.value })} />
          </Field>
          <Field label="Días de entrega">
            <input type="number" className={inputCls} value={cot.diasEntrega} onChange={(e) => setCot({ ...cot, diasEntrega: e.target.value })} />
          </Field>
          <Field label="Nota" className="sm:col-span-2">
            <input className={inputCls} value={cot.nota} onChange={(e) => setCot({ ...cot, nota: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={modal === 'recibir'}
        onClose={() => setModal('')}
        title={`Recepción de ${oc?.id ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal('')}>
              Cancelar
            </Button>
            <Button onClick={recibir}>
              Registrar
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {oc && `${c.provNombre(oc.proveedorId)} · ${q(oc.monto ?? 0)}`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Serie FEL">
            <input className={inputCls} value={doc.serie} onChange={(e) => setDoc({ ...doc, serie: e.target.value })} />
          </Field>
          <Field label="Número FEL">
            <input className={inputCls} value={doc.numero} onChange={(e) => setDoc({ ...doc, numero: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
