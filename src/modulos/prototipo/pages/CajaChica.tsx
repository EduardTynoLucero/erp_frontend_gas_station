'use client';

import { useState } from 'react';
import { Aviso, Badge, Button, Card, cx, Empty, Field, inputCls, Modal, PageHeader, ProgressBar, TableWrap, td, tdR, th, thR } from '../components/ui';
import { fecha, q, sumar } from '../lib/format';
import { puedeOperarCaja, tiene, veEstacion } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { estadoCaja } from '../lib/selectors';
import type { MovimientoCaja } from '../types';

export default function CajaChica() {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const cajas = db.cajasChicas.filter((x) => veEstacion(db, usuario, x.estacionId) && (estacionFiltro === 'ALL' || x.estacionId === estacionFiltro));
  const [sel, setSel] = useState(cajas[0]?.id ?? '');
  const [modal, setModal] = useState(false);
  const [mov, setMov] = useState({ fecha: db.config.hoy, descripcion: '', monto: '', categoriaId: 'ADM', comprobante: '' });
  const actual = cajas.find((x) => x.id === sel) ?? cajas[0];
  const opera = tiene(db, usuario, 'caja_chica');
  const registrar = async () => {
    if (!actual) return;
    const ok = await acciones.desembolsoCaja(actual.id, {
      fecha: mov.fecha,
      descripcion: mov.descripcion.trim(),
      monto: Number(mov.monto),
      categoriaId: mov.categoriaId,
      comprobante: mov.comprobante.trim(),
    });
    if (ok) setModal(false);
  };

  const estadoMov = (m: MovimientoCaja) => {
    if (m.tipo === 'apertura') return <Badge>Apertura</Badge>;
    if (!m.liquidacionId) return <Badge tone="amber">Por liquidar</Badge>;
    const gs = db.gastos.filter((g) => g.referencia === m.liquidacionId);
    return gs.every((g) => g.estado === 'pagado') ? <Badge tone="green">Repuesto</Badge> : <Badge tone="blue">En reposición</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="Caja chica"
        description={`Fondo fijo por estación. Tope por desembolso ${q(db.config.limiteDesembolsoCaja)}; comprobante obligatorio desde ${q(
          db.config.comprobanteObligatorioDesde,
        )}. Al liquidar, los desembolsos pasan a autorización y el fondo se repone cuando se paga.`}
      />

      {cajas.length === 0 ? (
        <Empty>No hay cajas chicas en las estaciones que puede ver.</Empty>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {cajas.map((caja) => {
              const ec = estadoCaja(db, caja);
              return (
                <button
                  key={caja.id}
                  type="button"
                  onClick={() => setSel(caja.id)}
                  className={`rounded-xl border bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition ${actual?.id === caja.id ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {caja.id} · {c.estCodigo(caja.estacionId)}
                    </p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{c.usrNombre(caja.responsableId)}</span>
                  </div>
                  <p className="tabular-nums mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{q(ec.saldo)}</p>
                  <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">saldo de un fondo de {q(caja.fondo)}</p>
                  <ProgressBar pct={ec.usoPct} warnAt={70} />
                  <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Por liquidar: {q(sumar(ec.porLiquidar, (m) => m.monto))}</span>
                    <span>En reposición: {q(ec.enReposicion)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {actual && (
            <Card
              className="mt-4"
              title={`Movimientos de ${actual.id} · ${c.estacion(actual.estacionId)?.nombre}`}
              actions={
                opera && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={!puedeOperarCaja(db, usuario, actual.estacionId).ok}
                      title={puedeOperarCaja(db, usuario, actual.estacionId).motivo}
                      onClick={() => acciones.liquidarCaja(actual.id)}
                    >
                      Liquidar y pedir reposición
                    </Button>
                    <Button
                      disabled={!puedeOperarCaja(db, usuario, actual.estacionId).ok}
                      title={puedeOperarCaja(db, usuario, actual.estacionId).motivo}
                      onClick={() => {
                        setMov({ fecha: db.config.hoy, descripcion: '', monto: '', categoriaId: 'ADM', comprobante: '' });
                        setModal(true);
                      }}
                    >
                      + Desembolso
                    </Button>
                  </>
                )
              }
            >
              {!opera && (
                <div className="mb-3">
                  <Aviso>Solo consulta: los desembolsos y la liquidación los registra el encargado de caja chica. La reposición la autoriza el gerente y la paga Tesorería.</Aviso>
                </div>
              )}
              <TableWrap minWidth={720}>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className={th}>Fecha</th>
                    <th className={th}>Descripción</th>
                    <th className={th}>Categoría</th>
                    <th className={th}>Comprobante</th>
                    <th className={th}>Estado</th>
                    <th className={thR}>Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...actual.movimientos].reverse().map((m) => (
                    <tr key={m.id}>
                      <td className={cx(td, `whitespace-nowrap`)}>{fecha(m.fecha)}</td>
                      <td className={td}>{m.descripcion}</td>
                      <td className={td}>{m.categoriaId ? c.catNombre(m.categoriaId) : '—'}</td>
                      <td className={td}>{m.comprobante || <span className="text-xs text-slate-400 dark:text-slate-500">Sin comprobante</span>}</td>
                      <td className={td}>{estadoMov(m)}</td>
                      <td className={cx(tdR, `${m.tipo === 'apertura' ? 'text-emerald-700 dark:text-emerald-400' : ''}`)}>
                        {m.tipo === 'apertura' ? '+' : '−'}
                        {q(m.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>
          )}
        </>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={`Desembolso de ${actual?.id ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={registrar}>
              Registrar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <input type="date" className={inputCls} value={mov.fecha} max={db.config.hoy} onChange={(e) => setMov({ ...mov, fecha: e.target.value })} />
          </Field>
          <Field label="Monto">
            <input type="number" className={`${inputCls} tabular-nums`} value={mov.monto} onChange={(e) => setMov({ ...mov, monto: e.target.value })} />
          </Field>
          <Field label="Descripción" className="sm:col-span-2">
            <input className={inputCls} value={mov.descripcion} onChange={(e) => setMov({ ...mov, descripcion: e.target.value })} />
          </Field>
          <Field label="Categoría">
            <select className={inputCls} value={mov.categoriaId} onChange={(e) => setMov({ ...mov, categoriaId: e.target.value })}>
              {db.categorias.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Comprobante">
            <input className={inputCls} value={mov.comprobante} onChange={(e) => setMov({ ...mov, comprobante: e.target.value })} placeholder="FEL o recibo" />
          </Field>
        </div>
        <div className="mt-3">
          <Aviso>
            Tope {q(db.config.limiteDesembolsoCaja)} por desembolso. Desde {q(db.config.comprobanteObligatorioDesde)} se exige comprobante.
          </Aviso>
        </div>
      </Modal>
    </div>
  );
}
