'use client';

import { useState, type ReactNode } from 'react';
import { useParams, useVolver } from '../lib/router';
import { Adjuntar, Aviso, Badge, Button, Card, EstadoBadge, Field, inputCls, Modal, PageHeader } from '../components/ui';
import { fecha, fechaHora, pct, q } from '../lib/format';
import {
  esAjusteContable,
  faltaComprobante,
  nivelRequerido,
  puedeAprobar,
  puedeComprobante,
  puedeEditarBorrador,
  puedePagar,
  puedeReabrir,
  tiene,
  veGasto,
} from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import type { Documento, TipoDocumento } from '../types';

const esImagen = (nombre?: string) => !!nombre && /\.(jpe?g|png|webp|gif|heic)$/i.test(nombre);

const ORIGEN: Record<string, string> = {
  manual: 'Registro manual',
  recurrente: 'Gasto recurrente',
  reporte: 'Tomado de los reportes del sistema de la estación',
  caja_chica: 'Liquidación de caja chica',
  compra: 'Compra administrativa',
};

export default function GastoDetalle() {
  const { id } = useParams();
  const { db, usuario, acciones, modo, ocupado, subirArchivo, urlArchivo } = useStore();
  const c = useCatalogos();
  const volver = useVolver();
  const g = db.gastos.find((x) => x.id === id);
  const [modal, setModal] = useState<'' | 'aprobar' | 'rechazar' | 'pagar' | 'doc' | 'eliminar'>('');
  const [comentario, setComentario] = useState('');
  const [pago, setPago] = useState({ fecha: db.config.hoy, metodo: 'Transferencia', referencia: '' });
  const [doc, setDoc] = useState<Documento>({ tipo: 'FEL', serie: '', numero: '', fechaEmision: db.config.hoy });

  if (!g || !veGasto(db, usuario, g)) {
    return (
      <div>
        <PageHeader title="Gasto no disponible" />
        <Aviso tone="amber">
          No existe en los datos simulados o su usuario no tiene acceso a ese gasto.{' '}
          <button type="button" onClick={volver} className="font-medium underline">
            Volver
          </button>
        </Aviso>
      </div>
    );
  }

  const vAprobar = puedeAprobar(db, usuario, g);
  const vPagar = puedePagar(db, usuario, g);
  const autoriza = tiene(db, usuario, 'aprobar');
  const paga = tiene(db, usuario, 'pagar');
  const puedeEditar = puedeComprobante(db, usuario, g).ok;
  const editable = puedeEditarBorrador(db, usuario, g).ok;
  const reabrible = puedeReabrir(db, usuario, g).ok;
  const urlAdjunto = g.documento.archivoId ? urlArchivo(g.documento.archivoId) : '';
  const nivel = nivelRequerido(db, g.monto);
  const autorizadores = db.usuarios.filter((u) => u.activo && puedeAprobar(db, u, g).ok);
  const historial = db.auditoria.filter((a) => a.detalle.includes(g.folio));
  const cat = c.categoria(g.categoriaId);
  const prov = c.proveedor(g.proveedorId);
  const cerrar = () => {
    setModal('');
    setComentario('');
  };
  const correr = async (p: Promise<boolean>) => {
    if (await p) cerrar();
  };
  const abrirDoc = () => {
    setDoc(
      g.documento.tipo === 'Sin documento'
        ? { tipo: 'FEL', serie: '', numero: '', fechaEmision: db.config.hoy }
        : { ...g.documento, verificado: undefined },
    );
    setModal('doc');
  };
  const subir = async (f: File) => {
    const r = await subirArchivo(f);
    if (r) setDoc((d) => ({ ...d, archivoId: r.id, archivoNombre: r.nombre }));
  };
  // En los datos simulados no hay formulario de edición (el de Registro de gastos trabaja con el backend): el gasto
  // rechazado vuelve a borrador y desde aquí se envía otra vez a autorización.
  const reabrir = () => acciones.reabrirGasto(g.id);
  const eliminar = async () => {
    if (await acciones.eliminarBorrador(g.id)) volver();
  };

  return (
    <div>
      <div className="mb-3 text-sm">
        <button type="button" onClick={volver} className="text-brand-600 hover:underline dark:text-brand-300">
          ← Volver
        </button>
      </div>
      <PageHeader
        title={`${g.folio} · ${q(g.monto)}`}
        description={g.descripcion}
        actions={
          <>
            {editable && (
              <>
                <Button variant="ghost" onClick={() => setModal('eliminar')}>
                  Eliminar
                </Button>
                <Button onClick={() => acciones.enviarGasto(g.id)}>Enviar a autorización</Button>
              </>
            )}
            {reabrible && <Button onClick={reabrir}>Volver a borrador</Button>}
            {g.estado === 'pendiente' && autoriza && (
              <>
                <Button variant="danger" disabled={!vAprobar.ok} title={vAprobar.motivo} onClick={() => setModal('rechazar')}>
                  Rechazar
                </Button>
                <Button variant="success" disabled={!vAprobar.ok} title={vAprobar.motivo} onClick={() => setModal('aprobar')}>
                  Aprobar
                </Button>
              </>
            )}
            {g.estado === 'aprobado' && !esAjusteContable(g) && paga && (
              <Button disabled={!vPagar.ok} title={vPagar.motivo} onClick={() => setModal('pagar')}>
                Registrar pago
              </Button>
            )}
          </>
        }
      />

      {g.estado === 'pendiente' && (autoriza && !vAprobar.ok ? <Aviso tone="amber">{vAprobar.motivo}</Aviso> : !autoriza && <Aviso>Pendiente de autorización: {nivel.etiqueta}.</Aviso>)}
      {g.estado === 'aprobado' && !esAjusteContable(g) && (paga ? !vPagar.ok && <Aviso tone="amber">{vPagar.motivo}</Aviso> : <Aviso>Aprobado. El pago lo registra Tesorería{faltaComprobante(db, g) ? ' cuando se adjunte el comprobante' : ''}.</Aviso>)}
      {g.estado === 'borrador' && <Aviso>Borrador: aún no entra a autorización.</Aviso>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Datos del gasto" actions={<EstadoBadge estado={g.estado} />}>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Dato k="Fecha">{fecha(g.fecha)}</Dato>
              <Dato k="Estación">
                {c.estCodigo(g.estacionId)} · {c.estacion(g.estacionId)?.nombre}
              </Dato>
              <Dato k="Centro de costo">{c.ccNombre(g.centroCostoId)}</Dato>
              <Dato k="Categoría">
                {cat?.nombre} · {g.subcategoria}
                <span className="block text-xs text-slate-500 dark:text-slate-400">Cuenta contable {cat?.cuentaContable}</span>
              </Dato>
              <Dato k="Proveedor">
                {c.provNombre(g.proveedorId)}
                {prov && <span className="block text-xs text-slate-500 dark:text-slate-400">NIT {prov.nit}</span>}
              </Dato>
              <Dato k="Forma de pago">{g.metodoPago}</Dato>
              <Dato k="Monto">
                <span className="tabular-nums">{q(g.monto)}</span>
                {g.iva > 0 && <span className="block text-xs text-slate-500 dark:text-slate-400">IVA incluido {q(g.iva)}</span>}
              </Dato>
              <Dato k="Vencimiento">{esAjusteContable(g) ? 'No aplica' : fecha(g.vencimiento)}</Dato>
              <Dato k="Origen">{ORIGEN[g.origen]}</Dato>
              <Dato k="Referencia">{g.referencia ?? '—'}</Dato>
              <Dato k="Solicitado por">{c.usrNombre(g.solicitanteId)}</Dato>
            </dl>
            {g.origen === 'reporte' && (
              <div className="mt-4">
                <Aviso tone="amber">
                  Este registro sale del análisis de los reportes del sistema de la estación. Es un ajuste contable sin factura: su soporte es el reporte
                  indicado en la referencia.
                </Aviso>
              </div>
            )}
          </Card>

          <Card
            title="Comprobante"
            actions={
              puedeEditar &&
              g.estado !== 'borrador' && (
                <Button size="sm" variant="secondary" onClick={abrirDoc}>
                  {g.documento.tipo === 'Sin documento' ? 'Adjuntar comprobante' : 'Cambiar'}
                </Button>
              )
            }
          >
            {g.documento.tipo === 'Sin documento' ? (
              faltaComprobante(db, g) ? (
                <Aviso tone="red">Falta el comprobante. Es obligatorio desde {q(db.config.comprobanteObligatorioDesde)}.</Aviso>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No requiere comprobante.</p>
              )
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {g.documento.tipo === 'FEL' ? 'Factura FEL' : 'Recibo'} {g.documento.serie && `${g.documento.serie} – `}
                    {g.documento.numero}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Emitida el {fecha(g.documento.fechaEmision)}</p>
                </div>
                {g.documento.tipo === 'FEL' &&
                  (g.documento.verificado ? (
                    <Badge tone="green">Verificada en SAT (simulado)</Badge>
                  ) : tiene(db, usuario, 'revisar') ? (
                    <Button size="sm" variant="secondary" onClick={() => acciones.verificarComprobante(g.id)}>
                      Verificar en SAT
                    </Button>
                  ) : (
                    <Badge>Sin verificar</Badge>
                  ))}
              </div>
            )}
            {g.documento.archivoId && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                {esImagen(g.documento.archivoNombre) && urlAdjunto && (
                  <img src={urlAdjunto} alt="Comprobante adjunto" className="h-20 w-20 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                )}
                <div className="min-w-0 text-sm">
                  <p className="truncate text-slate-700 dark:text-slate-200">📎 {g.documento.archivoNombre}</p>
                  {urlAdjunto && (
                    <a
                      href={urlAdjunto}
                      target="_blank"
                      rel="noreferrer"
                      download={modo === 'local' ? g.documento.archivoNombre : undefined}
                      className="text-xs font-medium text-brand-600 dark:text-brand-300 hover:underline"
                    >
                      {modo === 'local' ? 'Descargar' : 'Abrir archivo'}
                    </a>
                  )}
                </div>
              </div>
            )}
          </Card>

          {g.distribucion && (
            <Card title="Distribución entre estaciones (prorrateo)">
              <ul className="space-y-1 text-sm">
                {g.distribucion.map((d) => (
                  <li key={d.estacionId} className="flex justify-between">
                    <span>
                      {c.estCodigo(d.estacionId)} · {pct(d.pct)}
                    </span>
                    <span className="tabular-nums">{q(d.monto)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Flujo del gasto">
            <ol className="relative space-y-4 border-l border-slate-200 dark:border-slate-800 pl-4 text-sm">
              <Paso ok titulo="Solicitado">
                {c.usrNombre(g.solicitanteId)} · {fecha(g.fecha)}
              </Paso>
              <Paso
                ok={g.aprobaciones.length > 0}
                error={g.estado === 'rechazado'}
                titulo={g.estado === 'rechazado' ? 'Rechazado' : 'Autorización'}
              >
                {g.aprobaciones.length ? (
                  g.aprobaciones.map((a, i) => (
                    <span key={i} className="block">
                      {c.usrNombre(a.usuarioId)} · {fecha(a.fecha)}
                      {a.comentario && <span className="block text-xs italic text-slate-500 dark:text-slate-400">“{a.comentario}”</span>}
                    </span>
                  ))
                ) : (
                  <>
                    Requiere: {nivel.etiqueta}
                    {g.estado === 'pendiente' && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Pueden autorizar: {autorizadores.map((u) => u.nombre).join(', ') || 'nadie con los permisos actuales'}
                      </span>
                    )}
                  </>
                )}
              </Paso>
              <Paso ok={!!g.pago} titulo={esAjusteContable(g) ? 'Registro contable' : 'Pago'}>
                {g.pago
                  ? `${g.pago.metodo} ${g.pago.referencia} · ${fecha(g.pago.fecha)} · ${c.usrNombre(g.pago.usuarioId)}`
                  : esAjusteContable(g)
                    ? 'No genera pago; se registra como gasto al aprobarse'
                    : g.estado === 'aprobado'
                      ? `Pendiente, vence ${fecha(g.vencimiento)}`
                      : 'Pendiente'}
              </Paso>
            </ol>
          </Card>

          <Card title="Historial" subtitle="Bitácora de auditoría de este folio">
            <ul className="space-y-2 text-sm">
              {historial.map((a) => (
                <li key={a.id}>
                  <p className="text-slate-700 dark:text-slate-200">
                    <span className="font-medium">{c.usrNombre(a.usuarioId)}</span> · {a.accion.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{fechaHora(a.fecha)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={modal === 'aprobar' || modal === 'rechazar'}
        onClose={cerrar}
        title={modal === 'aprobar' ? `Aprobar ${g.folio}` : `Rechazar ${g.folio}`}
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            {modal === 'aprobar' ? (
              <Button variant="success" disabled={ocupado} onClick={() => correr(acciones.aprobarGasto(g.id, comentario.trim()))}>
                Aprobar {q(g.monto)}
              </Button>
            ) : (
              <Button variant="danger" disabled={ocupado} onClick={() => correr(acciones.rechazarGasto(g.id, comentario))}>
                Rechazar
              </Button>
            )}
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{g.descripcion}</p>
        <Field label={modal === 'aprobar' ? 'Comentario (opcional)' : 'Motivo del rechazo'}>
          <textarea className={inputCls} rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={modal === 'pagar'}
        onClose={cerrar}
        title={`Registrar pago de ${g.folio}`}
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button disabled={ocupado} onClick={() => correr(acciones.pagarGasto(g.id, pago))}>
              Registrar pago
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha de pago">
            <input type="date" className={inputCls} value={pago.fecha} max={db.config.hoy} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} />
          </Field>
          <Field label="Método">
            <select className={inputCls} value={pago.metodo} onChange={(e) => setPago({ ...pago, metodo: e.target.value })}>
              {['Transferencia', 'Cheque', 'Efectivo', 'Débito bancario', 'Tarjeta corporativa'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Referencia" className="sm:col-span-2" hint="Número de transferencia, cheque o recibo de caja">
            <input className={inputCls} value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} />
          </Field>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Monto: <span className="tabular-nums font-semibold">{q(g.monto)}</span> a {c.provNombre(g.proveedorId)}
        </p>
      </Modal>

      <Modal
        open={modal === 'doc'}
        onClose={cerrar}
        title="Comprobante del gasto"
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button disabled={ocupado} onClick={() => correr(acciones.registrarComprobante(g.id, doc))}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select className={inputCls} value={doc.tipo} onChange={(e) => setDoc({ ...doc, tipo: e.target.value as TipoDocumento })}>
              <option value="FEL">Factura FEL</option>
              <option value="Recibo">Recibo</option>
            </select>
          </Field>
          <Field label="Fecha de emisión">
            <input type="date" className={inputCls} value={doc.fechaEmision} onChange={(e) => setDoc({ ...doc, fechaEmision: e.target.value })} />
          </Field>
          {doc.tipo === 'FEL' && (
            <Field label="Serie">
              <input className={inputCls} value={doc.serie} onChange={(e) => setDoc({ ...doc, serie: e.target.value.toUpperCase() })} />
            </Field>
          )}
          <Field label="Número">
            <input className={inputCls} value={doc.numero} onChange={(e) => setDoc({ ...doc, numero: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Foto o PDF del comprobante</p>
          <Adjuntar
            nombre={doc.archivoNombre}
            ocupado={ocupado}
            onSubir={subir}
            onQuitar={() => setDoc({ ...doc, archivoId: undefined, archivoNombre: undefined })}
          />
        </div>
      </Modal>

      <Modal
        open={modal === 'eliminar'}
        onClose={cerrar}
        title={`Eliminar borrador ${g.folio}`}
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={eliminar}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">El borrador se borra y queda constancia en la bitácora. Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
}

function Dato({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function Paso({ ok, error, titulo, children }: { ok: boolean; error?: boolean; titulo: string; children: ReactNode }) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[22.5px] top-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${error ? 'bg-red-500' : ok ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
      />
      <p className="font-medium text-slate-800 dark:text-slate-100">{titulo}</p>
      <div className="text-slate-600 dark:text-slate-300">{children}</div>
    </li>
  );
}
